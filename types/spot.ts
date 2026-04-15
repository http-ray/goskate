// ============================================================
// Spot — the core data model shared across the entire app.
// Every skate spot (official or user-added) follows this shape.
// ============================================================

export type Spot = {
  /** Unique identifier for the spot */
  id: string;
  /** Human-readable name shown on markers & popups */
  name: string;
  /** GPS coordinates */
  latitude: number;
  longitude: number;
  /** What kind of spot it is */
  type: "street" | "skatepark";
  /** Who added the spot — "official" means pre-loaded, "user" means community-added */
  source: "official" | "user";
  /** Number of video clips linked to this spot (optional) */
  clipsCount?: number;
  /** How many skaters are currently active here (optional, for future live feature) */
  activeSkaters?: number;
};
