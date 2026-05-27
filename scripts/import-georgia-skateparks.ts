// ============================================================
// Georgia Skatepark Import (Google Places → Supabase)
//
// Usage:
//   npx tsx scripts/import-georgia-skateparks.ts
//   npx tsx scripts/import-georgia-skateparks.ts --region atlanta
//   npx tsx scripts/import-georgia-skateparks.ts --known-only
//   npx tsx scripts/import-georgia-skateparks.ts --list-regions
//
// What it does:
//   1. Sweeps Georgia region-by-region using Google Places Text Search
//   2. Runs a separate name-based fallback search for each known park
//   3. Upserts results into the existing spots table (no duplicates)
//   4. Logs exactly what was found, inserted, skipped, and not found
//
// Required env vars in .env.local:
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

const GOOGLE_PLACES_TEXT_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchText";

// Tune these if you hit quota limits or timeouts.
const DELAY_BETWEEN_REGIONS_MS = 3500;
const DELAY_BETWEEN_PAGES_MS = 2500;
const MAX_PAGES_PER_REGION = 3;
const PAGE_SIZE = 20;

// ============================================================
// Georgia region bounding boxes
// Each box is small enough that Google Places can return
// meaningful results without too much noise.
// ============================================================
interface Region {
  key: string;
  name: string;
  south: number;
  west: number;
  north: number;
  east: number;
}

const GEORGIA_REGIONS: Region[] = [
  // ---- Atlanta core ----
  {
    key: "atlanta-core",
    name: "Atlanta Core",
    south: 33.65,
    west: -84.55,
    north: 33.85,
    east: -84.25,
  },
  // ---- Atlanta north suburbs (Dunwoody, Sandy Springs, Roswell) ----
  {
    key: "atlanta-north-suburbs",
    name: "Atlanta North Suburbs",
    south: 33.85,
    west: -84.55,
    north: 34.1,
    east: -84.2,
  },
  // ---- Atlanta south / southwest (Newnan, Fayette, Henry) ----
  {
    key: "atlanta-south",
    name: "Atlanta South / Newnan",
    south: 33.2,
    west: -84.9,
    north: 33.65,
    east: -84.35,
  },
  // ---- Gwinnett / Lawrenceville ----
  {
    key: "gwinnett",
    name: "Gwinnett / Lawrenceville",
    south: 33.8,
    west: -84.25,
    north: 34.15,
    east: -83.8,
  },
  // ---- Athens / Clarke County ----
  {
    key: "athens",
    name: "Athens",
    south: 33.85,
    west: -83.55,
    north: 34.1,
    east: -83.25,
  },
  // ---- Gainesville / Hall / Jackson / Jefferson ----
  {
    key: "gainesville-jefferson",
    name: "Gainesville / Jefferson",
    south: 34.1,
    west: -83.9,
    north: 34.55,
    east: -83.4,
  },
  // ---- Savannah / Coastal ----
  {
    key: "savannah",
    name: "Savannah",
    south: 31.85,
    west: -81.4,
    north: 32.3,
    east: -80.85,
  },
  // ---- Augusta / Richmond County ----
  {
    key: "augusta",
    name: "Augusta",
    south: 33.2,
    west: -82.3,
    north: 33.65,
    east: -81.85,
  },
  // ---- Macon / Bibb County ----
  {
    key: "macon",
    name: "Macon",
    south: 32.65,
    west: -83.9,
    north: 32.95,
    east: -83.5,
  },
  // ---- Columbus ----
  {
    key: "columbus",
    name: "Columbus",
    south: 32.3,
    west: -85.05,
    north: 32.65,
    east: -84.75,
  },
  // ---- Valdosta / South Georgia ----
  {
    key: "valdosta",
    name: "Valdosta / South Georgia",
    south: 30.6,
    west: -83.6,
    north: 31.15,
    east: -83.0,
  },
];

// ============================================================
// Known Georgia parks
//
// These are searched individually by name when the broad
// region sweep finishes, in case they were missed.
//
// approximate_lat / approximate_lng help Google Places narrow
// results — they are not stored as the final coordinate.
// ============================================================
interface KnownPark {
  /** Exact or close-to-exact name to search for */
  name: string;
  /** City/state context appended to the text query */
  city: string;
  approximate_lat: number;
  approximate_lng: number;
}

const KNOWN_GEORGIA_PARKS: KnownPark[] = [
  {
    name: "Duncan Creek Park Skatepark",
    city: "Dacula, GA",
    approximate_lat: 34.0,
    approximate_lng: -83.9,
  },
  {
    name: "Bay Creek Park",
    city: "Lilburn, GA",
    approximate_lat: 33.88,
    approximate_lng: -84.14,
  },
  {
    name: "SkateATL",
    city: "Atlanta, GA",
    approximate_lat: 33.75,
    approximate_lng: -84.37,
  },
  {
    name: "Brook Run Skatepark",
    city: "Dunwoody, GA",
    approximate_lat: 33.94,
    approximate_lng: -84.33,
  },
  {
    name: "Ronald Reagan Park",
    city: "Gwinnett, GA",
    approximate_lat: 33.95,
    approximate_lng: -84.06,
  },
  {
    name: "Newnan Skatepark",
    city: "Newnan, GA",
    approximate_lat: 33.38,
    approximate_lng: -84.79,
  },
  {
    name: "Denny Dobbs Park",
    city: "Gainesville, GA",
    approximate_lat: 34.3,
    approximate_lng: -83.83,
  },
  {
    name: "Fourth Ward Park",
    city: "Atlanta, GA",
    approximate_lat: 33.77,
    approximate_lng: -84.37,
  },
];

// ============================================================
// Types
// ============================================================
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

// ============================================================
// Helpers
// ============================================================
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Returns true if two names are similar enough to be considered
 * the same park. Used to match known-park results from Google.
 *
 * Checks:
 *  1. Exact match (after normalisation)
 *  2. One name contains the other
 *  3. Both names share at least 2 meaningful words
 */
function namesAreSimilar(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);

  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  // Word-overlap check — ignore common short words
  const STOP_WORDS = new Set(["the", "a", "at", "in", "of", "park", "skate", "skatepark"]);
  const wordsA = na.split(/\s+/).filter((w) => !STOP_WORDS.has(w));
  const wordsB = nb.split(/\s+/).filter((w) => !STOP_WORDS.has(w));
  const shared = wordsA.filter((w) => wordsB.includes(w));
  return shared.length >= 2;
}

function isSkateparkPlace(place: GooglePlace): boolean {
  const name = place.displayName?.text?.toLowerCase() ?? "";
  const types = place.types ?? [];
  return types.includes("skate_park") || name.includes("skate");
}

function placeToRow(place: GooglePlace): SpotRow | null {
  const placeId = place.id;
  const lat = place.location?.latitude;
  const lon = place.location?.longitude;

  if (!placeId || lat === undefined || lon === undefined) return null;

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

  return {
    display_name: displayName,
    type: "skatepark",
    source: "official",
    latitude: lat,
    longitude: lon,
    osm_name: name,
    // Re-use the osm_id column for Google's unique place id.
    // This is the deduplication key — if the same place shows up
    // in multiple regions we only store it once.
    osm_id: `google_place/${placeId}`,
    needs_review: needsReview,
  };
}

// ============================================================
// Google Places API calls
// ============================================================

/** Fetch all pages of results for a bounding-box region sweep. */
async function fetchRegionPlaces(
  region: Region
): Promise<{ ok: boolean; places: GooglePlace[]; error?: string }> {
  const places: GooglePlace[] = [];
  let nextPageToken: string | undefined;

  for (let page = 1; page <= MAX_PAGES_PER_REGION; page++) {
    if (page > 1 && !nextPageToken) break;
    if (page > 1) {
      await sleep(DELAY_BETWEEN_PAGES_MS);
    }

    const body: Record<string, unknown> = {
      textQuery: "skatepark",
      pageSize: PAGE_SIZE,
      locationRestriction: {
        rectangle: {
          low: { latitude: region.south, longitude: region.west },
          high: { latitude: region.north, longitude: region.east },
        },
      },
    };

    if (nextPageToken) body.pageToken = nextPageToken;

    try {
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
        return { ok: false, places, error: `HTTP ${response.status}: ${text}` };
      }

      const data: GooglePlacesResponse = await response.json();
      const batch = data.places ?? [];
      console.log(`      Page ${page}: ${batch.length} places returned`);
      places.push(...batch);
      nextPageToken = data.nextPageToken;
    } catch (err) {
      return { ok: false, places, error: (err as Error).message };
    }
  }

  return { ok: true, places };
}

/**
 * Search for a single known park by name + city.
 *
 * Google Places Text Search treats the whole query string as a
 * natural-language search, so "Brook Run Skatepark Dunwoody, GA"
 * returns the most relevant match first.
 *
 * We use a loose location bias (circle around the approximate
 * coordinates) rather than a hard bounding box so that parks
 * slightly outside our expected region can still surface.
 */
async function fetchKnownPark(
  park: KnownPark
): Promise<{ ok: boolean; place: GooglePlace | null; error?: string }> {
  const body: Record<string, unknown> = {
    textQuery: `${park.name} ${park.city}`,
    pageSize: 5, // Only need the top few candidates
    locationBias: {
      circle: {
        center: {
          latitude: park.approximate_lat,
          longitude: park.approximate_lng,
        },
        // 30 km radius — generous enough to always find the park
        radius: 30_000,
      },
    },
  };

  try {
    const response = await fetch(GOOGLE_PLACES_TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googlePlacesApiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.location,places.formattedAddress,places.types",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, place: null, error: `HTTP ${response.status}: ${text}` };
    }

    const data: GooglePlacesResponse = await response.json();
    const candidates = data.places ?? [];

    // Pick the first candidate whose name is similar to what we searched for.
    const match = candidates.find((p) => {
      const returnedName = p.displayName?.text ?? "";
      return namesAreSimilar(park.name, returnedName);
    });

    return { ok: true, place: match ?? null };
  } catch (err) {
    return { ok: false, place: null, error: (err as Error).message };
  }
}

// ============================================================
// Supabase upsert
//
// Duplicate prevention:
//   The spots table has a UNIQUE constraint on the osm_id column.
//   Each Google Place is stored as  google_place/<place_id>.
//   ON CONFLICT + ignoreDuplicates means re-running the script
//   is always safe — existing rows are untouched.
// ============================================================
interface UpsertStats {
  inserted: number;
  skipped: number;
}

async function upsertSpots(rows: SpotRow[]): Promise<UpsertStats> {
  if (rows.length === 0) return { inserted: 0, skipped: 0 };

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
      console.error(
        `  ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} upsert failed: ${error.message}`
      );
      skipped += batch.length;
    } else {
      const batchInserted = data?.length ?? 0;
      inserted += batchInserted;
      // Rows that were skipped as duplicates: batch size minus what was actually inserted
      skipped += batch.length - batchInserted;
    }
  }

  return { inserted, skipped };
}

// ============================================================
// CLI argument parsing
// ============================================================
function getArgs(): {
  regionKey: string | null;
  knownOnly: boolean;
  listRegions: boolean;
} {
  const args = process.argv.slice(2);

  if (args.includes("--list-regions")) {
    return { regionKey: null, knownOnly: false, listRegions: true };
  }

  const knownOnly = args.includes("--known-only");

  const regionIdx = args.findIndex((a) => a === "--region");
  const regionValue =
    regionIdx >= 0
      ? args[regionIdx + 1]
      : args.find((a) => a.startsWith("--region="))?.split("=").slice(1).join("=");

  return {
    regionKey: regionValue?.trim() ?? null,
    knownOnly,
    listRegions: false,
  };
}

// ============================================================
// main
// ============================================================
async function main() {
  const { regionKey, knownOnly, listRegions } = getArgs();

  if (listRegions) {
    console.log("Available Georgia regions:");
    for (const r of GEORGIA_REGIONS) {
      console.log(`  ${r.key.padEnd(28)} ${r.name}`);
    }
    console.log();
    console.log("Example: npx tsx scripts/import-georgia-skateparks.ts --region atlanta-core");
    process.exit(0);
  }

  console.log("🛹 GoSkate — Georgia Skatepark Import");
  console.log("=".repeat(54));
  console.log();

  // Decide which regions to run
  let regionsToRun: Region[] = [];

  if (!knownOnly) {
    if (regionKey) {
      const found = GEORGIA_REGIONS.find((r) => r.key === regionKey);
      if (!found) {
        console.error(`❌ Unknown region: "${regionKey}". Use --list-regions to see options.`);
        process.exit(1);
      }
      regionsToRun = [found];
    } else {
      regionsToRun = GEORGIA_REGIONS;
    }
  }

  // ---- Summary counters ----
  let totalRawPlaces = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  const failedRegions: string[] = [];

  // ============================================================
  // STEP 1 — Region sweep
  // ============================================================
  if (regionsToRun.length > 0) {
    console.log(`Step 1: Region sweep (${regionsToRun.length} regions)`);
    console.log("-".repeat(54));

    // Collect all places from all regions before upserting, so we
    // can dedupe across regions in memory (a park near a bbox border
    // may appear in two adjacent region results).
    const allRegionPlaces: GooglePlace[] = [];
    const seenPlaceIds = new Set<string>();

    for (let i = 0; i < regionsToRun.length; i++) {
      const region = regionsToRun[i];
      console.log(`  [${i + 1}/${regionsToRun.length}] ${region.name}`);

      const result = await fetchRegionPlaces(region);

      if (!result.ok) {
        console.error(`  ❌ Failed: ${result.error}`);
        failedRegions.push(region.name);
      } else {
        let newInThisRegion = 0;
        for (const place of result.places) {
          if (place.id && !seenPlaceIds.has(place.id)) {
            seenPlaceIds.add(place.id);
            allRegionPlaces.push(place);
            newInThisRegion++;
          }
        }
        console.log(
          `  ✅ ${result.places.length} raw, ${newInThisRegion} new after cross-region dedupe`
        );
      }

      if (i < regionsToRun.length - 1) {
        console.log(`  ⏳ Waiting ${DELAY_BETWEEN_REGIONS_MS / 1000}s...`);
        await sleep(DELAY_BETWEEN_REGIONS_MS);
      }
    }

    totalRawPlaces = allRegionPlaces.length;
    console.log();
    console.log(`  📊 Total unique places from region sweep: ${totalRawPlaces}`);
    console.log();

    // Filter and convert to spot rows
    const regionRows = allRegionPlaces
      .filter(isSkateparkPlace)
      .map(placeToRow)
      .filter((r): r is SpotRow => r !== null);

    console.log(`  📝 After skatepark filter: ${regionRows.length} rows to upsert`);

    if (regionRows.length > 0) {
      console.log("  Upserting to Supabase...");
      const stats = await upsertSpots(regionRows);
      totalInserted += stats.inserted;
      totalSkipped += stats.skipped;
      console.log(`  ✅ Inserted: ${stats.inserted}`);
      console.log(`  ♻️  Skipped (already exist): ${stats.skipped}`);
    }

    console.log();
  }

  // ============================================================
  // STEP 2 — Known parks fallback
  //
  // Each known park is searched by name + city so parks that
  // were missed by the broad bbox sweep still get captured.
  // ============================================================
  console.log("Step 2: Known parks fallback search");
  console.log("-".repeat(54));
  console.log(`  Checking ${KNOWN_GEORGIA_PARKS.length} known parks individually...`);
  console.log();

  const knownFound: string[] = [];
  const knownNotFound: string[] = [];
  const knownFailed: string[] = [];
  const knownRows: SpotRow[] = [];

  for (const park of KNOWN_GEORGIA_PARKS) {
    const result = await fetchKnownPark(park);

    if (!result.ok) {
      console.log(`  ❓ ${park.name} — API error: ${result.error}`);
      knownFailed.push(park.name);
    } else if (!result.place) {
      console.log(`  ⚠️  ${park.name} — NOT FOUND (no strong match from Google)`);
      knownNotFound.push(park.name);
    } else {
      const returnedName = result.place.displayName?.text ?? "(no name)";
      console.log(`  ✅ ${park.name}`);
      console.log(`     → Google returned: "${returnedName}"`);

      const row = placeToRow(result.place);
      if (row) knownRows.push(row);
      knownFound.push(park.name);
    }

    // Small delay between individual known-park searches
    await sleep(1200);
  }

  console.log();

  if (knownRows.length > 0) {
    console.log(`  Upserting ${knownRows.length} known park rows...`);
    const stats = await upsertSpots(knownRows);
    totalInserted += stats.inserted;
    totalSkipped += stats.skipped;
    console.log(`  ✅ Inserted: ${stats.inserted}`);
    console.log(`  ♻️  Skipped (already exist): ${stats.skipped}`);
    console.log();
  }

  // ============================================================
  // Final summary
  // ============================================================
  console.log("=".repeat(54));
  console.log("📊 Import Summary");
  console.log("=".repeat(54));
  console.log();

  if (regionsToRun.length > 0) {
    console.log(`Regions searched:     ${regionsToRun.length}`);
    console.log(`Raw places fetched:   ${totalRawPlaces}`);
    if (failedRegions.length > 0) {
      console.log(`Failed regions:       ${failedRegions.length}`);
      for (const name of failedRegions) {
        console.log(`  • ${name}`);
      }
    }
    console.log();
  }

  console.log(`Known parks checked:  ${KNOWN_GEORGIA_PARKS.length}`);
  console.log(`  ✅ Found:           ${knownFound.length}`);
  if (knownFound.length > 0) {
    for (const name of knownFound) {
      console.log(`     • ${name}`);
    }
  }
  console.log(`  ⚠️  Not found:       ${knownNotFound.length}`);
  if (knownNotFound.length > 0) {
    for (const name of knownNotFound) {
      console.log(`     • ${name}  ← needs manual review`);
    }
  }
  if (knownFailed.length > 0) {
    console.log(`  ❌ API errors:      ${knownFailed.length}`);
    for (const name of knownFailed) {
      console.log(`     • ${name}`);
    }
  }

  console.log();
  console.log(`Total inserted:       ${totalInserted}`);
  console.log(`Total skipped:        ${totalSkipped}  (already in Supabase)`);
  console.log();
  console.log("🎉 Georgia import complete!");
  console.log();
  console.log("Retry a single region:");
  console.log("  npx tsx scripts/import-georgia-skateparks.ts --region atlanta-core");
  console.log("Run only the known parks check:");
  console.log("  npx tsx scripts/import-georgia-skateparks.ts --known-only");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
