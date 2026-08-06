# Security Fixes Log

## Open Graph metadata pointing to localhost
**What I found:** When a GoSkate link gets shared (iMessage, Slack, Twitter, wherever), the preview card is built from `og:url` and `og:image` meta tags. Both were resolving to `http://localhost:3000/...` instead of the real production URL, so every shared link showed a broken or dead preview.

**Why it mattered:** This is the kind of bug that's invisible in normal use — the site itself works fine — but it's the first thing a recruiter or interviewer sees if they get a shared link before ever loading the page. A broken preview reads as "this project isn't finished."

**Root cause:** `app/layout.tsx`, `app/robots.ts`, and `app/sitemap.ts` each built their base URL the same way: read `NEXT_PUBLIC_SITE_URL` from the environment, and if it's not set, hard fall back to `http://localhost:3000`. That variable was never set anywhere — it wasn't in `.env.local`, and it wasn't documented in `.env.local.example` either, so there was nothing prompting anyone to set it before deploying. The fallback silently did the wrong thing instead of failing loudly.

**Fix:** Created `lib/siteUrl.ts` with a `getSiteUrl()` helper and pointed all three files at it. It checks three things in order: an explicit `NEXT_PUBLIC_SITE_URL` override, then Vercel's own `VERCEL_PROJECT_PRODUCTION_URL` (which Vercel sets automatically on every deploy, no configuration needed), then `localhost` as the last resort for local dev. This means production OG tags now self-heal on Vercel even if nobody remembers to set the env var by hand. Also documented `NEXT_PUBLIC_SITE_URL` in `.env.local.example` so it's not an undocumented magic variable anymore.

**How I verified it:** Ran a real production build (`npm run build`) with `VERCEL_PROJECT_PRODUCTION_URL` set to simulate a live Vercel deploy, then read the actual generated HTML/XML output straight out of `.next/`. Confirmed `og:url` and `og:image` both resolved to the production domain, and `robots.txt` / `sitemap.xml` did too. Then rebuilt with no env vars set at all and confirmed it correctly fell back to `localhost:3000` — so local dev still works exactly as before, nothing regressed.

## Missing WITH CHECK on profile_clips UPDATE policy
**What I found:** The Row-Level Security policy controlling who can update a row in the `profile_clips` table (`supabase/social-schema.sql`) had a `USING` clause requiring `auth.uid() = user_id`, but no `WITH CHECK` clause.

**Why it mattered:** In Postgres RLS, `USING` controls which existing rows you're allowed to touch, but `WITH CHECK` controls what the row is allowed to look like *after* the update. Without it, the only thing stopping someone from updating their own clip and setting its `user_id` to someone else's id was... nothing. The `USING` clause only checks the row you started from, not the row you're leaving behind. In practice this means a signed-in user could take a clip they own and hand ownership of it to another user's account through a normal update call — not something you'd want possible.

**Root cause:** The policy was written with only half of the standard UPDATE-policy pattern. Every other RLS policy on this table (INSERT, DELETE) only needed one clause because those operations only have a "before" or "after" state, not both — UPDATE is the one command where leaving out `WITH CHECK` creates a real gap, and it's an easy thing to miss since the policy still "looks" complete with just `USING`.

**Fix:** Added `WITH CHECK (auth.uid() = user_id)` to the `"Users can update clips"` policy in `supabase/social-schema.sql`, matching the existing `USING` clause. Now both the row being changed and the row left behind have to belong to the same user.

**How I verified it:** I don't have database write credentials in this environment (only the app's public anon key, no service role key), so I couldn't run this against the live database myself. What I did verify: the syntax exactly matches the `USING` + `WITH CHECK` pattern already live and working on the `spots` table's admin UPDATE policy in `spots-moderation-schema.sql`, so it's the same proven shape, not something new and untested. This fix still needs to be applied to the live database — run the statement below in the Supabase SQL Editor:

```sql
DROP POLICY IF EXISTS "Users can update clips" ON profile_clips;

CREATE POLICY "Users can update clips"
  ON profile_clips FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

After running it, you can confirm it took by checking `pg_policies`:

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profile_clips' AND policyname = 'Users can update clips';
```

The `with_check` column should no longer be empty.


## Duplicate detection doesn't flag submissions
**What I found:** `checkNearbySpots()` correctly detects nearby spots on submission, but the result was never used to set `possible_duplicate` — the column exists in the schema, and the admin review page already had UI ready to display it, but nothing ever wrote `true` to it. Every submitted spot showed `possible_duplicate = false`, even ones submitted 10 meters from an existing park.

**Why it mattered:** the user submitting the spot saw a warning ("nearby spot(s) detected"), which implied something would happen on the backend as a result. Nothing did. A moderator reviewing the pending queue had no way to tell a likely duplicate apart from a brand new spot — they'd have to notice the overlap themselves by eye, which defeats the purpose of building the detection logic in the first place.

**Root cause:** the check and the write were split across two different functions that never talked to each other. `checkNearbySpots()` (in `lib/spotsService.ts`) ran and returned results, but `submitSpot()` — the function that actually does the insert — had no parameter for that result and never included `possible_duplicate` in the row it wrote. The detection half of the feature was built; the half that acts on the result wasn't.

**Fix:** `submitSpot()` now takes a third argument, `possibleDuplicate`, and includes it in the insert as `possible_duplicate` (`lib/spotsService.ts`). `AddSpotFlow.tsx` now passes `nearby.length > 0` from its existing `checkNearbySpots()` call straight into `submitSpot()`. Also corrected the success-screen copy, which previously said "this **may be** reviewed for duplicates" — now that the flag is actually wired up, it says the spot **was** flagged for moderator review, since that's now literally what happens. No changes were needed in `app/admin/review/page.tsx` — it already selected `possible_duplicate` via `select("*")` and already had a conditional "⚠️ Possible Duplicate" badge; that code was correct all along, it just never had real data to display.

**How I verified it:** Added `lib/spotsService.test.ts`, which mocks the Supabase client and asserts on the actual insert payload: submitting with the duplicate flag set to `true` results in `possible_duplicate: true` in the row sent to Supabase, `false` results in `false`, and omitting the argument defaults to `false`. All 3 new tests pass, and the full suite (31 tests total) still passes. Confirmed the admin queue's existing render logic is correct by reading the code directly — I did not create a live test submission against the production database to see the badge render, since that would mean writing real test data into production, which I didn't want to do without asking first.
documented for future work]