// ============================================================
// Spots Service — loads spots from Supabase and handles submissions.
//
// Fetching:
//   - fetchPublicSpots() returns both official and approved user spots
//
// Submission:
//   - submitSpot() creates a new user-submitted spot (status = pending)
//   - checkNearbySpots() detects possible duplicates within a radius
//
// The function returns the app's Spot type (simplified view).
// Internal fields like enrichment tracking never reach the UI.
// ============================================================

import { supabase } from "@/lib/supabase";
import type { Spot, SupabaseSpotRow, SpotSubmission } from "@/types/spot";

/**
 * Fetches all publicly visible spots from Supabase.
 *
 * Includes:
 *   - Official spots (from imports) with status = 'approved'
 *   - User-submitted spots with status = 'approved'
 *
 * Excludes:
 *   - Pending, rejected, or flagged spots (unless viewing your own)
 *
 * Only selects the fields the frontend needs.
 * Coordinates are included for map markers and directions
 * but should never be displayed as text in the UI.
 */
export async function fetchPublicSpots(): Promise<Spot[]> {
  const baseSelect = "id, display_name, latitude, longitude, type, source";

  // Try to include area_text + region_label for grouped visible-spot sections.
  // If either column is unavailable in an older DB schema, we retry safely.
  let data: Array<
    Pick<
      SupabaseSpotRow,
      "id" | "display_name" | "latitude" | "longitude" | "type" | "source"
    > & { area_text?: string | null; region_label?: string | null }
  > | null = null;

  let error: { message: string } | null = null;

  const withArea = await supabase
    .from("spots")
    .select(`${baseSelect}, area_text, region_label`)
    .eq("status", "approved");

  if (withArea.error) {
    const message = withArea.error.message.toLowerCase();
    const missingGroupingColumn =
      (message.includes("area_text") || message.includes("region_label")) &&
      (message.includes("column") || message.includes("does not exist"));

    if (missingGroupingColumn) {
      // First fallback: try area_text only.
      const withAreaOnly = await supabase
        .from("spots")
        .select(`${baseSelect}, area_text`)
        .eq("status", "approved");

      if (withAreaOnly.error) {
        const areaOnlyMessage = withAreaOnly.error.message.toLowerCase();
        const missingAreaToo =
          areaOnlyMessage.includes("area_text") &&
          (areaOnlyMessage.includes("column") ||
            areaOnlyMessage.includes("does not exist"));

        if (missingAreaToo) {
          // Final fallback: base fields only.
          const baseFallback = await supabase
            .from("spots")
            .select(baseSelect)
            .eq("status", "approved");

          data = baseFallback.data as Array<
            Pick<
              SupabaseSpotRow,
              "id" | "display_name" | "latitude" | "longitude" | "type" | "source"
            > & { area_text?: string | null; region_label?: string | null }
          >;

          error = baseFallback.error ? { message: baseFallback.error.message } : null;
        } else {
          error = { message: withAreaOnly.error.message };
        }
      } else {
        data = withAreaOnly.data as Array<
          Pick<
            SupabaseSpotRow,
            "id" | "display_name" | "latitude" | "longitude" | "type" | "source"
          > & { area_text?: string | null; region_label?: string | null }
        >;
        error = null;
      }
    } else {
      error = { message: withArea.error.message };
    }
  } else {
    data = withArea.data as Array<
      Pick<
        SupabaseSpotRow,
        "id" | "display_name" | "latitude" | "longitude" | "type" | "source"
      > & { area_text?: string | null; region_label?: string | null }
    >;
  }

  if (error) {
    console.error("Failed to fetch spots from Supabase:", error.message);
    throw new Error(`Supabase error: ${error.message}`);
  }

  // Convert Supabase rows to the frontend Spot type
  return (data || []).map(
    (row: Pick<SupabaseSpotRow, "id" | "display_name" | "latitude" | "longitude" | "type" | "source"> & {
      area_text?: string | null;
      region_label?: string | null;
    }): Spot => ({
      id: row.id,
      name: row.display_name,   // display_name → name for the frontend
      latitude: row.latitude,
      longitude: row.longitude,
      type: row.type,
      source: row.source,
      areaText: row.area_text || undefined,
      regionLabel: row.region_label || undefined,
      // clipsCount and activeSkaters will come from future tables
    })
  );
}

/**
 * Legacy alias for backwards compatibility.
 * New code should use fetchPublicSpots().
 */
export async function fetchOfficialSpots(): Promise<Spot[]> {
  return fetchPublicSpots();
}

/**
 * Submits a new user spot. Returns the inserted row ID on success.
 *
 * The spot is created with:
 *   - source = 'user'
 *   - status = 'pending' (awaits moderation)
 *   - created_by = current authenticated user
 *
 * Throws if the user is not authenticated or if the insert fails.
 */
export async function submitSpot(
  userId: string,
  submission: SpotSubmission
): Promise<string> {
  const { data, error } = await supabase
    .from("spots")
    .insert({
      display_name: submission.display_name,
      type: submission.type,
      source: "user",
      status: "pending",
      latitude: submission.latitude,
      longitude: submission.longitude,
      description: submission.description || null,
      obstacle_tags: submission.obstacle_tags || [],
      area_text: submission.area_text || null,
      created_by: userId,
      osm_name: null,
      osm_id: null,
      needs_review: false,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to submit spot:", error.message);
    throw new Error(`Supabase error: ${error.message}`);
  }

  return data.id;
}

/**
 * Checks for existing spots near a given location.
 *
 * Returns spots within `radiusMeters` of the given coordinates.
 * Used for duplicate detection before submission.
 *
 * Note: This is a simplified lat/lng distance check.
 * For production, consider PostGIS ST_DWithin for accurate geospatial queries.
 */
export async function checkNearbySpots(
  lat: number,
  lng: number,
  radiusMeters = 100
): Promise<Spot[]> {
  // Approximate degrees per meter at equator
  // 1 degree latitude ≈ 111,320 meters
  // This is a rough approximation; PostGIS would be more accurate
  const latDelta = radiusMeters / 111320;
  const lngDelta = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));

  const { data, error } = await supabase
    .from("spots")
    .select("id, display_name, latitude, longitude, type, source, status")
    .gte("latitude", lat - latDelta)
    .lte("latitude", lat + latDelta)
    .gte("longitude", lng - lngDelta)
    .lte("longitude", lng + lngDelta);

  if (error) {
    console.error("Failed to check nearby spots:", error.message);
    return [];
  }

  return (data || []).map(
    (row: Pick<SupabaseSpotRow, "id" | "display_name" | "latitude" | "longitude" | "type" | "source">): Spot => ({
      id: row.id,
      name: row.display_name,
      latitude: row.latitude,
      longitude: row.longitude,
      type: row.type,
      source: row.source,
    })
  );
}
