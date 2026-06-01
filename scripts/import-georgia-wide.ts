// ============================================================
// Georgia Skatepark — Broad Coverage Import (Google Places → Supabase)
//
// Usage:
//   npx tsx scripts/import-georgia-wide.ts
//   npx tsx scripts/import-georgia-wide.ts --dry-run
//
// What it does:
//   Lays a uniform 5×5 grid across all of Georgia and runs three
//   different search terms in every cell:
//     • skatepark
//     • skate park
//     • skateboard park
//
//   That's 25 cells × 3 terms = 75 total Google Places searches.
//   The earlier import (import-georgia-skateparks.ts) covered
//   11 hand-picked population-center regions with a single search
//   term. This pass catches everything that fell through the gaps
//   (rural counties, small towns, parks near region borders, etc.)
//
// Duplicate prevention:
//   1. In-memory — every Google place_id is tracked in a Set.
//      If the same place comes back in two adjacent grid cells
//      or from two different search terms it is only counted once.
//   2. Supabase — each row is stored as  osm_id = "google_place/<id>".
//      The spots table has a UNIQUE constraint on osm_id, and the
//      upsert uses  ignoreDuplicates: true, so re-running this script
//      or running it after the earlier regional import is always safe.
//      Manually edited rows are never overwritten.
//
// Required env vars in .env.local:
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
//   GOOGLE_MAPS_API_KEY
// ============================================================

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

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

const GOOGLE_PLACES_TEXT_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchText";

// ---- Timing knobs ----
// Increase DELAY_BETWEEN_SEARCHES_MS if you start hitting rate-limit errors.
const DELAY_BETWEEN_SEARCHES_MS = 2200;
const DELAY_BETWEEN_PAGES_MS = 1800;
const MAX_PAGES_PER_SEARCH = 3;
const PAGE_SIZE = 20;

// ============================================================
// Search terms
// All three are used for every grid cell so that Google returns
// results regardless of how a park is listed in its database.
// ============================================================
const SEARCH_TERMS = ["skatepark", "skate park", "skateboard park"] as const;

// ============================================================
// Georgia 5×5 uniform grid
//
// Georgia approximate bounding box:
//   South  30.35  (St. Marys / Folkston)
//   North  35.01  (McCaysville / Tennessee border)
//   West  -85.65  (Rossville / Alabama border)
//   East  -80.84  (Savannah coast / SC border)
//
// Dividing that into 5 equal latitude bands and 5 equal
// longitude bands gives 25 cells.  Each cell is roughly
// 0.93° lat × 0.96° lon — about 103 km × 83 km.
//
// Some corner cells will include a sliver of a neighbouring
// state; that's fine — Google returns only places whose
// geocoordinates fall inside the requested rectangle.
// ============================================================
interface GridCell {
  key: string;       // machine-readable label for logs
  label: string;     // human-readable label for logs
  south: number;
  west: number;
  north: number;
  east: number;
}

// Latitude band edges (6 values → 5 bands)
const LAT_EDGES = [30.35, 31.28, 32.21, 33.14, 34.07, 35.01];
// Longitude band edges (6 values → 5 bands)
const LON_EDGES = [-85.65, -84.70, -83.75, -82.80, -81.85, -80.84];

// Human-readable row/column labels
const LAT_LABELS = [
  "South",           // 30.35–31.28  (Valdosta/Brunswick belt)
  "South-Central",   // 31.28–32.21  (Albany/Waycross belt)
  "Central",         // 32.21–33.14  (Macon/Augusta belt)
  "North-Central",   // 33.14–34.07  (Atlanta belt)
  "North",           // 34.07–35.01  (Rome/Blue Ridge belt)
];
const LON_LABELS = [
  "West",            // -85.65 to -84.70  (Columbus/Rome)
  "West-Central",    // -84.70 to -83.75  (Macon corridor)
  "Central",         // -83.75 to -82.80  (Milledgeville/Dublin)
  "East-Central",    // -82.80 to -81.85  (Augusta belt)
  "East",            // -81.85 to -80.84  (Savannah/Brunswick coast)
];

const GEORGIA_GRID: GridCell[] = [];
for (let row = 0; row < 5; row++) {
  for (let col = 0; col < 5; col++) {
    GEORGIA_GRID.push({
      key: `r${row}c${col}`,
      label: `${LAT_LABELS[row]} / ${LON_LABELS[col]}`,
      south: LAT_EDGES[row],
      north: LAT_EDGES[row + 1],
      west: LON_EDGES[col],
      east: LON_EDGES[col + 1],
    });
  }
}

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

/**
 * Returns true if the place is likely a skatepark.
 *
 * Even though we are already searching specifically for
 * "skatepark / skate park / skateboard park", Google sometimes
 * returns loosely related results.  This acts as a safety filter.
 */
function isSkateparkPlace(place: GooglePlace): boolean {
  const name = (place.displayName?.text ?? "").toLowerCase();
  const types = place.types ?? [];
  return types.includes("skate_park") || name.includes("skate");
}

/**
 * Converts a raw Google Place to a Supabase row.
 * Returns null if the place is missing required fields.
 *
 * needs_review is set to true when Google returned no display name,
 * which would leave us with only an address-based name.
 */
function placeToRow(place: GooglePlace): SpotRow | null {
  const placeId = place.id;
  const lat = place.location?.latitude;
  const lon = place.location?.longitude;

  if (!placeId || lat === undefined || lon === undefined) return null;

  const name = place.displayName?.text?.trim() ?? null;
  const address = place.formattedAddress?.trim() ?? null;

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
    // Re-use the osm_id column as a unique stable key for Google places.
    // Format:  google_place/<Google place_id>
    // This matches what import-georgia-skateparks.ts writes, so if the
    // same park was already imported it is treated as a duplicate.
    osm_id: `google_place/${placeId}`,
    needs_review: needsReview,
  };
}

// ============================================================
// Google Places API — fetch one page-chain for a cell + term
// ============================================================
interface FetchResult {
  ok: boolean;
  places: GooglePlace[];
  error?: string;
}

async function fetchCellPlaces(
  cell: GridCell,
  searchTerm: string
): Promise<FetchResult> {
  const places: GooglePlace[] = [];
  let nextPageToken: string | undefined;

  for (let page = 1; page <= MAX_PAGES_PER_SEARCH; page++) {
    if (page > 1 && !nextPageToken) break;
    if (page > 1) await sleep(DELAY_BETWEEN_PAGES_MS);

    const body: Record<string, unknown> = {
      textQuery: searchTerm,
      pageSize: PAGE_SIZE,
      locationRestriction: {
        rectangle: {
          low: { latitude: cell.south, longitude: cell.west },
          high: { latitude: cell.north, longitude: cell.east },
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
      if (batch.length > 0) {
        console.log(`        Page ${page}: ${batch.length} results`);
      }
      places.push(...batch);
      nextPageToken = data.nextPageToken;
    } catch (err) {
      return { ok: false, places, error: (err as Error).message };
    }
  }

  return { ok: true, places };
}

// ============================================================
// Supabase upsert
//
// Uses ON CONFLICT (osm_id) + ignoreDuplicates: true.
// Any row whose osm_id already exists in the table is silently
// skipped — this protects manually edited rows and prevents
// double-counting from the earlier regional import.
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
        `  ❌ Upsert batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${error.message}`
      );
      skipped += batch.length;
    } else {
      const batchInserted = data?.length ?? 0;
      inserted += batchInserted;
      skipped += batch.length - batchInserted;
    }
  }

  return { inserted, skipped };
}

// ============================================================
// CLI flags
// ============================================================
function isDryRun(): boolean {
  return process.argv.slice(2).includes("--dry-run");
}

// ============================================================
// main
// ============================================================
async function main() {
  const dryRun = isDryRun();

  console.log("🛹 GoSkate — Georgia-Wide Broad Coverage Import");
  console.log("=".repeat(58));
  if (dryRun) {
    console.log("⚠️  DRY RUN — searches will run but nothing will be inserted");
  }
  console.log();
  console.log(`Grid:         ${GEORGIA_GRID.length} cells (5 lat × 5 lon)`);
  console.log(`Search terms: ${SEARCH_TERMS.join(" | ")}`);
  console.log(`Total searches planned: ${GEORGIA_GRID.length * SEARCH_TERMS.length}`);
  console.log();

  // ---- Running totals ----
  let totalSearchesRun = 0;
  let totalRawPlacesFetched = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalNeedsReview = 0;
  const apiErrors: string[] = [];

  // Tracks every Google place_id seen across all cells and all search
  // terms so we only upsert each physical place once per run.
  const seenPlaceIds = new Set<string>();

  // Accumulate all unique valid rows before writing to Supabase so the
  // final upsert reflects the true count for this run.
  const allRows: SpotRow[] = [];

  // ============================================================
  // Grid sweep
  // ============================================================
  for (let cellIdx = 0; cellIdx < GEORGIA_GRID.length; cellIdx++) {
    const cell = GEORGIA_GRID[cellIdx];

    console.log(
      `[${String(cellIdx + 1).padStart(2)}/${GEORGIA_GRID.length}] ${cell.label}`
    );

    let cellNewPlaces = 0;

    for (const term of SEARCH_TERMS) {
      console.log(`    🔍 "${term}"`);
      totalSearchesRun++;

      const result = await fetchCellPlaces(cell, term);

      if (!result.ok) {
        const errMsg = `Cell ${cell.key} / "${term}": ${result.error}`;
        console.error(`    ❌ API error: ${result.error}`);
        apiErrors.push(errMsg);
      } else {
        totalRawPlacesFetched += result.places.length;

        let newThisSearch = 0;
        for (const place of result.places) {
          if (!place.id) continue;
          if (seenPlaceIds.has(place.id)) continue;   // already seen this run
          seenPlaceIds.add(place.id);

          // Safety filter — skip anything Google returned that is clearly
          // not a skatepark (false positives from broad text search).
          if (!isSkateparkPlace(place)) continue;

          const row = placeToRow(place);
          if (!row) continue;

          allRows.push(row);
          if (row.needs_review) totalNeedsReview++;
          newThisSearch++;
          cellNewPlaces++;
        }

        if (newThisSearch > 0) {
          console.log(
            `    ✅ ${result.places.length} raw → ${newThisSearch} new unique places`
          );
        } else if (result.places.length > 0) {
          console.log(
            `    ♻️  ${result.places.length} returned, all already seen (duplicates)`
          );
        } else {
          console.log(`    — 0 results`);
        }
      }

      // Pause between searches to stay within Google rate limits.
      await sleep(DELAY_BETWEEN_SEARCHES_MS);
    }

    if (cellNewPlaces > 0) {
      console.log(`  → ${cellNewPlaces} new unique place(s) this cell`);
    }
    console.log();
  }

  // ============================================================
  // Upsert to Supabase
  // ============================================================
  console.log("=".repeat(58));
  console.log(`📝 Unique skatepark places found this run: ${allRows.length}`);

  if (dryRun) {
    console.log();
    console.log("DRY RUN — no rows written to Supabase.");
    console.log("Would-be inserted:     (unknown until actual run)");
    console.log("Would-be skipped:      (unknown until actual run)");
    console.log(`Flagged needs_review:  ${totalNeedsReview}`);
  } else if (allRows.length > 0) {
    console.log("Upserting to Supabase...");
    const stats = await upsertSpots(allRows);
    totalInserted = stats.inserted;
    totalSkipped = stats.skipped;
    console.log(`  ✅ Inserted: ${stats.inserted}`);
    console.log(`  ♻️  Skipped (already in Supabase): ${stats.skipped}`);
  } else {
    console.log("Nothing new to insert.");
  }

  // ============================================================
  // Final summary
  // ============================================================
  console.log();
  console.log("=".repeat(58));
  console.log("📊 Final Summary");
  console.log("=".repeat(58));
  console.log();
  console.log(`Total searches run:            ${totalSearchesRun}`);
  console.log(`Total raw places fetched:      ${totalRawPlacesFetched}`);
  console.log(`Unique places after dedupe:    ${allRows.length}`);
  console.log();

  if (!dryRun) {
    console.log(`Inserted (new rows):           ${totalInserted}`);
    console.log(`Skipped (already in Supabase): ${totalSkipped}`);
  }

  console.log(`Flagged for review:            ${totalNeedsReview}`);
  if (totalNeedsReview > 0) {
    console.log(
      `  ↳ These have needs_review=true in Supabase because Google`
    );
    console.log(
      `    returned no display name. Review them in the dashboard.`
    );
    const reviewRows = allRows.filter((r) => r.needs_review);
    for (const r of reviewRows) {
      console.log(`     • ${r.display_name}  (osm_id: ${r.osm_id})`);
    }
  }

  console.log();

  if (apiErrors.length > 0) {
    console.log(`API errors (${apiErrors.length}):`);
    for (const e of apiErrors) {
      console.log(`  ❌ ${e}`);
    }
    console.log();
  }

  console.log("🎉 Georgia-wide import complete!");
  console.log();
  console.log("Re-run at any time — existing rows will be skipped automatically.");
  console.log(
    "To preview without writing: npx tsx scripts/import-georgia-wide.ts --dry-run"
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
