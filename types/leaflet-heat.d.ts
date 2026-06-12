// ============================================================
// Type shim for the leaflet.heat plugin.
//
// leaflet.heat ships no TypeScript types, so we augment the
// "leaflet" module with the single function we use: L.heatLayer.
// ============================================================

import "leaflet";

declare module "leaflet" {
  interface HeatMapOptions {
    minOpacity?: number;
    maxZoom?: number;
    max?: number;
    radius?: number;
    blur?: number;
    gradient?: Record<number, string>;
  }

  interface HeatLayer extends Layer {
    setLatLngs(latlngs: Array<[number, number, number?]>): this;
    addLatLng(latlng: [number, number, number?]): this;
    setOptions(options: HeatMapOptions): this;
  }

  function heatLayer(
    latlngs: Array<[number, number, number?]>,
    options?: HeatMapOptions
  ): HeatLayer;
}
