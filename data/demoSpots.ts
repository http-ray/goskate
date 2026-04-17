// ============================================================
// Demo / mock data — local user-added spots.
//
// Official spots now come from Supabase (imported via the
// OSM import script). Only user-added spots remain here
// as mock data until user spots are also migrated to Supabase.
// ============================================================

import { Spot } from "@/types/spot";

export const DEMO_SPOTS: Spot[] = [
  // ---------- User-added spots (mock / local) ----------
  {
    id: "user-1",
    name: "Santa Monica Gap",
    latitude: 34.0195,
    longitude: -118.4912,
    type: "street",
    source: "user",
    clipsCount: 4,
  },
  {
    id: "user-2",
    name: "Echo Park Rail",
    latitude: 34.0736,
    longitude: -118.2598,
    type: "street",
    source: "user",
    clipsCount: 11,
  },
  {
    id: "user-3",
    name: "Culver City DIY",
    latitude: 34.0211,
    longitude: -118.3965,
    type: "skatepark",
    source: "user",
    clipsCount: 22,
    activeSkaters: 2,
  },
];

// Default center of the map — roughly LA
export const DEFAULT_CENTER: [number, number] = [-118.35, 34.04];
export const DEFAULT_ZOOM = 11;

/**
 * Look up a single spot by its id in the local mock data.
 * For Supabase spots, use the spotsService instead.
 * Returns undefined if not found.
 */
export function getSpotById(id: string): Spot | undefined {
  return DEMO_SPOTS.find((s) => s.id === id);
}
