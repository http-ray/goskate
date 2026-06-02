# GoSkate — Development Log

This file documents each meaningful work session in plain language.
Its purpose is to serve as a study tool — explaining not just *what* changed, but *why*.

---

## Session: Visible Spots Panel, Map Performance, and Clustering

**Date:** June 1, 2026
**Areas touched:** MapView, VisibleSpotsPanel, marker cluster packages, global CSS

---

### 1. Overview

This session added a **Visible Spots Panel** to the GoSkate map — a live list of skateparks currently inside the user's map viewport.

- On **mobile**, it appears as a compact pill above the bottom dock. Tapping the pill opens a bottom sheet with the full list.
- On **desktop**, it appears as a floating right-side panel that is always visible and scrollable.
- Tapping a spot in the list flies the map to that location and opens the marker.

The session also ran into two separate runtime errors related to performance improvements and marker clustering, which are documented below.

---

### 2. Why This Feature Was Added

Before this feature, the only way to browse nearby parks was to tap individual markers on the map. That's fine when zoomed in, but it doesn't work well at wider zoom levels where parks become small dots.

The Visible Spots Panel solves this by giving users a scannable list of what's in view:

- **Zooming out** shows more parks in the list.
- **Zooming in** shows fewer parks — only what's actually visible.
- Users can tap a park in the list to jump directly to it, without needing to find the exact dot on the map.

---

### 3. Technical Implementation

#### How visible spots are calculated

Leaflet's map object exposes a `getBounds()` method that returns the current rectangular viewport as a `LatLngBounds` object. That object has a `.contains([lat, lng])` method — a simple range check that returns `true` if the coordinate falls inside the rectangle.

The visible spots calculation is:

```ts
const bounds = map.getBounds();
const visible = allSpots.filter(spot =>
  bounds.contains([spot.latitude, spot.longitude])
);
```

This runs in O(n) — one pass through all loaded spots. For a few hundred or even a few thousand spots, this is fast enough to run on every map event.

#### When the calculation runs

The calculation runs on two Leaflet events:

- **`moveend`** — fires once after the user finishes panning. Does not fire continuously while dragging.
- **`zoomend`** — fires once after the zoom animation finishes.

Using these events (not `move` or `zoom`) means the calculation runs at most once per user interaction, not 60 times per second.

#### Event listener setup

Inside a `useEffect`:

```ts
map.on("moveend", updateVisible);
map.on("zoomend", updateVisible);

return () => {
  map.off("moveend", updateVisible);
  map.off("zoomend", updateVisible);
};
```

The cleanup function removes the exact function reference (`updateVisible`), not all listeners on the map. This matters because other parts of the app may also listen to map events.

#### Clicking a list item

`VisibleSpotsPanel` accepts an `onSpotClick` callback. When the user taps a row, `MapView` calls:

```ts
mapRef.current?.flyTo([spot.latitude, spot.longitude], 15, { duration: 1.2 });
```

This smoothly animates the map to the selected park.

---

### 4. Bug: Maximum Update Depth Exceeded

**Error message:**
> Maximum update depth exceeded

#### What happened

React has a rule: a `useEffect` re-runs whenever its dependency array changes. The original code computed `allSpots` like this:

```ts
// This ran on EVERY render
const userSpots = DEMO_SPOTS.filter(spot => spot.source === "user");
const allSpots = [...officialSpots, ...userSpots];
```

Every time React re-rendered the component, these two lines created **brand new array references**, even when the actual data hadn't changed. JavaScript arrays are compared by reference, not by value — so `[...a, ...b]` always produces a new array that is `!==` to the previous one.

The `useEffect` for visible spots had `[allSpots]` in its dependency array. The sequence looked like this:

1. Render → new `allSpots` reference
2. Effect runs (because `allSpots` reference changed)
3. `setVisibleSpots(...)` is called
4. React re-renders
5. New `allSpots` reference is created again
6. Effect runs again
7. Loop repeats forever → **crash**

#### The fix: `useMemo`

`useMemo` caches a computed value and only recomputes it when specified dependencies actually change:

```ts
const userSpots = useMemo(
  () => DEMO_SPOTS.filter(spot => spot.source === "user"),
  [] // empty — DEMO_SPOTS never changes
);

const allSpots = useMemo(
  () => [...officialSpots, ...userSpots],
  [officialSpots, userSpots] // only recomputes when Supabase data arrives
);
```

Now `allSpots` holds the **same reference** between renders unless `officialSpots` actually changes. Since Supabase data only arrives once (on mount), the `useEffect` re-runs exactly twice: once on mount with an empty array, and once when data loads. After that, `setVisibleSpots` on `moveend`/`zoomend` triggers a re-render, but `allSpots` keeps its stable memoized reference — so the effect does **not** re-run. No loop.

#### The lesson

> **Derived values computed inline during render create new references every render.** Any `useEffect` that depends on them will run every render. Wrap expensive or reference-sensitive derived values in `useMemo` to keep them stable.

---

### 5. Performance Concerns

After the visible spots panel was working, the map felt laggy in dense areas like California, where hundreds of skateparks can be on screen at once.

The root problem: without clustering, every spot on the map — even those that are pixel-level tiny at the current zoom — has a real DOM element. A full-screen view of California at zoom level 6 might have 400+ individual markers all fighting for layout and render time.

Two ideas were discussed:

1. **Marker clustering** — group nearby markers into a single bubble that shows a count. This dramatically reduces DOM elements at low zoom levels.
2. **Visible spots recalculation efficiency** — already handled with `useMemo` and `moveend`/`zoomend`.

---

### 6. Bug: Clustering Broke Marker Popups

**Error message:**
> Cannot read properties of undefined (reading 'on')
> at Popup (SpotMarker.tsx:78)

#### What happened

The first clustering attempt used `leaflet.markercluster` directly, wrapped in a custom React component built with `createElementHook` from `@react-leaflet/core`.

React Leaflet v5 completely rewrote its internal context system compared to v4. In v5, every component (`<Marker>`, `<Popup>`, `<TileLayer>`, etc.) reads a **shared context object** from its React tree. When `<Popup>` renders, it looks at that context to find its parent `<Marker>` and calls `.on()` to attach a click listener.

The custom wrapper was built against the **v4** context shape. When it injected its own context, the value it passed was structurally wrong for v5. `<Popup>` received `undefined` where it expected a Marker instance — and crashed immediately.

#### The lesson

> **React wrappers for Leaflet plugins must be built against the correct version of react-leaflet's internal context API.** A wrapper that works for v4 will silently break v5. Always check if a package explicitly supports your react-leaflet version.

---

### 7. Fix: Use `react-leaflet-cluster`

The solution was to remove the custom wrapper and install `react-leaflet-cluster`, which is built against react-leaflet v5's context API from the start.

```
npm install react-leaflet-cluster
```

Usage is simple — wrap `<SpotMarker>` components inside `<MarkerClusterGroup>`:

```tsx
import MarkerClusterGroup from "react-leaflet-cluster";

<MarkerClusterGroup
  iconCreateFunction={createClusterIcon}
  chunkedLoading
  spiderfyOnMaxZoom
  showCoverageOnHover={false}
  zoomToBoundsOnClick
  maxClusterRadius={60}
>
  {allSpots.map(spot => <SpotMarker key={spot.id} ... />)}
</MarkerClusterGroup>
```

Because `react-leaflet-cluster` uses react-leaflet v5's own `createPathComponent` internals, each `<Marker>` child still receives a fully intact context — so `<Popup>` works exactly as it did before clustering.

#### Performance benefit

At zoom 5 (US-wide view), 800 spots collapse into ~15–20 cluster bubbles. The browser only lays out 20 DOM nodes instead of 800. When the user zooms in, clusters break apart into individual markers with their full popups. `chunkedLoading: true` spreads the initial marker insertion across animation frames so there is no single-frame spike.

---

### 8. Concepts for Future Reference

#### React `useEffect` dependency loops

A `useEffect` runs after render, and re-runs whenever a value in its dependency array changes. If the effect calls `setState`, that triggers another render. If that render also produces a changed dependency, the effect runs again — infinite loop.

The safest rules:
- Only include values in `[]` that the effect actually reads.
- Use `useMemo` for computed arrays/objects that the effect depends on.
- Never include state that the effect *also sets* in the dependency array.

#### `useMemo` vs inline computation

```ts
// BAD — new reference every render, will retrigger effects
const allSpots = [...officialSpots, ...userSpots];

// GOOD — same reference until dependencies change
const allSpots = useMemo(() => [...officialSpots, ...userSpots], [officialSpots, userSpots]);
```

#### Leaflet `moveend` vs `move`

- `move` — fires continuously while the user is dragging (60x per second)
- `moveend` — fires once when the drag finishes

For expensive work like filtering hundreds of spots, always use `moveend` and `zoomend`.

#### Map bounds filtering

`map.getBounds()` returns the current viewport as a rectangular bounding box. `.contains([lat, lng])` is a fast O(1) check — it just tests whether lat and lng fall within two number ranges. No spatial index needed for the scale GoSkate operates at.

#### Marker clustering

At low zoom levels, many markers overlap and slow the browser. Clustering groups nearby markers into a single bubble with a count. The browser only renders one DOM node per cluster instead of one per marker. As the user zooms in, clusters split into individual markers.

#### React Leaflet context compatibility

React Leaflet v5 uses a React context to pass the map instance and parent layer down the component tree. Every component (`<Marker>`, `<Popup>`) reads this context. A plugin wrapper must inject a compatible context shape or child components will crash. Always verify a clustering or plugin package explicitly supports your react-leaflet major version.

---

### 9. Files Changed

| File | What changed |
|---|---|
| `components/map/MapView.tsx` | Added `useMemo` for `allSpots`; added `moveend`/`zoomend` effect for visible spots; added `<MarkerClusterGroup>` wrapper; added `handleFlyToSpot`; imported `VisibleSpotsPanel` and `MarkerClusterGroup` |
| `components/ui/VisibleSpotsPanel.tsx` | New file — mobile bottom sheet + desktop right panel; shows spot name, type, source, clips count |
| `components/map/MarkerClusterGroup.tsx` | Created then deleted — incompatible with react-leaflet v5 |
| `app/globals.css` | Added then removed cluster spider-leg CSS (not needed with `react-leaflet-cluster`) |
| `package.json` | Added `leaflet.markercluster`, `@types/leaflet.markercluster`, `react-leaflet-cluster` |

---

### 10. What Is Still Deferred

- **Visible spots list limit** — the panel currently shows all spots in view with no cap. For very dense views this could become a long list. A limit (e.g. "show top 50, sorted by distance to center") can be added later.
- **Bounds-based Supabase fetching** — currently all spots are loaded on mount. As the database grows, a smarter approach would be to only fetch spots inside the current viewport from Supabase, re-fetching on `moveend`. This is not needed yet at the current data scale.
- **State/region filters** — filtering the visible panel by state, type, or source is a future feature.
- **Advanced map performance** — lazy loading, tile pre-caching, and virtual list rendering for the panel are deferred until scale demands it.

---

### 11. Next Steps

1. **Test Visible Spots Panel** in California and Georgia — confirm the count is accurate and the panel updates correctly when panning/zooming.
2. **Mobile layout check** — confirm the pill does not overlap the Locate Me button; confirm the bottom sheet does not block map taps in collapsed state.
3. **Desktop layout check** — confirm the right panel does not overlap the left toolbar.
4. **External-link clip system** — the next major feature after this session.

---
