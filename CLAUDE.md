# GoSkate — Claude Code Reference

## What This Is
Full-stack skateboarding map and social platform. Next.js App Router, TypeScript, Tailwind CSS 4, Leaflet, Supabase Auth + PostgreSQL. Live at [go-skate.app](https://go-skate.app), hosted on Vercel.

---

## Commands
```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run test        # Vitest unit tests

# Data scripts (require .env.local)
npx tsx scripts/import-usa-skateparks.ts --state GA          # free, OSM/Overpass
npx tsx scripts/import-usa-skateparks-google.ts --pass city  # paid API, Google Places
npx tsx scripts/enrich-spots.ts
npx tsx scripts/backfill-city-from-coordinates.ts --dry-run
```

## Environment Variables
Copy `.env.local.example` → `.env.local`. Never commit `.env.local`.

| Variable | Used In | Notes |
|----------|---------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | Safe to be public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server | Safe to be public |
| `NEXT_PUBLIC_SITE_URL` | OG metadata, sitemap, robots, auth redirects | Optional on Vercel — `lib/siteUrl.ts` falls back to `VERCEL_PROJECT_PRODUCTION_URL`, then `localhost:3000` |
| `GOOGLE_MAPS_API_KEY` | `scripts/import-*.ts` | Script use only, not frontend |
| `GOOGLE_PLACES_API_KEY` | `scripts/enrich-spots.ts` only | Same underlying key, different var name — `enrich-spots.ts` predates the others and was never renamed to match |

No service role key is used anywhere in this project. Every read/write, including admin actions, goes through the anon key and is authorized by RLS.

---

## Architecture

### Key Directories
```
app/                    — Pages (Next.js App Router)
components/
  map/                  — MapView, SpotMarker, SpotPopup, SpotHeatLayer
  ui/                   — VisibleSpotsPanel, AddSpotFlow, AddClipModal, AddClipForm,
                           ClipCard, ProfileCard, UserBannerCard, BottomLeftWidget, Toast
  auth/                 — AuthProvider (React context, useAuth() hook)
lib/
  supabase.ts           — Singleton Supabase browser client
  siteUrl.ts            — getSiteUrl(): NEXT_PUBLIC_SITE_URL → VERCEL_PROJECT_PRODUCTION_URL → localhost
  spotsService.ts       — fetchPublicSpots(), submitSpot(), checkNearbySpots()
  profilesService.ts    — getProfile(), ensureProfile(), updateProfile()
  followsService.ts     — follow/unfollow, counts
  clipsService.ts       — clip CRUD, cover upload
  feedbackService.ts    — submitFeedback(), fetchFeedback(), setFeedbackStatus(), deleteFeedback()
  osmService.ts         — Overpass API client (OSM skatepark data)
  validation.ts         — LIMITS, capText/capOrNull, sanitizeSearchQuery, lat/lng checks
  usStates.ts           — STATE_NAMES, STATE_BBOXES, stateFromCoords() — used by both the
                           Spots-in-View panel's State→City grouping and the import scripts
supabase/
  schema.sql                    — Base spots table
  spots-moderation-schema.sql   — Adds status, created_by, description, obstacle_tags, area_text,
                                   possible_duplicate, moderation fields
  profiles-schema.sql           — Profiles table with RLS
  social-schema.sql             — user_follows, profile_clips tables + RLS + storage bucket policies
  feedback-schema.sql           — feedback table + RLS (anonymous insert allowed)
types/                  — spot.ts, social.ts, feedback.ts
scripts/                — Import + enrichment + backfill scripts (run via tsx, never in frontend).
                          Two independent import paths: free OSM (import-usa-skateparks.ts) and
                          paid Google Places (import-usa-skateparks-google.ts, plus older
                          per-state scripts for CA/GA). Both dedupe against existing rows via a
                          spatial hash grid + Haversine distance, and both upsert on osm_id so
                          re-running is safe.
```

No `data/` mock directory exists in this project — every route reads from Supabase. If you see a stale reference to mock data anywhere in docs, it predates the real follows/clips implementation and should be corrected, not trusted.

### Routes
| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Landing page |
| `/map` | `app/map/page.tsx` | Full-screen map |
| `/profile` | `app/profile/page.tsx` | Auth hub + profile view |
| `/profile/edit` | `app/profile/edit/page.tsx` | Edit profile fields |
| `/profile/friends` | `app/profile/friends/page.tsx` | Follower/following lists — real data via `user_follows` |
| `/profile/settings` | `app/profile/settings/page.tsx` | Change password, visibility toggle, feedback link, logout |
| `/profile/feedback` | `app/profile/feedback/page.tsx` | Feedback submission — works signed-in or anonymous |
| `/profile/[username]` | `app/profile/[username]/page.tsx` | Public profile page |
| `/spots/[id]` | `app/spots/[id]/page.tsx` | Spot detail — real clips via `profile_clips.spot_id` |
| `/users/search` | `app/users/search/page.tsx` | User search |
| `/admin/review` | `app/admin/review/page.tsx` | Moderation queue — Pending + History tabs, `profiles.is_admin` gated |
| `/admin/feedback` | `app/admin/feedback/page.tsx` | Feedback inbox — New/Read/Focus/Archived triage, `profiles.is_admin` gated |

---

## Data Flow

**Spots → Map:**
`fetchPublicSpots()` queries Supabase (`status='approved'`) → `MapView.tsx` loads on mount → `SpotMarker` per spot → clustered with `react-leaflet-cluster`.

**Visible Spots Panel:**
MapView listens to `moveend`/`zoomend` → filters `allSpots` by `map.getBounds().contains()` → passes to `VisibleSpotsPanel` → grouped by State → City (`resolveStateCity()` in `VisibleSpotsPanel.tsx`, backed by `lib/usStates.ts`) → client-side search + filter chips.

**User submits a spot:**
`AddSpotFlow` → `checkNearbySpots()` (bounding-box approximation, ~100m) → `submitSpot()` → INSERT with `status='pending'`, `possible_duplicate` set if a nearby spot was found → invisible on map → appears in `/admin/review` Pending tab, with a duplicate badge if flagged.

**Admin reviews a spot:**
`/admin/review` Pending tab → Approve/Reject/Flag (with optional note) → UPDATE `status` + `reviewed_by`/`reviewed_at`/`moderation_notes` → spot moves to the History tab. The same three actions are available on History items too, so a decision can be reversed at any time — nothing is final.

**Feedback:**
`/profile/feedback` (auth optional) → `submitFeedback()` → INSERT with `status='new'` → `/admin/feedback` lists it, admin can change `status` (Read/Focus/Archived) or delete.

**Auth:**
Supabase email/password → `AuthProvider` listens via `onAuthStateChange` only (no separate `getSession()` call — see gotcha below) → `ensureProfile()` auto-creates a profile row on first login. Custom SMTP (Resend) sends confirmation email from the app's own domain; `emailRedirectTo` is built from `window.location.origin` at signup time.

---

## Database Schema (Supabase)

### `spots` table (key columns)
- `id`, `display_name`, `type` (skatepark/street), `source` (official/user)
- `latitude`, `longitude`
- `status` (pending/approved/rejected/flagged) — default `'approved'` for official imports
- `created_by` (FK → auth.users), `area_text`
- `description`, `obstacle_tags` (JSONB array), `possible_duplicate`
- `moderation_notes`, `reviewed_by`, `reviewed_at`
- OSM/Google provenance: `osm_name`, `osm_id` (unique), `enrichment_checked`, `enrichment_source`, `enrichment_confidence`, `needs_review`

### `profiles` table
- `id` (FK → auth.users), `username` (unique), `display_name`
- `avatar_url`, `banner_url`, `bio`, `stance` (regular/goofy)
- `local_park`, `parks_visited_count`, `is_public`
- `is_admin` (BOOLEAN, default false) — set via SQL console only, never through the app

### `feedback` table
- `id`, `user_id` (FK → auth.users, **nullable** — null means anonymous submission)
- `message`, `status` (new/read/focus/archived), `created_at`

### RLS Summary
**`spots` — 7 active policies:**
- Anyone reads `status='approved'`
- Users read their own submissions (any status)
- Authenticated users INSERT with `status='pending'`, `source='user'`, `created_by=auth.uid()`
- Users UPDATE/DELETE their own pending submissions only
- Admins (`profiles.is_admin = true`) SELECT all spots (including pending)
- Admins UPDATE any spot (covers approve/reject/flag)

**`profiles` — 5 active policies:**
- Public profiles readable by anyone (`is_public = true`)
- Users CRUD their own row
- UPDATE policy has `WITH CHECK` preventing self-elevation of `is_admin`

**`user_follows` — 3 active policies:** anyone reads; users insert/delete only their own follow rows.

**`profile_clips` — 5 active policies:** public reads clips of public profiles; owner reads/inserts/updates/deletes their own.

**`feedback` — 4 active policies:** anyone inserts (as themselves or anonymously); only admins read, update, or delete.

**Known gotcha — schema drift:** more than once this project has had SQL files in `supabase/` that were correct but never actually applied to the live database (missing columns, missing RLS policies with no INSERT policy at all on `spots` at one point). If something that should work throws an RLS error or a "column not found," don't assume the code is wrong before checking `pg_policies` / the live column list against the file — they've diverged before.

**To grant admin rights:**
```sql
SELECT id FROM auth.users WHERE email = 'you@example.com';
UPDATE profiles SET is_admin = true WHERE id = '<your-uuid>';
```

---

## Known gotchas worth knowing before touching auth code

- **`AuthProvider` uses only `onAuthStateChange`, not a separate `getSession()` call.** It used to have both, which raced right after an email-confirmation redirect (the client has to parse the token out of the URL) — `user` could update twice in quick succession, causing anything keyed on it (like `ensureProfile()`) to fire concurrently. `onAuthStateChange` alone already fires once immediately on subscribe with the current session, so there's no need for the second source of truth.
- **`ensureProfile()` recovers from a `23505` (unique violation) instead of throwing** — it's a check-then-insert, not atomic, so if it's ever invoked twice concurrently it self-heals by re-fetching rather than surfacing an error.
- **Supabase's `signUp()` doesn't error on a duplicate email** by design (avoids leaking which emails are registered). Detect it via `data.user.identities.length === 0` instead — see `app/profile/page.tsx`.
