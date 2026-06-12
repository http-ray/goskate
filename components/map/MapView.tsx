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
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet.markercluster/dist/MarkerCluster.css";

import { Spot } from "@/types/spot";
import SpotMarker from "./SpotMarker";
import SpotHeatLayer from "./SpotHeatLayer";
import AddClipModal from "@/components/ui/AddClipModal";
import VisibleSpotsPanel from "@/components/ui/VisibleSpotsPanel";
import BottomLeftWidget from "@/components/ui/BottomLeftWidget";
import { fetchPublicSpots } from "@/lib/spotsService";

// ---- Invisible cluster icon (no numbered bubbles) ----
// react-leaflet-cluster REQUIRES an iconCreateFunction; whatever it returns
// is what shows on the map for a collapsed cluster.  We deliberately return
// an empty, zero-size icon so NO numbered circles (3, 14, 92...) ever render.
//
// Clustering still runs underneath purely for performance — at far zoom it
// collapses hundreds of markers into a handful of invisible clusters instead
// of drawing them all.  Visual density is carried entirely by the
// SpotHeatLayer.  As the user zooms in, clusters break apart into the real
// skateboard markers.
function createClusterIcon(): L.DivIcon {
  return L.divIcon({
    className: "gs-hidden-cluster",
    iconSize: [0, 0],
    html: "",
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
  // This effect is safe from infinite loops because `publicSpots` is wrapped in
  // useMemo above and only gets a new reference when `officialSpots` changes
  // (i.e., once after Supabase loads).  Calling setVisibleSpots on moveend
  // triggers a re-render, but `publicSpots` keeps its stable reference → the
  // effect does NOT re-run → no loop.
  //
  // `isMobile` is also in deps because the MapContainer remounts (via its
  // `key` prop) when the breakpoint changes — we need to re-attach listeners
  // to the new map instance.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Filter publicSpots to those whose coordinates fall inside the current
    // Leaflet viewport rectangle.  O(n) per call — fast enough for thousands
    // of spots since getBounds().contains() is a simple range check.
    function updateVisible() {
      const bounds = map!.getBounds();
      setVisibleSpots(
        publicSpots.filter((spot) =>
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
  }, [publicSpots, isMobile]);

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
        {/* --- Standard OpenStreetMap light tiles --- */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          minZoom={minZoom}
        />

        {/* --- Subtle density heatmap (sits below markers) ---
             Lives in the overlayPane beneath the markerPane, so it never
             intercepts marker/cluster clicks or popups. */}
        <SpotHeatLayer spots={publicSpots} />

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
          {publicSpots.map((spot) => (
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
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 border border-line bg-elevated text-ink text-sm rounded-full">
          Loading skateparks...
        </div>
      )}

      {/* --- Error indicator --- */}
      {loadError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 border border-danger/30 bg-danger/15 text-danger text-sm rounded-full">
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
