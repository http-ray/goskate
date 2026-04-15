// ============================================================
// Homepage — the only page in V1.
//
// It renders a full-screen map with floating UI on top.
// MapView is dynamically imported with { ssr: false } because
// Leaflet accesses `window` at import time and cannot run on
// the server.  Next.js requires `ssr: false` dynamic imports
// to live inside a Client Component, hence "use client" here.
// ============================================================

"use client";

import dynamic from "next/dynamic";
import BottomLeftWidget from "@/components/ui/BottomLeftWidget";

// Dynamic import — skips SSR so Leaflet never runs on the server
const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
});

export default function Home() {
  return (
    // The outer div is full viewport, positioned relative so
    // the map (absolute) fills it and the widget (fixed) floats.
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      {/* Full-screen map */}
      <MapView />

      {/* Floating buttons in the bottom-left corner */}
      <BottomLeftWidget />
    </div>
  );
}
