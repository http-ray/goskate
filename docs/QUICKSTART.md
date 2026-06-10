# GoSkate City Backfill & Search - Quick Start Guide

## What Was Built

### Part 1: Coordinate-Based City Backfill Script ✅
**Location:** `scripts/backfill-city-from-coordinates.ts`

A script that automatically determines each spot's city using GPS coordinates and a free US cities database (no paid APIs).

### Part 2: Search/Filter UI ✅
**Location:** `components/ui/VisibleSpotsPanel.tsx`

Enhanced the Visible Spots panel with search input, filter chips, and city-based grouping.

---

## Quick Start

### Step 1: Run the Backfill Script (Dry-Run First)

```bash
# See what would be updated (safe - no database changes)
npx tsx scripts/backfill-city-from-coordinates.ts --dry-run
```

**Example output:**
```
GoSkate — Coordinate-based City Backfill
==================================================
Mode: DRY RUN
Overwrite existing: NO
Max distance: 50 km
City dataset: 200 US cities

Fetching spots from Supabase...
Loaded 150 spots

Spots to process: 120
Skipped (already have city): 30

Matching spots to nearest cities...
Matched: 112
Unmatched: 8

Sample matches (first 10):
  Piedmont Park Skate Plaza → Atlanta, GA (2.3 km)
  Grant Park Skatepark → Atlanta, GA (3.8 km)
  Woodstock Skate Park → Woodstock, GA (1.2 km)
  Buford Community Center → Buford, GA (0.5 km)
  Athens Skatepark → Athens, GA (1.9 km)
  ...

Spots per city (top 20):
  Atlanta, GA: 42
  Los Angeles, CA: 28
  Buford, GA: 8
  ...

DRY RUN: No updates written to Supabase.
```

### Step 2: Run the Real Update

If the dry-run looks good:

```bash
# Update the database
npx tsx scripts/backfill-city-from-coordinates.ts
```

This will:
- Match each spot to its nearest city
- Save "City, State" to the `city` column
- Skip spots that already have a city (unless you use `--overwrite`)

### Step 3: Test the Search/Filter UI

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Open the app** and navigate to the map view

3. **Open the Visible Spots panel:**
   - **Mobile:** Tap the pill at the bottom
   - **Desktop:** Panel is always visible on the right

4. **Try searching:**
   - Type "atlanta" → See only Atlanta spots
   - Type "skatepark" → See only skateparks
   - Clear search → See all spots again

5. **Try filtering:**
   - Click "Official" → See only official spots
   - Click "Skateparks" → See only skateparks
   - Click "All" → Reset filter

6. **Try combining:**
   - Click "Official" + search "atlanta" → Official Atlanta spots only

---

## Common Commands

### Backfill Script

```bash
# Dry-run (recommended first)
npx tsx scripts/backfill-city-from-coordinates.ts --dry-run

# Live update
npx tsx scripts/backfill-city-from-coordinates.ts

# Use different max distance (default: 50 km)
npx tsx scripts/backfill-city-from-coordinates.ts --max-distance 30

# Overwrite existing city data
npx tsx scripts/backfill-city-from-coordinates.ts --overwrite

# Combine flags
npx tsx scripts/backfill-city-from-coordinates.ts --max-distance 75 --overwrite --dry-run
```

### Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Check TypeScript errors
npx tsc --noEmit
```

---

## What Changed

### New Files
- ✅ `scripts/backfill-city-from-coordinates.ts` - City matching script
- ✅ `docs/city-backfill-and-search.md` - Full documentation
- ✅ `docs/QUICKSTART.md` - This file

### Modified Files
- ✅ `components/ui/VisibleSpotsPanel.tsx` - Added search/filter UI
- ✅ `types/spot.ts` - Added `city` field to Spot type
- ✅ `lib/spotsService.ts` - Fetch `city` from database

### Database Changes
No schema changes required. The script uses the existing `area_text` column.

---

## Features Overview

### Backfill Script Features
✅ Uses free US cities dataset (SimpleMaps)  
✅ Haversine distance calculation (no external APIs)  
✅ Nearest-city matching algorithm  
✅ Dry-run mode for safety  
✅ Overwrite protection  
✅ Configurable distance threshold  
✅ Detailed logging and reporting  

### Search/Filter Features
✅ Real-time search across name, city, area, type, source  
✅ Filter chips: All, Official, User, Skateparks, Street  
✅ Combined search + filter logic  
✅ City-based grouping (priority: city → areaText → regionLabel → Other Nearby)  
✅ Alphabetical sorting within groups  
✅ Sticky city headers on scroll  
✅ Empty state messages  
✅ Adaptive count display ("42 of 150 spots")  
✅ Mobile and desktop layouts  
✅ Clear button for search  

---

## Testing Checklist

### Backfill Script
- [ ] Run dry-run first
- [ ] Verify sample matches look correct
- [ ] Check city distribution makes sense
- [ ] Run live update
- [ ] Verify database was updated

### Search/Filter UI
- [ ] Open panel on mobile and desktop
- [ ] Type in search → results filter instantly
- [ ] Click filter chips → results update
- [ ] Combine search + filter
- [ ] Verify city headers appear
- [ ] Check empty states work
- [ ] Click spot → map flies to it

---

## Troubleshooting

### "city column does not exist"
```sql
ALTER TABLE spots ADD COLUMN city TEXT;
```

### All spots show as "Unmatched"
Increase max distance or check if dataset covers your region:
```bash
npx tsx scripts/backfill-city-from-coordinates.ts --max-distance 100 --dry-run
```

### Search doesn't find spots by city
Run the backfill script first to populate city data.

### TypeScript errors
```bash
npx tsc --noEmit
```

---

## Next Steps

1. **Run the backfill script** to populate city data
2. **Test the search/filter UI** in the browser
3. **Adjust max-distance** if needed for your area
4. **Monitor** unmatched spots and consider adding missing cities to the dataset

---

## Full Documentation

For detailed explanations, see:
- **Full docs:** `docs/city-backfill-and-search.md`
- **Implementation details:** Comments in modified files
- **Original request:** See conversation history

---

## Support

If you encounter issues:
1. Check the full documentation in `docs/city-backfill-and-search.md`
2. Review TypeScript errors: `npx tsc --noEmit`
3. Check browser console for runtime errors
4. Verify Supabase credentials in `.env.local`

---

**Built with:**
- React + Next.js
- TypeScript
- Supabase
- Haversine distance algorithm
- SimpleMaps free city dataset

**No paid APIs required. Fully offline-capable.**
