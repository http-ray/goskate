// ============================================================
// SpotHeatLayer — a high-level density layer for skate spots.
//
// This is a zoomed-out discovery aid, NOT a permanent overlay. It
// shows where skate regions cluster when the map is far out, then
// fades away as individual skateboard markers take over on zoom-in.
//
// Standard cool → warm gradient (brighter, but not neon):
//   low density    → blue / cyan
//   medium density → green / yellow
//   high density   → orange / red
//
// The layer lives in Leaflet's overlayPane, which sits below the
// markerPane, so individual markers, clusters, popups, and their
// click behaviour are never blocked by the heat overlay.
//
// Uses the leaflet.heat plugin via the useMap() hook so it stays a
// pure visualization layer — no data fetching, no app logic.
// ============================================================

"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import { Spot } from "@/types/spot";

interface SpotHeatLayerProps {
  spots: Spot[];
}

// Heat layer opacity as a function of zoom. The heatmap is a high-level
// regional-discovery aid that should recede quickly once individual markers
// start showing, so closely-grouped parks aren't hidden behind it:
//   far      (≤ 5)  → strong, regional discovery
//   medium   (6–8)  → fades 0.75 → 0.25 as markers start appearing
//   low      (9)    → faint trace while markers become primary
//   close    (≥ 10) → hidden, markers only
function heatOpacityForZoom(zoom: number): number {
  if (zoom <= 5) return 1; // far: strong
  if (zoom >= 10) return 0; // close: hidden
  if (zoom <= 8) {
    // 5 → 8 medium band: 1.0 → 0.25
    return 1 - (zoom - 5) * 0.25;
  }
  // 8 → 10 low band: 0.25 → 0
  return (0.25 * (10 - zoom)) / 2;
}

export default function SpotHeatLayer({ spots }: SpotHeatLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!spots.length) return;

    // [lat, lng, intensity] — a modest flat intensity per spot. With max set
    // higher than one point's value, an isolated spot reads "cool" (blue) and
    // density only warms up (yellow → red) where several spots overlap.
    const points = spots.map(
      (s) => [s.latitude, s.longitude, 0.5] as [number, number, number]
    );

    const heat = L.heatLayer(points, {
      // Larger, softer footprint so density is clearly visible when zoomed out.
      radius: 28,
      blur: 22,
      // Points physically separate as you zoom in past this, so the heat
      // naturally fades and the individual skateboard markers take over.
      maxZoom: 12,
      // Higher floor so sparse areas still read clearly on a light basemap.
      minOpacity: 0.25,
      // ~5 overlapping spots are needed to reach full "red" intensity.
      max: 2.5,
      // Standard cool→warm gradient — strong, saturated alphas so it pops
      // against white OSM tiles (still no neon).
      gradient: {
        0.2: "rgba(30,120,235,0.62)", // blue — low
        0.4: "rgba(20,185,135,0.68)", // teal/green
        0.6: "rgba(245,205,30,0.72)", // yellow — medium
        0.8: "rgba(245,135,25,0.78)", // orange
        1.0: "rgba(225,40,30,0.85)", // red — high
      },
    });

    heat.addTo(map);

    // Fade the heat canvas in/out as the user zooms. leaflet.heat renders to a
    // single <canvas>, so adjusting its CSS opacity is a cheap, safe way to
    // dim the whole layer without touching marker/popup behaviour.
    const applyZoomOpacity = () => {
      const canvas = (heat as unknown as { _canvas?: HTMLCanvasElement })
        ._canvas;
      if (canvas) {
        canvas.style.opacity = String(heatOpacityForZoom(map.getZoom()));
        canvas.style.transition = "opacity 0.2s ease";
      }
    };

    applyZoomOpacity();
    map.on("zoomend", applyZoomOpacity);

    return () => {
      map.off("zoomend", applyZoomOpacity);
      heat.remove();
    };
  }, [map, spots]);

  return null;
}
