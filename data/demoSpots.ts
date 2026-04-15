// ============================================================
// Demo / mock data — hardcoded skate spots used during V1.
// Replace this with real API calls once a backend is ready.
//
// These spots are centered around Los Angeles so the map has
// a realistic cluster to look at on first load.
// ============================================================

import { Spot } from "@/types/spot";

export const DEMO_SPOTS: Spot[] = [
  // ---------- Official spots ----------
  {
    id: "official-1",
    name: "Venice Beach Skatepark",
    latitude: 33.985,
    longitude: -118.4695,
    type: "skatepark",
    source: "official",
    clipsCount: 142,
    activeSkaters: 8,
  },
  {
    id: "official-2",
    name: "Stoner Skate Plaza",
    latitude: 34.0365,
    longitude: -118.4475,
    type: "skatepark",
    source: "official",
    clipsCount: 67,
    activeSkaters: 3,
  },
  {
    id: "official-3",
    name: "Hollywood High 16",
    latitude: 34.1017,
    longitude: -118.3385,
    type: "street",
    source: "official",
    clipsCount: 231,
  },
  {
    id: "official-4",
    name: "The Berrics",
    latitude: 34.0275,
    longitude: -118.2375,
    type: "skatepark",
    source: "official",
    clipsCount: 512,
    activeSkaters: 12,
  },
  {
    id: "official-5",
    name: "Courthouse Ledges (DTLA)",
    latitude: 34.0503,
    longitude: -118.2468,
    type: "street",
    source: "official",
    clipsCount: 89,
  },

  // ---------- User-added spots ----------
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
 * Look up a single spot by its id.
 * Returns undefined if not found.
 */
export function getSpotById(id: string): Spot | undefined {
  return DEMO_SPOTS.find((s) => s.id === id);
}
