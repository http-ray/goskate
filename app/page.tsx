// ============================================================
// Homepage — the only page in V1.
//
// It renders a full-screen map with floating UI on top.
// MapView is dynamically imported with { ssr: false } because
// Leaflet accesses `window` at import time and cannot run on
// the server.  Next.js requires `ssr: false` dynamic imports
// to live inside a Client Component, hence "use client" here.
//
// All map controls (including BottomLeftWidget) are now rendered
// inside MapView for tighter integration with map state.
// ============================================================

"use client";

import dynamic from "next/dynamic";

// Dynamic import — skips SSR so Leaflet never runs on the server
const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
});

export default function Home() {
  return (
    // The outer div is full viewport, positioned relative so
    // the map (absolute) fills it and the floating controls overlay it.
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      {/* Full-screen map with integrated controls */}
      <MapView />
    </div>
  );
}
