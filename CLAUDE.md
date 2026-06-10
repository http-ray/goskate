# GoSkate — Claude Code Reference

## What This Is
Full-stack skateboarding map and social platform. Next.js App Router, TypeScript, Tailwind CSS 4, Leaflet, Supabase Auth + PostgreSQL.

---

## Commands
```bash
npm run dev       # Start dev server (localhost:3000)
npm run build     # Production build
npm run lint      # ESLint

# Data scripts (require .env.local)
npx tsx scripts/import-osm-spots.ts --region west-la
npx tsx scripts/enrich-spots.ts
npx tsx scripts/backfill-city-from-coordinates.ts --dry-run
```

## Environment Variables
Copy `.env.local.example` → `.env.local`. Never commit `.env.local`.

| Variable | Used In | Notes |
|----------|---------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | Safe to be public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server | Safe to be public |
| `GOOGLE_PLACES_API_KEY` | `scripts/enrich-spots.ts` only | Script use only, not frontend |

---

## Architecture

### Key Directories
```
app/                    — Pages + API routes (Next.js App Router)
components/
  map/                  — MapView, SpotMarker, SpotPopup
  ui/                   — VisibleSpotsPanel, AddSpotFlow, AddSpotModal, BottomLeftWidget, UserBannerCard, AddClipModal
  auth/                 — AuthProvider (React context, useAuth() hook)
lib/
  supabase.ts           — Singleton Supabase browser client
  spotsService.ts       — fetchPublicSpots(), submitSpot(), checkNearbySpots()
  profilesService.ts    — getProfile(), ensureProfile(), updateProfile()
  osmService.ts         — Overpass API client (OSM skatepark data)
supabase/
  schema.sql                    — Base spots table
  spots-moderation-schema.sql   — Adds status, created_by, description, obstacle_tags, area_text, moderation fields
  profiles-schema.sql           — Profiles table with RLS
types/spot.ts           — Spot, SupabaseSpotRow, SpotSubmission types
data/                   — DEV-ONLY mock data (demoSpots, demoSpotActivity, demoUser)
scripts/                — Import + backfill scripts (run via tsx, never in frontend)
```

### Routes
| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Full-screen map |
| `/profile` | `app/profile/page.tsx` | Auth hub + profile view |
| `/profile/edit` | `app/profile/edit/page.tsx` | Edit profile fields |
| `/profile/friends` | `app/profile/friends/page.tsx` | **Mock only — no real social graph** |
| `/profile/settings` | `app/profile/settings/page.tsx` | Settings + logout |
| `/spots/[id]` | `app/spots/[id]/page.tsx` | Spot detail (social sections are mock) |
| `/admin/review` | `app/admin/review/page.tsx` | Moderation queue |
| `/admin/review` | `app/admin/review/page.tsx` | Moderation queue (requires `profiles.is_admin = true`) |

---

## Data Flow

**Spots → Map:**
`fetchPublicSpots()` queries Supabase (`status='approved'`) → `MapView.tsx` loads on mount → `SpotMarker` per spot → clustered with `react-leaflet-cluster`.

**Visible Spots Panel:**
MapView listens to `moveend`/`zoomend` → filters `allSpots` by `map.getBounds().contains()` → passes to `VisibleSpotsPanel` → client-side search + filter chips.

**User submits a spot:**
`AddSpotFlow` → `submitSpot()` → INSERT with `status='pending'` → invisible on map → appears in `/admin/review`.

**Admin approves:**
`/admin/review` → UPDATE `status='approved'` → spot becomes public on next map load.

**Auth:**
Supabase email/password → `AuthProvider` (`onAuthStateChange`) → `ensureProfile()` auto-creates profile row on first login.

---

## Database Schema (Supabase)

### `spots` table (key columns)
- `id`, `display_name`, `type` (skatepark/street), `source` (official/user)
- `latitude`, `longitude`
- `status` (pending/approved/rejected/flagged) — default `'approved'` for official imports
- `created_by` (FK → auth.users), `area_text`
- `description`, `obstacle_tags` (JSONB array)
- `moderation_notes`, `reviewed_by`, `reviewed_at`
- OSM provenance: `osm_name`, `osm_id`, `enrichment_checked`, `enrichment_source`

### `profiles` table
- `id` (FK → auth.users), `username` (unique), `display_name`
- `avatar_url`, `banner_url`, `bio`, `stance` (regular/goofy)
- `local_park`, `parks_visited_count`, `is_public`
- `is_admin` (BOOLEAN, default false) — set via SQL console only, never through the app

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

**To grant admin rights:**
```sql
-- Find your UUID
SELECT id FROM auth.users WHERE email = 'you@example.com';
-- Grant admin
UPDATE profiles SET is_admin = true WHERE id = '<your-uuid>';
```

---