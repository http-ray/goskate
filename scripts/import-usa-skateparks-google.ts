// ============================================================
// USA Skatepark Import — Google Places, Two-Pass (→ Supabase)
//
// Replicates the pattern already proven out for Georgia
// (import-georgia-skateparks.ts city pass → import-georgia-wide.ts
// grid pass) but nationally, in one script with two passes.
//
// Usage:
//   npx tsx scripts/import-usa-skateparks-google.ts --dry-run
//   npx tsx scripts/import-usa-skateparks-google.ts --pass city
//   npx tsx scripts/import-usa-skateparks-google.ts --pass grid
//   npx tsx scripts/import-usa-skateparks-google.ts            (both passes)
//   npx tsx scripts/import-usa-skateparks-google.ts --state GA
//   npx tsx scripts/import-usa-skateparks-google.ts --tile-size 2.0
//
// Pass 1 — City-targeted:
//   One Text Search per city in the embedded US_CITIES dataset
//   (scripts/data/usCities.ts), e.g. "skatepark in Atlanta, GA".
//   Cheap, high hit-rate — most skateparks are in population centers.
//
// Pass 2 — Grid sweep:
//   Tiles every state's bounding box (lib/usStates.ts STATE_BBOXES)
//   at --tile-size degrees (default 2.5°) and searches 3 terms per
//   tile: "skatepark", "skate park", "skateboard park". Catches
//   small towns and gaps between cities that Pass 1 misses.
//
// Dedup:
//   - By osm_id ("google_place/<placeId>") — matches the convention
//     used by every existing Google-based import script.
//   - By proximity (~130m) to ANY existing spot in Supabase, so a
//     park already found via the free OSM import, or the earlier
//     CA/GA Google imports, is never duplicated.
//
// Cost:
//   Text Search Pro is $32/1,000 requests with 5,000 free/month
//   (as of the Google Maps Platform pricing page). A full national
//   run is estimated in the low thousands of requests — the final
//   summary below reports the actual count so you can check it
//   against your GCP billing console.
//
// Required env vars in .env.local:
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
//   GOOGLE_MAPS_API_KEY   (same var name the existing CA/GA scripts use)
// ============================================================

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { US_CITIES } from "./data/usCities";
import { STATE_NAMES, STATE_BBOXES } from "../lib/usStates";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

if (!supabaseUrl || !supabaseKey || !googleMapsApiKey) {
  console.error("❌ Missing required env vars in .env.local:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL");
  console.error("   NEXT_PUBLIC_SUPABASE_ANON_KEY");
  console.error("   GOOGLE_MAPS_API_KEY");
  process.exit(1);
}

const googlePlacesApiKey: string = googleMapsApiKey;
const supabase = createClient(supabaseUrl, supabaseKey);

const GOOGLE_PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

const DELAY_BETWEEN_TARGETS_MS = 2500;
const DELAY_BETWEEN_PAGES_MS = 2000;
const MAX_PAGES_PER_SEARCH = 3;
const PAGE_SIZE = 20;
const DEDUPE_RADIUS_M = 130;
const DEFAULT_TILE_SIZE_DEG = 2.5;

const GRID_SEARCH_TERMS = ["skatepark", "skate park", "skateboard park"] as const;

// ---- Types ----

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  formattedAddress?: string;
  types?: string[];
}

interface GooglePlacesResponse {
  places?: GooglePlace[];
  nextPageToken?: string;
}

interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface SearchTarget {
  label: string;
  textQuery: string;
  bbox?: BBox;
  // Area label to apply directly (city pass); undefined for the grid
  // pass, where it's derived per-result from formattedAddress instead.
  areaText?: string;
  stateCode: string;
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

// ---- Helpers ----

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSkateparkPlace(place: GooglePlace): boolean {
  const name = (place.displayName?.text ?? "").toLowerCase();
  const types = place.types ?? [];
  return types.includes("skate_park") || name.includes("skate");
}

// Best-effort city extraction from a Google formattedAddress, e.g.
// "123 Main St, Springfield, IL 62701, USA" -> "Springfield".
// Looks for the segment right before "<STATE> <ZIP>". Falls back to
// undefined (caller uses just the state code) if it can't find one.
function deriveCityFromAddress(
  formattedAddress: string | undefined,
  stateCode: string
): string | undefined {
  if (!formattedAddress) return undefined;
  const parts = formattedAddress.split(",").map((p) => p.trim());
  const stateZipIndex = parts.findIndex((p) =>
    new RegExp(`\\b${stateCode}\\b`).test(p)
  );
  if (stateZipIndex > 0) return parts[stateZipIndex - 1] || undefined;
  return undefined;
}

// ---- Proximity dedup grid (avoid re-importing existing spots) ----

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

// ---- Google Places Text Search ----

interface FetchResult {
  ok: boolean;
  places: GooglePlace[];
  requests: number;
  error?: string;
}

async function fetchTargetPlaces(target: SearchTarget): Promise<FetchResult> {
  const places: GooglePlace[] = [];
  let nextPageToken: string | undefined;
  let requests = 0;

  for (let page = 1; page <= MAX_PAGES_PER_SEARCH; page++) {
    if (page > 1 && !nextPageToken) break;
    if (page > 1) await sleep(DELAY_BETWEEN_PAGES_MS);

    const body: Record<string, unknown> = {
      textQuery: target.textQuery,
      pageSize: PAGE_SIZE,
    };
    if (target.bbox) {
      body.locationRestriction = {
        rectangle: {
          low: { latitude: target.bbox.south, longitude: target.bbox.west },
          high: { latitude: target.bbox.north, longitude: target.bbox.east },
        },
      };
    }
    if (nextPageToken) body.pageToken = nextPageToken;

    try {
      requests++;
      const response = await fetch(GOOGLE_PLACES_TEXT_SEARCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": googlePlacesApiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.location,places.formattedAddress,places.types,nextPageToken",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25_000),
      });

      if (!response.ok) {
        const text = await response.text();
        return { ok: false, places, requests, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
      }

      const data: GooglePlacesResponse = await response.json();
      places.push(...(data.places ?? []));
      nextPageToken = data.nextPageToken;
    } catch (err) {
      return { ok: false, places, requests, error: (err as Error).message };
    }
  }

  return { ok: true, places, requests };
}

// ---- Pass target builders ----

function buildCityTargets(stateFilter?: string): SearchTarget[] {
  const cities = stateFilter
    ? US_CITIES.filter((c) => c.state === stateFilter)
    : US_CITIES;

  return cities.map((c) => ({
    label: `${c.name}, ${c.state}`,
    textQuery: `skatepark in ${c.name}, ${c.state}`,
    areaText: `${c.name}, ${c.state}`,
    stateCode: c.state,
  }));
}

function buildGridTargets(
  tileSizeDeg: number,
  stateFilter?: string
): SearchTarget[] {
  const states = stateFilter
    ? [stateFilter]
    : Object.keys(STATE_NAMES);

  const targets: SearchTarget[] = [];

  for (const code of states) {
    const box = STATE_BBOXES[code];
    if (!box) continue;
    const [south, west, north, east] = box;

    for (let s = south; s < north; s += tileSizeDeg) {
      const n = Math.min(s + tileSizeDeg, north);
      for (let w = west; w < east; w += tileSizeDeg) {
        const e = Math.min(w + tileSizeDeg, east);

        for (const term of GRID_SEARCH_TERMS) {
          targets.push({
            label: `${code} tile [${s.toFixed(1)},${w.toFixed(1)}] "${term}"`,
            textQuery: term,
            bbox: { south: s, west: w, north: n, east: e },
            stateCode: code,
          });
        }
      }
    }
  }

  return targets;
}

// ---- Convert + upsert ----

function placeToRow(place: GooglePlace, target: SearchTarget): SpotRow | null {
  const placeId = place.id;
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;
  if (!placeId || lat === undefined || lng === undefined) return null;

  const name = place.displayName?.text?.trim() || null;
  const address = place.formattedAddress?.trim() || null;

  let displayName = "Unnamed Skatepark";
  let needsReview = true;
  if (name) {
    displayName = name;
    needsReview = false;
  } else if (address) {
    displayName = `Skatepark near ${address}`;
    needsReview = true;
  }

  const areaText =
    target.areaText ??
    (() => {
      const city = deriveCityFromAddress(place.formattedAddress, target.stateCode);
      return city ? `${city}, ${target.stateCode}` : target.stateCode;
    })();

  return {
    display_name: displayName,
    type: "skatepark",
    source: "official",
    latitude: lat,
    longitude: lng,
    osm_name: name,
    osm_id: `google_place/${placeId}`,
    needs_review: needsReview,
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

// ---- Shared pass runner ----

interface PassStats {
  requests: number;
  rawPlaces: number;
  newRows: number;
  failedTargets: string[];
}

async function runPass(
  passName: string,
  targets: SearchTarget[],
  seenOsmIds: Set<string>,
  existingGrid: SpotGrid,
  allRows: SpotRow[]
): Promise<PassStats> {
  const stats: PassStats = { requests: 0, rawPlaces: 0, newRows: 0, failedTargets: [] };

  console.log(`\n▶ Pass: ${passName} (${targets.length} targets)`);
  console.log("=".repeat(58));

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const result = await fetchTargetPlaces(target);
    stats.requests += result.requests;

    if (!result.ok) {
      console.error(`  [${i + 1}/${targets.length}] ❌ ${target.label}: ${result.error}`);
      stats.failedTargets.push(target.label);
    } else {
      stats.rawPlaces += result.places.length;
      let newForTarget = 0;

      for (const place of result.places) {
        if (!isSkateparkPlace(place)) continue;
        const row = placeToRow(place, target);
        if (!row) continue;
        if (seenOsmIds.has(row.osm_id)) continue;
        seenOsmIds.add(row.osm_id);

        if (existingGrid.hasNearby(row.latitude, row.longitude, DEDUPE_RADIUS_M)) continue;
        existingGrid.add(row.latitude, row.longitude);

        allRows.push(row);
        stats.newRows++;
        newForTarget++;
      }

      if (newForTarget > 0 || (i + 1) % 25 === 0 || i === targets.length - 1) {
        console.log(
          `  [${i + 1}/${targets.length}] ${target.label} → ${result.places.length} found, ${newForTarget} new`
        );
      }
    }

    if (i < targets.length - 1) await sleep(DELAY_BETWEEN_TARGETS_MS);
  }

  return stats;
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
  const passFlag = (getFlag("--pass") ?? "both") as "city" | "grid" | "both";
  const stateFlag = getFlag("--state")?.toUpperCase();
  const tileSizeDeg = Number(getFlag("--tile-size") ?? DEFAULT_TILE_SIZE_DEG);

  if (stateFlag && !STATE_NAMES[stateFlag]) {
    console.error(`❌ Unknown state code: ${stateFlag}`);
    process.exit(1);
  }
  if (!["city", "grid", "both"].includes(passFlag)) {
    console.error(`❌ --pass must be city, grid, or both`);
    process.exit(1);
  }

  console.log("🛹 GoSkate — USA Skatepark Import (Google Places, two-pass)");
  console.log("=".repeat(58));
  if (dryRun) console.log("⚠️  DRY RUN — nothing will be written to Supabase");
  console.log(`Pass:      ${passFlag}`);
  console.log(`State:     ${stateFlag ?? "all"}`);
  console.log(`Tile size: ${tileSizeDeg}°`);

  console.log("\nLoading existing spots for proximity de-duplication...");
  const existingGrid = await loadExistingSpotGrid();
  console.log("Done.");

  const seenOsmIds = new Set<string>();
  const allRows: SpotRow[] = [];
  let totalRequests = 0;
  const passSummaries: string[] = [];

  if (passFlag === "city" || passFlag === "both") {
    const targets = buildCityTargets(stateFlag);
    const stats = await runPass("City-targeted", targets, seenOsmIds, existingGrid, allRows);
    totalRequests += stats.requests;
    passSummaries.push(
      `City pass:  ${stats.requests} requests, ${stats.rawPlaces} raw places, ${stats.newRows} new` +
        (stats.failedTargets.length ? `, ${stats.failedTargets.length} failed targets` : "")
    );
  }

  if (passFlag === "grid" || passFlag === "both") {
    const targets = buildGridTargets(tileSizeDeg, stateFlag);
    const stats = await runPass("Grid sweep", targets, seenOsmIds, existingGrid, allRows);
    totalRequests += stats.requests;
    passSummaries.push(
      `Grid pass:  ${stats.requests} requests, ${stats.rawPlaces} raw places, ${stats.newRows} new` +
        (stats.failedTargets.length ? `, ${stats.failedTargets.length} failed targets` : "")
    );
  }

  console.log("\n" + "=".repeat(58));
  console.log("📊 Summary");
  console.log("=".repeat(58));
  passSummaries.forEach((s) => console.log(s));
  console.log(`\nTotal requests this run:    ${totalRequests}`);
  console.log(`Total new unique parks:     ${allRows.length}`);
  console.log(`Needs review (no name):     ${allRows.filter((r) => r.needs_review).length}`);
  console.log(
    "\n(Check this request count against your GCP billing console — Text Search Pro"
  );
  console.log("gives 5,000 free requests/month; this run should be well under that.)");

  if (dryRun) {
    console.log("\nDRY RUN — no rows written. Re-run without --dry-run to import.");
    return;
  }

  if (allRows.length === 0) {
    console.log("\nNothing new to insert.");
    return;
  }

  console.log("\nUpserting to Supabase...");
  const upsertStats = await upsertSpots(allRows);
  console.log(`  ✅ Inserted: ${upsertStats.inserted}`);
  console.log(`  ♻️  Skipped (already in Supabase): ${upsertStats.skipped}`);
  console.log("\n🎉 Import complete! Re-run any time — existing rows are skipped.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
