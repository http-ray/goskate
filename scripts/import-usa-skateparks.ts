// ============================================================
// USA Skatepark Import (OpenStreetMap / Overpass → Supabase)
//
// Fetches every skatepark tagged in OpenStreetMap across all 50
// states + DC and caches them in the Supabase spots table.
//
// Why OSM instead of Google Places:
//   - Free: no API key, no billing, no quota
//   - Comprehensive: OSM has strong `leisure=skate_park` coverage
//   - One pass covers the whole country
//
// Usage:
//   npx tsx scripts/import-usa-skateparks.ts --dry-run   # preview only
//   npx tsx scripts/import-usa-skateparks.ts             # import all states
//   npx tsx scripts/import-usa-skateparks.ts --state CA  # one state
//
// What it does:
//   1. For each state, queries Overpass for skateparks inside that
//      state's boundary (via ISO3166-2 area).
//   2. Labels each spot with area_text = "City, ST" (city from the
//      OSM addr:city tag when present, else just the state code) so
//      the Spots-in-View panel can group by state → city.
//   3. Dedupes:
//        - by osm_id (unique key in the spots table)
//        - by proximity to any EXISTING spot (~130 m) so parks already
//          imported (e.g. the California/Georgia Google imports) are
//          never doubled up.
//   4. Upserts with ignoreDuplicates so re-running is always safe.
//
// Required env vars in .env.local:
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
// ============================================================

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { STATE_NAMES } from "../lib/usStates";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing required env vars in .env.local:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL");
  console.error("   NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

const DELAY_BETWEEN_STATES_MS = 2500;
const DEDUPE_RADIUS_M = 130;

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string | undefined>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

interface SpotRow {
  display_name: string;
  type: "skatepark";
  source: "official";
  latitude: number;
  longitude: number;
  osm_name: string | null;
  osm_id: string;
  needs_review: boolean;
  area_text: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- Proximity helpers (dedupe against existing spots) ----

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// A spatial grid of existing spot coordinates (~1.1 km cells) so proximity
// checks stay fast even with thousands of existing spots.
class SpotGrid {
  private cells = new Map<string, Array<[number, number]>>();
  private readonly cell = 0.01; // degrees (~1.1 km)

  private key(lat: number, lng: number): string {
    return `${Math.round(lat / this.cell)}_${Math.round(lng / this.cell)}`;
  }

  add(lat: number, lng: number): void {
    const k = this.key(lat, lng);
    const list = this.cells.get(k) ?? [];
    list.push([lat, lng]);
    this.cells.set(k, list);
  }

  hasNearby(lat: number, lng: number, radiusM: number): boolean {
    const cLat = Math.round(lat / this.cell);
    const cLng = Math.round(lng / this.cell);
    for (let dLat = -1; dLat <= 1; dLat++) {
      for (let dLng = -1; dLng <= 1; dLng++) {
        const list = this.cells.get(`${cLat + dLat}_${cLng + dLng}`);
        if (!list) continue;
        for (const [eLat, eLng] of list) {
          if (haversineMeters(lat, lng, eLat, eLng) <= radiusM) return true;
        }
      }
    }
    return false;
  }
}

async function loadExistingSpotGrid(): Promise<SpotGrid> {
  const grid = new SpotGrid();
  const PAGE = 1000;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("spots")
      .select("latitude, longitude")
      .range(offset, offset + PAGE - 1);

    if (error) throw new Error(`Failed to load existing spots: ${error.message}`);

    const rows = data ?? [];
    for (const r of rows) {
      if (typeof r.latitude === "number" && typeof r.longitude === "number") {
        grid.add(r.latitude, r.longitude);
      }
    }

    if (rows.length < PAGE) break;
    offset += PAGE;
  }

  return grid;
}

// ---- Overpass query per state ----

function buildQuery(stateCode: string): string {
  return `
    [out:json][timeout:180];
    area["ISO3166-2"="US-${stateCode}"][admin_level=4]->.a;
    (
      nwr["leisure"="skate_park"](area.a);
      nwr["leisure"="pitch"]["sport"="skateboard"](area.a);
    );
    out center tags;
  `;
}

async function fetchStateSkateparks(
  stateCode: string
): Promise<{ ok: boolean; elements: OverpassElement[]; error?: string }> {
  const query = buildQuery(stateCode);

  for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
    const url = OVERPASS_ENDPOINTS[i];
    if (i > 0) await sleep(2000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(190_000),
      });

      if (response.status === 429) {
        console.warn(`    ⚠️  Rate limited on ${url}, trying next endpoint...`);
        continue;
      }
      if (!response.ok) {
        const text = await response.text();
        return { ok: false, elements: [], error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
      }

      const data: OverpassResponse = await response.json();
      return { ok: true, elements: data.elements ?? [] };
    } catch (err) {
      console.warn(`    ⚠️  ${url} failed: ${(err as Error).message}`);
    }
  }

  return { ok: false, elements: [], error: "All Overpass endpoints failed" };
}

function elementToRow(el: OverpassElement, stateCode: string): SpotRow | null {
  const lat = el.type === "node" ? el.lat : el.center?.lat;
  const lng = el.type === "node" ? el.lon : el.center?.lon;
  if (lat === undefined || lng === undefined) return null;

  const tags = el.tags ?? {};
  const name = tags.name?.trim() || null;
  const city = tags["addr:city"]?.trim();

  const displayName = name || (city ? `Skatepark in ${city}` : "Unnamed Skatepark");
  const areaText = city ? `${city}, ${stateCode}` : stateCode;

  return {
    display_name: displayName,
    type: "skatepark",
    source: "official",
    latitude: lat,
    longitude: lng,
    osm_name: name,
    osm_id: `osm/${el.type}/${el.id}`,
    needs_review: !name,
    area_text: areaText,
  };
}

async function upsertSpots(rows: SpotRow[]): Promise<{ inserted: number; skipped: number }> {
  if (rows.length === 0) return { inserted: 0, skipped: 0 };

  const BATCH = 50;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("spots")
      .upsert(batch, { onConflict: "osm_id", ignoreDuplicates: true })
      .select("id");

    if (error) {
      console.error(`  ❌ Batch ${Math.floor(i / BATCH) + 1} failed: ${error.message}`);
      skipped += batch.length;
    } else {
      const n = data?.length ?? 0;
      inserted += n;
      skipped += batch.length - n;
    }
  }

  return { inserted, skipped };
}

// ---- CLI ----

function getFlag(name: string): string | undefined {
  const args = process.argv.slice(2);
  const i = args.findIndex((a) => a === name);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`${name}=`));
  return eq?.split("=").slice(1).join("=");
}

async function main() {
  const dryRun = process.argv.slice(2).includes("--dry-run");
  const oneState = getFlag("--state")?.toUpperCase();

  const stateCodes = oneState ? [oneState] : Object.keys(STATE_NAMES);
  if (oneState && !STATE_NAMES[oneState]) {
    console.error(`❌ Unknown state code: ${oneState}`);
    process.exit(1);
  }

  console.log("🛹 GoSkate — USA Skatepark Import (OpenStreetMap)");
  console.log("=".repeat(58));
  if (dryRun) console.log("⚠️  DRY RUN — nothing will be written to Supabase");
  console.log(`States to query: ${stateCodes.length}`);
  console.log();

  console.log("Loading existing spots for proximity de-duplication...");
  const existingGrid = await loadExistingSpotGrid();
  console.log("Done.\n");

  const seenOsmIds = new Set<string>();
  const rowsToInsert: SpotRow[] = [];
  let totalRaw = 0;
  let skippedNearby = 0;
  const failedStates: string[] = [];

  for (let i = 0; i < stateCodes.length; i++) {
    const code = stateCodes[i];
    console.log(`[${i + 1}/${stateCodes.length}] ${STATE_NAMES[code]} (${code})`);

    const result = await fetchStateSkateparks(code);
    if (!result.ok) {
      console.error(`    ❌ ${result.error}`);
      failedStates.push(code);
    } else {
      totalRaw += result.elements.length;
      let newForState = 0;

      for (const el of result.elements) {
        const row = elementToRow(el, code);
        if (!row) continue;
        if (seenOsmIds.has(row.osm_id)) continue;
        seenOsmIds.add(row.osm_id);

        // Skip if a spot already exists at (nearly) this location.
        if (existingGrid.hasNearby(row.latitude, row.longitude, DEDUPE_RADIUS_M)) {
          skippedNearby++;
          continue;
        }

        // Add to the grid so two OSM parks at the same spot don't both import.
        existingGrid.add(row.latitude, row.longitude);
        rowsToInsert.push(row);
        newForState++;
      }

      console.log(`    ${result.elements.length} found → ${newForState} new`);
    }

    if (i < stateCodes.length - 1) await sleep(DELAY_BETWEEN_STATES_MS);
  }

  console.log();
  console.log("=".repeat(58));
  console.log(`Raw elements fetched:        ${totalRaw}`);
  console.log(`Skipped (near existing spot): ${skippedNearby}`);
  console.log(`New unique parks to insert:   ${rowsToInsert.length}`);
  console.log(`Needs review (no name):       ${rowsToInsert.filter((r) => r.needs_review).length}`);
  if (failedStates.length) console.log(`Failed states:                ${failedStates.join(", ")}`);
  console.log();

  if (dryRun) {
    console.log("DRY RUN — no rows written. Re-run without --dry-run to import.");
    return;
  }

  if (rowsToInsert.length === 0) {
    console.log("Nothing new to insert.");
    return;
  }

  console.log("Upserting to Supabase...");
  const stats = await upsertSpots(rowsToInsert);
  console.log(`  ✅ Inserted: ${stats.inserted}`);
  console.log(`  ♻️  Skipped (already in Supabase): ${stats.skipped}`);
  console.log();
  console.log("🎉 USA import complete! Re-run any time — existing rows are skipped.");
  if (failedStates.length) {
    console.log(`Retry failed states, e.g.: npx tsx scripts/import-usa-skateparks.ts --state ${failedStates[0]}`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
