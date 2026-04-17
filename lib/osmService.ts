// ============================================================
// OSM Service — fetch real skatepark data from OpenStreetMap
//
// Uses the Overpass API to query for:
//   1. leisure=skate_park
//   2. leisure=pitch + sport=skateboard
//
// Converts the results into the app's Spot type.
// Handles both node results (with lat/lon) and way/relation
// results (using center coordinates).
//
// Includes retry logic and multiple API endpoints to handle
// rate limiting (429 errors).
// ============================================================

import { Spot } from "@/types/spot";

/**
 * Multiple Overpass API endpoints to try (fallback for rate limiting)
 */
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

/**
 * The shape of elements returned by Overpass API.
 * Each element can be a node (with lat/lon) or a way/relation
 * (with center lat/lon).
 */
interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number; // Present on nodes
  lon?: number; // Present on nodes
  center?: {
    // Present on ways/relations when "out center" is used
    lat: number;
    lon: number;
  };
  tags?: {
    name?: string;
    leisure?: string;
    sport?: string;
    "addr:city"?: string;
    "addr:street"?: string;
    "addr:housenumber"?: string;
    description?: string;
    [key: string]: string | undefined;
  };
}

interface OverpassResponse {
  elements: OverpassElement[];
}

/**
 * Fetches skateparks within the given bounding box from OpenStreetMap.
 *
 * @param south - Southern latitude
 * @param west - Western longitude
 * @param north - Northern latitude
 * @param east - Eastern longitude
 * @returns Array of Spot objects with source="official"
 */
export async function fetchOSMSkateparks(
  south: number,
  west: number,
  north: number,
  east: number
): Promise<Spot[]> {
  const bbox = `${south},${west},${north},${east}`;

  // Overpass QL query:
  // - Find all nodes/ways/relations with leisure=skate_park
  // - Find all nodes/ways/relations with leisure=pitch + sport=skateboard
  // - Return with "out center" so ways/relations include center coordinates
  const query = `
    [out:json][timeout:25];
    (
      node["leisure"="skate_park"](${bbox});
      way["leisure"="skate_park"](${bbox});
      relation["leisure"="skate_park"](${bbox});
      node["leisure"="pitch"]["sport"="skateboard"](${bbox});
      way["leisure"="pitch"]["sport"="skateboard"](${bbox});
      relation["leisure"="pitch"]["sport"="skateboard"](${bbox});
    );
    out center;
  `;

  // Try each endpoint with retry logic
  let lastError: Error | null = null;

  for (let endpointIndex = 0; endpointIndex < OVERPASS_ENDPOINTS.length; endpointIndex++) {
    const url = OVERPASS_ENDPOINTS[endpointIndex];

    try {
      // Add a small delay to avoid immediate rate limiting (except first try)
      if (endpointIndex > 0) {
        await sleep(2000); // 2 second delay before trying next endpoint
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (response.status === 429) {
        // Rate limited - try next endpoint
        console.warn(`Rate limited on ${url}, trying next endpoint...`);
        lastError = new Error(`Rate limited (429)`);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status}`);
      }

      const data: OverpassResponse = await response.json();

      // Convert each element to a Spot
      return data.elements
        .map((el) => convertOSMElementToSpot(el))
        .filter((spot): spot is Spot => spot !== null);
    } catch (error) {
      console.error(`Failed to fetch from ${url}:`, error);
      lastError = error as Error;
      // Continue to next endpoint
    }
  }

  // All endpoints failed
  console.error("All Overpass API endpoints failed:", lastError);
  throw lastError || new Error("Failed to fetch OSM skateparks");
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Converts a single Overpass element into a Spot.
 * Returns null if the element can't be converted (missing coordinates, etc.).
 */
function convertOSMElementToSpot(el: OverpassElement): Spot | null {
  // Extract lat/lon depending on element type
  let latitude: number | undefined;
  let longitude: number | undefined;

  if (el.type === "node" && el.lat !== undefined && el.lon !== undefined) {
    latitude = el.lat;
    longitude = el.lon;
  } else if (el.center) {
    latitude = el.center.lat;
    longitude = el.center.lon;
  }

  // Skip if we don't have coordinates
  if (latitude === undefined || longitude === undefined) {
    return null;
  }

  // Generate a stable ID from OSM type + id
  const id = `osm-${el.type}-${el.id}`;

  // Generate the best possible name using available tags
  const name = generateSpotName(el, latitude, longitude);

  return {
    id,
    name,
    latitude,
    longitude,
    type: "skatepark",
    source: "official",
    // We don't have clips/activeSkaters data from OSM, so leave these undefined
  };
}

/**
 * Generates a descriptive name for a skatepark using available OSM tags.
 * Only uses real names and address data from OpenStreetMap.
 */
function generateSpotName(
  el: OverpassElement,
  lat: number,
  lon: number
): string {
  const tags = el.tags;

  // 1. Try the name tag first (this is the official name)
  if (tags?.name) {
    return tags.name;
  }

  // 2. Try building a name from address components
  const city = tags?.["addr:city"];
  const street = tags?.["addr:street"];

  if (city && street) {
    return `Skatepark on ${street}, ${city}`;
  }
  if (street) {
    return `Skatepark on ${street}`;
  }
  if (city) {
    return `Skatepark in ${city}`;
  }

  // 3. Try description tag if available
  if (tags?.description) {
    return tags.description;
  }

  // 4. If no usable data exists in OSM, mark it as unnamed
  // This indicates incomplete OSM data for this skatepark
  return "Unnamed Skatepark";
}
