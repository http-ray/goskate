// ============================================================
// SpotHeatLayer — a density heatmap for skate spots.
//
// Renders underneath the spot markers/clusters to show where spots
// concentrate.  Uses a standard heat gradient (cool → warm) but kept
// at moderate opacity so the OSM basemap stays readable:
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
      // Floor so sparse areas still show a faint trace.
      minOpacity: 0.2,
      // ~5 overlapping spots are needed to reach full "red" intensity.
      max: 2.5,
      // Standard cool→warm gradient, alpha capped at ~0.7 to stay readable.
      gradient: {
        0.2: "rgba(45,140,220,0.45)", // blue — low
        0.4: "rgba(40,190,150,0.5)", // teal/green
        0.6: "rgba(225,210,55,0.55)", // yellow — medium
        0.8: "rgba(240,150,40,0.6)", // orange
        1.0: "rgba(225,55,40,0.7)", // red — high
      },
    });

    heat.addTo(map);

    return () => {
      heat.remove();
    };
  }, [map, spots]);

  return null;
}
