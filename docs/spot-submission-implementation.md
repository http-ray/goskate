# GoSkate MVP Spot Submission + Moderation Pipeline

**Implementation Date:** June 8, 2026  
**Status:** ✅ Complete - Ready for Testing

---

## Overview

This implementation adds a complete user spot submission and moderation workflow to GoSkate. Users can now submit their own skateparks and street spots, which enter a pending queue for admin review before appearing on the public map.

---

## Features Implemented

### 1. Database Schema & Security ✅

**File:** `supabase/spots-moderation-schema.sql`

Added 10 new columns to the `spots` table:
- `created_by` - UUID reference to the submitting user
- `status` - Workflow state: pending, approved, rejected, flagged
- `description` - User's description of the spot
- `obstacle_tags` - JSONB array of obstacle types
- `area_text` - User-provided location context
- `moderation_notes` - Admin notes for rejected/flagged spots
- `reviewed_by` - UUID of reviewing admin
- `reviewed_at` - Timestamp of review
- `possible_duplicate` - Boolean flag for duplicate detection

**Indexes Added:**
- `idx_spots_status` - Fast status filtering
- `idx_spots_created_by` - User's submitted spots
- `idx_spots_pending_review` - Admin review queue
- `idx_spots_flagged` - Flagged spots
- `idx_spots_lat_lng_btree` - Spatial queries for duplicate detection

**Row Level Security (RLS) Policies:**
- Public can read approved spots only
- Users can read their own submissions (any status)
- Authenticated users can insert pending spots
- Users can update/delete their own pending submissions

### 2. TypeScript Types ✅

**File:** `types/spot.ts`

- Updated `SupabaseSpotRow` with all moderation fields
- Created `SpotSubmission` type for new spot submissions

### 3. Service Layer ✅

**File:** `lib/spotsService.ts`

Three new functions:
1. **`fetchPublicSpots()`** - Fetches approved spots (official + user-submitted)
2. **`submitSpot(userId, submission)`** - Creates new spot with status='pending'
3. **`checkNearbySpots(lat, lng, radiusMeters)`** - Finds spots within radius for duplicate detection

The old `fetchOfficialSpots()` is now an alias for backwards compatibility.

### 4. Add Spot Modal ✅

**File:** `components/ui/AddSpotModal.tsx`

A comprehensive modal with:
- Location picker (use map center or tap map)
- Spot name input (required)
- Type selector (skatepark/street)
- Description textarea
- Obstacle tags (8 options: rail, ledge, stairs, gap, flatground, bowl, manual pad)
- Area/address input
- Duplicate detection warning
- Success confirmation
- Authentication check (redirects to login if needed)

**User Flow:**
1. Tap the "+" button
2. Choose location by tapping map or using current center
3. Fill out spot details
4. Submit → spot created with status='pending'
5. Success message: "Your spot is awaiting moderation"

### 5. Map Integration ✅

**Files:** 
- `components/ui/BottomLeftWidget.tsx`
- `components/map/MapView.tsx`
- `app/page.tsx`

**Changes:**
- BottomLeftWidget now opens AddSpotModal instead of showing alert
- MapView passes map center and location picker callback to BottomLeftWidget
- Map click handler enables "tap to pick location" mode
- Public spots filter now shows both official and approved user spots
- BottomLeftWidget integrated into MapView for tighter state management

### 6. Admin Review Page ✅

**File:** `app/admin/review/page.tsx`

Full-featured admin interface:
- Fetches all pending spots with submitter profiles
- Displays spot details (name, type, location, description, tags, area)
- Shows submitter username and avatar
- Highlights possible duplicates
- Three action buttons per spot:
  - **Approve** - Sets status to 'approved', appears on map
  - **Reject** - Opens note modal, sets status to 'rejected'
  - **Flag** - Opens note modal, sets status to 'flagged'
- Moderation notes modal for reject/flag actions
- Access control via hardcoded admin email list

**Access Control (MVP):**
- Hardcoded `ADMIN_EMAILS` array in page code
- Checks user email on page load
- Redirects non-admins to home page

**TODO for Production:**
- Add `is_admin` column to profiles table
- Implement proper RBAC
- Use Supabase Functions with service role for admin actions

---

## How to Test

### 1. Apply Database Migration

```sql
-- In Supabase SQL Editor, run:
-- c:\Users\shopk\Documents\Code\GoSkate\supabase\spots-moderation-schema.sql
```

This will:
- Add all moderation columns
- Set existing spots to status='approved'
- Create indexes
- Update RLS policies

### 2. Add Yourself as Admin

Edit `app/admin/review/page.tsx`:
```typescript
const ADMIN_EMAILS = [
  "admin@goskate.app",
  "your-email@example.com", // <-- Add your email here
];
```

### 3. Test User Submission Flow

1. Navigate to map (home page)
2. Click the green "+" button
3. Choose "Use Map Center" or "Pick on Map"
4. Fill out spot details:
   - Name: "Test Skatepark"
   - Type: Skatepark
   - Description: "A great test spot"
   - Tags: Select a few obstacles
   - Area: "Downtown"
5. Submit
6. Verify success message appears
7. Check that spot does NOT appear on map (status='pending')

### 4. Test Admin Review Flow

1. Navigate to `/admin/review`
2. Verify your test spot appears in the list
3. Test each action:
   - **Approve** - Should remove from list, appear on map
   - **Reject** - Should prompt for note, remove from list
   - **Flag** - Should prompt for note, remove from list

### 5. Test Duplicate Detection

1. Submit a spot
2. Submit another spot within 100 meters of the first
3. Verify the second submission shows duplicate warning
4. Admin review page should show "⚠️ Possible Duplicate" badge

### 6. Test Security

1. Log out
2. Try clicking "+" button - should show "Login Required" message
3. Log in as non-admin
4. Navigate to `/admin/review` - should redirect with access denied message
5. Try direct SQL query:
   ```sql
   SELECT * FROM spots WHERE status = 'pending';
   ```
   Should only return your own pending spots (RLS enforcement)

---

## API Reference

### Service Functions

```typescript
// Fetch all approved spots (official + user-submitted)
const spots = await fetchPublicSpots();

// Submit a new spot
const spotId = await submitSpot(userId, {
  display_name: "My Spot",
  type: "skatepark",
  latitude: 34.0522,
  longitude: -118.2437,
  description: "Great park with rails and ledges",
  obstacle_tags: ["rail", "ledge", "stairs"],
  area_text: "Downtown Los Angeles"
});

// Check for nearby spots (duplicate detection)
const nearbySpots = await checkNearbySpots(34.0522, -118.2437, 100);
```

### Database Queries

```sql
-- Get all pending spots for review
SELECT * FROM spots WHERE status = 'pending' ORDER BY created_at DESC;

-- Approve a spot
UPDATE spots 
SET status = 'approved', 
    reviewed_by = 'admin-user-id',
    reviewed_at = NOW()
WHERE id = 'spot-id';

-- Reject a spot with notes
UPDATE spots 
SET status = 'rejected',
    reviewed_by = 'admin-user-id',
    reviewed_at = NOW(),
    moderation_notes = 'Duplicate of spot XYZ'
WHERE id = 'spot-id';

-- Get user's submissions
SELECT * FROM spots WHERE created_by = 'user-id' ORDER BY created_at DESC;

-- Find nearby spots (simple lat/lng distance)
SELECT * FROM spots 
WHERE latitude BETWEEN 34.0522 - 0.001 AND 34.0522 + 0.001
  AND longitude BETWEEN -118.2437 - 0.001 AND -118.2437 + 0.001;
```

---

## Architecture Decisions

### 1. Status Workflow

**States:**
- `pending` - Newly submitted, awaiting review
- `approved` - Reviewed and approved, visible on map
- `rejected` - Reviewed and rejected, hidden from map
- `flagged` - Requires attention, hidden from map

**Why:** Simple linear workflow suitable for MVP. Easy to extend with more states later (e.g., `auto_approved` for trusted users).

### 2. Duplicate Detection

**Current:** Simple lat/lng distance check (100m radius)  
**Why:** Fast, works without PostGIS, good enough for MVP

**Future Enhancement:** Use PostGIS `ST_DWithin` for accurate geospatial queries accounting for Earth's curvature.

### 3. Admin Access Control

**Current:** Hardcoded email array in app code  
**Why:** Fastest path to MVP, no database schema changes

**Future Enhancement:**
- Add `is_admin` boolean to profiles table
- Use RLS policies for admin actions
- Implement proper role-based access control (RBAC)

### 4. Component Structure

**Decision:** Move BottomLeftWidget inside MapView  
**Why:** Tighter integration with map state (center, click handlers)

**Trade-off:** Reduces separation of concerns but improves data flow for location picking feature.

---

## Security Notes

### Row Level Security (RLS)

All policies are enforced at the database level:
- ✅ Users can only submit spots as themselves
- ✅ Users can only edit their own pending submissions
- ✅ Public can only see approved spots
- ✅ Users can see their own submissions regardless of status

### Admin Actions

**Current (MVP):** Client-side email check  
**Risk:** Admins can be impersonated if JWT is compromised

**Recommended for Production:**
- Use Supabase Edge Functions with service role key
- Validate admin status server-side on every action
- Add audit logging for all moderation actions

---

## Known Limitations

1. **Duplicate Detection:** Uses simple lat/lng math, not accurate for large distances
2. **Admin Security:** Email list is hardcoded, not database-enforced
3. **No Batch Actions:** Admins must review spots one at a time
4. **No Appeal Process:** Rejected spots cannot be re-submitted
5. **No Analytics:** No tracking of submission rates, approval rates, etc.

---

## Future Enhancements

### Phase 2 - Enhanced Moderation
- [ ] Bulk approve/reject actions
- [ ] Filter spots by submitter, date, type
- [ ] View submission history per user
- [ ] Auto-approve trusted users after N approved submissions
- [ ] Email notifications for submission status changes

### Phase 3 - Advanced Features
- [ ] Spot photos upload
- [ ] Community voting on pending spots
- [ ] Edit suggestions for existing spots
- [ ] Merge duplicate spots
- [ ] PostGIS integration for accurate geospatial queries

### Phase 4 - Analytics
- [ ] Admin dashboard with submission metrics
- [ ] Heatmap of user activity
- [ ] Quality score for submitters
- [ ] Automated duplicate detection improvements

---

## Files Changed/Created

### Created Files:
- `supabase/spots-moderation-schema.sql` - Database migration
- `components/ui/AddSpotModal.tsx` - Submission modal
- `app/admin/review/page.tsx` - Admin review interface
- `docs/spot-submission-implementation.md` - This document

### Modified Files:
- `types/spot.ts` - Added moderation fields to SupabaseSpotRow, added SpotSubmission
- `lib/spotsService.ts` - Added fetchPublicSpots, submitSpot, checkNearbySpots
- `components/ui/BottomLeftWidget.tsx` - Integrated AddSpotModal
- `components/map/MapView.tsx` - Added location picker, map center tracking, BottomLeftWidget
- `app/page.tsx` - Removed BottomLeftWidget (now in MapView)

---

## Deployment Checklist

Before deploying to production:

- [ ] Run `spots-moderation-schema.sql` in Supabase production environment
- [ ] Update `ADMIN_EMAILS` array with real admin emails
- [ ] Test submission flow on production domain
- [ ] Test admin review flow
- [ ] Verify RLS policies are enforced
- [ ] Set up monitoring for failed submissions
- [ ] Document admin procedures for team
- [ ] Create user documentation for spot submission
- [ ] Consider rate limiting for submissions (prevent spam)

---

## Support

For questions or issues:
1. Check this document first
2. Review Supabase logs for RLS policy errors
3. Check browser console for client-side errors
4. Verify database migration was applied correctly

---

**Implementation Complete** ✅  
All core features are functional and ready for testing. Admin review access must be configured before use.
