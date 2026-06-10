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
