# GoSkate — RLS Manual Testing Checklist

Run through this checklist after applying the SQL in `supabase/spots-moderation-schema.sql`
and `supabase/profiles-schema.sql` to your Supabase project.

---

## Setup Before Testing

1. Open two browser sessions (or use a private window for the second):
   - **Session A** — your admin account (`is_admin = true`)
   - **Session B** — a regular test account (no `is_admin`)
   - **Session C** — logged out / anonymous

2. Make sure at least one spot exists with `status = 'pending'` in your database.
   You can submit one via the Add Spot flow while signed in as the regular user.

---

## 1. Anonymous / Logged-Out User

- [ ] Map loads and shows spots (all markers are `status = 'approved'`)
- [ ] No pending, rejected, or flagged spots appear on the map
- [ ] Navigating to `/admin/review` redirects to `/profile`
- [ ] The Add Spot button prompts to sign in (does not open the flow)
- [ ] `fetchPublicSpots()` in the browser network tab sends `.eq("status","approved")`

---

## 2. Regular Logged-In User (no is_admin)

- [ ] Can sign up and sign in successfully
- [ ] Profile is auto-created on first login
- [ ] Can open the Add Spot flow and submit a spot
- [ ] Submitted spot has `status = 'pending'` (check Supabase table editor)
- [ ] Submitted spot does **not** appear on the public map
- [ ] Navigating to `/admin/review` redirects to `/` (access denied)
- [ ] Cannot approve/reject/flag a spot by calling the Supabase API directly
  - Open DevTools → Console and run:
    ```js
    const { createClient } = window.__SUPABASE__ // or import from app
    // A direct update attempt from an anon session should return 0 rows or an error
    ```
  - The "Admins can update any spot" RLS policy should block this
- [ ] Cannot set `is_admin = true` on their own profile via `updateProfile()`
  - The "Users can update their own profile" WITH CHECK clause should block this

---

## 3. Admin User (is_admin = true)

- [ ] Sign in as the admin account
- [ ] Navigate to `/admin/review` — page loads without redirect
- [ ] Pending spots list appears (submitted by the regular user above)
- [ ] Submitter username/avatar shows correctly

### Approve
- [ ] Click **Approve** on a pending spot
- [ ] Spot disappears from the pending list
- [ ] Spot appears on the public map (may need a page refresh)
- [ ] In Supabase table editor: spot has `status = 'approved'`, `reviewed_by` = admin UUID, `reviewed_at` is set

### Reject
- [ ] Submit another spot as the regular user
- [ ] As admin, click **Reject** → enter a moderation note → Submit
- [ ] Spot disappears from pending list
- [ ] Spot does **not** appear on the public map
- [ ] In Supabase: `status = 'rejected'`, `moderation_notes` contains your note

### Flag
- [ ] Submit another spot as the regular user
- [ ] As admin, click **Flag** → enter a note → Submit
- [ ] Spot disappears from pending list
- [ ] In Supabase: `status = 'flagged'`

---

## 4. End-to-End Spot Lifecycle

- [ ] Regular user submits spot → `status = 'pending'`, not on map
- [ ] Admin approves → `status = 'approved'`, appears on map
- [ ] Approved spot shows in the Spots in View panel
- [ ] Approved spot has correct color (amber for user-submitted source)

---

## 5. Profile Update Lockdown

Run this in the Supabase SQL Editor (as a sanity check after applying migrations):

```sql
-- Should return true for your admin user, false for everyone else
SELECT id, username, is_admin FROM profiles ORDER BY is_admin DESC;
```

Attempt via the app UI (profile edit page):
- [ ] Regular user can update username, bio, stance, local_park — all save correctly
- [ ] `is_admin` field does not appear in the edit form (it's not in ProfileUpdate type)
- [ ] No way to set `is_admin` through the app UI

---

## 6. Verify Active RLS Policies

Run in Supabase SQL Editor to confirm all policies are in place:

```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('spots', 'profiles')
ORDER BY tablename, cmd;
```

**Expected spots policies (7 total):**
- `SELECT` — Anyone can read approved spots
- `SELECT` — Users can read their own submissions
- `SELECT` — Admins can read all spots
- `INSERT` — Authenticated users can submit spots
- `UPDATE` — Users can update their own pending submissions
- `UPDATE` — Admins can update any spot
- `DELETE` — Users can delete their own pending submissions

**Expected profiles policies (5 total):**
- `SELECT` — Public profiles are readable by everyone
- `SELECT` — Users can read their own profile
- `INSERT` — Users can create their own profile
- `UPDATE` — Users can update their own profile (with is_admin lock)
- `DELETE` — Users can delete their own profile
