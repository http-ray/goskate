# GoSkate — Profile System & Georgia Import
**Date:** May 27, 2026
**Scope:** Real profile system foundation + Georgia skatepark data import

---

## Table of Contents

1. [Profile System](#1-profile-system)
2. [Georgia Skatepark Import](#2-georgia-skatepark-import)
3. [Engineering Notes](#3-engineering-notes)
4. [Future Work](#4-future-work)

---

## 1. Profile System

### Why a separate profiles table?

When a user signs up with Supabase Auth, Supabase creates a row in an internal `auth.users` table. You can store small bits of extra data there (like a username) in a `user_metadata` JSON field — and that's what the V1 profile page did.

The problem with only using `auth.users` metadata:

- **It's not queryable.** You can't run `SELECT * FROM users WHERE stance = 'goofy'` on metadata JSON easily.
- **It doesn't have proper columns.** No constraints, no indexes, no foreign keys.
- **It can't hold relational data.** You can't join metadata to spots, clips, or friend connections later.
- **It's not designed for growth.** Adding bio, stance, local park, banner image, and privacy settings to a JSON blob gets messy fast.

A dedicated `profiles` table gives each user a proper row with typed columns, indexes, and Row Level Security. It's the right foundation the moment you need more than "username + avatar URL."

---

### How profiles connect to auth users

The `profiles` table uses the **same UUID** as the `auth.users` table for its primary key:

```sql
id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY
```

This means:
- Every profile row is tied to exactly one auth user.
- If the auth user is deleted, the profile row is automatically deleted too (`ON DELETE CASCADE`).
- The app can look up `profiles` by `auth.uid()` — the signed-in user's id — without any joins.

Think of it as: **auth.users owns the login, profiles owns the skater identity.**

---

### Profile fields

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Same as `auth.users.id` — primary key |
| `username` | TEXT (unique) | The `@handle` shown in the app |
| `display_name` | TEXT | Friendly name, e.g. "Alex Hawk" |
| `avatar_url` | TEXT | URL string for V1; file upload comes later |
| `banner_url` | TEXT | Profile background/header image URL |
| `bio` | TEXT | Short free-text description |
| `stance` | TEXT | `'regular'` or `'goofy'` — enforced by a SQL CHECK |
| `local_park` | TEXT | User's home skatepark (free text for V1) |
| `parks_visited_count` | INTEGER | Auto-tracked stat; never set by the user directly |
| `is_public` | BOOLEAN | `true` = visible to others; `false` = private |
| `created_at` | TIMESTAMPTZ | Set automatically on insert |
| `updated_at` | TIMESTAMPTZ | Updated automatically by a database trigger |

The `updated_at` column uses a PostgreSQL trigger function (`set_updated_at`) so the app never has to pass a timestamp — the database handles it.

---

### How the edit profile flow works

1. User opens `/profile/edit`
2. `useAuth()` resolves the signed-in user from Supabase Auth
3. `getProfile(user.id)` fetches the profile row from the `profiles` table
4. If no row exists yet (first visit), the user is redirected back to `/profile` where `ensureProfile(user)` creates one
5. The form pre-fills with the loaded profile data
6. On save, `updateProfile(user.id, updates)` sends only the changed fields to Supabase
7. The saved profile is reflected immediately in the UI

**Why `ensureProfile` instead of creating the row on signup?**

Supabase Auth email confirmation can delay the first real login. `ensureProfile` is called on every login and checks for an existing row first — so it's idempotent. Running it twice never creates duplicates. This is safer than hooking into a signup callback that may not fire reliably during email confirmation flows.

---

### What is implemented now vs. scaffolded for later

#### Implemented
- `supabase/profiles-schema.sql` — full table schema with RLS, indexes, `updated_at` trigger
- `lib/profilesService.ts` — `getProfile`, `ensureProfile`, `updateProfile` functions and TypeScript types
- `app/profile/page.tsx` — loads real profile data, shows `UserBannerCard`, links to edit/settings
- `app/profile/edit/page.tsx` — edit all profile fields with real Supabase save; `parks_visited_count` shown as read-only stat
- `components/ui/UserBannerCard.tsx` — reusable profile card (avatar, banner, name, stats, clips button slot)
- `is_public` toggle — stored and displayed; toggle works in edit profile

#### Scaffolded (column/field exists, logic deferred)
- **Privacy enforcement** — the RLS policy for `is_public = false` is written in SQL but the full private-profile UX (hiding from search, map, etc.) is not built yet
- **`parks_visited_count` increment** — the column exists and is displayed; the trigger or function to increment it when a user checks in to a new spot is not written yet
- **Avatar/banner file upload** — the schema SQL includes comments on Supabase Storage bucket naming and policies; the upload UI is not built yet
- **Public profile pages** (`/u/:username`) — the `username` column has a unique index ready for URL routing; the page is not built yet

---

### UserBannerCard — future use on the map

`components/ui/UserBannerCard.tsx` is designed to work in two contexts:

1. **`/profile`** — the logged-in user's own card (already live)
2. **Map spot popups / nearby user previews** — a future feature where tapping a user's location marker on the map shows a compact version of their card

The component accepts a `profile` prop (any `Profile` object) and an optional `onClipsClick` callback, so it can display any user's data without knowing where it's being rendered.

---

## 2. Georgia Skatepark Import

### Why Georgia?

The app already contained California skatepark data from earlier import work. Georgia was added so that users testing the app locally (specifically in the Atlanta metro and surrounding areas) would see real, nearby parks on the map instead of an empty region.

Real park data makes two things possible:
- **Functional testing** — clicking a real marker, checking in, reviewing the popup
- **Demos** — showing the app to someone in Atlanta and having it look populated

---

### How the import works

The script (`scripts/import-georgia-skateparks.ts`) runs in two steps:

**Step 1 — Region sweep**

Georgia is divided into 11 bounding boxes (Atlanta Core, Gwinnett, Athens, Savannah, Augusta, Macon, etc.). Each box is sent to the Google Places Text Search API with the query `"skatepark"`. The API returns up to 60 results per region (3 pages × 20 results). An in-memory Set of place IDs deduplicates results if the same park appears near a border of two adjacent regions.

**Step 2 — Known parks fallback**

8 specific Georgia parks are searched individually by name + city. This catches parks that the broad bbox sweep might have missed (e.g. a park listed under a different address, or one near the edge of a region box). The result name is compared against the expected name using a `namesAreSimilar()` function that checks for exact matches, substring containment, and shared meaningful words. If no strong match is found, the park is flagged for manual review.

---

### How duplicate prevention works

Each Google Place has a globally unique `id` string (e.g. `ChIJ...`). The script stores it as `google_place/<id>` in the `osm_id` column of the `spots` table. That column has a `UNIQUE` constraint. The Supabase upsert uses `onConflict: "osm_id", ignoreDuplicates: true`, so:

- Re-running the script never creates duplicate rows
- Existing rows are never overwritten
- Only genuinely new parks are inserted

---

### Import results — May 27, 2026

| Metric | Value |
|---|---|
| Regions searched | 11 |
| Raw places fetched | 48 |
| Failed regions | 1 (Augusta — API error) |
| Known parks checked | 8 |
| Total inserted | 38 |
| Total skipped (already in Supabase) | 2 |

**Known parks — found (5)**
- Duncan Creek Park Skatepark
- Brook Run Skatepark
- Ronald Reagan Park
- Newnan Skatepark
- Fourth Ward Park

**Known parks — not found / needs manual review (1)**
- SkateATL — no strong Google Places match returned

**Known parks — API error (2)**
- Bay Creek Park
- Denny Dobbs Park

---

### Next steps for Georgia data

Every park added in this import should be manually reviewed:

1. Open the Supabase Table Editor → `spots` table
2. Filter by `source = 'official'` and `needs_review = true`
3. For each flagged row: verify the name is correct, check the coordinates on the map, fix any issues
4. Set `needs_review = false` once confirmed

For the 3 parks not captured (SkateATL, Bay Creek Park, Denny Dobbs Park): search for them manually in Google Maps, note their coordinates and official name, and insert them by hand or re-run `--known-only` once the API quota resets.

To retry Augusta (failed region):
```
npx tsx scripts/import-georgia-skateparks.ts --region augusta
```

To re-run only the known parks check:
```
npx tsx scripts/import-georgia-skateparks.ts --known-only
```

---

## 3. Engineering Notes

### Concepts practiced today

**Supabase Auth + profiles relationship**

Auth systems often separate *who you are* (login credentials) from *your public identity* (profile data). Supabase Auth owns the login; the `profiles` table owns everything the skater wants to share. The link is a foreign key on a shared UUID. This pattern is called "profile augmentation" and is standard in apps that need more than username + email from their auth system.

**Service layer pattern**

`lib/profilesService.ts` is a service layer — a file that owns all the logic for one data domain (profiles). The UI just calls `ensureProfile(user)` or `updateProfile(userId, data)` without knowing the SQL or Supabase API details. This keeps pages clean and makes the data logic easy to change in one place.

**Data import and caching**

Spot data (skateparks) comes from Google Places, an external API that costs money per request and has rate limits. Rather than having every app user make a live API call when they open the map, the import script pre-fetches the data once and caches it in the app's own Supabase database. Users then read from the fast, free, internal database — not the slow, expensive, rate-limited external one.

This pattern is called **ETL (Extract, Transform, Load)**:
- **Extract**: fetch places from Google Places API
- **Transform**: convert to the app's `spots` table shape
- **Load**: upsert into Supabase

**Duplicate prevention in imports**

Every external data source has its own unique IDs. Google Places uses a `place_id` string. By storing `google_place/<place_id>` in the `osm_id` column (which has a unique constraint), the import becomes **idempotent** — running it twice produces the same result as running it once. This is a critical property for any data import script.

**Import logging**

Good import scripts log at every step: how many records were fetched, how many were filtered, how many were inserted, how many were skipped as duplicates, and which specific items failed. This makes it easy to audit what happened and diagnose problems without re-running the whole import.

**Why cache external data instead of fetching live?**

If 1,000 users open the GoSkate map at the same time, making 1,000 live Google Places API calls would be slow, expensive, and likely hit rate limits. Caching the data in Supabase means all 1,000 users read from one fast database query that costs nothing extra. The tradeoff is that the cached data can go stale — parks can open, close, or move — so periodic re-imports or manual curation are needed.

---

## 4. Future Work

### Deferred features

The following features are **intentionally not built yet**. They are noted here so the decisions are visible and easy to pick up later.

**Friends system** — Following, friend requests, and friend activity feeds are deferred. The data model (a `friendships` join table) is straightforward to add when needed, but the UX complexity of notifications, privacy, and activity feeds is significant enough to keep out of V1.

**Nearby users on the map** — Showing other skaters' locations in real time requires a live location-sharing system with privacy controls and a real-time Supabase subscription. This is deferred until the core map and profile systems are stable.

**Clip upload** — Building a full video upload system (storage buckets, transcoding, CDN delivery) is expensive and complex. The plan is to start with **external clip links** (TikTok, Instagram, YouTube) instead of native uploads. Users paste a link; the app embeds it. This keeps storage costs near zero in V1.

**Skate Reels** — A scrollable short-video feed similar to TikTok/Reels is a long-term goal. It depends on clips being established first.

### Clip embed fallback message

When a user pastes an external clip link (TikTok, Instagram, etc.) and the original post is later deleted, made private, or restricted, the app should show a clear fallback instead of a broken embed:

> *"Clip unavailable. The original post may have been deleted, made private, or restricted."*

This message should be shown wherever an embed fails to load, rather than a broken iframe or empty space.
