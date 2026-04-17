// ============================================================
// Enrichment Script — improve weak skatepark names using
// Google Places API (Nearby Search).
//
// Usage:
//   npx tsx scripts/enrich-spots.ts
//
// What it does:
//   1. Loads spots from Supabase where:
//      - needs_review = true, AND
//      - enrichment_checked = false (hasn't been tried yet)
//   2. For each spot, queries Google Places Nearby Search
//      using the spot's coordinates + "skatepark" keyword
//   3. If a confident match is found, updates display_name
//   4. Always marks enrichment_checked = true so we don't retry
//   5. Uncertain results get needs_review = true for manual review
//
// Important rules:
//   - Do NOT append "Skatepark" to names if the real name is
//     something like "Bay Creek Park" — keep the real name
//   - This script is meant to be run manually and infrequently
//   - It does NOT run in the frontend
//   - You need a GOOGLE_PLACES_API_KEY in .env.local
//
// Requirements:
//   - .env.local with NEXT_PUBLIC_SUPABASE_URL,
//     NEXT_PUBLIC_SUPABASE_ANON_KEY, GOOGLE_PLACES_API_KEY
//   - The spots table populated (run import-osm-spots.ts first)
//   - Install tsx if not present: npm install -D tsx
// ============================================================

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local from project root
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials in .env.local");
  process.exit(1);
}

if (!googleApiKey) {
  console.error("❌ Missing GOOGLE_PLACES_API_KEY in .env.local");
  console.error("   Get one at: https://console.cloud.google.com/apis/credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// Configuration
// ============================================================

// Maximum spots to enrich per run (to control API costs)
const MAX_SPOTS_PER_RUN = 20;

// Radius in meters to search around each spot
const SEARCH_RADIUS_M = 200;

// Delay between Google API calls (ms) to stay under rate limits
const DELAY_BETWEEN_CALLS_MS = 1500;

// ============================================================
// Step 1: Load spots that need enrichment
// ============================================================

interface SpotToEnrich {
  id: string;
  display_name: string;
  latitude: number;
  longitude: number;
  osm_name: string | null;
}

async function loadSpotsNeedingEnrichment(): Promise<SpotToEnrich[]> {
  const { data, error } = await supabase
    .from("spots")
    .select("id, display_name, latitude, longitude, osm_name")
    .eq("needs_review", true)
    .eq("enrichment_checked", false)
    .limit(MAX_SPOTS_PER_RUN);

  if (error) {
    throw new Error(`Failed to load spots: ${error.message}`);
  }

  return data || [];
}

// ============================================================
// Step 2: Query Google Places for a better name
// ============================================================

interface GooglePlaceResult {
  name: string;
  vicinity: string;
  types: string[];
  geometry: {
    location: { lat: number; lng: number };
  };
}

interface GoogleNearbyResponse {
  results: GooglePlaceResult[];
  status: string;
}

async function findNearbyPlace(
  lat: number,
  lon: number
): Promise<GooglePlaceResult | null> {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
  );
  url.searchParams.set("location", `${lat},${lon}`);
  url.searchParams.set("radius", String(SEARCH_RADIUS_M));
  url.searchParams.set("keyword", "skatepark");
  url.searchParams.set("key", googleApiKey!);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Google Places API error: ${response.status}`);
  }

  const data: GoogleNearbyResponse = await response.json();

  if (data.status !== "OK" || data.results.length === 0) {
    return null;
  }

  // Return the closest / most relevant result
  return data.results[0];
}

// ============================================================
// Step 3: Decide confidence and update the spot
// ============================================================

/**
 * Determines how confident we are that the Google result is the
 * correct name for this skatepark.
 *
 * HIGH: Google returned a park-type place very close by
 * MEDIUM: Google returned something nearby but it might be a different place
 * LOW: The result is far away or the type doesn't match well
 */
function assessConfidence(
  spot: SpotToEnrich,
  place: GooglePlaceResult
): "high" | "medium" | "low" {
  // Check if the Google types include park-related categories
  const parkTypes = ["park", "point_of_interest", "establishment"];
  const hasRelevantType = place.types.some((t) => parkTypes.includes(t));

  // Calculate rough distance (degrees → ~meters at LA latitude)
  const dlat = Math.abs(spot.latitude - place.geometry.location.lat);
  const dlon = Math.abs(spot.longitude - place.geometry.location.lng);
  const approxDistM = Math.sqrt(dlat ** 2 + dlon ** 2) * 111_000;

  if (hasRelevantType && approxDistM < 100) {
    return "high";
  } else if (approxDistM < 200) {
    return "medium";
  } else {
    return "low";
  }
}

async function updateSpot(
  spotId: string,
  place: GooglePlaceResult | null,
  confidence: "high" | "medium" | "low" | null
): Promise<void> {
  if (place && confidence === "high") {
    // High confidence — update the display name directly
    // Use the real place name as-is (e.g. "Bay Creek Park", not "Bay Creek Park Skatepark")
    const { error } = await supabase
      .from("spots")
      .update({
        display_name: place.name,
        enrichment_checked: true,
        enrichment_source: "google_places",
        enrichment_confidence: confidence,
        needs_review: false, // confident enough to auto-approve
      })
      .eq("id", spotId);

    if (error) throw new Error(`Update failed for ${spotId}: ${error.message}`);
  } else if (place && (confidence === "medium" || confidence === "low")) {
    // Low/medium confidence — store the suggestion but keep needs_review = true
    // The human reviewer can accept or reject in Supabase table editor
    const { error } = await supabase
      .from("spots")
      .update({
        // Don't change display_name — leave the current value
        // The reviewer can see enrichment_source to know what Google suggested
        enrichment_checked: true,
        enrichment_source: `google_places:${place.name}`,
        enrichment_confidence: confidence,
        needs_review: true, // still needs human review
      })
      .eq("id", spotId);

    if (error) throw new Error(`Update failed for ${spotId}: ${error.message}`);
  } else {
    // No result from Google — mark as checked but still needs review
    const { error } = await supabase
      .from("spots")
      .update({
        enrichment_checked: true,
        enrichment_source: null,
        enrichment_confidence: null,
        needs_review: true,
      })
      .eq("id", spotId);

    if (error) throw new Error(`Update failed for ${spotId}: ${error.message}`);
  }
}

// ============================================================
// Main
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("🛹 GoSkate — Spot Name Enrichment");
  console.log("=".repeat(50));
  console.log();

  // Step 1: Load spots
  console.log("Step 1: Loading spots that need enrichment...");
  const spots = await loadSpotsNeedingEnrichment();
  console.log(`  Found ${spots.length} spots to process`);
  console.log();

  if (spots.length === 0) {
    console.log("Nothing to do! All spots have been checked.");
    return;
  }

  // Step 2 & 3: Enrich each spot
  let enriched = 0;
  let reviewNeeded = 0;
  let noResult = 0;

  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i];
    console.log(
      `[${i + 1}/${spots.length}] "${spot.display_name}" (${spot.id.slice(0, 8)}...)`
    );

    try {
      const place = await findNearbyPlace(spot.latitude, spot.longitude);

      if (place) {
        const confidence = assessConfidence(spot, place);
        console.log(
          `  → Google: "${place.name}" (confidence: ${confidence})`
        );

        await updateSpot(spot.id, place, confidence);

        if (confidence === "high") {
          enriched++;
        } else {
          reviewNeeded++;
        }
      } else {
        console.log("  → No Google result found");
        await updateSpot(spot.id, null, null);
        noResult++;
      }
    } catch (err) {
      console.error(`  ❌ Error:`, (err as Error).message);
    }

    // Delay between calls to avoid rate limiting
    if (i < spots.length - 1) {
      await sleep(DELAY_BETWEEN_CALLS_MS);
    }
  }

  console.log();
  console.log("=".repeat(50));
  console.log(`✅ Auto-enriched (high confidence): ${enriched}`);
  console.log(`🔍 Needs manual review: ${reviewNeeded}`);
  console.log(`❌ No Google result: ${noResult}`);
  console.log();
  console.log("Next steps:");
  console.log("  1. Open your Supabase table editor");
  console.log('  2. Filter spots where needs_review = true');
  console.log("  3. Check enrichment_source to see Google's suggestion");
  console.log("  4. Manually set display_name and set needs_review = false");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
