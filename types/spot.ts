// ============================================================
// Spot — the core data model shared across the entire app.
// Every skate spot (official or user-added) follows this shape.
//
// The frontend Spot type is a simplified view of the database
// row. Internal fields like enrichment tracking stay in the DB
// and are not sent to the browser.
// ============================================================

export type Spot = {
  /** Unique identifier (UUID from Supabase, or local mock ID) */
  id: string;
  /** Human-readable name shown on markers & popups */
  name: string;
  /** Latitude coordinate (used internally for map markers / directions) */
  latitude: number;
  /** Longitude coordinate (used internally for map markers / directions) */
  longitude: number;
  /** What kind of spot it is */
  type: "street" | "skatepark";
  /** Who added the spot — "official" = from OSM/Supabase, "user" = community-added */
  source: "official" | "user";
  /** Number of video clips linked to this spot (optional) */
  clipsCount?: number;
  /** How many skaters are currently active here (optional, for future live feature) */
  activeSkaters?: number;
};

// ============================================================
// SupabaseSpotRow — the full row shape as it exists in the
// Supabase "spots" table. Used by import/enrichment scripts
// and the data-loading layer.
// ============================================================

export type SupabaseSpotRow = {
  id: string;
  display_name: string;
  type: "street" | "skatepark";
  source: "official" | "user";
  latitude: number;
  longitude: number;
  osm_name: string | null;
  osm_id: string | null;
  enrichment_checked: boolean;
  enrichment_source: string | null;
  enrichment_confidence: "high" | "medium" | "low" | null;
  needs_review: boolean;
  created_at: string;
};
