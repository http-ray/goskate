// ============================================================
// Google Places Import Script — fetch official skateparks and
// cache them in the Supabase spots table.
//
// Usage:
//   npx tsx scripts/import-osm-spots.ts --list-regions
//   npx tsx scripts/import-osm-spots.ts --region west-la
//   npx tsx scripts/import-osm-spots.ts --city "Atlanta, GA"
//   npx tsx scripts/import-osm-spots.ts --bbox 33.93,-118.52,34.08,-118.37
//   npx tsx scripts/import-osm-spots.ts --all
//   npx tsx scripts/import-osm-spots.ts --test
//
// What it does:
//   1. Calls Google Places Text Search for skateparks
//   2. Supports imports by predefined region, city name, or bbox
//   3. Converts each place into the existing spots table shape
//   4. Upserts into Supabase and skips duplicates by unique place ID
//
// Requirements (.env.local):
//   - NEXT_PUBLIC_SUPABASE_URL
//   - NEXT_PUBLIC_SUPABASE_ANON_KEY
//   - GOOGLE_MAPS_API_KEY
// ============================================================

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

if (!supabaseUrl || !supabaseKey || !googleMapsApiKey) {
  console.error("❌ Missing one or more required env vars in .env.local:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  console.error("   - NEXT_PUBLIC_SUPABASE_ANON_KEY");
  console.error("   - GOOGLE_MAPS_API_KEY");
  process.exit(1);
}

const googlePlacesApiKey: string = googleMapsApiKey;

const supabase = createClient(supabaseUrl, supabaseKey);

interface Region {
  key: string;
  name: string;
  south: number;
  west: number;
  north: number;
  east: number;
}

const TEST_REGION: Region = {
  key: "venice-test",
  name: "Venice Beach (test)",
  south: 33.975,
  west: -118.48,
  north: 33.995,
  east: -118.455,
};

// Beginner-friendly region list: edit/add entries here.
const REGIONS: Region[] = [
  { key: "west-la", name: "West LA", south: 33.93, west: -118.52, north: 34.08, east: -118.37 },
  { key: "central-la", name: "Central LA", south: 33.93, west: -118.37, north: 34.08, east: -118.20 },
  { key: "east-la-pasadena", name: "East LA / Pasadena", south: 34.0, west: -118.2, north: 34.2, east: -118.05 },
  { key: "south-bay", name: "South Bay", south: 33.73, west: -118.42, north: 33.93, east: -118.15 },
  { key: "sfv-south", name: "SFV South", south: 34.08, west: -118.6, north: 34.22, east: -118.37 },
  { key: "sfv-north", name: "SFV North", south: 34.08, west: -118.37, north: 34.3, east: -118.15 },
  { key: "georgia", name: "Georgia", south: 30.35, west: -85.61, north: 35.0, east: -80.84 },
  { key: "atlanta", name: "Atlanta", south: 33.4, west: -84.7, north: 34.1, east: -83.9 },
];

const GOOGLE_PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

// Tuning points for reliability and API quota behavior.
const DELAY_BETWEEN_TARGETS_MS = 3500;
const DELAY_BETWEEN_PAGES_MS = 2500;
const MAX_PAGES_PER_TARGET = 3;
const PAGE_SIZE = 20;

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

interface FetchResult {
  ok: boolean;
  places: GooglePlace[];
  error?: string;
}

interface SpotRow {
  display_name: string;
  type: "skatepark" | "street";
  source: "official";
  latitude: number;
  longitude: number;
  osm_name: string | null;
  osm_id: string;
  needs_review: boolean;
}

interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface ImportTarget {
  kind: "region" | "city" | "bbox";
  key: string;
  label: string;
  city?: string;
  bbox?: BBox;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseBbox(raw: string): BBox | null {
  const parts = raw.split(",").map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    return null;
  }

  const [south, west, north, east] = parts;
  if (south >= north || west >= east) {
    return null;
  }

  return { south, west, north, east };
}

function buildRegionTarget(region: Region): ImportTarget {
  return {
    kind: "region",
    key: region.key,
    label: region.name,
    bbox: {
      south: region.south,
      west: region.west,
      north: region.north,
      east: region.east,
    },
  };
}

/**
 * CLI modes:
 *   --all                              import all predefined regions
 *   --region west-la                   import one predefined region
 *   --city "Atlanta, GA"               import one city
 *   --bbox south,west,north,east       import one custom bounding area
 *   --test                             import the tiny Venice test region
 *   --list-regions                     print region keys then exit
 */
function getImportTargets(): ImportTarget[] {
  const args = process.argv.slice(2);

  if (args.includes("--list-regions")) {
    console.log("Available regions:");
    for (const region of REGIONS) {
      console.log(`  - ${region.key} (${region.name})`);
    }
    console.log();
    console.log("Example: npx tsx scripts/import-osm-spots.ts --region west-la");
    process.exit(0);
  }

  if (args.includes("--test")) {
    return [buildRegionTarget(TEST_REGION)];
  }

  const regionArgIndex = args.findIndex((arg) => arg === "--region");
  const cityArgIndex = args.findIndex((arg) => arg === "--city");
  const bboxArgIndex = args.findIndex((arg) => arg === "--bbox");

  const regionValue =
    regionArgIndex >= 0 ? args[regionArgIndex + 1] : args.find((a) => a.startsWith("--region="))?.split("=").slice(1).join("=");
  const cityValue =
    cityArgIndex >= 0 ? args[cityArgIndex + 1] : args.find((a) => a.startsWith("--city="))?.split("=").slice(1).join("=");
  const bboxValue =
    bboxArgIndex >= 0 ? args[bboxArgIndex + 1] : args.find((a) => a.startsWith("--bbox="))?.split("=").slice(1).join("=");

  if (regionValue) {
    const input = regionValue.trim().toLowerCase();
    const region = REGIONS.find(
      (r) => r.key.toLowerCase() === input || r.name.toLowerCase() === input
    );

    if (!region) {
      console.error(`❌ Unknown region: "${regionValue}"`);
      console.error("Use --list-regions to see valid regions.");
      process.exit(1);
    }

    return [buildRegionTarget(region)];
  }

  if (cityValue) {
    const city = cityValue.trim();
    if (!city) {
      console.error("❌ --city cannot be empty.");
      process.exit(1);
    }

    return [{ kind: "city", key: city.toLowerCase(), label: city, city }];
  }

  if (bboxValue) {
    const bbox = parseBbox(bboxValue);
    if (!bbox) {
      console.error("❌ Invalid --bbox. Expected format: south,west,north,east");
      process.exit(1);
    }

    return [{ kind: "bbox", key: "custom-bbox", label: `BBox ${bboxValue}`, bbox }];
  }

  // Default (or explicit --all): import all predefined regions.
  return REGIONS.map(buildRegionTarget);
}

function buildSearchRequest(target: ImportTarget, pageToken?: string): Record<string, unknown> {
  const base: Record<string, unknown> = {
    textQuery: target.kind === "city" ? `skatepark in ${target.city}` : "skatepark",
    pageSize: PAGE_SIZE,
  };

  if (target.bbox) {
    base.locationRestriction = {
      rectangle: {
        low: { latitude: target.bbox.south, longitude: target.bbox.west },
        high: { latitude: target.bbox.north, longitude: target.bbox.east },
      },
    };
  }

  if (pageToken) {
    base.pageToken = pageToken;
  }

  return base;
}

function isSkateparkPlace(place: GooglePlace): boolean {
  const name = place.displayName?.text?.toLowerCase() ?? "";
  const types = place.types ?? [];

  if (types.includes("skate_park")) {
    return true;
  }

  return name.includes("skate");
}

async function fetchPlacesForTarget(target: ImportTarget): Promise<FetchResult> {
  const places: GooglePlace[] = [];
  let nextPageToken: string | undefined;

  for (let page = 1; page <= MAX_PAGES_PER_TARGET; page++) {
    if (page > 1 && !nextPageToken) {
      break;
    }

    if (page > 1) {
      console.log(`    Waiting ${DELAY_BETWEEN_PAGES_MS / 1000}s before next page token...`);
      await sleep(DELAY_BETWEEN_PAGES_MS);
    }

    const body = buildSearchRequest(target, nextPageToken);

    try {
      const response = await fetch(GOOGLE_PLACES_TEXT_SEARCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": googlePlacesApiKey,
          "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress,places.types,nextPageToken",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25_000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          ok: false,
          places,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      const data: GooglePlacesResponse = await response.json();
      const batch = data.places ?? [];
      console.log(`    ✅ Page ${page}: ${batch.length} places`);
      places.push(...batch);
      nextPageToken = data.nextPageToken;
    } catch (err) {
      return {
        ok: false,
        places,
        error: (err as Error).message,
      };
    }
  }

  return { ok: true, places };
}

function convertPlacesToRows(allPlaces: GooglePlace[]): SpotRow[] {
  const rowsById = new Map<string, SpotRow>();

  for (const place of allPlaces) {
    if (!isSkateparkPlace(place)) {
      continue;
    }

    const placeId = place.id;
    const lat = place.location?.latitude;
    const lon = place.location?.longitude;

    if (!placeId || lat === undefined || lon === undefined) {
      continue;
    }

    const name = place.displayName?.text?.trim() || null;
    const formattedAddress = place.formattedAddress?.trim() || null;

    let displayName = "Unnamed Skatepark";
    let needsReview = true;

    if (name) {
      displayName = name;
      needsReview = false;
    } else if (formattedAddress) {
      displayName = `Skatepark near ${formattedAddress}`;
      needsReview = true;
    }

    // Keep existing table shape: store Google unique ID in osm_id for dedupe.
    rowsById.set(`google_place/${placeId}`, {
      display_name: displayName,
      type: "skatepark",
      source: "official",
      latitude: lat,
      longitude: lon,
      osm_name: name,
      osm_id: `google_place/${placeId}`,
      needs_review: needsReview,
    });
  }

  return Array.from(rowsById.values());
}

async function upsertSpots(rows: SpotRow[]): Promise<void> {
  if (rows.length === 0) {
    console.log("  No rows to insert.");
    return;
  }

  const BATCH_SIZE = 50;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from("spots")
      .upsert(batch, {
        onConflict: "osm_id",
        ignoreDuplicates: true,
      })
      .select("id");

    if (error) {
      console.error(`  ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${error.message}`);
      skipped += batch.length;
    } else {
      inserted += data?.length ?? 0;
    }
  }

  console.log(`  ✅ Inserted: ${inserted}`);
  if (skipped > 0) {
    console.log(`  ⚠️  Skipped/errored: ${skipped}`);
  }
}

async function main() {
  const targets = getImportTargets();

  console.log("🛹 GoSkate — Google Places Skatepark Import");
  console.log("=".repeat(54));
  console.log(`📍 Targets to import: ${targets.length}`);
  console.log(targets.map((t) => `   • ${t.label}`).join("\n"));
  console.log();

  const successfulTargets: string[] = [];
  const failedTargets: Array<{ name: string; reason: string }> = [];
  const allPlaces: GooglePlace[] = [];

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    console.log(`  [${i + 1}/${targets.length}] ${target.label}`);

    const result = await fetchPlacesForTarget(target);
    if (result.ok) {
      successfulTargets.push(target.label);
      allPlaces.push(...result.places);
    } else {
      failedTargets.push({
        name: target.label,
        reason: result.error ?? "unknown Google Places error",
      });
    }

    if (i < targets.length - 1) {
      console.log(`  ⏳ Waiting ${DELAY_BETWEEN_TARGETS_MS / 1000}s before next target...`);
      await sleep(DELAY_BETWEEN_TARGETS_MS);
    }
  }

  console.log();
  console.log(`  📊 Raw places fetched: ${allPlaces.length}`);
  console.log(`  ✅ Successful targets: ${successfulTargets.length}`);
  console.log(`  ⚠️  Failed targets: ${failedTargets.length}`);
  if (failedTargets.length > 0) {
    console.log("  Failed target details:");
    for (const failed of failedTargets) {
      console.log(`   • ${failed.name}`);
      console.log(`     Reason: ${failed.reason}`);
    }
  }
  console.log();

  if (allPlaces.length === 0) {
    console.log("❌ No places fetched. Check GOOGLE_MAPS_API_KEY, billing, and API enablement.");
    process.exit(1);
  }

  console.log("Step 2: Normalizing places into spots rows...");
  const rows = convertPlacesToRows(allPlaces);
  console.log(`  📊 Rows after dedupe/filtering: ${rows.length}`);
  console.log(`  📝 Need review: ${rows.filter((r) => r.needs_review).length}`);
  console.log(`  ✅ Have names: ${rows.filter((r) => r.osm_name).length}`);
  console.log();

  console.log("Step 3: Caching official spots in Supabase...");
  await upsertSpots(rows);
  console.log();

  console.log("🎉 Import complete!");
  console.log("Retry examples:");
  console.log("  npx tsx scripts/import-osm-spots.ts --region west-la");
  console.log('  npx tsx scripts/import-osm-spots.ts --city "Atlanta, GA"');
  console.log("  npx tsx scripts/import-osm-spots.ts --bbox 33.93,-118.52,34.08,-118.37");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
