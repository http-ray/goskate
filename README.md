# GoSkate

A full-stack skateboarding map and social platform. Find skateparks and street spots, add new ones, follow other skaters, and share clips tied to the spots where they were filmed.

**Live:** [go-skate.app](https://go-skate.app)

Built with Next.js (App Router), TypeScript, Tailwind CSS 4, Leaflet, and Supabase (Auth + PostgreSQL + Storage).

---

## Features

**Map**
- Full-screen interactive Leaflet map with marker clustering and a density heatmap
- Official spots (imported from OpenStreetMap / Google Places) and user-submitted spots, visually distinguished
- "Spots in View" panel — search and filter chips (All / Official / User / Skateparks / Street), grouped by State → City
- Add Spot flow with proximity-based duplicate detection (~100m); a detected duplicate is flagged (`possible_duplicate`) for moderator review rather than blocked

**Spot popups**
- Directions (opens Google Maps, driving mode), View Spot, and Add Clip actions
- Add Clip opens a modal that links the new clip directly to that spot (`spot_id`), prompting sign-in if the user isn't authenticated

**Spot detail pages** (`/spots/[id]`)
- Spot info, type/source badges, directions
- Public Clips — real clips linked to that spot via `profile_clips.spot_id`, with poster attribution

**Profiles & social**
- Public profile pages at `/profile/[username]` — avatar, banner, bio, stance, local park, follower/following counts
- Follow / unfollow system (`user_follows` table)
- User search at `/users/search`
- Profile clips — TikTok/Instagram/YouTube links with iframe embeds (cover image and platform-placeholder fallbacks)
- New-follower notification badge on the map's profile button (localStorage-based, no extra table)
- Responsive layout (mobile-first, wider/taller on desktop)

**Feedback**
- In-app feedback form at `/profile/feedback` — no email client required, and works for signed-out visitors too (stored anonymously)
- Admin inbox at `/admin/feedback` — triage messages as New / Read / Focus / Archived, or delete

**Auth & moderation**
- Supabase email/password auth with custom SMTP (Resend) for confirmation emails; duplicate-signup attempts are detected and redirected to login instead of showing a misleading "account created" message
- Profile auto-created on first login, with race-safe handling if auth state settles in two steps (can happen right after an email-confirmation redirect)
- Admin moderation queue at `/admin/review` — Pending tab for first-time decisions, History tab for everything already decided, with the same Approve/Reject/Flag actions available on history items so a past call can be reversed
- All admin gating (`profiles.is_admin`) is enforced at the RLS layer, not just client-side checks

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Map | Leaflet, react-leaflet, react-leaflet-cluster, leaflet.heat |
| Backend | Supabase (Auth, PostgreSQL, Row Level Security, Storage) |
| Email | Resend (custom SMTP for Supabase Auth — confirmation emails send from the app's own domain) |
| Hosting | Vercel |
| Data import | tsx scripts using the Overpass API (OpenStreetMap, free) and Google Places API (admin scripts only, never in the frontend) |
| Testing | Vitest |

---

## Getting Started

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase project values
npm run dev                         # http://localhost:3000
```

### Other commands

```bash
npm run build      # production build
npm run start      # run the production build
npm run lint        # ESLint
npm run typecheck  # tsc --noEmit
npm run test        # Vitest unit tests
npm run test:watch # Vitest watch mode
```

---

## Environment Variables

| Variable | Used in | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | Safe to be public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server | Safe to be public |
| `NEXT_PUBLIC_SITE_URL` | Metadata / OG / sitemap / auth redirects | Your production URL. Optional on Vercel — falls back automatically to `VERCEL_PROJECT_PRODUCTION_URL`, then `localhost:3000` in dev (see `lib/siteUrl.ts`) |
| `GOOGLE_MAPS_API_KEY` | Import scripts (`import-*.ts`) only | Script use only — never used by the frontend |
| `GOOGLE_PLACES_API_KEY` | `scripts/enrich-spots.ts` only | Same Google API key, different variable name — this script predates the others and wasn't renamed to match; set both to the same value if you need enrichment too |

Never commit `.env.local`. The Supabase service role key is never used in this project — all client/server reads and writes go through the anon key, gated by Row Level Security.

---

## Project Structure

```
app/                          Pages + routes (Next.js App Router)
  page.tsx                    Landing page (public front door)
  map/                        Full-screen map
  profile/                    Auth hub, edit, friends (follow lists), settings, feedback
  profile/[username]/         Public profile page
  spots/[id]/                 Spot detail page (info + public clips)
  users/search/                User search
  admin/review/               Moderation queue, Pending + History tabs (admin only)
  admin/feedback/              Feedback inbox (admin only)

components/
  map/                        MapView, SpotMarker, SpotPopup, SpotHeatLayer
  ui/                         VisibleSpotsPanel, AddSpotFlow, AddClipModal,
                               AddClipForm, ClipCard, ProfileCard,
                               UserBannerCard, BottomLeftWidget, Toast
  auth/                       AuthProvider (React context, useAuth() hook)

lib/
  supabase.ts                 Singleton Supabase browser client (anon key)
  siteUrl.ts                  Resolves the site's own absolute URL (OG tags, auth redirects)
  spotsService.ts             fetchPublicSpots(), submitSpot(), checkNearbySpots()
  profilesService.ts          getProfile(), ensureProfile(), updateProfile(), search
  followsService.ts           followUser(), unfollowUser(), follow counts/status
  clipsService.ts             getClipsForUser(), addClip(), deleteClip(), cover upload
  feedbackService.ts          submitFeedback(), fetchFeedback(), setFeedbackStatus(), deleteFeedback()
  notificationService.ts      localStorage helpers for the new-follower badge
  osmService.ts                Overpass API client (OSM skatepark data)
  validation.ts                Shared input length caps and sanitizers
  clipUrl.ts                    Clip platform/URL parsing (TikTok/Instagram)
  usStates.ts                  State name/bbox lookups for grouping and geo scripts

supabase/
  schema.sql                  Base spots table
  spots-moderation-schema.sql Adds status, created_by, description, moderation fields
  profiles-schema.sql         Profiles table + RLS
  social-schema.sql           user_follows + profile_clips tables + RLS + storage policies
  feedback-schema.sql         feedback table + RLS (anonymous inserts allowed, admin-only read/update/delete)

scripts/                      Import + enrichment + backfill scripts (run via tsx, never in frontend)
types/                        Spot, Profile, social (Follow/ProfileClip), feedback, submission types
```

---

## Data Flow

- **Spots → Map:** `fetchPublicSpots()` (status = `approved`) → `MapView` on mount → `SpotMarker` per spot, clustered.
- **User submits a spot:** `AddSpotFlow` → `checkNearbySpots()` → `submitSpot()` → inserted as `status='pending'`, with `possible_duplicate` set if a nearby spot was found → invisible on the public map until reviewed in `/admin/review`.
- **Admin reviews:** `/admin/review` Pending tab → Approve/Reject/Flag → status updated → spot appears (or doesn't) on next map load. Decided spots move to the History tab, where the same actions can reverse an earlier call.
- **Add Clip from a spot popup:** `SpotPopup` → `AddClipModal` (with `spot_id`) → `AddClipForm` → `addClip()` → clip is saved with both `user_id` and `spot_id`, so it shows up on the user's profile *and* on that spot's Public Clips section.
- **Feedback:** `/profile/feedback` (signed in or anonymous) → `submitFeedback()` → stored with `status='new'` → triaged in `/admin/feedback`.
- **Auth:** Supabase email/password → `AuthProvider` listens via `onAuthStateChange` (the sole source of session state) → `ensureProfile()` auto-creates a profile row on first login, self-healing if it's called twice concurrently right after an email-confirmation redirect.

---

## Database (Supabase)

### `spots`
Core fields: `id`, `display_name`, `type` (`skatepark`/`street`), `source` (`official`/`user`), `latitude`, `longitude`, `status` (`pending`/`approved`/`rejected`/`flagged`), `created_by`, `description`, `obstacle_tags`, `area_text`, `possible_duplicate`, moderation fields, OSM/Google provenance fields.

### `profiles`
`id` (FK → `auth.users`), `username` (unique), `display_name`, `avatar_url`, `banner_url`, `bio`, `stance`, `local_park`, `parks_visited_count`, `is_public`, `is_admin` (set via SQL console only).

### `user_follows`
`follower_id`, `following_id` (both FK → `profiles`), `created_at`. Following is public (like Twitter) — it does not bypass a private profile's content.

### `profile_clips`
`id`, `user_id` (FK → `profiles`), `title`, `caption`, `platform` (`tiktok`/`instagram`/`youtube`/`other`), `external_url`, `cover_image_url`, `spot_id` (FK → `spots`, nullable), `created_at`. No native video files are stored — clips are external links with optional cover images.

### `feedback`
`id`, `user_id` (FK → `auth.users`, nullable — null means anonymous), `message`, `status` (`new`/`read`/`focus`/`archived`), `created_at`.

### Row Level Security summary
- **`spots`** — anyone reads `approved` spots; users read/edit/delete their own pending submissions; authenticated users insert as `pending`; admins (`profiles.is_admin = true`) can read and update any spot.
- **`profiles`** — public profiles readable by anyone; users manage their own row; `is_admin` cannot be self-elevated (enforced in the `UPDATE` policy's `WITH CHECK`).
- **`user_follows`** — anyone can read follow relationships; users can only create/delete their own follow rows.
- **`profile_clips`** — readable by anyone if the owning profile is public, or always by the owner; users insert/update/delete only their own clips.
- **`feedback`** — anyone can insert (as themselves, or anonymously with `user_id = null`); only admins can read, update (triage), or delete.

To grant admin rights, run in the Supabase SQL console:
```sql
SELECT id FROM auth.users WHERE email = 'you@example.com';
UPDATE profiles SET is_admin = true WHERE id = '<your-uuid>';
```

---

## Security Notes

- The Supabase service role key is never used — all access goes through the anon key plus RLS.
- Admin checks are enforced at the database layer (RLS), not just client-side.
- Google Places API is used only in the import/enrichment scripts, never in frontend or user-facing code.
- No native video storage — clips are external links (TikTok/Instagram/YouTube) with optional cover images in Supabase Storage.
- Auth confirmation emails are sent through a verified custom domain via Resend, not Supabase's shared default sender (which is rate-limited and not intended for production signup volume).

---

## Known Limitations / Not Yet Built

- Import data currently focuses on the contiguous United States — the state/city grouping and import scripts weren't built with international coverage in mind
- No TikTok/Instagram account connection — clips are added by pasting a link
- Spot check-ins ("who's here now") were removed from spot popups in favor of spot-linked clips
- No push notifications, activity feed, or direct messages yet
