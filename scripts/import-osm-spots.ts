// ============================================================
// OSM Import Script — fetch skateparks from OpenStreetMap and
// insert them into the Supabase spots table.
//
// Usage:
//   npx tsx scripts/import-osm-spots.ts            ← imports the active region
//   npx tsx scripts/import-osm-spots.ts --test      ← tiny test area first
//   npx tsx scripts/import-osm-spots.ts --all       ← imports every region
//
// What it does:
//   1. Queries the Overpass API for skateparks in one or more
//      small bounding boxes (regions)
//   2. Converts each OSM element into a spots table row
//   3. Upserts rows into Supabase (skips duplicates by osm_id)
//   4. Marks spots with weak/missing names for future enrichment
//
// Why small regions?
//   Public Overpass endpoints have strict rate limits and short
//   timeouts. A single huge bounding box can exceed those limits
//   and get your request killed (429 / timeout / 504). Splitting
//   into smaller regions keeps each query fast and well within
//   the free-tier limits.
//
// Requirements:
//   - .env.local must have NEXT_PUBLIC_SUPABASE_URL and
//     NEXT_PUBLIC_SUPABASE_ANON_KEY set
//   - The spots table must already exist (run supabase/schema.sql)
//   - Install tsx if not present: npm install -D tsx
// ============================================================

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local from the project root
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// REGION CONFIG — edit these to control what gets imported
//
// Each region is a small bounding box. Smaller boxes are more
// reliable because Overpass processes less data per request.
//
// To add a new area, just add another entry here.
// Format: { south, west, north, east } (lat/lon)
// ============================================================

interface Region {
  name: string;
  south: number;
  west: number;
  north: number;
  east: number;
}

// 🧪 A tiny test region — Venice Beach area only (~3 km²)
// Use this to confirm the full pipeline works before scaling up.
const TEST_REGION: Region = {
  name: "Venice Beach (test)",
  south: 33.975,
  west: -118.48,
  north: 33.995,
  east: -118.455,
};

// 📍 Production regions — LA metro split into manageable chunks.
// Each covers roughly 0.15° × 0.15° (~15 km × 17 km) which is
// small enough for Overpass to handle quickly.
const REGIONS: Region[] = [
  // West LA / Santa Monica / Venice
  { name: "West LA",             south: 33.93, west: -118.52, north: 34.08, east: -118.37 },
  // Central LA / Hollywood / DTLA
  { name: "Central LA",          south: 33.93, west: -118.37, north: 34.08, east: -118.20 },
  // East LA / Pasadena
  { name: "East LA / Pasadena",  south: 34.00, west: -118.20, north: 34.20, east: -118.05 },
  // South Bay / Torrance / Long Beach
  { name: "South Bay",           south: 33.73, west: -118.42, north: 33.93, east: -118.15 },
  // San Fernando Valley (south half)
  { name: "SFV South",           south: 34.08, west: -118.60, north: 34.22, east: -118.37 },
  // San Fernando Valley (north half)
  { name: "SFV North",           south: 34.08, west: -118.37, north: 34.30, east: -118.15 },
];

// ============================================================
// Overpass endpoint config
// ============================================================

// Multiple Overpass API endpoints (fallback for rate limiting)
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

// Seconds to wait between region fetches (avoids rate limits)
const DELAY_BETWEEN_REGIONS_MS = 5000;

// ============================================================
// Overpass API types
// ============================================================

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: {
    name?: string;
    leisure?: string;
    sport?: string;
    "addr:city"?: string;
    "addr:street"?: string;
    description?: string;
    [key: string]: string | undefined;
  };
}

interface OverpassResponse {
  elements: OverpassElement[];
}

// ============================================================
// Step 1: Build the Overpass query for a single region
// ============================================================

/**
 * Builds an Overpass QL query for skateparks in a bounding box.
 * Queries for:
 *   - leisure=skate_park (dedicated skateparks)
 *   - leisure=pitch + sport=skateboard (multi-use pitches tagged for skating)
 * Uses "out center" so ways/relations return their center coordinates.
 */
function buildOverpassQuery(region: Region): string {
  const bbox = `${region.south},${region.west},${region.north},${region.east}`;

  return `
    [out:json][timeout:15];
    (
      node["leisure"="skate_park"](${bbox});
      way["leisure"="skate_park"](${bbox});
      relation["leisure"="skate_park"](${bbox});
      node["leisure"="pitch"]["sport"="skateboard"](${bbox});
      way["leisure"="pitch"]["sport"="skateboard"](${bbox});
      relation["leisure"="pitch"]["sport"="skateboard"](${bbox});
    );
    out center;
  `;
}

// ============================================================
// Step 2: Fetch a single region from Overpass API
// ============================================================

async function fetchRegion(region: Region): Promise<OverpassElement[]> {
  const query = buildOverpassQuery(region);

  for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
    const url = OVERPASS_ENDPOINTS[i];
    console.log(`    Trying ${new URL(url).hostname}...`);

    try {
      if (i > 0) {
        console.log("    Waiting 3s before next endpoint...");
        await sleep(3000);
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(20_000), // 20s hard timeout per request
      });

      if (response.status === 429) {
        console.warn(`    ⚠️  Rate limited (429)`);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: OverpassResponse = await response.json();
      console.log(`    ✅ ${data.elements.length} elements`);
      return data.elements;
    } catch (err) {
      const msg = (err as Error).message;
      // Detect timeout specifically so it's clear in the output
      if (msg.includes("abort") || msg.includes("timeout")) {
        console.error(`    ❌ Timed out on ${new URL(url).hostname}`);
      } else {
        console.error(`    ❌ Failed: ${msg}`);
      }
    }
  }

  // All endpoints failed for this region — return empty instead of
  // crashing the whole import. We'll log a warning and keep going.
  console.warn(`    ⚠️  All endpoints failed for "${region.name}" — skipping`);
  return [];
}

// ============================================================
// Step 2: Convert OSM elements to Supabase rows
// ============================================================

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

function convertToRows(elements: OverpassElement[]): SpotRow[] {
  const rows: SpotRow[] = [];

  for (const el of elements) {
    // Extract coordinates
    let lat: number | undefined;
    let lon: number | undefined;

    if (el.type === "node" && el.lat !== undefined && el.lon !== undefined) {
      lat = el.lat;
      lon = el.lon;
    } else if (el.center) {
      lat = el.center.lat;
      lon = el.center.lon;
    }

    // Skip elements without coordinates
    if (lat === undefined || lon === undefined) {
      continue;
    }

    const osmId = `${el.type}/${el.id}`;
    const osmName = el.tags?.name || null;

    // Determine the display name and whether we need review
    let displayName: string;
    let needsReview = false;

    if (osmName && osmName.trim().length > 0) {
      // OSM has a real name — use it as-is
      // Do NOT append "Skatepark" or any other qualifier
      displayName = osmName.trim();
    } else {
      // No name in OSM — use address info if available, otherwise
      // set a temporary placeholder and mark for review/enrichment
      const city = el.tags?.["addr:city"];
      const street = el.tags?.["addr:street"];

      if (city && street) {
        displayName = `Skatepark on ${street}, ${city}`;
        needsReview = true; // address-derived names should be reviewed
      } else if (street) {
        displayName = `Skatepark on ${street}`;
        needsReview = true;
      } else if (city) {
        displayName = `Skatepark in ${city}`;
        needsReview = true;
      } else {
        displayName = "Unnamed Skatepark";
        needsReview = true; // definitely needs enrichment or manual naming
      }
    }

    rows.push({
      display_name: displayName,
      type: "skatepark",
      source: "official",
      latitude: lat,
      longitude: lon,
      osm_name: osmName,
      osm_id: osmId,
      needs_review: needsReview,
    });
  }

  return rows;
}

// ============================================================
// Step 3: Upsert into Supabase
// ============================================================

async function upsertSpots(rows: SpotRow[]): Promise<void> {
  if (rows.length === 0) {
    console.log("  No rows to insert.");
    return;
  }

  // Upsert in batches of 50 to avoid hitting request size limits
  const BATCH_SIZE = 50;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from("spots")
      .upsert(batch, {
        onConflict: "osm_id",       // Skip duplicates based on OSM ID
        ignoreDuplicates: true,      // Don't overwrite existing rows
      })
      .select("id");

    if (error) {
      console.error(`  ❌ Batch ${i / BATCH_SIZE + 1} failed:`, error.message);
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

// ============================================================
// Main
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse CLI flags to decide which regions to import.
 *   --test  → just the tiny Venice Beach test region
 *   --all   → all production regions
 *   (none)  → all production regions (default)
 */
function getRegionsToImport(): Region[] {
  const args = process.argv.slice(2);

  if (args.includes("--test")) {
    return [TEST_REGION];
  }

  // Default: import all production regions
  return REGIONS;
}

async function main() {
  const regions = getRegionsToImport();
  const isTest = regions.length === 1 && regions[0] === TEST_REGION;

  console.log("🛹 GoSkate — OSM Skatepark Import");
  console.log("=".repeat(50));
  if (isTest) {
    console.log("🧪 TEST MODE — importing only the Venice Beach test area");
  }
  console.log(`📍 Regions to import: ${regions.length}`);
  console.log(regions.map((r) => `   • ${r.name}`).join("\n"));
  console.log();

  // ---- Step 1: Fetch from Overpass, region by region ----
  console.log("Step 1: Fetching skateparks from OpenStreetMap...");
  let allElements: OverpassElement[] = [];
  let failedRegions = 0;

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    console.log(`  [${i + 1}/${regions.length}] ${region.name}`);

    const elements = await fetchRegion(region);
    allElements = allElements.concat(elements);

    if (elements.length === 0) {
      failedRegions++;
    }

    // Pause between regions to avoid rate limiting
    if (i < regions.length - 1) {
      console.log(`  ⏳ Waiting ${DELAY_BETWEEN_REGIONS_MS / 1000}s before next region...`);
      await sleep(DELAY_BETWEEN_REGIONS_MS);
    }
  }

  console.log();
  console.log(`  📊 Total elements fetched: ${allElements.length}`);
  if (failedRegions > 0) {
    console.log(`  ⚠️  Failed regions: ${failedRegions} (re-run later to retry)`);
  }
  console.log();

  if (allElements.length === 0) {
    console.log("❌ No data fetched. Check your internet or try again later.");
    process.exit(1);
  }

  // ---- Step 2: Convert to rows ----
  console.log("Step 2: Converting to database rows...");
  const rows = convertToRows(allElements);
  console.log(`  📊 Total rows: ${rows.length}`);
  console.log(`  📝 Need review: ${rows.filter((r) => r.needs_review).length}`);
  console.log(`  ✅ Have names: ${rows.filter((r) => r.osm_name).length}`);
  console.log();

  // ---- Step 3: Upsert into Supabase ----
  console.log("Step 3: Upserting into Supabase...");
  await upsertSpots(rows);
  console.log();

  console.log("🎉 Import complete!");
  console.log();
  if (isTest) {
    console.log("Test import worked! Next: run without --test to import all regions:");
    console.log("  npx tsx scripts/import-osm-spots.ts");
  } else {
    console.log("Next steps:");
    console.log("  1. Check your Supabase table for imported spots");
    console.log('  2. Filter by needs_review = true to find spots needing better names');
    console.log("  3. Run scripts/enrich-spots.ts to attempt Google Places enrichment");
    console.log("  4. Manually review uncertain results in Supabase table editor");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
