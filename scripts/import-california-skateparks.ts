// ============================================================
// California Skatepark Import (Google Places -> Supabase)
//
// Usage:
//   npx tsx scripts/import-california-skateparks.ts
//   npx tsx scripts/import-california-skateparks.ts --tile-size 2.5
//   npx tsx scripts/import-california-skateparks.ts --max-pages 3
//
// What it does:
//   1. Sweeps California using smaller bbox tiles
//   2. Fetches skateparks from Google Places Text Search
//   3. Skips duplicates by place ID and by display_name
//   4. Caches official spots in Supabase
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
  console.error("Missing required env vars in .env.local:");
  console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  console.error("  - NEXT_PUBLIC_SUPABASE_ANON_KEY");
  console.error("  - GOOGLE_MAPS_API_KEY");
  process.exit(1);
}

const googlePlacesApiKey: string = googleMapsApiKey;
const supabase = createClient(supabaseUrl, supabaseKey);

const GOOGLE_PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const DELAY_BETWEEN_TILES_MS = 2500;
const DELAY_BETWEEN_PAGES_MS = 2500;
const PAGE_SIZE = 20;
const DEFAULT_MAX_PAGES = 3;

// Approximate California bounding rectangle.
const CALIFORNIA_BOUNDS = {
  south: 32.5,
  west: -124.5,
  north: 42.1,
  east: -114.1,
};

interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseNumberFlag(flagName: string, defaultValue: number): number {
  const args = process.argv.slice(2);
  const index = args.findIndex((a) => a === flagName);
  const equalsValue = args.find((a) => a.startsWith(`${flagName}=`));

  let raw: string | undefined;
  if (index >= 0 && args[index + 1]) {
    raw = args[index + 1];
  } else if (equalsValue) {
    raw = equalsValue.split("=").slice(1).join("=");
  }

  if (!raw) {
    return defaultValue;
  }

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) {
    console.error(`Invalid value for ${flagName}: ${raw}`);
    process.exit(1);
  }

  return parsed;
}

function buildCaliforniaTiles(tileSizeDeg: number): BBox[] {
  const tiles: BBox[] = [];

  for (let south = CALIFORNIA_BOUNDS.south; south < CALIFORNIA_BOUNDS.north; south += tileSizeDeg) {
    const north = Math.min(south + tileSizeDeg, CALIFORNIA_BOUNDS.north);
    for (let west = CALIFORNIA_BOUNDS.west; west < CALIFORNIA_BOUNDS.east; west += tileSizeDeg) {
      const east = Math.min(west + tileSizeDeg, CALIFORNIA_BOUNDS.east);
      tiles.push({ south, west, north, east });
    }
  }

  return tiles;
}

function isSkateparkPlace(place: GooglePlace): boolean {
  const types = place.types ?? [];
  const name = place.displayName?.text?.toLowerCase() ?? "";

  if (types.includes("skate_park")) {
    return true;
  }

  // Fallback heuristic for results that miss type tagging.
  return name.includes("skate");
}

async function fetchTilePlaces(tile: BBox, maxPages: number): Promise<{ ok: boolean; places: GooglePlace[]; error?: string }> {
  const places: GooglePlace[] = [];
  let nextPageToken: string | undefined;

  for (let page = 1; page <= maxPages; page++) {
    if (page > 1 && !nextPageToken) {
      break;
    }

    if (page > 1) {
      await sleep(DELAY_BETWEEN_PAGES_MS);
    }

    const body: Record<string, unknown> = {
      textQuery: "skatepark",
      pageSize: PAGE_SIZE,
      locationRestriction: {
        rectangle: {
          low: { latitude: tile.south, longitude: tile.west },
          high: { latitude: tile.north, longitude: tile.east },
        },
      },
    };

    if (nextPageToken) {
      body.pageToken = nextPageToken;
    }

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
      places.push(...(data.places ?? []));
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

async function fetchExistingOfficialNameSet(): Promise<Set<string>> {
  const set = new Set<string>();
  const PAGE_SIZE_DB = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("spots")
      .select("display_name")
      .eq("source", "official")
      .range(offset, offset + PAGE_SIZE_DB - 1);

    if (error) {
      throw new Error(`Failed to fetch existing names: ${error.message}`);
    }

    const rows = data ?? [];
    for (const row of rows) {
      if (row.display_name) {
        set.add(normalizeName(row.display_name));
      }
    }

    if (rows.length < PAGE_SIZE_DB) {
      break;
    }

    offset += PAGE_SIZE_DB;
  }

  return set;
}

function convertPlacesToRows(
  allPlaces: GooglePlace[],
  existingOfficialNames: Set<string>
): { rows: SpotRow[]; skippedByName: number; skippedById: number } {
  const rowsById = new Map<string, SpotRow>();
  let skippedByName = 0;
  let skippedById = 0;

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

    const rowId = `google_place/${placeId}`;

    if (rowsById.has(rowId)) {
      skippedById++;
      continue;
    }

    const normalizedDisplayName = normalizeName(displayName);
    if (existingOfficialNames.has(normalizedDisplayName)) {
      skippedByName++;
      continue;
    }

    existingOfficialNames.add(normalizedDisplayName);

    rowsById.set(rowId, {
      display_name: displayName,
      type: "skatepark",
      source: "official",
      latitude: lat,
      longitude: lon,
      osm_name: name,
      osm_id: rowId,
      needs_review: needsReview,
    });
  }

  return {
    rows: Array.from(rowsById.values()),
    skippedByName,
    skippedById,
  };
}

async function upsertSpots(rows: SpotRow[]): Promise<void> {
  if (rows.length === 0) {
    console.log("No rows to insert.");
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
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${error.message}`);
      skipped += batch.length;
    } else {
      inserted += data?.length ?? 0;
    }
  }

  console.log(`Inserted: ${inserted}`);
  if (skipped > 0) {
    console.log(`Skipped/errored in upsert: ${skipped}`);
  }
}

async function main() {
  const tileSizeDeg = parseNumberFlag("--tile-size", 2.5);
  const maxPages = parseNumberFlag("--max-pages", DEFAULT_MAX_PAGES);

  const tiles = buildCaliforniaTiles(tileSizeDeg);

  console.log("GoSkate — California Skatepark Import (Google Places)");
  console.log("=".repeat(62));
  console.log(`Tile size: ${tileSizeDeg} degrees`);
  console.log(`Max pages per tile: ${maxPages}`);
  console.log(`Total tiles: ${tiles.length}`);
  console.log();

  console.log("Step 1: Loading existing official names for duplicate-name checks...");
  const existingOfficialNames = await fetchExistingOfficialNameSet();
  console.log(`Existing official names loaded: ${existingOfficialNames.size}`);
  console.log();

  console.log("Step 2: Fetching skateparks from Google Places tile-by-tile...");
  const allPlaces: GooglePlace[] = [];
  const failedTiles: Array<{ tile: BBox; reason: string }> = [];

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    const label = `${tile.south},${tile.west},${tile.north},${tile.east}`;
    console.log(`[${i + 1}/${tiles.length}] Tile ${label}`);

    const result = await fetchTilePlaces(tile, maxPages);
    if (result.ok) {
      allPlaces.push(...result.places);
      console.log(`  Places fetched: ${result.places.length}`);
    } else {
      failedTiles.push({ tile, reason: result.error ?? "unknown error" });
      console.log(`  Failed: ${result.error ?? "unknown error"}`);
    }

    if (i < tiles.length - 1) {
      await sleep(DELAY_BETWEEN_TILES_MS);
    }
  }

  console.log();
  console.log(`Raw places fetched: ${allPlaces.length}`);
  console.log(`Failed tiles: ${failedTiles.length}`);
  if (failedTiles.length > 0) {
    console.log("Failed tile list (for reruns):");
    for (const failed of failedTiles) {
      const t = failed.tile;
      console.log(`  --bbox ${t.south},${t.west},${t.north},${t.east}`);
      console.log(`     reason: ${failed.reason}`);
    }
  }
  console.log();

  console.log("Step 3: Normalizing and deduping (by place ID + name)...");
  const { rows, skippedByName, skippedById } = convertPlacesToRows(
    allPlaces,
    existingOfficialNames
  );
  console.log(`Rows after normalization: ${rows.length}`);
  console.log(`Skipped duplicate place IDs: ${skippedById}`);
  console.log(`Skipped duplicate names (Supabase + current run): ${skippedByName}`);
  console.log();

  console.log("Step 4: Caching rows in Supabase...");
  await upsertSpots(rows);
  console.log();

  console.log("Import complete.");
  console.log("Rerun options:");
  console.log("  npx tsx scripts/import-california-skateparks.ts");
  console.log("  npx tsx scripts/import-california-skateparks.ts --tile-size 2.0");
  console.log("  npx tsx scripts/import-california-skateparks.ts --max-pages 2");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
