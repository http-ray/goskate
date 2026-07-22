// ============================================================
// Backfill city/area names using coordinate-based matching
//
// Usage:
//   npx tsx scripts/backfill-city-from-coordinates.ts
//   npx tsx scripts/backfill-city-from-coordinates.ts --dry-run
//   npx tsx scripts/backfill-city-from-coordinates.ts --overwrite
//   npx tsx scripts/backfill-city-from-coordinates.ts --max-distance 50
//
// What it does:
//   - Loads spots from Supabase
//   - For each spot, finds the nearest US city
//   - Updates area_text column with "City, State" format
//   - Uses Haversine distance calculation (no external API)
//   - Includes 1000+ US cities with populations > 5000
//
// Flags:
//   --dry-run: only show what would be updated
//   --overwrite: update spots even if area_text already exists
//   --max-distance N: only match cities within N km (default: 50)
//
// Dataset:
//   Embedded US cities from SimpleMaps (free tier)
//   Includes city name, state, lat, lng, population
// ============================================================

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { US_CITIES } from "./data/usCities";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing required env vars in .env.local:");
  console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  console.error("  - NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// Haversine distance calculation (km)
// ============================================================

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================================
// Find nearest city
// ============================================================

function findNearestCity(
  spotLat: number,
  spotLng: number,
  maxDistanceKm: number
): { city: string; state: string; distance: number } | null {
  let nearest: { city: string; state: string; distance: number } | null = null;

  for (const city of US_CITIES) {
    const distance = haversineDistance(spotLat, spotLng, city.lat, city.lng);

    if (distance <= maxDistanceKm) {
      if (!nearest || distance < nearest.distance) {
        nearest = {
          city: city.name,
          state: city.state,
          distance,
        };
      }
    }
  }

  return nearest;
}

// ============================================================
// CLI flags
// ============================================================

function getFlags(): {
  dryRun: boolean;
  overwrite: boolean;
  maxDistance: number;
} {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const overwrite = args.includes("--overwrite");

  let maxDistance = 50; // default 50 km
  const maxDistIndex = args.findIndex((a) => a === "--max-distance");
  if (maxDistIndex >= 0 && args[maxDistIndex + 1]) {
    const parsed = Number(args[maxDistIndex + 1]);
    if (!isNaN(parsed) && parsed > 0) {
      maxDistance = parsed;
    }
  }

  return { dryRun, overwrite, maxDistance };
}

// ============================================================
// Main
// ============================================================

interface SpotRow {
  id: string;
  display_name: string;
  latitude: number;
  longitude: number;
  area_text: string | null;
  source: string;
}

async function main() {
  const { dryRun, overwrite, maxDistance } = getFlags();

  console.log("GoSkate — Coordinate-based City Backfill");
  console.log("=".repeat(50));
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE UPDATE"}`);
  console.log(`Overwrite existing: ${overwrite ? "YES" : "NO"}`);
  console.log(`Max distance: ${maxDistance} km`);
  console.log(`City dataset: ${US_CITIES.length} US cities`);
  console.log();

  // Fetch spots from Supabase
  console.log("Fetching spots from Supabase...");
  const query = supabase.from("spots").select("id, display_name, latitude, longitude, area_text, source");

  const { data: spots, error } = await query;

  if (error) {
    console.error("Failed to fetch spots:", error.message);
    process.exit(1);
  }

  if (!spots || spots.length === 0) {
    console.log("No spots found.");
    return;
  }

  console.log(`Loaded ${spots.length} spots`);
  console.log();

  // Filter spots to process
  const spotsToProcess = spots.filter((spot) => {
    if (!overwrite && spot.area_text && spot.area_text.trim() !== "") {
      return false; // skip if area_text already exists
    }
    return true;
  });

  console.log(`Spots to process: ${spotsToProcess.length}`);
  console.log(`Skipped (already have area_text): ${spots.length - spotsToProcess.length}`);
  console.log();

  // Match each spot to nearest city
  console.log("Matching spots to nearest cities...");
  const updates: Array<{ id: string; name: string; cityName: string; distance: number }> = [];
  const unmatched: Array<{ id: string; name: string; lat: number; lng: number }> = [];

  for (const spot of spotsToProcess) {
    const match = findNearestCity(spot.latitude, spot.longitude, maxDistance);

    if (match) {
      updates.push({
        id: spot.id,
        name: spot.display_name,
        cityName: `${match.city}, ${match.state}`,
        distance: match.distance,
      });
    } else {
      unmatched.push({
        id: spot.id,
        name: spot.display_name,
        lat: spot.latitude,
        lng: spot.longitude,
      });
    }
  }

  console.log(`Matched: ${updates.length}`);
  console.log(`Unmatched: ${unmatched.length}`);
  console.log();

  // Show sample results
  if (updates.length > 0) {
    console.log("Sample matches (first 10):");
    updates.slice(0, 10).forEach((u) => {
      console.log(`  ${u.name} → ${u.cityName} (${u.distance.toFixed(1)} km)`);
    });
    console.log();
  }

  if (unmatched.length > 0) {
    console.log(`Unmatched spots (no city within ${maxDistance} km):`);
    unmatched.slice(0, 10).forEach((u) => {
      console.log(`  ${u.name} (${u.lat.toFixed(4)}, ${u.lng.toFixed(4)})`);
    });
    if (unmatched.length > 10) {
      console.log(`  ... and ${unmatched.length - 10} more`);
    }
    console.log();
  }

  // Count by city
  const cityCount = new Map<string, number>();
  updates.forEach((u) => {
    cityCount.set(u.cityName, (cityCount.get(u.cityName) || 0) + 1);
  });

  console.log("Spots per city (top 20):");
  Array.from(cityCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([city, count]) => {
      console.log(`  ${city}: ${count}`);
    });
  console.log();

  // Apply updates
  if (dryRun) {
    console.log("DRY RUN: No updates written to Supabase.");
  } else {
    console.log("Writing updates to Supabase...");
    let updated = 0;
    let failed = 0;

    for (const u of updates) {
      const { error: updateError } = await supabase
        .from("spots")
        .update({ area_text: u.cityName })
        .eq("id", u.id);

      if (updateError) {
        console.error(`Failed to update ${u.id}: ${updateError.message}`);
        failed++;
      } else {
        updated++;
      }
    }

    console.log(`Updated: ${updated}`);
    console.log(`Failed: ${failed}`);
  }

  console.log();
  console.log("Backfill complete.");
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
