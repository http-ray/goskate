# GoSkate V1 Foundation Documentation

## Purpose of This Document

This document explains the current GoSkate V1 foundation before authentication, social features, and production-scale community systems are added. It is written to help with:

- onboarding new contributors
- understanding why the current architecture was chosen
- interview preparation and technical discussion
- learning the main concepts used in the codebase
- planning future phases without losing the intent of V1

The goal of V1 is not to ship the complete social network. The goal is to prove the core loop:

1. load skate spots from a real data source
2. show them on a fast, fullscreen map
3. keep the UI mobile-friendly
4. preserve room for future check-ins, clips, profiles, and social systems

---

## 1. App Overview

GoSkate is a location-based skate discovery app. The current foundation focuses on the map experience: users can browse skate spots on a dark fullscreen map, open spot popups, view action buttons, and trigger a location recenter flow.

At this stage, the app is intentionally simple:

- the map is the main product surface
- official skate spots come from Supabase
- the frontend is responsible for rendering, filtering, and interaction only
- social systems are planned, but not yet active

This makes V1 a good foundation for learning how a map-first product can be structured with a real backend and clean separation between UI and data.

---

## 2. Current Goals of V1

The current phase is about building the foundation for a skate spot platform, not the final network effect layer.

The main goals are:

- prove the map and spot data model
- keep the app responsive on mobile and desktop
- maintain a fullscreen map experience
- cache official spots in Supabase so the UI does not rely on live scraping
- keep the codebase beginner-friendly and easy to extend
- prepare for future authentication, profiles, clips, and social activity

---

## 3. Current Tech Stack and Why It Was Chosen

### Next.js

GoSkate uses Next.js because it gives us:

- a modern React app structure
- file-based routing
- server/client component separation when needed
- production-ready build and deployment behavior
- a good path toward auth, API routes, and future pages

For V1, Next.js is helpful because the app is small enough to stay simple, but the project still has room to grow into a larger product.

### React

React is the UI layer. It fits this project because the app is mostly:

- state-driven UI
- map overlays
- popups and controls
- future expandable screens like profile, clips, and settings

The current codebase uses React in a straightforward way: state, effects, callbacks, and small components.

### TypeScript

TypeScript is used to make the data model explicit.

Why it matters here:

- spot data has a clear shape
- Supabase rows differ from frontend spot objects
- map components rely on predictable lat/lng values
- future features will add more tables and more shared models

TypeScript reduces accidental mismatches between database shape and UI shape.

### Tailwind CSS

Tailwind is used for layout and responsive styling.

Why it works well for this project:

- map overlays need quick responsive adjustments
- mobile vs desktop UI changes are easy to express with breakpoint classes
- styles remain close to the component logic
- the app can evolve quickly without a large CSS architecture

### Leaflet + React-Leaflet

Leaflet is the map engine. React-Leaflet wraps Leaflet for React use.

Why this is a good fit:

- simple and lightweight compared with heavier map SDKs
- strong support for tiles, markers, and map interaction
- easy to control panning, bounds, and zooming
- works well for a fullscreen map product

This choice keeps the map understandable for beginners while still giving real map behavior.

### Supabase

Supabase is used as the backend database and read source for official spots.

Why Supabase fits V1:

- PostgreSQL gives a real relational data model
- the frontend can read from one source of truth
- Row Level Security can be added cleanly later
- the team can cache/import spots without building a custom backend first
- it supports a gradual transition from prototype to product

### Google Places API

Google Places is used in the enrichment/import pipeline, not directly by the current map UI.

Why it exists in the foundation:

- OpenStreetMap is a good base source but not always complete
- Google Places can help enrich weak or missing skatepark names
- the data can be cached in Supabase to avoid repeated live lookups
- the app can move toward better naming quality without changing the frontend data flow

### Node.js / TSX scripts

The import scripts run with `tsx` in Node.js.

This is useful because:

- data import is separate from the UI
- the scripts can be run manually when needed
- the import workflow can evolve independently from the app

---

## 4. Current Project Structure

Current top-level structure:

- `app/` - Next.js routes and layout
- `components/` - reusable UI and map-specific components
- `data/` - local demo and seed data
- `lib/` - shared service wrappers and backend clients
- `public/` - static assets
- `scripts/` - data import and enrichment scripts
- `supabase/` - database schema and SQL setup
- `types/` - shared TypeScript types

### Important folders

#### `app/`

Contains the page entry points and global layout.

- `app/layout.tsx` defines global metadata and font/layout setup
- `app/page.tsx` renders the fullscreen map experience
- `app/profile/`, `app/spots/`, and nested pages exist as the starting point for future routes

#### `components/map/`

Map-specific UI.

- `MapView.tsx` owns the Leaflet map, data loading, bounds, and spot rendering
- `SpotMarker.tsx` renders the map markers and spot interactions
- `SpotPopup.tsx` renders popup content for a spot

#### `components/ui/`

Floating action controls and modal UI.

- `BottomLeftWidget.tsx` holds the current floating controls
- `AddClipModal.tsx` is the spot-level clip action UI

#### `lib/`

Shared backend access.

- `supabase.ts` creates the Supabase client
- `spotsService.ts` fetches official spots from Supabase
- `osmService.ts` supports data import and source integration

#### `scripts/`

Offline or manual data workflows.

- `import-osm-spots.ts` imports OSM-derived spot data
- `import-california-skateparks.ts` enriches California skateparks from Google Places into Supabase
- `enrich-spots.ts` supports enrichment and cache maintenance workflows

#### `supabase/`

Database setup and schema.

- `schema.sql` defines the current spots table and indexes

#### `types/`

Shared app types.

- `spot.ts` defines the frontend `Spot` type and full Supabase row type

---

## 5. Map System Architecture

The map is the center of the app.

### Main responsibilities of `MapView`

`MapView` does several jobs:

- creates the fullscreen Leaflet map
- loads official spots from Supabase on mount
- merges official spots with local demo/user spots
- renders one marker per spot
- manages check-in state in the frontend
- opens and closes the add-clip modal
- exposes a locate-me function to the control widget

This is intentionally centralized because the map is the product’s main interaction surface.

### Why this architecture was chosen

The map owns the most important screen state because:

- spot markers depend on map rendering
- popups depend on map interaction
- the geolocation recenter action needs access to the map instance
- the data layer is simple enough to keep in one place for V1

For a small foundation app, keeping the map logic close together is easier to understand than splitting it too early.

### Map rendering flow

1. the page loads
2. `MapView` mounts on the client
3. Supabase official spots are fetched
4. local demo/user spots are merged in
5. Leaflet renders the tiles and markers
6. floating controls overlay the map
7. popups and actions are triggered from markers

---

## 6. Google Places Import and Supabase Caching Flow

This is one of the most important foundation concepts in the project.

### What the import pipeline does

The import script currently acts like a data ingestion layer:

- it sweeps a geographic area in tiles
- it queries Google Places for skateparks
- it filters and normalizes results
- it removes duplicates by place ID and display name
- it stores the official spot rows in Supabase

### Why cache in Supabase instead of querying live every time

Caching the imported results in Supabase is a deliberate product and engineering choice.

Benefits:

- the map loads faster because it reads one database table
- the frontend does not depend on a live Google query every time
- results are stable and consistent
- the team can review or enrich names later
- the data can be reused for future search, filters, and profiles

This is a common production pattern: do expensive or rate-limited work offline, then serve the app from a database.

### Current import flow

The California import script currently works like this:

1. read environment variables
2. generate bounding-box tiles for California
3. call Google Places Text Search for each tile
4. apply skatepark heuristics
5. deduplicate results
6. map Google Places fields into Supabase rows
7. insert the rows into the `spots` table

### Data relationship between import and frontend

The frontend does not talk to Google Places directly.

Instead:

- import scripts write official spot data into Supabase
- `spotsService.ts` reads official spots from Supabase
- `MapView` receives normalized Spot objects
- spot markers render from that simplified frontend shape

That separation keeps the UI simpler and keeps the external API logic out of the map component.

### Beginner-friendly concept: cache vs source of truth

The Google Places response is not treated as the app’s runtime source of truth. Supabase is.

That means:

- Google Places helps generate or enrich data
- Supabase stores the working app dataset
- the frontend reads from Supabase every time

This is easier to scale and easier to debug.

---

## 7. Responsive Mobile-First UI System

The current UI is designed to feel like a map app rather than a generic webpage.

### Mobile-first approach

The UI is styled so it works on small screens first and then adapts upward for desktop.

Current mobile patterns include:

- floating bottom dock controls
- thumb-friendly button spacing
- a larger center action button
- a recenter control positioned above the dock
- map content that remains visible and interactive behind overlays

### Why this approach was chosen

Map products are often primarily used on mobile.

Mobile-first design helps because:

- the app feels natural on a phone
- controls stay reachable with one hand
- the map remains the main focus
- desktop can still present a cleaner floating toolbar

### Desktop vs mobile behavior

The app currently uses responsive Tailwind classes to switch between layouts.

Mobile:

- bottom dock is visible
- controls are grouped for thumb reach
- the map recenter button floats above the dock

Desktop:

- controls move to a floating left toolbar
- the bottom dock is hidden
- the recenter button stays as a left-side floating control

This makes the UI feel more like a real map app on small screens while still being clean on larger screens.

---

## 8. Current Spot System and Data Structure

### Spot model

The app uses a shared `Spot` type in `types/spot.ts`.

A spot includes:

- `id`
- `name`
- `latitude`
- `longitude`
- `type`
- `source`
- optional future fields like `clipsCount` and `activeSkaters`

### Why the frontend Spot type is simplified

The frontend does not need every database field.

A simplified type is useful because:

- the UI only needs the display fields and coordinates
- internal enrichment fields stay in the database layer
- the map code is easier to read
- future backend changes are less likely to break the UI

### Current spot sources

The current foundation supports two source categories:

- `official` - imported from OpenStreetMap / cached in Supabase
- `user` - local mock/demo user spots used in the current foundation

### Why the app merges official and local spots

This makes it easier to prototype the product before the full user-generated content system exists.

It allows the app to:

- show real official data now
- preserve a path for community spots later
- keep the UI representative of the final product direction

---

## 9. Current Popup and Action System

The current spot interaction model is lightweight.

### What happens when a user interacts with a spot

Each spot marker can open a popup and expose actions such as:

- viewing spot info
- checking in or out
- adding a clip

### Why popups are used

Popups are a good V1 choice because:

- they keep the map visible
- they avoid leaving the map screen
- they make spot-level actions feel immediate
- they are easy to understand for new users

### Current action philosophy

The current action system is intentionally minimal.

It focuses on:

- marker interaction
- check-in toggles
- add-clip entry points
- future expansion into richer social actions

This keeps the product grounded in real map behavior instead of overbuilding a dashboard too early.

---

## 10. Map Bounds and Zoom Handling

Map bounds and zoom are a major part of the product experience.

### Why bounds matter

Without bounds, users can pan and zoom anywhere in the world. That is not useful for a focused skate discovery app.

Current bounds behavior:

- the map is constrained around the United States
- slight padding is allowed for neighboring Canada and Mexico regions
- dragging outside the supported area feels resisted rather than abrupt

### Why zoom limits matter

Zoom limits prevent users from zooming out too far and losing the product context.

This matters because:

- the app should feel like a USA-focused skate map
- world view is not useful for the current data scope
- consistent zoom levels improve mobile and desktop behavior

### Current implementation concept

The map uses:

- `maxBounds` to constrain panning
- `maxBoundsViscosity` to resist movement beyond the bounds
- `minZoom` to stop zooming out too far
- a device-aware center/zoom strategy to keep mobile visually tighter than desktop

### Why this was chosen

This is a common map-product pattern:

- the UI guides attention to the supported geography
- the map feels intentionally scoped
- the user is less likely to get lost in empty areas

### Beginner-friendly concept: bounds vs zoom

- `bounds` control where the map can be dragged
- `minZoom` controls how far out the user can zoom

They solve different problems, so both are useful.

---

## 11. Important Implementation Decisions and Tradeoffs

### Keep the map fullscreen

The map fills the viewport because the app is map-first. This keeps the user focused on the spots instead of on panels and navigation.

Tradeoff:

- less room for side panels
- but much better immersion and simpler interaction

### Keep the current UI overlay model

Controls float above the map instead of pushing the map into a smaller container.

Tradeoff:

- overlay buttons need careful spacing and responsive behavior
- but the map remains interactive and visually dominant

### Keep Supabase as the frontend read source

The frontend reads official spots from Supabase rather than querying external sources live.

Tradeoff:

- requires an import pipeline
- but gives much better runtime performance and stability

### Keep the architecture simple in V1

This phase intentionally avoids unnecessary abstraction.

Tradeoff:

- not as modular as a mature production app
- but much easier to understand, debug, and extend while the product is still forming

---

## 12. Current Limitations

This is a foundation stage, so some things are intentionally incomplete.

Current limitations include:

- authentication is not implemented yet
- social relationships are not implemented yet
- clip uploads are not connected to a full backend workflow
- real-time presence and activity are future work
- community moderation tools are not in place
- user-generated spots are still partly represented by local/demo data
- advanced search and filters are not yet productionized

These are acceptable limitations for V1 because the project is still validating the core map experience.

---

## 13. Future Scalability Ideas

Likely production-scale improvements later:

- auth and account management
- profile pages tied to user identity
- real clip upload/storage pipeline
- dedicated tables for check-ins, clips, and follows
- moderation and reporting workflows
- spot search, filters, and saved locations
- server-side caching or geo queries for faster spot loading
- better tile-based import jobs for more regions
- region-specific data enrichment workflows
- map clustering for dense cities
- offline-friendly or partially cached mobile behavior

### What would likely change in production later?

In a production version, the app would likely evolve from a simple read-first foundation into a multi-service system:

- authenticated users would own content
- spot activity would be stored in dedicated tables
- map queries might be region-based instead of loading everything at once
- spot import jobs would likely run in a more automated pipeline
- moderation and analytics would become first-class concerns

---

## 14. Planned Future Phases and Features

The current foundation suggests a path like this:

### Phase 2: Authentication

- sign-in and account creation
- basic user identity
- protected actions like clips or check-ins

### Phase 3: Social Graph

- friends/following
- public profiles
- activity feeds
- spotting who is active at a location

### Phase 4: Clip System

- upload and attach clips to spots
- show clip counts and spot media
- timeline or gallery views

### Phase 5: Community Spot Creation

- add user-submitted street spots
- moderation and review flow
- more robust anti-duplication logic

### Phase 6: Scale and Optimization

- clustering and region loading
- better search and filters
- performance tuning for large datasets
- support for more cities and countries

---

## 15. What Skills and Concepts Were Learned During This Phase?

This phase demonstrates and teaches several useful engineering concepts:

- React component composition
- client-side state management
- responsive UI design
- map tile rendering and marker overlays
- geolocation and map recenter behavior
- database-backed data loading
- import pipeline design
- cache-as-source-of-truth thinking
- TypeScript data modeling
- separation between frontend views and backend data
- practical tradeoff management in early product development

These are useful both for building the app and for discussing the work in interviews.

---

## 16. Interview-Relevant Engineering Concepts Demonstrated

GoSkate V1 shows several concepts that are easy to discuss in a technical interview:

### Frontend architecture

- choosing a simple, maintainable component structure
- keeping the map component focused on map state
- using responsive overlays without breaking the map

### Data architecture

- separating import scripts from runtime UI
- caching third-party data into a database
- normalizing data before it reaches the frontend

### Product thinking

- prioritizing the core loop first
- designing for mobile behavior early
- using V1 as a foundation rather than overengineering too soon

### Performance and scalability thinking

- avoiding repeated live API calls
- loading only what the UI needs
- keeping room for future pagination, clustering, and geo filtering

### Engineering tradeoff judgment

- simple now, scalable later
- readable over prematurely abstract
- product focus over platform complexity

---

## 17. Why Was This Architecture Chosen?

This architecture was chosen because the product is still in its foundation stage.

The main priorities were:

- make the map feel good on mobile immediately
- keep the code understandable for a small team or solo developer
- get real spot data into the app without building a full backend from scratch
- leave clear paths for auth, social, clips, and moderation later

In other words, the architecture is intentionally practical.

It is not optimized for every future scenario yet, but it creates a strong and readable base for the next phases.

---

## 18. Summary

GoSkate V1 is a fullscreen, map-first skate discovery foundation built with Next.js, React, TypeScript, Leaflet, Tailwind, and Supabase.

The most important ideas in this phase are:

- the map is the product core
- official data is imported once and cached in Supabase
- the frontend reads a simplified spot model
- mobile and desktop map behavior are intentionally different
- the architecture is simple now so it can scale later

This is a good foundation for future authentication, social, and clip systems because it already has:

- a real backend data source
- a clear spot model
- a map-centered UI
- a data import pipeline
- responsive mobile-first interaction patterns
