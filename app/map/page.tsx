// ============================================================
// Map page — the full-screen interactive map.
//
// MapView is dynamically imported with { ssr: false } because
// Leaflet accesses `window` at import time and cannot run on
// the server. Next.js requires `ssr: false` dynamic imports to
// live inside a Client Component, hence "use client" here.
//
// All map controls (including BottomLeftWidget) are rendered
// inside MapView for tighter integration with map state.
// ============================================================

"use client";

import dynamic from "next/dynamic";

// Dynamic import — skips SSR so Leaflet never runs on the server
const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
});

export default function MapPage() {
  return (
    // Full viewport, positioned relative so the map (absolute)
    // fills it and the floating controls overlay it.
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <MapView />
    </div>
  );
}
