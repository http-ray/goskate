# GoSkate

A full-stack skateboarding map and social platform. Find skateparks and street spots, add new ones, follow other skaters, and share clips tied to the spots where they were filmed.

Built with Next.js (App Router), TypeScript, Tailwind CSS 4, Leaflet, and Supabase (Auth + PostgreSQL + Storage).

---

## Features

**Map**
- Full-screen interactive Leaflet map with marker clustering and a density heatmap
- Official spots (imported from OpenStreetMap) and user-submitted spots, visually distinguished
- "Spots in View" panel — search and filter chips (All / Official / User / Skateparks / Street), grouped by area
- Add Spot flow with duplicate detection within ~100m

**Spot popups**
- Directions (opens Google Maps), View Spot, and Add Clip actions
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

**Auth & moderation**
- Supabase email/password auth; profile auto-created on first login
- Admin moderation queue at `/admin/review` for approving/rejecting/flagging user-submitted spots (`profiles.is_admin` gated, enforced via RLS)

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Map | Leaflet, react-leaflet, react-leaflet-cluster, leaflet.heat |
| Backend | Supabase (Auth, PostgreSQL, Row Level Security, Storage) |
| Data import | tsx scripts using the Overpass API (OpenStreetMap) and Google Places (admin scripts only) |

---

## Getting Started

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase project values
npm run dev                         # http://localhost:3000
```

### Other commands

```bash
npm run build     # production build
npm run start     # run the production build
npm run lint       # ESLint
```

### Data scripts (require `.env.local`)

```bash
npx tsx scripts/import-osm-spots.ts --region west-la
npx tsx scripts/enrich-spots.ts
npx tsx scripts/backfill-city-from-coordinates.ts --dry-run
```

---

## Environment Variables

| Variable | Used in | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | Safe to be public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server | Safe to be public |
| `GOOGLE_PLACES_API_KEY` | `scripts/enrich-spots.ts` only | Script use only — never used by the frontend |

Never commit `.env.local`. The Supabase service role key is never used in this project — all client/server reads and writes go through the anon key, gated by Row Level Security.

---

## Project Structure

```
app/                          Pages + routes (Next.js App Router)
  page.tsx                    Full-screen map
  profile/                    Auth hub, edit, friends (follow lists), settings
  profile/[username]/         Public profile page
  spots/[id]/                 Spot detail page (info + public clips)
  users/search/                User search
  admin/review/               Moderation queue (admin only)

components/
  map/                        MapView, SpotMarker, SpotPopup, SpotHeatLayer
  ui/                         VisibleSpotsPanel, AddSpotFlow, AddClipModal,
                               AddClipForm, ClipCard, ProfileCard,
                               UserBannerCard, BottomLeftWidget
  auth/                       AuthProvider (React context, useAuth() hook)

lib/
  supabase.ts                 Singleton Supabase browser client (anon key)
  spotsService.ts             fetchPublicSpots(), submitSpot(), checkNearbySpots()
  profilesService.ts          getProfile(), ensureProfile(), updateProfile(), search
  followsService.ts           followUser(), unfollowUser(), follow counts/status
  clipsService.ts             getClipsForUser(), addClip(), deleteClip(), cover upload
  notificationService.ts      localStorage helpers for the new-follower badge
  osmService.ts                Overpass API client (OSM skatepark data)

supabase/
  schema.sql                  Base spots table
  spots-moderation-schema.sql Adds status, created_by, description, moderation fields
  profiles-schema.sql         Profiles table + RLS
  social-schema.sql           user_follows + profile_clips tables + RLS

scripts/                      Import + enrichment + backfill scripts (run via tsx)
types/                        Spot, Profile, social (Follow/ProfileClip), submission types
```

---

## Data Flow

- **Spots → Map:** `fetchPublicSpots()` (status = `approved`) → `MapView` on mount → `SpotMarker` per spot, clustered.
- **User submits a spot:** `AddSpotFlow` → `submitSpot()` → inserted as `status='pending'` → invisible on the public map until reviewed in `/admin/review`.
- **Admin approves:** `/admin/review` → status updated to `approved` → spot appears on next map load.
- **Add Clip from a spot popup:** `SpotPopup` → `AddClipModal` (with `spot_id`) → `AddClipForm` → `addClip()` → clip is saved with both `user_id` and `spot_id`, so it shows up on the user's profile *and* on that spot's Public Clips section.
- **Auth:** Supabase email/password → `AuthProvider` listens via `onAuthStateChange` → `ensureProfile()` auto-creates a profile row on first login.

---

## Database (Supabase)

### `spots`
Core fields: `id`, `display_name`, `type` (`skatepark`/`street`), `source` (`official`/`user`), `latitude`, `longitude`, `status` (`pending`/`approved`/`rejected`/`flagged`), `created_by`, `description`, `obstacle_tags`, `area_text`, moderation fields, OSM provenance fields.

### `profiles`
`id` (FK → `auth.users`), `username` (unique), `display_name`, `avatar_url`, `banner_url`, `bio`, `stance`, `local_park`, `parks_visited_count`, `is_public`, `is_admin` (set via SQL console only).

### `user_follows`
`follower_id`, `following_id` (both FK → `profiles`), `created_at`. Following is public (like Twitter) — it does not bypass a private profile's content.

### `profile_clips`
`id`, `user_id` (FK → `profiles`), `title`, `caption`, `platform` (`tiktok`/`instagram`/`youtube`/`other`), `external_url`, `cover_image_url`, `spot_id` (FK → `spots`, nullable), `created_at`. No native video files are stored — clips are external links with optional cover images.

### Row Level Security summary
- **`spots`** — anyone reads `approved` spots; users read/edit/delete their own pending submissions; authenticated users insert as `pending`; admins (`profiles.is_admin = true`) can read and update any spot.
- **`profiles`** — public profiles readable by anyone; users manage their own row; `is_admin` cannot be self-elevated (enforced in the `UPDATE` policy's `WITH CHECK`).
- **`user_follows`** — anyone can read follow relationships; users can only create/delete their own follow rows.
- **`profile_clips`** — readable by anyone if the owning profile is public, or always by the owner; users insert/update/delete only their own clips.

To grant admin rights, run in the Supabase SQL console:
```sql
SELECT id FROM auth.users WHERE email = 'you@example.com';
UPDATE profiles SET is_admin = true WHERE id = '<your-uuid>';
```

---

## Security Notes

- The Supabase service role key is never used — all access goes through the anon key plus RLS.
- Admin checks are enforced at the database layer (RLS), not just client-side.
- Google Places API is used only in `scripts/enrich-spots.ts`, never in frontend or user-facing code.
- No native video storage — clips are external links (TikTok/Instagram/YouTube) with optional cover images in Supabase Storage.

---

## Known Limitations / Not Yet Built

- No TikTok/Instagram account connection — clips are added by pasting a link
- Spot check-ins ("who's here now") were removed from spot popups in favor of spot-linked clips
- No push notifications, activity feed, or direct messages yet
