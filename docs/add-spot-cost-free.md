# Add Spot Flow — Cost-Free Implementation

**Last Updated:** June 8, 2026  
**Status:** ✅ Revised to eliminate user-triggered API costs

---

## Overview

The Add Spot flow allows authenticated users to submit new skateparks and street spots **without triggering any paid API calls**. All location selection methods use free, client-side technologies.

### Key Principles

✅ **Zero API Costs for Users** — No Google Places, Geocoding, or external location APIs  
✅ **Free Location Methods Only** — Browser geolocation + map clicks  
✅ **Manual Address Entry** — Users type area/address text (no geocoding)  
✅ **Admin-Only Paid APIs** — Google Places reserved for bulk imports/admin tools  

---

## Location Selection (2 Free Options)

### 1. Use Current Location

**Technology:** Browser Geolocation API  
**Cost:** FREE ✅

**How it works:**
```typescript
navigator.geolocation.getCurrentPosition(
  (pos) => {
    setLocation({ 
      lat: pos.coords.latitude, 
      lng: pos.coords.longitude 
    });
    setLocationLabel("Current location");
  }
);
```

**User Experience:**
1. User clicks "Use Current Location"
2. Browser prompts for location permission
3. Map flies to user's position
4. Location confirmed with label "Current location"

### 2. Pick on Map

**Technology:** Leaflet map click event  
**Cost:** FREE ✅

**How it works:**
```typescript
// When user clicks "Pick on Map"
setIsMinimized(true); // Hide main modal
onLocationPick((lat, lng) => {
  setLocation({ lat, lng });
  setLocationLabel("Location from map");
  setIsMinimized(false); // Reopen modal
});
```

**User Experience:**
1. User clicks "Pick on Map"
2. Modal minimizes to small banner
3. Banner displays: "Tap the map to place your spot"
4. User taps anywhere on the map
5. Modal reopens with location selected
6. Location confirmed with label "Location from map"

**Technical Implementation:**

*AddSpotFlow.tsx:*
```typescript
const handlePickOnMap = () => {
  setIsMinimized(true);
  onLocationPick((lat: number, lng: number) => {
    setLocation({ lat, lng });
    setLocationLabel("Location from map");
    setIsMinimized(false);
  });
};
```

*MapView.tsx:*
```typescript
useEffect(() => {
  if (!map || !locationPickCallback) return;
  
  const handleMapClick = (e: L.LeafletMouseEvent) => {
    locationPickCallback(e.latlng.lat, e.latlng.lng);
    setLocationPickCallback(null); // One-time use
  };
  
  map.on("click", handleMapClick);
  return () => map.off("click", handleMapClick);
}, [locationPickCallback]);
```

---

## Area/Address Field (Manual Entry)

**Technology:** Plain text input (no geocoding)  
**Cost:** FREE ✅

**Implementation:**
```typescript
<input
  type="text"
  value={areaText}
  onChange={(e) => setAreaText(e.target.value)}
  placeholder="e.g. Downtown, near 5th St"
/>
```

**User Experience:**
- Optional text field in Step 2 (Spot Details)
- User types area/address/landmark manually
- Examples: "Downtown", "Near City Hall", "5th and Main"
- Stored as `area_text` in database
- No external API calls
- No geocoding or validation
- Admin can see this text during review

---

## What Was Removed

### Address/Place Search (Previously Used Google Places API)

**Previous Implementation:**
- Used Google Places Text Search API
- Cost: $0.032 per search
- Potential monthly cost: ~$192 for 1000 users

**Why It Was Removed:**
- ❌ Adds API costs for user-triggered actions
- ❌ Users could trigger hundreds of searches
- ❌ Not necessary when Pick on Map works well
- ❌ Duplicates functionality of manual area text field

**Current Alternative:**
- Users use "Pick on Map" for exact location
- Users type area/address in manual text field
- Zero API costs ✅

---

## Submission Pipeline

### Database Schema

Spots saved with these fields:
```sql
display_name TEXT NOT NULL,
type TEXT NOT NULL, -- 'skatepark' or 'street'
latitude DOUBLE PRECISION NOT NULL,
longitude DOUBLE PRECISION NOT NULL,
description TEXT,
obstacle_tags JSONB, -- e.g. ["rail", "ledge", "stairs"]
area_text TEXT, -- Manual area/address entry
source TEXT DEFAULT 'user',
status TEXT DEFAULT 'pending',
created_by UUID REFERENCES auth.users(id),
possible_duplicate BOOLEAN DEFAULT FALSE
```

### Duplicate Detection

**Technology:** Supabase spatial query  
**Cost:** FREE ✅ (included in Supabase free tier)

```typescript
export async function checkNearbySpots(
  lat: number, 
  lng: number, 
  radiusMeters: number = 100
) {
  // Simple distance check using Supabase
  // Uses ST_Distance or similar PostGIS function
  const nearby = await supabase
    .from('spots')
    .select('*')
    .filter(...) // Within radius
    
  return nearby.data || [];
}
```

### Moderation Workflow

1. User submits spot → `status='pending'`, `source='user'`
2. Admin reviews at `/admin/review`
3. Admin actions:
   - **Approve** → `status='approved'` (appears on map for all users)
   - **Reject** → `status='rejected'` (with moderation_notes)
   - **Flag** → `status='flagged'` (for further review)

---

## Cost Analysis

### Current Implementation (Cost-Free)

| Feature | Technology | Cost per Use | Monthly Cost (1000 users) |
|---------|-----------|--------------|---------------------------|
| Use Current Location | Browser Geolocation | $0.00 | $0.00 |
| Pick on Map | Leaflet Click Event | $0.00 | $0.00 |
| Manual Area Text | Text Input | $0.00 | $0.00 |
| Duplicate Check | Supabase Query | $0.00* | $0.00* |
| Spot Submission | Supabase Insert | $0.00* | $0.00* |

*Included in Supabase free tier (500MB database, 2GB bandwidth/month)

**Total Monthly Cost: $0.00** ✅

### Previous Implementation (With Address Search)

| Feature | Cost per Use | Monthly Cost (1000 users × 2 spots × 3 searches) |
|---------|--------------|--------------------------------------------------|
| Google Places Search | $0.032 | ~$192/month |

**Savings: $192/month by removing address search** 💰

---

## Admin/Import Scripts (Where Paid APIs Are Used)

Google Places API is **still used** for admin-controlled operations:

### 1. Bulk OSM Imports

**File:** `scripts/import-osm-spots.ts`  
**Purpose:** Import skateparks from OpenStreetMap  
**Frequency:** Once per region (rare)  
**Cost:** Controlled by admin, one-time per import  

### 2. Spot Enrichment

**File:** `scripts/enrich-spots.ts`  
**Purpose:** Add additional data to existing spots  
**Frequency:** Occasional admin maintenance  
**Cost:** Controlled, infrequent  

### Why This Is Acceptable

✅ **Admin-controlled** — Only trusted users can run these scripts  
✅ **Infrequent** — Runs once per region, not per user submission  
✅ **Predictable cost** — Can set quotas and budgets  
✅ **High value** — Imports thousands of spots at once  

### Cost Control for Admin Scripts

1. Set API quotas in Google Cloud Console
2. Set budget alerts (e.g., alert at $50/month)
3. Run scripts during off-peak hours
4. Cache results to avoid repeated calls
5. Use bulk import endpoints when available

---

## Mobile vs Desktop Behavior

### Mobile (<768px)
- Modal slides up from bottom (bottom sheet)
- Full-width buttons
- Touch-optimized tap targets (min 44px)
- Minimized banner sticks to bottom

### Desktop (≥768px)
- Modal centered on screen
- Max width 512px (max-w-lg)
- Hover effects on buttons
- Minimized banner in bottom-right

---

## Testing Checklist

### ✅ Use Current Location
- [ ] Click "Use Current Location"
- [ ] Browser prompts for permission
- [ ] Allow location access
- [ ] Map flies to current position
- [ ] Confirm location shows "Current location" label
- [ ] Proceed to Step 2

### ✅ Pick on Map
- [ ] Click "Pick on Map"
- [ ] Modal minimizes to banner
- [ ] Banner displays "Tap the map to place your spot"
- [ ] Tap anywhere on the map
- [ ] Modal reopens
- [ ] Confirm location shows "Location from map" label
- [ ] Proceed to Step 2

### ✅ Spot Details Form
- [ ] Enter spot name: "Downtown Ledges"
- [ ] Select type: "Street Spot"
- [ ] Add description: "Great ledge and stairs"
- [ ] Select obstacles: rail, ledge, stairs
- [ ] **Enter area text: "Downtown, near 5th St"** (manual entry)
- [ ] Submit spot

### ✅ Submission Verification
- [ ] Success screen appears
- [ ] Shows "Submitted for Review!"
- [ ] If nearby spots, shows duplicate warning
- [ ] Click "Done"

### ✅ Database Verification
1. Open Supabase dashboard
2. Navigate to spots table
3. Find latest submission
4. Verify fields:
   - `source = 'user'`
   - `status = 'pending'`
   - `created_by = {user_id}`
   - `area_text = 'Downtown, near 5th St'`
   - `latitude` and `longitude` are set
   - `obstacle_tags = ["rail", "ledge", "stairs"]`

### ✅ Admin Review
- [ ] Navigate to `/admin/review`
- [ ] See pending spot with area_text displayed
- [ ] Approve the spot
- [ ] Refresh map → spot appears

---

## Troubleshooting

### "Geolocation not supported"
**Cause:** Browser doesn't support Geolocation API (very rare)  
**Solution:** Use "Pick on Map" instead

### "Could not get your location"
**Causes:**
- User denied location permission
- GPS unavailable
- Location services disabled

**Solution:** Use "Pick on Map" instead

### Pick on Map doesn't work

**Issue:** Modal doesn't minimize
```typescript
// Check isMinimized state in AddSpotFlow.tsx
console.log("isMinimized:", isMinimized);
```

**Issue:** Map not clickable
```typescript
// Check z-index in MapView.tsx
// Minimized banner should be z-[9999]
// Map should be lower z-index
```

**Issue:** Callback not firing
```typescript
// Add debug log in MapView.tsx
const handleMapClick = (e: L.LeafletMouseEvent) => {
  console.log("Map clicked:", e.latlng);
  locationPickCallback(e.latlng.lat, e.latlng.lng);
};
```

**Issue:** Modal doesn't reopen
```typescript
// Check handlePickOnMap in AddSpotFlow.tsx
// Should call setIsMinimized(false) in callback
```

### Area text not saving

**Check database:**
```sql
SELECT id, display_name, area_text 
FROM spots 
WHERE created_by = '{user_id}'
ORDER BY created_at DESC 
LIMIT 5;
```

**Check service layer:**
```typescript
// In spotsService.ts submitSpot()
// Verify area_text is included in insert
area_text: submission.area_text || null
```

---

## Future Enhancements (Optional)

### Option 1: Nominatim (OpenStreetMap Geocoding)

**Technology:** Free OSM-based geocoding  
**Cost:** FREE (with rate limits)  
**Rate Limit:** 1 request/second  
**Use Case:** Optional address search for power users  

**Implementation:**
```typescript
const response = await fetch(
  `https://nominatim.openstreetmap.org/search?` +
  `q=${encodeURIComponent(query)}&format=json&limit=5`,
  { headers: { 'User-Agent': 'GoSkate/1.0' } }
);
```

**Pros:**
- Free for reasonable use
- No API key required
- Respects open data

**Cons:**
- Must respect rate limits
- Must provide User-Agent header
- Quality may vary by region

### Option 2: Offline Geocoding

**Technology:** Local geocoding database  
**Cost:** FREE (after initial setup)  
**Use Case:** High-volume apps  

**Implementation:**
- Download place name database (e.g., GeoNames)
- Store in Supabase
- Use full-text search
- No external API calls

**Pros:**
- Zero runtime costs
- Fast response
- No rate limits

**Cons:**
- Initial setup required
- Database size (several GB)
- Maintenance overhead

---

## Summary

### What Users Get

✅ Easy location selection (GPS or map click)  
✅ Fast submission flow (3 clear steps)  
✅ Mobile-friendly interface  
✅ Manual area/address field for context  

### What Admins Get

✅ Zero API costs from user submissions  
✅ Controlled use of Google Places for bulk imports  
✅ Manual area text to help identify spot locations  
✅ Full moderation pipeline (pending/approved/rejected)  

### What Developers Get

✅ Simple, maintainable code  
✅ No API key management for user flow  
✅ Supabase handles all data storage  
✅ Future-proof architecture (can add geocoding later)  

---

## File Reference

**Modified Files:**
- `components/ui/AddSpotFlow.tsx` — Removed search functionality
- `app/api/search-places/route.ts` — No longer used by user flow

**Unchanged Files:**
- `lib/spotsService.ts` — submitSpot(), checkNearbySpots()
- `components/map/MapView.tsx` — Map click handler
- `components/ui/BottomLeftWidget.tsx` — Add Spot button
- `app/admin/review/page.tsx` — Admin moderation interface
- `supabase/spots-moderation-schema.sql` — Database schema

**Admin-Only Files (Still Use Google Places API):**
- `scripts/import-osm-spots.ts`
- `scripts/enrich-spots.ts`

---

## Questions?

**Q: Can users still search for addresses?**  
A: No, address search was removed to eliminate API costs. Users use "Pick on Map" + manual area text field instead.

**Q: How do users find specific locations?**  
A: Users pan/zoom the map manually, then use "Pick on Map" to tap the exact location. The map shows existing spots and uses familiar Leaflet controls.

**Q: What if a user doesn't know the exact coordinates?**  
A: They use "Pick on Map" to visually select the location on the map, then type the area/address in the manual text field (e.g., "Near City Hall"). Admin sees this during review.

**Q: Can we add address search back later?**  
A: Yes! Consider free alternatives like Nominatim (OpenStreetMap) or offline geocoding if budget allows paid APIs later.

**Q: Does this affect existing spots?**  
A: No, existing spots are unchanged. This only affects new user submissions.

**Q: Can admins still use Google Places API?**  
A: Yes! Admin import scripts still use Google Places for bulk operations. Only user-facing flow was changed.

---

**Implementation Date:** June 8, 2026  
**Status:** ✅ Complete and cost-free
