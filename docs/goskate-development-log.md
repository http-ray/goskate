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

## Session: MVP Moderation Pipeline, Access Fixes, and Visible Panel Revert

**Date:** June 8, 2026  
**Areas touched:** spot submission flow, moderation schema/workflow, admin access checks, settings cleanup direction, visible spots panel UX decisions

---

### 1. Session Overview

This session continued preparing GoSkate for MVP deployment with a strong focus on practical backend workflow and lower operational risk.

- Continued preparing GoSkate for MVP deployment.
- Focused on user-submitted skate spots and moderation workflow.
- Fixed admin review access issues.
- Reviewed Visible Spots Panel improvements and reverted area grouping/tabs for now.
- Discussed keeping MVP focused before larger UI redesign work.

Why this mattered:
- MVP needs reliable core flows (submit, review, approve) more than advanced categorization UI.
- Stability and moderation controls are more valuable at launch than polish features that depend on incomplete data.

---

### 2. Add Spot / Moderation Pipeline

GoSkate now supports a moderation-first submission pipeline rather than simple direct-write CRUD.

- Users can submit either skatepark or street spots.
- Submissions are saved in the `spots` table.
- User-submitted spots are written with:
  - `source = "user"`
  - `status = "pending"`
  - `created_by = current authenticated user id`
- Spot lifecycle states are:
  - `pending`
  - `approved`
  - `rejected`
  - `flagged`
- Approved user spots can appear publicly.
- Pending/rejected/flagged spots stay hidden from the public map.

Why this is stronger than simple CRUD:
- It prevents bad or duplicate spots from becoming public immediately.
- It creates a clear audit path (`reviewed_by`, `reviewed_at`, `moderation_notes`).
- It makes community submissions safe to scale.

---

### 3. Database Updates

The `spots` table was extended for moderation and review.

Added/used moderation fields:
- `status`
- `created_by`
- `description`
- `obstacle_tags`
- `area_text`
- `moderation_notes`
- `reviewed_by`
- `reviewed_at`
- `possible_duplicate`

Why defaults were chosen this way:
- Existing official spots default to `approved` because they are imported baseline data and should remain visible.
- New user submissions default to `pending` so admins can verify quality before publishing.

How this helps future workflows:
- Enables admin review UI and status transitions.
- Supports duplicate checks and moderation notes without schema redesign.
- Keeps public read logic simple (`status = approved`).

---

### 4. Admin Review Page

The admin review page is used to process pending submissions.

Documented behavior:
- Admin page lists pending spot submissions.
- Admins can approve, reject, or flag.

Access issue that was fixed:
- Route access had an auth loading race.
- Root cause: page checked `user` before Supabase auth hydration completed.
- During hydration, `user` is temporarily null, which triggered incorrect redirect.

Fix applied:
- Wait for auth `loading` to finish before route decisions.
- Then check whether user exists.
- Then check whether user email is in admin allowlist.

Additional cleanup:
- `ADMIN_EMAILS` array syntax issue (comma) was fixed.

---

### 5. Bugs / Issues Encountered

#### Issue A: `column spots.status does not exist`

- Cause: frontend/service logic expected moderation columns before migration had been applied.
- Fix: apply moderation SQL migration to add missing columns.

#### Issue B: Admin redirect loop / bad redirect

- Cause: auth state checked too early.
- Fix: gate redirect logic behind auth loading completion.

#### Issue C: Build issue in `BottomLeftWidget`

- Cause: misplaced return/brace structure inside component.
- Fix: keep component return inside function scope and remove invalid duplicate structure.

---

### 6. Add Spot UX Decisions

To keep MVP costs low and behavior predictable:

- Avoid user-triggered paid Google API calls in Add Spot flow.
- No public address/place search for MVP.
- Use free/client-side location selection only:
  - Pick on Map
  - Use Current Location
  - Manual `Area / Address / Landmark` text input

Google Places remains useful, but only for admin/import scripts where calls are controlled and budgetable.

Why this decision:
- Prevents accidental API cost spikes from normal user behavior.
- Keeps the submission flow fast and dependency-light.
- Keeps MVP affordable while still collecting usable location context.

---

### 7. Visible Spots Panel Decision

Area grouping/tabs were explored, then reverted for MVP.

What happened:
- Grouping logic was added using area labels.
- Imported official spots often did not yet have `area_text`/`region` labels.
- Result: many rows fell into `Other Nearby`, reducing the value of the grouped UI.

MVP decision:
- Revert to the normal simple visible spots list.
- Keep panel behavior stable and predictable while data quality catches up.

Future plan:
- Bring area/category tabs back after area labeling is reliably populated in imported data.

---

### 8. Settings Cleanup Direction

Settings simplification was planned/handled with MVP scope in mind.

- Remove Map Preferences section for now.
- Remove Appearance section for now.
- Keep Account, Notifications, Privacy, and Help/About as core structure for settings UX direction.
- Unimplemented items show `Coming soon` placeholders.
- Edit Profile opened from Settings should return back to Settings.

Why:
- Reduces unfinished UI surface area.
- Keeps navigation clear while preserving extension points.

---

### 9. Concepts Learned (Beginner-Friendly)

#### Database migrations
Migrations are controlled schema updates. If app code expects new columns, migration must run first.

#### Moderation workflows
A `status` pipeline (`pending -> approved/rejected/flagged`) is safer than immediate publish.

#### Status-based backend pipelines
Using status in read/write rules cleanly separates public data from review-only data.

#### Auth hydration/loading state
Auth providers often initialize asynchronously. Guarding on loading avoids false redirects.

#### Admin route protection
Access checks should run only after auth is resolved, then validate role/email.

#### Avoiding premature complexity
A simpler UI with reliable data beats advanced UI with weak data quality at MVP stage.

#### Cost control
Avoiding user-triggered paid APIs helps keep launch costs predictable.

#### MVP scoping
Ship the essential loop first (submit -> review -> approve -> visible), then iterate UI depth after launch.

---

### 10. Next Steps

1. Finish and test Add Spot submission flow end-to-end.
2. Test admin review actions (approve/reject/flag) end-to-end.
3. Confirm approved user spots appear on the public map.
4. Tighten RLS/security policies before deployment.
5. Add/verify loading, error, and empty states across critical pages.
6. Deploy MVP.
7. After MVP is live, redesign UI more creatively with better data foundations.

---

## Session: Spots in View Search/Filters and Coordinate Area Backfill Fix

**Date:** June 10, 2026  
**Areas touched:** visible spots panel search/filter UX, coordinate backfill script, spots service field compatibility, MVP schema alignment

---

### 1. Session Overview

This session continued polishing GoSkate for MVP deployment, with a practical focus on UX clarity and schema-safe data enrichment.

- Added search/filter lookup to the Spots in View panel.
- Added/fixed coordinate-based city/area labeling for existing spots.
- Kept MVP schema simple by using the existing `area_text` column instead of adding `city` or `region_label`.

Why this mattered:
- The map experience becomes easier to scan when users can filter what they already see.
- Existing spot data can be organized geographically without launching a risky schema expansion during MVP.
- Shipping with fewer moving parts reduces deployment risk.

---

### 2. Spots in View Search / Filters

The Spots in View panel now supports fast in-panel filtering of the spots that are already inside the current map viewport.

What was added:
- Search input in the panel.
- Search only applies to spots currently visible in map bounds.
- Search matches:
  - spot name/display_name
  - area_text
  - type/category
  - source
- Filter chips/buttons:
  - All
  - Official
  - User
  - Skateparks
  - Street
- Search text and selected filter chip combine together.

Example behavior:
- If user selects **Official** and searches **Atlanta**, results show only visible official spots whose searchable text matches Atlanta.

Empty states now communicate intent clearly:
- If viewport has no spots: show no-spots-in-view message.
- If viewport has spots but filters remove all: show no-search-matches message.

Why this approach was chosen:
- It avoids extra API calls by filtering the local visible list.
- It preserves existing map behavior and keeps panel logic simple for MVP.

---

### 3. Coordinate-based Area Backfill

A coordinate-based backfill script was created/fixed to assign area labels using spot latitude/longitude and a local free city dataset.

How it works:
- Reads spots with coordinates from Supabase.
- Finds nearest city/area using coordinate distance math (Haversine).
- Produces labels like:
  - Atlanta, GA
  - Buford, GA
  - Los Angeles, CA
- Writes matched label into the existing `area_text` column.

Important constraints respected:
- No paid APIs.
- No Google Places calls for this backfill.
- Admin-only script flow.
- DRY_RUN safety mode retained.

Why this is MVP-safe:
- Keeps enrichment offline/local and cost-safe.
- Uses existing schema column already consumed by app UI.
- Avoids introducing schema migration risk during deployment window.

---

### 4. Bug Encountered

Error observed:

> Could not find the 'city' column of 'spots' in the schema cache

What caused it:
- The script attempted to select/update a `city` column that does not exist in `spots`.
- The table also did not have `region_label`.

Why this surfaced immediately:
- Supabase validates payload columns against known table schema.
- Any unknown column in `select` or `update` triggers schema cache errors.

---

### 5. Fix Applied

The fix was to align all code with real MVP schema and use `area_text` only.

Changes made:
- Removed `city` from Supabase select queries.
- Removed `city` from update payloads.
- Removed `city` from skip/overwrite checks.
- Removed `region_label` references.
- Updated script writes to only:
  - `area_text: matchedCityArea`
- Updated panel search/grouping logic to use `area_text` as the city/area label.

Result:
- Backfill updates now succeed against existing schema.
- Panel grouping/search works with populated `area_text` data.

---

### 6. Concepts Learned (Beginner-Friendly)

#### Local dataset field vs database column
- A local dataset can have fields like `city.name` or `city.lat`.
- That does not mean your database has columns with those names.
- You must map dataset output into actual DB columns that exist.

#### Why Supabase schema errors happen
- Supabase checks query/update fields against table schema.
- If payload includes a non-existing column, request fails before update is applied.
- This is a safety feature that prevents silent bad writes.

#### Why using existing columns can be safer for MVP
- Adding columns means migrations, compatibility checks, and potential rollback complexity.
- Reusing an existing column (`area_text`) reduces moving parts and launch risk.
- MVP favors stability and iteration speed over idealized schema design.

#### How panel search can avoid extra API calls
- Map already has a visible subset of spots in memory.
- Search/filter can run on that in-memory subset.
- This is fast, cheap, and simpler than new backend search endpoints for MVP.

#### Why MVP should avoid unnecessary schema complexity
- Every schema change increases coordination cost (DB + backend + frontend).
- If a current column solves the immediate product need, use it.
- Optimize architecture after core flow is stable in production.

---

### 7. Next Steps

1. Do a small UI polish pass.
2. Run RLS/security policy pass.
3. Add loading/error/empty states across core pages.
4. Test full MVP flow on desktop and mobile.
5. Deploy to Vercel.

---

## Session: Map UI Polish, Heatmap, Markers, Filter Sync, and MVP Readiness

**Date:** June 13, 2026
**Areas touched:** MapView, SpotMarker, SpotHeatLayer, VisibleSpotsPanel, spotsService, Spot type, settings page, development log

---

### 1. Session Overview

This session was primarily about visual polish and making the map feel like a real product before deployment. Several problems that had been acceptable during development were no longer acceptable for a public MVP:

- The map tiles were dark and hard to read as a *location* tool.
- Spot markers were small colored dots — not distinctive enough.
- The heatmap existed but was too subtle and washed out.
- Selecting a filter in the Spots in View panel changed the list but left the map completely unchanged — markers and heatmap still showed everything.
- User-submitted spots showed a plain "User" badge with no attribution.
- The Settings back button went to the profile page instead of the map.

Each of these was fixed. The section below explains what changed and why.

---

### 2. Map Tiles: Switching to OpenStreetMap Light

**What changed:** The map tile layer was switched from dark CARTO tiles to the standard OpenStreetMap light tile style.

**Why this matters:**

Tile layers are the background image of a map. They determine what the map *looks* like at rest — roads, labels, parks, buildings.

Dark tiles look great for data dashboards and nighttime navigation apps. For GoSkate, the goal is the opposite: help skaters *find a location* — an intersection, a plaza, a park entrance. Light tiles with clear road labels and landmark names are much easier to read for this purpose.

There's also a practical reason: when markers, heatmap colors, and UI widgets are dark-themed and so is the base map, everything blends together. A light tile layer creates contrast — dark UI elements read clearly against a light background, and the heatmap colors pop instead of disappearing.

The switch was one line change in `MapView.tsx`:

```tsx
// Before: CARTO dark tiles
url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"

// After: OpenStreetMap standard light tiles
url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
```

---

### 3. UI Color Direction

**What changed:** The color system was clarified to serve specific semantic purposes rather than being decorative.

| Color | Role |
|---|---|
| Cream / off-white | Map widgets, panel backgrounds, UI accents |
| Green | Semantic only — Official/Approved badges and status dots |
| Red + Black | Skate-inspired — spot markers, visual branding |

**Why this matters:**

Before this change, green was used for both marker dots *and* official badges. That made it hard to quickly distinguish "this spot is official" from "this is a spot." Once green became semantic-only (meaning only when something is verified or approved), the visual language became clearer. A user glancing at the panel can immediately tell a green dot means "official" without reading the label.

---

### 4. Spot Markers: From Colored Dots to Skateboard Icons

**What changed:** Individual spot markers were replaced with a custom skateboard icon (`public/images/skateicon.png`).

**Why this matters:**

Colored circle dots are the Leaflet default. They work, but they carry no brand identity. On a busy OSM light tile map with road labels, circles can be hard to pick out at a glance.

A skateboard icon makes the spots immediately recognizable as skate-related, creates a consistent visual identity, and stands out against the map tiles without requiring bright neon colors.

The marker implementation uses Leaflet's `DivIcon` with an `<img>` tag:

```tsx
html: `
  <div style="display:flex;align-items:center;justify-content:center;
    width:${wrapper}px;height:${wrapper}px;cursor:pointer;">
    <img src="/images/skateicon.png" alt="" style="
      width:${iconSize}px;height:${iconSize}px;object-fit:contain;
      filter:drop-shadow(0 1px 3px rgba(0,0,0,0.45));" />
  </div>
`
```

Official spots render at 48px; user-submitted spots at 44px. The outer wrapper is 56px so the tap target stays easy to hit on mobile. The `drop-shadow` CSS filter adds depth against the light tile background without a colored ring.

**Size iterations:** The marker went through several size passes (32px → 40px → 48px). The lesson: on a real device at real map zoom levels, what looks big in a browser window can still be small. Test on mobile hardware.

---

### 5. Heatmap Density Layer

**What changed:** A `leaflet.heat`-based density heatmap was added as a high-level skate spot discovery tool.

**What it does:**

The heatmap is a blurred color overlay that shows where spots *cluster* at regional zoom levels. It is not meant to show exact locations — that's what individual markers are for. Think of the heatmap as an answer to "where are the skateboarding scenes in this state?" before you zoom in to find specific parks.

**Zoom-based behavior:**

| Zoom level | Heatmap | Markers |
|---|---|---|
| ≤ 5 (US-wide) | Full opacity | Clustered/hidden |
| 6–8 (state/city) | Fading out | Gradually appearing |
| 9 | Very faint | Primary interaction layer |
| ≥ 10 (neighborhood) | Hidden | Fully visible |

This transition is deliberate: the two layers serve different purposes, and showing both at the same time creates visual noise. As you zoom in, the heatmap gracefully gives way to the exact markers.

**How opacity transition works:**

`leaflet.heat` renders to a single `<canvas>` element in Leaflet's `overlayPane` (which sits *below* the `markerPane`). Setting `canvas.style.opacity` on `zoomend` is a lightweight way to fade the whole heatmap layer. No new canvas is created; no data is reprocessed — just a single CSS property update.

```ts
const applyZoomOpacity = () => {
  const canvas = (heat as unknown as { _canvas?: HTMLCanvasElement })._canvas;
  if (canvas) {
    canvas.style.opacity = String(heatOpacityForZoom(map.getZoom()));
    canvas.style.transition = "opacity 0.2s ease";
  }
};
```

Because the heatmap canvas is *below* the marker pane, it never intercepts clicks. Marker popups and check-in buttons work at all zoom levels.

**Gradient:** A standard cool→warm gradient was used (blue → teal → yellow → orange → red). Alpha values were tuned specifically for a white/light tile background — colors that look soft on dark tiles look washed out on light tiles, so alphas needed to be higher.

**Cluster settings:** `disableClusteringAtZoom={8}` means individual markers appear at zoom 8 and below. `maxClusterRadius={30}` means only markers within 30px on screen cluster together — so closely-grouped parks separate into individual markers sooner than the default.

---

### 6. Filter Sync: Map Visuals Now Match Active Filters

**What changed:** The active filter chip now affects map markers *and* the heatmap, not just the Spots in View panel list.

**The problem before:**

The filter state (`activeFilter`) lived entirely inside `VisibleSpotsPanel`. When you selected "Street," the panel list changed, but `MapView` had no idea — it kept showing all spot markers and the full heatmap.

This was a data isolation problem. The component that *displayed* the filter result (the panel) owned the filter state, but the components that *needed to respond* to it (markers, heatmap) were siblings in a different part of the tree with no access.

**The fix: lift state to the shared parent**

`activeFilter` was moved up to `MapView.tsx`, which is the shared parent of the panel, the markers, and the heatmap. This is a standard React pattern called *lifting state up*.

```
MapView (owns activeFilter)
  ├── SpotHeatLayer          ← receives filteredPublicSpots
  ├── MarkerClusterGroup
  │     └── SpotMarker[]     ← rendered from filteredPublicSpots
  └── VisibleSpotsPanel      ← receives filteredVisibleSpots + activeFilter + onFilterChange
```

Two derived arrays are computed in `MapView` using `useMemo`:

```ts
// All spots matching the filter — used for markers and heatmap
const filteredPublicSpots = useMemo(
  () => applyFilter(publicSpots, activeFilter),
  [publicSpots, activeFilter]
);

// Only the viewport-visible spots matching the filter — used for the panel
const filteredVisibleSpots = useMemo(
  () => applyFilter(visibleSpots, activeFilter),
  [visibleSpots, activeFilter]
);
```

The panel still owns `searchText` internally (it only affects the list display, not the map).

**FilterType was simplified:**

`"official"` and `"user"` filter options were removed entirely. Source-based filtering was not a useful discovery mechanic from the map perspective — skaters don't think "show me only user-submitted spots." The remaining options are `"all"`, `"skatepark"`, and `"street"`, which map to real-world how skaters navigate.

---

### 7. User Attribution on Spot Badges

**What changed:** The "User" badge on user-submitted spots in the panel now shows `User: @username` when the submitter has a public profile.

**Why this matters:**

Plain "User" is anonymous. Showing `@username` gives credit to the skater who found and submitted the spot. It also makes the panel more social — you can see who's been adding spots in your city.

**How it works:**

The `Spot` type was extended with `submitterUsername?: string`. The `fetchPublicSpots` function now:

1. Fetches spots including the `created_by` UUID column.
2. Collects unique `created_by` IDs for user-submitted spots only.
3. Does one batch `profiles.select("id, username").in("id", [...])` call.
4. Maps the result onto each spot's `submitterUsername` field.

This is two queries total regardless of how many user spots exist — no N+1 problem.

**Privacy:** The profiles table RLS only returns rows where `is_public = true` via the anon key. If a submitter has a private profile, no username is returned and the badge falls back to plain `"User"`. This is the correct behavior — private profiles should not have their username exposed.

---

### 8. Collapsible City/Area Sections in Spots Panel

**What changed:** City/area group headers in the Spots in View panel are now *collapsed by default*, and expand individually when tapped.

**Why this matters:**

Before this change, every area group was expanded all the time. In a dense metro area with 30+ spots across 10 neighborhoods, the list was overwhelming to scroll through.

Collapsing by default keeps the panel compact and scannable — you see the city/area headers and their spot counts without needing to read every spot name. Tap to expand only the neighborhood you care about.

**Special case:** When the user types in the search box, all groups auto-expand so matching results are visible even in collapsed sections. This prevents the confusing situation where a search returns "3 spots" but none are visible because all sections are still collapsed.

The collapse state is tracked as a `Set<string>` of *expanded* area keys:

```ts
// Empty set = all collapsed (correct default)
const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
const isExpanded = isSearching || expandedAreas.has(groupKey);
```

---

### 9. Settings Page: Back Link to Map

**What changed:** The back link on the Settings page was changed from "← Back to profile" (which navigated to `/profile`) to "← Back to map" (navigating to `/`).

**Why this matters:**

Users most commonly reach Settings from the map's bottom-left widget, not from the profile page. The previous back destination created a two-tap path to return to the map. The new destination gets users back to their primary interaction surface immediately.

This is a small change with a meaningful impact on navigation feel, especially on mobile where every tap counts.

---

### 10. Security and Deployment Readiness Review

A full review was completed against the GoSkate codebase before deployment. The major findings:

**Clean:**
- No `NEXT_PUBLIC_` service role key exposure anywhere.
- No Google Places API calls in frontend code — scripts only.
- Admin moderation backed by RLS at the database layer (`profiles.is_admin = true`).
- `WITH CHECK` on profile UPDATE prevents users from self-elevating `is_admin`.
- Public spot reads restricted to `status = 'approved'` at DB level.
- User INSERT enforces `status = 'pending'`, `source = 'user'`, `created_by = auth.uid()`.

**Deployment steps remaining:**
1. Finish map UI polish and verify marker/heatmap/filter behavior on device.
2. Add and verify loading, error, and empty states on critical pages.
3. Run `npm run lint` — fix any warnings.
4. Run `npm run build` — confirm clean build output.
5. Add production domain to Supabase Auth → URL Configuration → Site URL and Redirect URLs.
6. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel environment.
7. Deploy to Vercel.
8. Test deployed app: auth login/logout, map load, Add Spot submission, admin review and approval.

---

### 11. Planned Future Work: Social and Profile Features

The following features are planned for after MVP deployment. They are **not** in the current codebase.

**Profiles:**
- Avatar upload from device using Supabase Storage.
- Public profile pages accessible by username URL (e.g. `/u/rayshun`).
- User search to find other skaters.

**Social:**
- Following / followers system.
- Activity feed showing recent spot additions and check-ins by followed users.

**Clips:**
- Profile clips linked from external platforms: TikTok, Instagram, YouTube.
- Optional cover image upload (static thumbnail) per clip using Supabase Storage.
- No native video uploads — hosting and streaming video is expensive and complex. External links give the social experience without the infrastructure cost.
- No TikTok or Instagram OAuth account connection — users paste the link manually.

**Why external links instead of native uploads:**

Hosting video requires: storage (expensive per GB), CDN (expensive per egress), a video processing pipeline (transcode, thumbnail generation), and player logic. A link to a TikTok video costs zero infrastructure and the video is already mobile-optimized with captions and social engagement. For an MVP social layer, this is the correct tradeoff.

---

### 12. Concepts Learned (Beginner-Friendly)

#### Why light map tiles improve readability

A map tile is a pre-rendered image served from a tile server. Dark tiles reduce glare in navigation apps and look dramatic in data dashboards. For GoSkate — where the goal is "find this specific plaza downtown" — light tiles with legible road labels and building outlines help users orient themselves faster. The contrast also makes markers and UI panels easier to read.

#### Heatmap density vs individual marker interaction

A heatmap answers a regional question: "where are the scenes?" Individual markers answer a specific question: "what is this spot, how do I get there, who added it?"

Trying to answer both questions with the same visual element (markers) doesn't scale. At US-wide zoom, 800 individual skateboard icons are unreadable noise. At street-level zoom, a blurry heatmap blob adds nothing. Using each tool at the right zoom level makes both more useful.

#### Why `area_text` was safer than a new schema column

Adding a new database column requires: a SQL migration, testing that existing data doesn't break, verifying the app handles null gracefully for rows that predate the column, and updating any queries that reference the table. For MVP, that's risk without benefit when `area_text` already exists, is already populated by the backfill script, and is already read by the panel grouping logic. Reuse what works.

#### Why map filters should affect both the list and the map

A filter creates a contract with the user: "I want to see only X." If the list shows only X but the map still shows everything, the user has to mentally reconcile two different states. That cognitive overhead is friction. When the list and the map always agree, the filter feels reliable and the app feels coherent.

#### Why RLS matters before deployment

RLS (Row Level Security) is Postgres's built-in access control system. Without it, any API call using the anon key can read, write, or delete any row — regardless of what the frontend code tries to enforce. Frontend access checks can be bypassed by anyone who opens DevTools or sends a direct API request. RLS enforces the same rules at the database layer where they cannot be bypassed. For GoSkate, this means a non-admin user cannot approve their own pending spot submission even if they send the API request directly.

#### Why external video links are cheaper than native uploads

Storing, transcoding, and streaming video is expensive. A 10-second clip might be 8MB. A platform with 1,000 users and 5 clips each is 40GB of storage, plus CDN egress every time anyone watches. External links (TikTok, YouTube) cost zero to host. The tradeoff is that you don't own the content — but for an MVP social layer, that's the right call.

---

### 13. Files Changed This Session

| File | What changed |
|---|---|
| `components/map/MapView.tsx` | Switched to OSM light tiles; added `activeFilter` state; added `filteredPublicSpots` + `filteredVisibleSpots` memos; feeds filtered arrays to heatmap, markers, and panel; added `useMemo` import |
| `components/map/SpotMarker.tsx` | Replaced colored circle `DivIcon` with skateboard icon (`skateicon.png`); tuned icon sizes (official 48px / user 44px) and wrapper tap target (56px) |
| `components/map/SpotHeatLayer.tsx` | New file — `leaflet.heat` density heatmap; zoom-based opacity fade via CSS on heat canvas; cool→warm gradient tuned for white tile map |
| `types/leaflet-heat.d.ts` | New file — TypeScript shim augmenting `"leaflet"` module with `L.heatLayer` and `L.HeatLayer` types |
| `components/ui/VisibleSpotsPanel.tsx` | Exported `FilterType`; added `activeFilter` + `onFilterChange` props (filter state lifted to MapView); filter chip logic now calls `onFilterChange`; city/area sections collapsed by default; auto-expand when searching; updated empty state messages; source badge shows `User: @username` |
| `lib/spotsService.ts` | `fetchPublicSpots` now selects `created_by`; batch-fetches profile usernames for user spots; maps `submitterUsername` onto returned `Spot` objects |
| `types/spot.ts` | Added `submitterUsername?: string` field to `Spot` type |
| `app/profile/settings/page.tsx` | Back link changed from `href="/profile"` / "Back to profile" to `href="/"` / "Back to map" |
| `package.json` | Added `leaflet.heat: ^0.2.0` |

---

### 14. Next Steps

1. Verify marker/heatmap/filter behavior visually on device (desktop + mobile).
2. Confirm the mobile pill count updates correctly when filters change.
3. Add loading and error states to any pages still missing them.
4. Confirm RLS and admin review still work correctly end-to-end.
5. Run `npm run lint` — fix any warnings.
6. Run `npm run build` — confirm clean output.
7. Add GoSkate production URL to Supabase Auth redirect settings.
8. Set environment variables in Vercel dashboard.
9. Deploy MVP.
10. Test deployed auth, map, Add Spot, admin review, and spot approval on the live URL.
11. After deployment, begin planning the social/profile feature set.

---

## Session: Social Layer — Profiles, Follows, and Clips

**Date:** June 13, 2026
**Areas touched:** types, Supabase schema, profilesService, new followsService, new clipsService, profile/edit, profile page, friends page, public profile page, user search, UserBannerCard, ProfileCard, ClipCard, AddClipForm

---

### 1. Session Overview

This session built the social layer for GoSkate from scratch. The map and moderation features were already complete. What was missing was a way for skaters to find each other, follow each other, and share clips from their profile.

The goals set before building:

- Skaters can upload a real avatar image from their device (not paste a URL).
- Every public profile has a permanent URL at `/profile/[username]` that anyone can visit.
- A search page lets users find other skaters by name, username, or local park.
- Users can follow each other with a simple one-directional follow system.
- Users can add clips from TikTok, Instagram, YouTube, or any platform by pasting a link. No native video upload.
- Clips show a cover image (optional upload) and an "Open original" link. No embeds.
- Private profiles remain completely hidden — search results, clip reads, and profile pages all respect the `is_public` flag.

Everything was built without changing the existing `spots` table, map logic, heatmap, moderation, or admin page.

---

### 2. New Database Tables

Two new tables were added. Both are defined in `supabase/social-schema.sql` and must be created in the Supabase SQL editor before the social features work.

#### `user_follows`

```sql
CREATE TABLE user_follows (
  follower_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);
```

The composite primary key `(follower_id, following_id)` means there can only ever be one follow relationship between any two users — duplicates are prevented at the database level, not just the frontend.

The `CHECK (follower_id != following_id)` constraint makes it impossible to follow yourself. This is enforced at the DB layer, so it holds even if a bug in the frontend tries to submit it.

The `ON DELETE CASCADE` on both columns means: if a user deletes their account, all their follows (both as follower and as someone being followed) are cleaned up automatically.

#### `profile_clips`

```sql
CREATE TABLE profile_clips (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title           TEXT,
  caption         TEXT,
  platform        TEXT CHECK (platform IN ('tiktok', 'instagram', 'youtube', 'other')) NOT NULL,
  external_url    TEXT NOT NULL,
  cover_image_url TEXT,
  spot_id         UUID REFERENCES spots(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

The `platform` column uses a `CHECK` constraint to enforce valid values — only `tiktok`, `instagram`, `youtube`, or `other` are accepted. This prevents garbage data without needing application-level validation as the only guard.

`spot_id` is optional and uses `ON DELETE SET NULL` — if the referenced spot is deleted, the clip stays on the profile but just loses its spot reference. This avoids cascading deletes wiping out clips because a spot was removed.

`external_url` is required. `cover_image_url` is optional — clips work without a cover, which is important for MVP where users may not have a good thumbnail to upload.

---

### 3. RLS Policy Design

#### `user_follows` — 3 policies

| Policy | Operation | Rule |
|--------|-----------|------|
| Anyone can view follows | SELECT | `USING (true)` — public |
| Users can follow others | INSERT | `WITH CHECK (auth.uid() = follower_id)` |
| Users can unfollow | DELETE | `USING (auth.uid() = follower_id)` |

Follow relationships are public because follower/following counts need to be readable by anyone visiting a public profile. There is no private follow system.

The INSERT and DELETE policies tie the operation to the `follower_id` column — a user can only create or delete follow rows where they are the follower. The database enforces this even if someone crafts a raw API request.

#### `profile_clips` — 5 policies

| Policy | Operation | Rule |
|--------|-----------|------|
| Public clips are readable | SELECT | Profile must have `is_public = true` |
| Users can read own clips | SELECT | `auth.uid() = user_id` |
| Users can add clips | INSERT | `WITH CHECK (auth.uid() = user_id)` |
| Users can update clips | UPDATE | `USING (auth.uid() = user_id)` |
| Users can delete clips | DELETE | `USING (auth.uid() = user_id)` |

There are two separate SELECT policies because RLS policies are OR-combined — a row is readable if *any* policy grants access. The first policy lets anyone read clips from a public profile. The second policy lets a user always read their own clips even if their profile is private. Together, they handle both cases correctly.

---

### 4. Supabase Storage Buckets

Two public Storage buckets were added. Both are created by `supabase/social-schema.sql`.

**`avatars` bucket**
- Avatar path: `{userId}/avatar.{ext}`
- Banner path: `{userId}/banner.{ext}` (same bucket, different filename)
- Storage policies: authenticated users can upload, update, and delete files only under their own `{userId}/` prefix
- Public read: anyone can read (needed to serve `avatar_url` and `banner_url` via CDN link)

Using the same fixed path `{userId}/avatar.jpg` for each user means uploading a new avatar automatically overwrites the old one. No old files pile up in storage and no cleanup is needed.

**`clip-covers` bucket**
- Cover path: `{userId}/{clipId}.{ext}`
- Same storage policies as `avatars` — users can only touch their own files
- Public read: cover images appear on public profile pages

---

### 5. Avatar Upload — Profile Edit Page

Before this session, avatar and banner were plain URL text inputs. Users had to host an image somewhere and paste a link. That's a bad user experience and essentially gates the feature to people who already have a CDN.

The new approach in `app/profile/edit/page.tsx`:

1. A hidden `<input type="file">` is attached to a visible "Upload Avatar" button.
2. When a file is selected, it is validated before upload: type must be JPEG, PNG, or WebP; size must be 5 MB or less.
3. Validation passes → file uploads to `avatars/{userId}/avatar.{ext}` via Supabase Storage.
4. Supabase returns a public URL → that URL is immediately saved to `profiles.avatar_url` via `updateProfile()`.
5. The avatar preview updates in the UI.

The upload-then-save pattern (upload file, then save URL to the profiles row) is the standard approach for Supabase Storage. The Storage bucket holds the file; the database row holds the URL string that points to it.

Banner upload works the same way but uses the path `{userId}/banner.{ext}`.

---

### 6. Public Profile Page — `/profile/[username]`

Before this session, there was no way to view another user's profile. `getProfileByUsername()` was added to `lib/profilesService.ts` to look up a public profile by username:

```ts
const { data } = await supabase
  .from("profiles")
  .select("*")
  .eq("username", username)
  .eq("is_public", true)
  .single();
```

The `.eq("is_public", true)` filter is critical — it means this function only ever returns public profiles. Even if someone requests a private profile's username directly in the URL, the query returns nothing. The page then shows "Profile not found" without exposing any data. This is the correct privacy model: do not reveal that a private profile exists at all.

**Page layout:**
- Full-width banner
- Avatar overlapping the banner edge (same visual pattern as the own-profile card)
- Follow button (if signed in and not own profile) or "Sign in to Follow" link
- Follower and following counts (read-only for now)
- Stats pills (stance, local park, parks visited)
- Bio
- Clips grid (read-only `ClipCard` components)

**Own profile detection:**
The page checks `user.id === profile.id`. If true, the Follow button is replaced with an "Edit Profile" link. This prevents the confusing situation of seeing a Follow button on your own profile.

---

### 7. User Search — `/users/search`

`searchProfiles()` was added to `lib/profilesService.ts`:

```ts
supabase
  .from("profiles")
  .select("*")
  .eq("is_public", true)
  .or(`username.ilike.%${q}%,display_name.ilike.%${q}%,local_park.ilike.%${q}%`)
  .limit(20)
```

The `.ilike()` operator is case-insensitive substring matching — searching "tony" would match "Tony Hawk" or "antony". Private profiles are excluded by `.eq("is_public", true)` before any search logic runs.

The search page debounces input by 300ms using `setTimeout` and `clearTimeout`. This means the Supabase query only runs after the user stops typing for 300ms — not on every keystroke. This prevents flooding the database with a query for every single character typed.

Results render as `ProfileCard` components, each showing avatar, display name, handle, stance, local park, and a Follow button.

---

### 8. Follow System

The follow system is one-directional (like Twitter/Instagram), not mutual (like Facebook friends). One user follows another; the other user does not need to approve.

**Why one-directional:**
- Simpler database model — one row per relationship, no `status` enum.
- No notification logic needed (acceptance/rejection notifications are complex).
- More natural for a skate community where content creators want public reach.

**`lib/followsService.ts` functions:**

| Function | What it does |
|----------|-------------|
| `followUser(followingId)` | INSERT into `user_follows`; gets current user from Supabase auth |
| `unfollowUser(followingId)` | DELETE from `user_follows` |
| `getFollowCounts(userId)` | Two parallel SELECT COUNT queries — followers and following |
| `getFollowStatus(targetUserId)` | Returns true/false: does current user follow this person? |
| `getFollowers(userId)` | JOIN with profiles to get the list of people who follow userId |
| `getFollowing(userId)` | JOIN with profiles to get the list of people userId follows |

The `getFollowing` and `getFollowers` functions use Supabase's foreign key join syntax:

```ts
supabase
  .from("user_follows")
  .select("following_id, profiles!user_follows_following_id_fkey(*)")
  .eq("follower_id", userId)
```

The `profiles!user_follows_following_id_fkey(*)` syntax tells Supabase to join the `profiles` table using the named foreign key constraint (`user_follows_following_id_fkey`). This returns the full profile row for each followed user in a single query — no N+1 problem.

**Friends page repurposed:**
`/profile/friends` was a "Coming Soon" placeholder. It's now a real page with two tabs — Following and Followers — that renders `ProfileCard` lists. A "Find skaters →" link navigates to `/users/search`.

---

### 9. Profile Clips

#### Why external links, not video uploads

Storing and serving video requires:
- Storage at scale (a 10-second TikTok clip is ~8 MB)
- CDN for global delivery
- Video transcoding (different browsers need different formats)
- Player logic

A link to a TikTok or YouTube video costs zero to store and the video is already transcoded, captioned, and mobile-optimized by the platform. For an MVP social layer this is the right tradeoff. The user experience of tapping "Open original" and landing in TikTok is actually better than a native player — the user is in the platform where they can like, comment, and share.

#### Why no embeds at launch

TikTok embeds require oEmbed API calls and can be blocked by privacy settings. Instagram embeds are restricted and require Facebook app review. YouTube iframes work but add complexity (loading state, iframe sandbox, responsive sizing).

The MVP display is: cover image (if uploaded) or a platform-colored placeholder card, a title, and an "Open original" link. This renders reliably on every platform, every browser, with no external dependencies.

#### `AddClipForm` — how it works

1. User pastes a URL.
2. The form auto-detects the platform from the URL (`tiktok.com` → TikTok, `youtube.com` → YouTube, etc.) and sets the Platform dropdown.
3. User optionally fills title, caption, and uploads a cover image.
4. On submit: `addClip()` inserts the clip row first to get an ID.
5. If a cover image was provided: `uploadClipCover(userId, clipId, file)` uploads it to `clip-covers/{userId}/{clipId}.ext`.
6. The cover URL is written back to the clip row with a second update.

The two-step approach (insert → upload → update) is necessary because the clip ID (used as the storage path) is only known after the INSERT. This is a common pattern with Supabase: generate UUIDs at the DB layer via `gen_random_uuid()`, then use the returned ID for related storage operations.

---

### 10. Privacy Model Summary

The privacy system works at two levels:

**Profile level (`profiles.is_public`)**
- `false` → profile is completely invisible. `getProfileByUsername` returns nothing. Search excludes the user. `/profile/[username]` shows "Profile not found."
- `true` → profile is publicly visible and searchable.

**Clip level**
- Clips from a public profile are readable by anyone (RLS: `profiles.is_public = true`).
- Users always read their own clips regardless of profile visibility (second SELECT policy).
- Clips from a private profile are invisible to others even if someone queries the `profile_clips` table directly using the anon key.

This means a user can make their profile private at any time and their clips immediately become inaccessible to others — no manual clip visibility toggle needed.

---

### 11. Concepts Learned (Beginner-Friendly)

#### Why a composite primary key prevents duplicate follows

A primary key must be unique. Setting the primary key to `(follower_id, following_id)` means the combination of both values must be unique — the same user cannot follow the same person twice. If `followUser()` is called twice accidentally, the second INSERT will fail with a unique constraint violation, not silently create a duplicate row.

#### What `ON DELETE CASCADE` means

When a user deletes their account (`auth.users` row is removed), Postgres can automatically remove all related rows in other tables. `REFERENCES profiles(id) ON DELETE CASCADE` on `user_follows` means: "if the profile this row points to is deleted, delete this follow row too." Without cascade, deleting a user would fail because follow rows would still reference the deleted profile ID.

#### Why RLS SELECT policies are OR-combined

Postgres evaluates multiple RLS policies with OR logic: a row is visible if *any* policy allows it. This is why `profile_clips` has two SELECT policies — one for public profiles and one for own clips. If they were combined into one policy with AND logic, a user would need both conditions to be true simultaneously (which is impossible when your own profile is private).

#### Why debouncing search prevents wasted API calls

Without debouncing, typing "rayshun" would trigger 7 separate Supabase queries — one per keystroke. With 300ms debouncing, the timer resets on each keystroke. Only after the user stops typing for 300ms does the final query run. For a search feature, this is essential: it reduces database load, prevents flickering results, and avoids rate limit issues.

#### What Supabase's foreign key join syntax does

`profiles!user_follows_following_id_fkey(*)` tells Supabase which foreign key to use for a join. Supabase can infer joins automatically, but when a table has *multiple* foreign keys to the same table (like `user_follows` has both `follower_id` and `following_id` pointing to `profiles`), the explicit constraint name is required to remove ambiguity. Without it, Supabase wouldn't know whether to join on `follower_id` or `following_id`.

#### Why fixed storage paths replace old files automatically

`supabase.storage.upload(path, file, { upsert: true })` overwrites an existing file at the same path. By always using the same path for a user's avatar (`{userId}/avatar.jpg`), the new upload automatically replaces the old file without any cleanup code. If paths were unique per upload (e.g., using a timestamp), old avatar files would accumulate indefinitely and need a separate cleanup job.

#### Why external video links are MVP-correct

The cost model for native video: storage (GB at rest), transcoding (CPU time), CDN egress (GB per view), a video player (JavaScript library), and accessibility (captions). The cost model for a link: zero. The tradeoff is that you don't control the content — if someone deletes their TikTok, the clip disappears. For MVP this is acceptable. Build the infrastructure only when the product has proven it's worth the operational cost.

---

### 12. Files Changed This Session

#### New files

| File | Purpose |
|------|---------|
| `types/social.ts` | `Follow`, `ProfileClip`, `NewClipInput`, `FollowCounts` TypeScript types |
| `supabase/social-schema.sql` | SQL for `user_follows` + `profile_clips` tables, all RLS policies, and Storage bucket creation — run once in Supabase SQL editor |
| `lib/followsService.ts` | `followUser`, `unfollowUser`, `getFollowCounts`, `getFollowStatus`, `getFollowers`, `getFollowing` |
| `lib/clipsService.ts` | `getClipsForUser`, `addClip`, `deleteClip`, `uploadClipCover` |
| `components/ui/ProfileCard.tsx` | Compact skater profile card with inline follow/unfollow button; used in search results and followers/following lists |
| `components/ui/ClipCard.tsx` | Single clip display — cover image or platform placeholder, title, platform badge, "Open original" link; no embed logic |
| `components/ui/AddClipForm.tsx` | Form to add a clip: URL (required), platform (auto-detected), title, caption, optional cover upload |
| `app/profile/[username]/page.tsx` | Public profile page — privacy-gated, shows avatar/bio/follow button/clips grid |
| `app/users/search/page.tsx` | Debounced user search across public profiles; renders `ProfileCard` results |

#### Modified files

| File | What changed |
|------|-------------|
| `lib/profilesService.ts` | Added `getProfileByUsername(username)` and `searchProfiles(query)` |
| `app/profile/edit/page.tsx` | Replaced `avatar_url` and `banner_url` text inputs with real file upload buttons; validates type and size before uploading to Supabase Storage `avatars` bucket; saves returned public URL to profile row immediately |
| `app/profile/friends/page.tsx` | Replaced "Coming Soon" placeholder with real Following/Followers tab UI backed by `getFollowing` and `getFollowers`; includes empty states and "Find skaters" link |
| `app/profile/page.tsx` | Added follow counts row (Following / Followers / Find skaters links); added clips section with `AddClipForm` toggle and `ClipCard` grid with delete support |
| `components/ui/UserBannerCard.tsx` | Added optional `followCounts?: FollowCounts` prop; renders follower/following counts below the stats row when provided |

---

### 13. Setup Required Before Testing

The social features depend on database objects that do not exist until the SQL schema is applied. Before testing any social feature:

1. Open Supabase Dashboard → SQL Editor.
2. Run the full contents of `supabase/social-schema.sql`.
3. This creates: `user_follows` table, `profile_clips` table, all 8 RLS policies, `avatars` Storage bucket, `clip-covers` Storage bucket, and all 8 Storage policies.
4. Verify with:
   ```sql
   SELECT tablename, policyname, cmd
   FROM pg_policies
   WHERE tablename IN ('user_follows', 'profile_clips')
   ORDER BY tablename, cmd;
   ```

---

### 14. What to Build After This (Next Session)

**Short term — test and harden:**
1. Test avatar upload end-to-end: pick file, verify bucket path, verify profile row updated, verify new avatar renders.
2. Test public profile: visit `/profile/[username]`, check that private profiles show "Profile not found".
3. Test user search: search for username, display_name, and local_park.
4. Test follow/unfollow: button state, count updates, following/followers tabs.
5. Test add clip: paste TikTok URL, add cover, verify it appears on profile.
6. Test delete clip.
7. Test RLS: confirm clips from private profiles return no rows via anon key.

**Medium term — polish:**
- Add a link to user search from the map (possibly in the bottom dock or VisibleSpotsPanel).
- Show clip count on `UserBannerCard` (requires counting `profile_clips` rows).
- Add spot attribution on clips — clicking a clip's spot badge flies the map to that location.
- Verify mobile layout on all new pages.

**Longer term — social depth:**
- Activity feed showing recent clip posts from followed users.
- YouTube embed (iframes are straightforward; a simple `<iframe>` works for YouTube).
- TikTok/Instagram: cover + "Open original" is the permanent plan — embeds require platform review.
- Notifications for new followers.
- Per-user follower/following public pages (so anyone can see who a skater follows, not just the logged-in user's own list).

---

## Session: Profile Polish — Embeds, Notifications, and Responsive Layout

**Date:** June 13, 2026
**Areas touched:** `ClipCard`, `BottomLeftWidget`, `notificationService.ts` (new), public profile page layout

---

### 1. Overview

This session polished the social layer that was built in the previous session. Three distinct problems were fixed:

1. **Clip cards were cover-image-only** — TikTok and Instagram clips now attempt a live iframe embed before falling back to the cover image or a platform placeholder.
2. **No way to notice new followers without visiting the profile page** — A lightweight red notification dot now appears on the map's profile button when a new follower is detected.
3. **Public profile layout was broken on mobile and looked like a stretched mobile card on desktop** — The profile page was rewritten with explicit mobile and desktop breakpoints, and the avatar was permanently separated from the banner.

No database schema, RLS policies, auth logic, follow/unfollow logic, or map logic were changed.

---

### 2. TikTok and Instagram Embeds in ClipCard

#### What changed

`components/ui/ClipCard.tsx` was rewritten to add a `MediaSection` sub-component. `MediaSection` runs before reaching the cover-image fallback:

```ts
// Attempt TikTok embed
if (clip.platform === "tiktok") {
  const videoId = extractTikTokVideoId(clip.external_url);
  // URL pattern: https://www.tiktok.com/@user/video/1234567890
  // Extracts: "1234567890"
  if (videoId && !embedError) {
    return <iframe src={`https://www.tiktok.com/embed/v2/${videoId}`} ... />;
  }
}

// Attempt Instagram embed
if (clip.platform === "instagram") {
  const shortcode = extractInstagramShortcode(clip.external_url);
  // URL pattern: https://www.instagram.com/p/ABC123/
  // Extracts: "ABC123"
  if (shortcode && !embedError) {
    return <iframe src={`https://www.instagram.com/p/${shortcode}/embed/`} ... />;
  }
}

// If neither matched, fall through to cover image or placeholder
```

#### How the embed fallback chain works

The card has three levels:

| Level | Shown when |
|-------|-----------|
| **Iframe embed** | Platform is TikTok or Instagram AND a valid video ID / shortcode can be extracted from the URL AND the iframe has not fired `onError` |
| **Cover image** | Embed is not attempted (wrong platform / bad URL) OR iframe failed — AND the clip has a `cover_image_url` |
| **Platform placeholder** | No embed, no cover — shows a platform-colored block with text |

Within the platform placeholder, an extra "Clip unavailable" message appears when the URL was a TikTok/Instagram link but no valid ID could be parsed (e.g. a profile URL instead of a post URL), or when the iframe fired an error event.

#### What `onError` does and does not catch

`<iframe onError={() => setEmbedError(true)}>` fires when the iframe itself fails to load — network error, CORS block, invalid URL. It does **not** fire when TikTok or Instagram loads successfully but shows an "unavailable" message inside the iframe (the iframe HTTP response is still 200 OK). This means:

- A deleted public TikTok: may show TikTok's own "unavailable" screen inside the iframe
- A private TikTok post: same
- A network failure: triggers `onError`, shows fallback

"Open original ↗" is always visible in the info row below the embed for this reason — it is the real escape hatch regardless of embed state.

#### The `sandbox` attribute on iframes

All embed iframes include:
```html
sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation"
```

`sandbox` limits what an embedded iframe can do. Without it, an iframe can access the parent page, run arbitrary JavaScript, redirect the whole tab, and read cookies. The attribute enables only the permissions the video player actually needs:

- `allow-scripts` — the player's JavaScript runs
- `allow-same-origin` — the iframe can read its own cookies (needed for auth inside the embed)
- `allow-popups` — "Share" and external links inside the player work
- `allow-forms` — comment / like forms inside the embed work
- `allow-top-navigation-by-user-activation` — tapping a link in the embed can open a new page, but only when the user explicitly clicks (not from script)

`allow-top-navigation` (without the `by-user-activation` suffix) is intentionally omitted — that would let the embed redirect the whole browser tab via JavaScript.

#### YouTube and "other" platform clips

Unchanged. YouTube clips show the cover image (or a red placeholder) and "Open original" link. No YouTube iframe embed is added here because YouTube's embed URL format (`/embed/VIDEO_ID`) requires extracting the video ID from several possible URL patterns (`/watch?v=`, `/shorts/`, `youtu.be/`) and the MVP value is limited — the TikTok/Instagram embeds are higher priority for a skate clip platform. YouTube embeds remain a noted future item.

---

### 3. New Follower Notification Badge

#### The problem

After the social layer was built, there was no way for a user to know they had a new follower without manually opening their profile page. The profile button on the map had no indicator.

#### The solution: localStorage-based badge

A new file `lib/notificationService.ts` was added with two functions:

```ts
// Read how many followers the user had last time they visited their profile
getSeenFollowerCount(userId: string): number | null

// Write the current follower count after the user visits their profile
setSeenFollowerCount(userId: string, count: number): void
```

These store and read a single value in the browser's `localStorage`:
- Key: `goskate_seen_followers_{userId}`
- Value: an integer (the follower count at last profile visit)

The flow across two components:

**`app/profile/page.tsx`** (own profile page):
After follower counts are fetched from Supabase, the current count is written to localStorage:
```ts
setSeenFollowerCount(p.id, counts.followers); // "I've now seen N followers"
```

**`components/ui/BottomLeftWidget.tsx`** (map controls):
On mount, when the user is logged in, one `getFollowCounts` query runs. The result is compared to the stored value:
```ts
const seen = getSeenFollowerCount(user.id);
if (seen === null) {
  // First time ever — set baseline, no badge
  setSeenFollowerCount(user.id, counts.followers);
} else if (counts.followers > seen) {
  setHasNewFollowers(true); // show red dot
}
```

When the profile button is tapped, `setHasNewFollowers(false)` clears the badge immediately before navigating, so the badge disappears the moment the user acts on it. The badge will not reappear until the next map load detects another increase.

#### Why localStorage instead of a database table

A proper notification system requires a `notifications` table, RLS, insert triggers, and ideally real-time subscriptions. For an MVP badge indicating "someone new followed you," that infrastructure is premature. localStorage is:

- Zero additional database queries beyond the one follower count fetch
- Zero schema changes
- Persistent across page reloads (unlike `useState`)
- Per-device (the badge may not show on a second device if the user checked it on the first — acceptable for MVP)

The tradeoff: if a user gains followers on device A and never visits their profile on device A, the badge on device B will also never appear until device A checks. This is a known limitation and acceptable for MVP.

#### The red dot badge

On both desktop (left toolbar) and mobile (bottom dock), the profile button is wrapped in a `relative` div. The badge is:
```html
<span class="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-surface" />
```

`ring-2 ring-surface` adds a thin border matching the background color, creating a visual separation between the dot and the button icon. `pointer-events-none` prevents the dot from interfering with button clicks.

---

### 4. Public Profile Page — Responsive Layout Rewrite

#### What was wrong

The public profile page (`/profile/[username]`) had several layout issues:

- **Mobile:** The avatar was using a negative top margin (`-mt-11`) to overlap the banner, but the amount of overlap was inconsistent across iterations and caused the username, follow button, and counts to start too close to the bottom of the banner, creating a cramped / overlapping appearance.
- **Desktop:** The container was `max-w-lg` (512px) — the same narrow width used for mobile. On a 1280px desktop, this looked like a tiny centered card rather than a real profile page.
- **Avatar "inside the banner":** After several layout attempts the negative margin was either too large (avatar deeply into banner) or removed (avatar flat below banner with no visual connection). The final decision was to fully separate the avatar from the banner.

#### The final layout structure

```
[Full-width banner — h-36 mobile / md:h-52 desktop]
  [Back button — absolute top-left]

[Content container — max-w-xl mobile / md:max-w-3xl desktop, px-4 / md:px-8]
  [mt-5 / md:mt-8 — clear space below banner]
  [Row: Avatar (h-20 / md:h-28) | Follow button — items-center]
  [Display name — text-xl / md:text-2xl]
  [@handle — text-sm / md:text-base]
  [Follow counts — text-sm / md:text-base]
  [Stats pills — text-xs / md:text-sm]
  [Bio — text-sm / md:text-base]
  [Clips grid — grid-cols-1 / sm:grid-cols-2, gap-3 / md:gap-4]
```

#### Mobile vs desktop — what changes at each breakpoint

| Property | Mobile (default) | Desktop (`md:` prefix, ≥768px) |
|----------|-----------------|-------------------------------|
| Banner height | `h-36` (144px) | `md:h-52` (208px) |
| Container max-width | `max-w-xl` (576px) | `md:max-w-3xl` (768px) |
| Container side padding | `px-4` (16px each) | `md:px-8` (32px each) |
| Space below banner | `mt-5` (20px) | `md:mt-8` (32px) |
| Avatar size | `h-20 w-20` (80px) | `md:h-28 md:w-28` (112px) |
| Avatar/button gap after row | `mb-4` (16px) | `md:mb-5` (20px) |
| Name font size | `text-xl` | `md:text-2xl` |
| Body text font size | `text-sm` | `md:text-base` |
| Clips grid gap | `gap-3` | `md:gap-4` |

#### Why the avatar no longer overlaps the banner

The "overlap" pattern (avatar straddles the banner bottom) is a well-known design pattern used by Twitter and Instagram. It is visually nice but requires precise negative margin math:

- Avatar is `h-20` = 80px. To straddle the banner: `margin-top: -(80px / 2)` = `-40px` so half the avatar is in the banner.
- On mobile, `-40px` on a `h-36` banner leaves only `96px` of visible banner above the avatar — fine on large phones, cramped on small ones.
- The math changes when avatar size changes (`md:h-28` needs `md:-mt-14`), when banner height changes, and when the container padding shifts. All three were changing across breakpoints.

The decision was made to remove the overlap entirely: the avatar sits cleanly below the banner with `mt-5` / `md:mt-8` of breathing room. The avatar is still large and prominent. The layout is predictable at every screen size and does not require maintaining a set of negative margin values that match the avatar/banner heights.

#### How Tailwind responsive prefixes work

Tailwind uses a mobile-first approach. A class without a prefix applies at all screen sizes. A prefixed class (`md:`, `lg:`, etc.) activates at that breakpoint and above, and overrides the unprefixed version:

```html
<div class="max-w-xl md:max-w-3xl px-4 md:px-8">
```

At screens narrower than 768px: `max-w-xl` and `px-4` apply.
At 768px and wider: `md:max-w-3xl` overrides `max-w-xl`, and `md:px-8` overrides `px-4`.

There is no "mobile only" prefix — to apply a style only on mobile, you use the unprefixed class and then override it at the next breakpoint. For example, a class that should only exist on mobile looks like:
```html
<p class="block md:hidden">Mobile only</p>
```

---

### 5. Key Concepts This Session

#### `iframe` embeds vs `<script>` embeds

Social platforms offer two kinds of embed:

- **Script-based** (TikTok's `<blockquote>` + `embed.js`, Instagram's `<blockquote>` + `embed.js`): The embed HTML is a stub; the platform's JavaScript replaces it at runtime with the real player. Works everywhere. Requires loading an external script, which can slow the page and has more cross-site concerns.

- **Iframe-based** (`/embed/v2/VIDEO_ID`): The entire player lives at a platform URL inside a sandboxed frame. No external script. Cleaner to implement. Easier to sandbox. This is what GoSkate uses.

GoSkate uses the iframe path for both TikTok and Instagram because it requires no `<script>` tags, allows `sandbox` attribute control, and keeps the player entirely contained.

#### Why `localStorage` is different from `useState`

| | `useState` | `localStorage` |
|--|-----------|---------------|
| Survives page refresh | No | Yes |
| Shared across tabs | No (each tab's React tree is separate) | Yes (same origin) |
| Shared across devices | No | No |
| Persists after browser close | No | Yes (until cleared) |
| Available during SSR | No | No (browser only) |

For the notification badge, `useState` alone would reset on every page load. `localStorage` keeps the "last seen count" across page loads and browser restarts, which is exactly the behavior needed.

#### Why `pointer-events-none` on the badge span

An absolutely positioned element sits visually on top of elements beneath it. Without `pointer-events-none`, clicking near the badge would target the badge span, not the button behind it. `pointer-events-none` makes the span invisible to mouse and touch events — clicks pass through to the button underneath.

#### What `items-center` vs `items-end` does in a flex row

Both control vertical alignment of items inside a flex container:

- `items-end`: all items align to the **bottom** of the row. Used in the previous profile layout so the follow button's bottom edge lined up with the avatar's bottom edge — a typical "profile header" appearance.
- `items-center`: all items align to the **vertical center** of the row. Used in the current layout because the avatar and follow button are the same logical "level" — neither is meant to anchor at the bottom.

When the avatar was overlapping the banner, `items-end` made sense: the follow button needed to sit at the banner boundary, not float in the middle. Once the overlap was removed, `items-center` produces a cleaner side-by-side appearance.

---

### 6. Files Changed This Session

#### New files

| File | Purpose |
|------|---------|
| `lib/notificationService.ts` | `getSeenFollowerCount` and `setSeenFollowerCount` — localStorage helpers for the new-follower badge; no database dependency |

#### Modified files

| File | What changed |
|------|-------------|
| `components/ui/ClipCard.tsx` | Rewrote to add `MediaSection` sub-component; TikTok iframe embed via `/embed/v2/{id}`; Instagram iframe embed via `/p/{shortcode}/embed/`; `onError` fallback to cover image or platform placeholder; "Clip unavailable" message for unparseable URLs |
| `components/ui/BottomLeftWidget.tsx` | Added `useAuth`, `getFollowCounts`, `getSeenFollowerCount`, `setSeenFollowerCount` imports; added `hasNewFollowers` state and mount effect; added red dot badge to profile button on both desktop and mobile toolbars; `goToProfile()` helper clears badge before navigating |
| `app/profile/page.tsx` | Added `setSeenFollowerCount` call after follower counts load — dismisses the map badge when user visits their own profile |
| `app/profile/[username]/page.tsx` | Full layout rewrite: responsive container (`max-w-xl` → `md:max-w-3xl`), taller desktop banner (`md:h-52`), larger desktop avatar (`md:h-28`), avatar fully separated from banner (positive `mt-5 md:mt-8`), larger text on desktop, responsive clips grid gap |

---

### 7. What to Build After This

**Short term — test these features:**
1. Open a TikTok clip URL on a profile — verify the iframe loads the player.
2. Open an Instagram clip URL — verify the iframe loads.
3. Paste an invalid TikTok URL (e.g. a profile link, not a video) — verify "Clip unavailable" message appears.
4. Gain a new follower (use a second test account), return to the map — verify the red dot appears on the profile button.
5. Tap the profile button — verify the dot disappears.
6. Visit the profile page — verify the dot does not return on next map load.
7. View `/profile/[username]` on a wide desktop screen — verify the `max-w-3xl` container and larger banner/avatar.
8. View same page on a 375px mobile — verify no horizontal overflow, avatar is fully below banner.

**Medium term:**
- YouTube iframe embed — extract video ID from `/watch?v=ID`, `/shorts/ID`, and `youtu.be/ID` URLs; render `https://www.youtube.com/embed/{id}`.
- Real notification infrastructure: a `notifications` table with `type='new_follower'`, `actor_id`, `read_at`. The badge would query unread rows instead of comparing localStorage counts.
- Per-user public followers/following pages at `/profile/[username]/followers` and `/profile/[username]/following`.

---
