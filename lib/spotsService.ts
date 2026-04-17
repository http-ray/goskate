// ============================================================
// Spots Service — loads official spots from Supabase.
//
// This replaces the old direct-from-Overpass approach.
// Official spots are now pre-imported into Supabase via the
// import script, so the frontend just reads from the database.
//
// The function returns the app's Spot type (simplified view).
// Internal fields like enrichment tracking never reach the UI.
// ============================================================

import { supabase } from "@/lib/supabase";
import type { Spot, SupabaseSpotRow } from "@/types/spot";

/**
 * Fetches all official spots from Supabase.
 *
 * Only selects the fields the frontend needs.
 * Coordinates are included for map markers and directions
 * but should never be displayed as text in the UI.
 */
export async function fetchOfficialSpots(): Promise<Spot[]> {
  const { data, error } = await supabase
    .from("spots")
    .select("id, display_name, latitude, longitude, type, source")
    .eq("source", "official");

  if (error) {
    console.error("Failed to fetch spots from Supabase:", error.message);
    throw new Error(`Supabase error: ${error.message}`);
  }

  // Convert Supabase rows to the frontend Spot type
  return (data || []).map(
    (row: Pick<SupabaseSpotRow, "id" | "display_name" | "latitude" | "longitude" | "type" | "source">): Spot => ({
      id: row.id,
      name: row.display_name,   // display_name → name for the frontend
      latitude: row.latitude,
      longitude: row.longitude,
      type: row.type,
      source: row.source,
      // clipsCount and activeSkaters will come from future tables
    })
  );
}
