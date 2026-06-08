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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet.markercluster/dist/MarkerCluster.css";

import { Spot } from "@/types/spot";
import { DEMO_SPOTS } from "@/data/demoSpots";
import SpotMarker from "./SpotMarker";
import AddClipModal from "@/components/ui/AddClipModal";
import VisibleSpotsPanel from "@/components/ui/VisibleSpotsPanel";
import BottomLeftWidget from "@/components/ui/BottomLeftWidget";
import { fetchPublicSpots } from "@/lib/spotsService";

// ---- Cluster bubble icon (GoSkate brand colours) ----
// react-leaflet-cluster calls this function to build the icon for each
// cluster bubble.  We replace the default blue circles with a dark-green
// bubble that matches the official spot marker colour (#22c55e).
function createClusterIcon(cluster: any): L.DivIcon {
  const count = cluster.getChildCount();
  // Grow the bubble slightly as the cluster gets bigger.
  const size = count < 10 ? 36 : count < 50 ? 44 : 52;

  return L.divIcon({
    className: "", // clear Leaflet's default class
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `
      <div style="
        display:flex;align-items:center;justify-content:center;
        width:${size}px;height:${size}px;
        background:rgba(34,197,94,0.88);
        border-radius:50%;
        border:2px solid rgba(255,255,255,0.25);
        box-shadow:0 2px 8px rgba(0,0,0,0.55);
        color:#fff;font-size:13px;font-weight:700;
        font-family:system-ui,sans-serif;
        cursor:pointer;
      ">${count}</div>
    `,
  });
}

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
  // Public spots loaded from Supabase (official + approved user spots)
  const [publicSpots, setPublicSpots] = useState<Spot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---- Fetch public spots from Supabase on mount ----
  useEffect(() => {
    fetchPublicSpots()
      .then((spots) => {
        setPublicSpots(spots);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load public spots:", error);
        setLoadError("Failed to load skateparks.");
        setIsLoading(false);
      });
  }, []);

  // ---- Combine official OSM spots with local user spots ----
  //
  // ROOT CAUSE OF THE INFINITE LOOP (now fixed):
  //   Without useMemo, these two lines run on EVERY render and create new
  //   array references each time — even when the data hasn't changed.
  //   The visible spots useEffect had [allSpots] in its deps, so a new
  //   reference triggered the effect → setVisibleSpots → re-render →
  //   new allSpots reference → effect again → infinite loop.
  //
  // The fix: useMemo makes `allSpots` return the SAME array reference
  //   unless `officialSpots` actually changes.  Since officialSpots only
  //   changes once (when Supabase loads), the visible spots effect runs
  //   exactly twice: on mount (empty) and once when data arrives.
  //   After that, panning/zooming calls setVisibleSpots but doesn't
  //   change `allSpots`, so the effect never re-runs in a loop.

  // Filter DEMO_SPOTS to only include user-added spots.
  // DEMO_SPOTS is a module-level constant so this never needs to recompute.
  const userSpots = useMemo(
    () => DEMO_SPOTS.filter((spot) => spot.source === "user"),
    [], // empty deps — DEMO_SPOTS never changes
  );

  // Stable merged array — only recomputed when Supabase data arrives.
  const allSpots = useMemo(
    () => [...publicSpots, ...userSpots],
    [publicSpots, userSpots],
  );

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

  // ---- Visible spots state ----
  // Tracks which spots fall inside the current map viewport.
  // Updated whenever the user pans or zooms via the moveend/zoomend effect below.
  const [visibleSpots, setVisibleSpots] = useState<Spot[]>([]);

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

  // ---- Visible spots — recalculate when the viewport or data changes ----
  //
  // This effect is safe from infinite loops because `allSpots` is wrapped in
  // useMemo above and only gets a new reference when `officialSpots` changes
  // (i.e., once after Supabase loads).  Calling setVisibleSpots on moveend
  // triggers a re-render, but `allSpots` keeps its stable reference → the
  // effect does NOT re-run → no loop.
  //
  // `isMobile` is also in deps because the MapContainer remounts (via its
  // `key` prop) when the breakpoint changes — we need to re-attach listeners
  // to the new map instance.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Filter allSpots to those whose coordinates fall inside the current
    // Leaflet viewport rectangle.  O(n) per call — fast enough for thousands
    // of spots since getBounds().contains() is a simple range check.
    function updateVisible() {
      const bounds = map!.getBounds();
      setVisibleSpots(
        allSpots.filter((spot) =>
          bounds.contains([spot.latitude, spot.longitude])
        )
      );
    }

    // Populate the panel immediately on mount / data load.
    updateVisible();

    // Re-run only when the user finishes moving (moveend) or zooming
    // (zoomend) — not continuously while dragging, which would be expensive.
    map.on("moveend", updateVisible);
    map.on("zoomend", updateVisible);

    // Remove exactly these listener instances on cleanup so we don't
    // accumulate duplicate listeners if the effect re-runs.
    return () => {
      map.off("moveend", updateVisible);
      map.off("zoomend", updateVisible);
    };
  }, [allSpots, isMobile]);

  // ---- Fly to a spot when the user taps it in the panel ----
  const handleFlyToSpot = useCallback((spot: Spot) => {
    mapRef.current?.flyTo([spot.latitude, spot.longitude], 15, {
      duration: 1.2,
    });
  }, []);

  // ---- Move map to a specific location (for Add Spot flow) ----
  const handleMapMove = useCallback((lat: number, lng: number) => {
    mapRef.current?.flyTo([lat, lng], 15, {
      duration: 1.2,
    });
  }, []);

  // ---- Map click handler for spot location picking ----
  const [locationPickCallback, setLocationPickCallback] = useState<
    ((lat: number, lng: number) => void) | null
  >(null);

  const handleLocationPick = useCallback(
    (callback: (lat: number, lng: number) => void) => {
      setLocationPickCallback(() => callback);
    },
    []
  );

  // Attach map click listener when location picking is active
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !locationPickCallback) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      locationPickCallback(e.latlng.lat, e.latlng.lng);
      setLocationPickCallback(null); // clear after one click
    };

    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
    };
  }, [locationPickCallback]);

  // Track current map center for AddSpotModal default location
  const [currentMapCenter, setCurrentMapCenter] = useState({
    lat: mapCenter[0],
    lng: mapCenter[1],
  });

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateCenter = () => {
      const center = map.getCenter();
      setCurrentMapCenter({ lat: center.lat, lng: center.lng });
    };

    map.on("moveend", updateCenter);

    return () => {
      map.off("moveend", updateCenter);
    };
  }, []);

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

        {/* --- Markers grouped into clusters when zoomed out ---
             react-leaflet-cluster wraps children using react-leaflet v5's
             own context API so Marker/Popup context is never broken.
             Clicking a cluster zooms in; individual markers + popups
             work exactly as before. */}
        <MarkerClusterGroup
          iconCreateFunction={createClusterIcon}
          chunkedLoading
          spiderfyOnMaxZoom
          showCoverageOnHover={false}
          zoomToBoundsOnClick
          maxClusterRadius={60}
        >
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
        </MarkerClusterGroup>
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

      {/* --- Visible spots panel ---
           Mobile: collapsed pill above the bottom dock, expands to sheet.
           Desktop: right-side floating panel, always visible. */}
      <VisibleSpotsPanel spots={visibleSpots} onSpotClick={handleFlyToSpot} />

      {/* --- Bottom controls (Add Spot, Profile, Settings, Locate Me) --- */}
      <BottomLeftWidget
        mapCenter={currentMapCenter}
        onLocationPick={handleLocationPick}
        onMapMove={handleMapMove}
      />
    </>
  );
}
