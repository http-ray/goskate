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
import {
  LIMITS,
  capText,
  capOrNull,
  isValidLatitude,
  isValidLongitude,
} from "@/lib/validation";

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
type SpotRow = Pick<
  SupabaseSpotRow,
  "id" | "display_name" | "latitude" | "longitude" | "type" | "source" | "created_by"
> & { area_text?: string | null };

export async function fetchPublicSpots(): Promise<Spot[]> {
  const baseSelect = "id, display_name, latitude, longitude, type, source, created_by";

  // Try to include area_text for grouped visible-spot sections.
  // If the column is unavailable in an older DB schema, we retry safely.
  let data: SpotRow[] | null = null;
  let error: { message: string } | null = null;

  const withArea = await supabase
    .from("spots")
    .select(`${baseSelect}, area_text`)
    .eq("status", "approved");

  if (withArea.error) {
    const message = withArea.error.message.toLowerCase();
    const missingAreaColumn =
      message.includes("area_text") &&
      (message.includes("column") || message.includes("does not exist"));

    if (missingAreaColumn) {
      const baseFallback = await supabase
        .from("spots")
        .select(baseSelect)
        .eq("status", "approved");

      data = baseFallback.data as SpotRow[];
      error = baseFallback.error ? { message: baseFallback.error.message } : null;
    } else {
      error = { message: withArea.error.message };
    }
  } else {
    data = withArea.data as SpotRow[];
  }

  if (error) {
    console.error("Failed to fetch spots from Supabase:", error.message);
    throw new Error(`Supabase error: ${error.message}`);
  }

  const rows = data || [];

  // Batch-fetch usernames for user-submitted spots. Official spots have
  // created_by = null so they're excluded. profiles RLS only returns public
  // profiles via the anon key — private-profile submitters show no username.
  const userIds = [
    ...new Set(
      rows
        .filter((r) => r.source === "user" && r.created_by)
        .map((r) => r.created_by as string)
    ),
  ];

  const usernameById: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", userIds);

    (profiles || []).forEach((p: { id: string; username: string | null }) => {
      if (p.username) usernameById[p.id] = p.username;
    });
  }

  return rows.map((row): Spot => ({
    id: row.id,
    name: row.display_name,
    latitude: row.latitude,
    longitude: row.longitude,
    type: row.type,
    source: row.source,
    areaText: row.area_text || undefined,
    submitterUsername:
      row.source === "user" && row.created_by
        ? usernameById[row.created_by]
        : undefined,
  }));
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
  // Validate + cap user input before writing.
  const name = capText(submission.display_name, LIMITS.spotName);
  if (!name) {
    throw new Error("Spot name is required.");
  }
  if (
    !isValidLatitude(submission.latitude) ||
    !isValidLongitude(submission.longitude)
  ) {
    throw new Error("Spot location is invalid.");
  }

  const { data, error } = await supabase
    .from("spots")
    .insert({
      display_name: name,
      type: submission.type,
      source: "user",
      status: "pending",
      latitude: submission.latitude,
      longitude: submission.longitude,
      description: submission.description
        ? capOrNull(submission.description, LIMITS.spotDescription)
        : null,
      obstacle_tags: submission.obstacle_tags || [],
      area_text: submission.area_text
        ? capOrNull(submission.area_text, LIMITS.areaText)
        : null,
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
