// ============================================================
// Backfill Georgia area_text labels for existing official spots.
//
// Usage:
//   npx tsx scripts/backfill-georgia-area-text.ts
//   npx tsx scripts/backfill-georgia-area-text.ts --dry-run
//
// What it does:
//   - Sets area_text for official spots in Georgia when area_text is empty
//   - Uses simple bounding boxes (no external APIs)
//   - Never updates display_name, coordinates, or user-submitted spots
//
// Notes:
//   - This script only updates rows where area_text is NULL or blank
//   - Re-running is safe
// ============================================================

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

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

type AreaRule = {
  label: string;
  south: number;
  west: number;
  north: number;
  east: number;
};

const GEORGIA_AREAS: AreaRule[] = [
  { label: "Atlanta Metro", south: 33.2, west: -84.9, north: 34.1, east: -84.2 },
  { label: "Gwinnett / Lawrenceville", south: 33.8, west: -84.25, north: 34.15, east: -83.8 },
  { label: "Athens", south: 33.85, west: -83.55, north: 34.1, east: -83.25 },
  { label: "Gainesville / Jefferson", south: 34.1, west: -83.9, north: 34.55, east: -83.4 },
  { label: "Savannah", south: 31.85, west: -81.4, north: 32.3, east: -80.85 },
  { label: "Augusta", south: 33.2, west: -82.3, north: 33.65, east: -81.85 },
  { label: "Macon", south: 32.65, west: -83.9, north: 32.95, east: -83.5 },
];

function isDryRun(): boolean {
  return process.argv.slice(2).includes("--dry-run");
}

async function countCandidates(rule: AreaRule): Promise<number> {
  const { count, error } = await supabase
    .from("spots")
    .select("id", { count: "exact", head: true })
    .eq("source", "official")
    .gte("latitude", rule.south)
    .lte("latitude", rule.north)
    .gte("longitude", rule.west)
    .lte("longitude", rule.east)
    .or("area_text.is.null,area_text.eq.");

  if (error) throw new Error(`Count failed for ${rule.label}: ${error.message}`);
  return count ?? 0;
}

async function applyRule(rule: AreaRule): Promise<number> {
  const { data, error } = await supabase
    .from("spots")
    .update({ area_text: rule.label })
    .eq("source", "official")
    .gte("latitude", rule.south)
    .lte("latitude", rule.north)
    .gte("longitude", rule.west)
    .lte("longitude", rule.east)
    .or("area_text.is.null,area_text.eq.")
    .select("id");

  if (error) throw new Error(`Update failed for ${rule.label}: ${error.message}`);
  return data?.length ?? 0;
}

async function main() {
  const dryRun = isDryRun();

  console.log("GoSkate — Georgia area_text backfill");
  console.log("=".repeat(44));
  if (dryRun) {
    console.log("DRY RUN: no updates will be written.");
  }
  console.log();

  let total = 0;

  for (const rule of GEORGIA_AREAS) {
    const candidates = await countCandidates(rule);

    if (dryRun) {
      console.log(`${rule.label}: ${candidates} rows would be updated`);
      total += candidates;
      continue;
    }

    const updated = await applyRule(rule);
    console.log(`${rule.label}: ${updated} rows updated`);
    total += updated;
  }

  console.log();
  if (dryRun) {
    console.log(`Total rows that would be updated: ${total}`);
  } else {
    console.log(`Total rows updated: ${total}`);
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
