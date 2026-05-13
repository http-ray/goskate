// ============================================================
// MapView — the main map component that ties everything together.
//
// How it works:
//   1. Initialises a full-screen Leaflet map with dark OSM tiles.
//   2. Loads official skatepark data from Supabase on mount.
//   3. Combines Supabase official spots with local user-added spots.
//   4. Renders a <SpotMarker /> for each spot (with popup).
//   5. Manages check-in state (which spots the user checked into).
//   6. Manages the AddClipModal open/close state.
//   7. Exposes a "Locate Me" handler via window so the
//      BottomLeftWidget can trigger it.
//
// This is a CLIENT component because Leaflet requires browser APIs.
// ============================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { Spot } from "@/types/spot";
import { DEMO_SPOTS } from "@/data/demoSpots";
import SpotMarker from "./SpotMarker";
import AddClipModal from "@/components/ui/AddClipModal";
import { fetchOfficialSpots } from "@/lib/spotsService";

// Keep map navigation focused on the U.S. with a little buffer into
// Canada and Mexico so edge regions still feel natural to explore.
//
// To adjust coverage later:
// - First point is southwest [lat, lng]
// - Second point is northeast [lat, lng]
// - Increase/decrease either latitude or longitude to expand/shrink area
const US_PADDED_BOUNDS: L.LatLngBoundsExpression = [
  [14, -150],
  [60, -52],
];

// Desktop map behavior (kept aligned with the existing desktop experience).
const DESKTOP_CENTER: [number, number] = [39.8283, -98.5795]; // [lat, lng]
const DESKTOP_DEFAULT_ZOOM = 5;
const DESKTOP_MIN_ZOOM = 4;

// Mobile map behavior.
// A slightly lower center keeps the U.S. better centered on tall screens
// and reduces how much Canada appears at zoomed-out levels.
const MOBILE_CENTER: [number, number] = [37.5, -96.0]; // [lat, lng]
// Mobile starts a bit farther out for better regional context.
const MOBILE_DEFAULT_ZOOM = 4;
// Mobile allows one extra zoom-out step compared to desktop.
const MOBILE_MIN_ZOOM = 3;

export default function MapView() {
  // Keep a ref to the Leaflet map instance for imperative actions
  const mapRef = useRef<L.Map | null>(null);

  // Detect mobile by viewport width so we can apply mobile map defaults.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const updateIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    updateIsMobile();
    window.addEventListener("resize", updateIsMobile);

    return () => {
      window.removeEventListener("resize", updateIsMobile);
    };
  }, []);

  const mapCenter = isMobile ? MOBILE_CENTER : DESKTOP_CENTER;
  const defaultZoom = isMobile ? MOBILE_DEFAULT_ZOOM : DESKTOP_DEFAULT_ZOOM;
  const minZoom = isMobile ? MOBILE_MIN_ZOOM : DESKTOP_MIN_ZOOM;

  // ---- Supabase data state ----
  // Official spots loaded from Supabase
  const [officialSpots, setOfficialSpots] = useState<Spot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---- Fetch official spots from Supabase on mount ----
  useEffect(() => {
    fetchOfficialSpots()
      .then((spots) => {
        setOfficialSpots(spots);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load official spots:", error);
        setLoadError("Failed to load skateparks.");
        setIsLoading(false);
      });
  }, []);

  // ---- Combine official OSM spots with local user spots ----
  // Filter DEMO_SPOTS to only include user-added spots
  const userSpots = DEMO_SPOTS.filter((spot) => spot.source === "user");
  // Merge official + user spots
  const allSpots = [...officialSpots, ...userSpots];

  // ---- Check-in state ----
  // A Set of spot IDs the user has checked into (frontend-only).
  const [checkedInSpots, setCheckedInSpots] = useState<Set<string>>(new Set());

  const handleToggleCheckIn = useCallback((spotId: string) => {
    setCheckedInSpots((prev) => {
      const next = new Set(prev);
      if (next.has(spotId)) {
        next.delete(spotId); // check out
      } else {
        next.add(spotId); // check in
      }
      return next;
    });
  }, []);

  // ---- Add Clip modal state ----
  const [clipSpot, setClipSpot] = useState<Spot | null>(null);

  const handleOpenAddClip = useCallback((spot: Spot) => {
    setClipSpot(spot);
  }, []);

  const handleCloseAddClip = useCallback(() => {
    setClipSpot(null);
  }, []);

  // ---- "Locate Me" handler (called from BottomLeftWidget) ----
  const handleLocateMe = useCallback(() => {
    if (!mapRef.current) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.flyTo(
          [pos.coords.latitude, pos.coords.longitude],
          14
        );
      },
      (err) => {
        console.warn("Geolocation error:", err.message);
        alert(
          "Could not get your location. Make sure location access is enabled."
        );
      }
    );
  }, []);

  // Expose locateMe on window so BottomLeftWidget can call it
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__goskate_locateMe =
      handleLocateMe;
    return () => {
      delete (window as unknown as Record<string, unknown>).__goskate_locateMe;
    };
  }, [handleLocateMe]);

  return (
    <>
      <MapContainer
        // Leaflet center uses [lat, lng].
        center={mapCenter}
        zoom={defaultZoom}
        // Keep zoom-out bounded per device profile.
        minZoom={minZoom}
        // Restrict panning so users stay in the supported region.
        maxBounds={US_PADDED_BOUNDS}
        // Higher values create a stronger "rubber-band" near the edge.
        maxBoundsViscosity={0.9}
        zoomControl={false}
        className="absolute inset-0 z-0 h-full w-full"
        ref={mapRef}
        // Recreate map when crossing mobile/desktop breakpoint so
        // the correct initial center/zoom is always applied.
        key={isMobile ? "mobile-map" : "desktop-map"}
      >
        {/* --- Dark-themed OpenStreetMap tiles --- */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          minZoom={minZoom}
        />

        {/* --- One marker per spot --- */}
        {allSpots.map((spot) => (
          <SpotMarker
            key={spot.id}
            spot={spot}
            checkInCount={checkedInSpots.has(spot.id) ? 1 : 0}
            isCheckedIn={checkedInSpots.has(spot.id)}
            onToggleCheckIn={handleToggleCheckIn}
            onAddClip={handleOpenAddClip}
          />
        ))}
      </MapContainer>

      {/* --- Loading indicator --- */}
      {isLoading && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-zinc-900/90 text-white text-sm rounded-full backdrop-blur">
          Loading skateparks...
        </div>
      )}

      {/* --- Error indicator --- */}
      {loadError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-900/90 text-white text-sm rounded-full backdrop-blur">
          {loadError}
        </div>
      )}

      {/* --- Add Clip modal (rendered outside the map) --- */}
      {clipSpot && (
        <AddClipModal spot={clipSpot} onClose={handleCloseAddClip} />
      )}
    </>
  );
}
