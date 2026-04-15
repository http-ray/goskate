// ============================================================
// MapView — the main map component that ties everything together.
//
// How it works:
//   1. Initialises a full-screen Leaflet map with dark OSM tiles.
//   2. Loops over all spots from demoSpots.ts and renders a
//      <SpotMarker /> for each one (which includes its popup).
//   3. Manages check-in state (which spots the user checked into)
//      and passes it down so popups can show updated counts.
//   4. Manages the AddClipModal open/close state.
//   5. Exposes a "Locate Me" handler via window so the
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
import { DEMO_SPOTS, DEFAULT_CENTER, DEFAULT_ZOOM } from "@/data/demoSpots";
import SpotMarker from "./SpotMarker";
import AddClipModal from "@/components/ui/AddClipModal";

export default function MapView() {
  // Keep a ref to the Leaflet map instance for imperative actions
  const mapRef = useRef<L.Map | null>(null);

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
        // Leaflet uses [lat, lng] — our DEFAULT_CENTER is [lng, lat],
        // so we reverse it here.
        center={[DEFAULT_CENTER[1], DEFAULT_CENTER[0]]}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
        className="absolute inset-0 z-0 h-full w-full"
        ref={mapRef}
      >
        {/* --- Dark-themed OpenStreetMap tiles --- */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* --- One marker per spot --- */}
        {DEMO_SPOTS.map((spot) => (
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

      {/* --- Add Clip modal (rendered outside the map) --- */}
      {clipSpot && (
        <AddClipModal spot={clipSpot} onClose={handleCloseAddClip} />
      )}
    </>
  );
}
