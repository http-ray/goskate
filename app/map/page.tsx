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

// Shown while the Leaflet map chunk downloads and hydrates, so the
// user sees a branded loader instead of a blank black screen.
function MapLoading() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-base text-sm text-muted">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
        Loading the map…
      </div>
    </div>
  );
}

// Dynamic import — skips SSR so Leaflet never runs on the server
const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: MapLoading,
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
