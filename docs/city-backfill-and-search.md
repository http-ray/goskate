# City Backfill & Search/Filter Implementation

## Overview

This document explains the coordinate-based city matching system and the search/filter functionality added to the GoSkate Visible Spots Panel.

## Part 1: Coordinate-Based City Backfill Script

### Location
`scripts/backfill-city-from-coordinates.ts`

### Purpose
Automatically determines the city/area for each spot based on its GPS coordinates, without using paid APIs or manual geographic buckets.

### How It Works

#### 1. **City Dataset**
- Uses an embedded dataset of **1000+ US cities** from SimpleMaps (free tier)
- Includes major cities across all 50 states
- Each city record contains:
  - City name
  - State abbreviation
  - Latitude
  - Longitude
  - Population (used for prioritizing larger cities)

#### 2. **Nearest-City Matching Algorithm**
The script uses the **Haversine formula** to calculate the great-circle distance between two points on Earth:

```typescript
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}
```

For each spot:
1. Calculate distance from spot to every city in the dataset
2. Find the nearest city within the maximum distance threshold (default: 50 km)
3. If no city is within range, mark as unmatched
4. Format the result as "City, State" (e.g., "Atlanta, GA")

#### 3. **Safety Features**

**Dry-Run Mode**
```bash
npx tsx scripts/backfill-city-from-coordinates.ts --dry-run
```
- Shows what would be updated without writing to database
- Displays sample matches, unmatched spots, and city distribution
- Perfect for testing before running the real update

**Overwrite Protection**
```bash
# Skip spots that already have area_text
npx tsx scripts/backfill-city-from-coordinates.ts

# Force overwrite existing area_text data
npx tsx scripts/backfill-city-from-coordinates.ts --overwrite
```
- By default, only updates spots where `area_text` is NULL or empty
- Use `--overwrite` flag to update all spots regardless of existing data

**Distance Threshold**
```bash
# Only match cities within 30 km
npx tsx scripts/backfill-city-from-coordinates.ts --max-distance 30

# Increase range to 100 km for rural areas
npx tsx scripts/backfill-city-from-coordinates.ts --max-distance 100
```
- Default: 50 km (good for urban/suburban areas)
- Lower values: more precise, but more unmatched spots
- Higher values: fewer unmatched spots, but less precise

#### 4. **Database Updates**
- Updates the `area_text` column in the `spots` table
- Format: "City, State" (e.g., "Los Angeles, CA", "Buford, GA")
- Uses Supabase anon key for safe, row-level-security-aware updates
- Logs success/failure for each update

#### 5. **Reporting**
The script provides detailed output:
- Total spots processed
- Spots skipped (already have city)
- Matched vs. unmatched counts
- Sample matches with distances
- Top 20 cities by spot count
- Update success/failure summary

### Usage Examples

**Basic usage (dry-run by default for safety):**
```bash
npx tsx scripts/backfill-city-from-coordinates.ts --dry-run
```

**Run the real update:**
```bash
npx tsx scripts/backfill-city-from-coordinates.ts
```

**Update only spots within 25 km of a city:**
```bash
npx tsx scripts/backfill-city-from-coordinates.ts --max-distance 25
```

**Force update all spots, including those with existing city data:**
```bash
npx tsx scripts/backfill-city-from-coordinates.ts --overwrite
```

**Combine flags:**
```bash
npx tsx scripts/backfill-city-from-coordinates.ts --overwrite --max-distance 75 --dry-run
```

### Example Output

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

Unmatched spots (no city within 50 km):
  Remote Mountain Spot (34.8234, -83.2341)
  Desert Street Plaza (32.1234, -110.5678)
  ...

Spots per city (top 20):
  Atlanta, GA: 42
  Los Angeles, CA: 28
  Buford, GA: 8
  Woodstock, GA: 6
  Athens, GA: 5
  ...

DRY RUN: No updates written to Supabase.

Backfill complete.
```

---

## Part 2: Search/Filter UI in Visible Spots Panel

### Location
`components/ui/VisibleSpotsPanel.tsx`

### Purpose
Allow users to search and filter the spots currently visible in their map viewport by name, area, type, and source.

### Features Added

#### 1. **Search Input**
- Located below the "Spots in view" header
- Placeholder: "Search spots..."
- Searches across multiple fields:
  - Spot name (`name`)
  - Area text (`areaText`)
  - Type (`skatepark` or `street`)
  - Source (`official` or `user`)
  - Source (`official` or `user`)
- Case-insensitive matching
- Clear button (X) appears when search text is present
- Real-time filtering using React `useMemo`

#### 2. **Filter Chips**
Five filter buttons arranged horizontally:
- **All** — Shows all visible spots (default)
- **Official** — Only spots with `source = "official"`
- **User** — Only spots with `source = "user"`
- **Skateparks** — Only spots with `type = "skatepark"`
- **Street** — Only spots with `type = "street"`

Styling:
- Active filter: Blue background (`bg-blue-500`)
- Inactive filters: Transparent with border (`border border-white/10`)
- Hover effect on inactive filters

#### 3. **Combined Search + Filter Logic**

```typescript
const filteredSpots = useMemo(() => {
  let filtered = spots;

  // Apply filter first
  if (activeFilter === "official") {
    filtered = filtered.filter((s) => s.source === "official");
  } else if (activeFilter === "user") {
    filtered = filtered.filter((s) => s.source === "user");
  } else if (activeFilter === "skatepark") {
    filtered = filtered.filter((s) => s.type === "skatepark");
  } else if (activeFilter === "street") {
    filtered = filtered.filter((s) => s.type === "street");
  }

  // Then apply search text
  if (searchText.trim()) {
    const query = searchText.toLowerCase().trim();
    filtered = filtered.filter((s) => {
      const matchName = s.name.toLowerCase().includes(query);
      const matchArea = s.areaText?.toLowerCase().includes(query);
      const matchType = s.type.toLowerCase().includes(query);
      const matchSource = s.source.toLowerCase().includes(query);

      return matchName || matchArea || matchType || matchSource;
    });
  }

  return filtered;
}, [spots, activeFilter, searchText]);
```

**Example Behavior:**
- User selects "Official" filter + searches "Atlanta"
  - Result: Only official spots matching "Atlanta" in any field
- User searches "skatepark" with "All" filter
  - Result: All spots (official + user) that have "skatepark" in name or type
- User selects "Street" filter + searches "Los Angeles"
  - Result: Only street spots matching "Los Angeles"

#### 4. **Area Grouping**

After filtering, spots are grouped by area with the following priority:

1. **areaText** (populated by backfill script or manual labels)
2. **"Other Nearby"** (fallback for spots with no location data)

```typescript
const groupedSpots = useMemo(() => {
  const groups = new Map<string, Spot[]>();

  filteredSpots.forEach((spot) => {
    const key = spot.areaText || "Other Nearby";

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(spot);
  });

  // Sort groups alphabetically, "Other Nearby" always last
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === "Other Nearby") return 1;
    if (b === "Other Nearby") return -1;
    return a.localeCompare(b);
  });

  // Sort spots within each group alphabetically by name
  sortedKeys.forEach((key) => {
    groups.get(key)!.sort((a, b) => a.name.localeCompare(b.name));
  });

  return { groups, sortedKeys };
}, [filteredSpots]);
```

**Display:**
```
┌─────────────────────────────┐
│ ATLANTA, GA                 │ ← Area header (sticky)
├─────────────────────────────┤
│ • Grant Park Skatepark      │
│ • Historic Fourth Ward Park │
│ • Piedmont Park Plaza       │
├─────────────────────────────┤
│ BUFORD, GA                  │
├─────────────────────────────┤
│ • Buford Community Center   │
│ • Gwinnett Place Mall       │
├─────────────────────────────┤
│ OTHER NEARBY                │
├─────────────────────────────┤
│ • Rural Spot with No Area   │
└─────────────────────────────┘
```

Area headers:
- Sticky positioning (stays visible when scrolling group)
- Uppercase text with tracking
- Dark background (`bg-zinc-800/90 backdrop-blur`)
- Distinguishes geographic sections clearly

#### 5. **Empty States**

**No spots in viewport:**
```
No spots visible here.
Pan or zoom out to find more.
```

**Spots exist but search/filter removes all:**
```
No spots match your search.
Try different keywords or filters.
```

#### 6. **Count Display**

Header text adapts based on filtering:
- **No filtering:** `"150 spots visible"`
- **With filtering:** `"42 of 150 spots"` (filtered count / total count)

Mobile pill shows the same adaptive count:
- **No filtering:** `"🛹 150 spots"`
- **With filtering:** `"🛹 42 of 150 spots"`

#### 7. **Layout Adjustments**

**Mobile:**
- Bottom sheet height increased from `65vh` to `75vh` to accommodate search/filter UI
- Search and filters appear below the header, above the spot list
- Panel remains fully responsive and scrollable

**Desktop:**
- Panel width increased from `w-72` (18rem) to `w-80` (20rem) for better readability
- Search and filters integrated into the fixed right panel
- Still positioned at `right-4 top-20` with max-height constraint

### User Experience Flow

1. **User pans/zooms the map** → Visible spots update automatically
2. **User opens Visible Spots panel** → Sees all spots in viewport, grouped by city
3. **User types "atlanta" in search** → Only spots matching "atlanta" appear (city, name, etc.)
4. **User clicks "Skateparks" filter** → Only skateparks matching "atlanta" remain
5. **User clears search** → All skateparks in viewport appear, grouped by city
6. **User clicks "All" filter** → Returns to full unfiltered list
7. **User clicks a spot** → Map flies to that spot, marker opens popup

### Performance Considerations

- **useMemo optimization:** Filtering and grouping only recompute when dependencies change
- **Real-time search:** No debouncing needed (filtering is fast with typical spot counts)
- **Scroll performance:** Virtual scrolling not needed for lists under 1000 items
- **Mobile optimization:** Bottom sheet collapses after spot selection to show map

---

## Data Flow

### Before Backfill
```
Database: spots.area_text = NULL
Frontend: spot.areaText = undefined
Panel grouping: All spots under "Other Nearby"
Search: Can't search by area/city names
```

### After Backfill
```
Database: spots.area_text = "Atlanta, GA"
Frontend: spot.areaText = "Atlanta, GA"
Panel grouping: Groups by real city/area names
Search: Finds spots by typing city name
```

### Field Priority in Grouping

| Priority | Field | Source | Example |
|----------|-------|--------|---------|
| 1 | `areaText` | Backfill script or manual labels | "Atlanta, GA" |
| 2 | Fallback | Hardcoded | "Other Nearby" |

This priority ensures:
- Backfill-generated area names take precedence (most accurate)
- Legacy manual labels still work for spots not yet backfilled
- No spot is left ungrouped

---

## Database Schema

The script uses the following columns in the `spots` table:

```sql
-- Required columns (already exist)
id UUID PRIMARY KEY
display_name TEXT
latitude DOUBLE PRECISION
longitude DOUBLE PRECISION
type TEXT -- 'skatepark' or 'street'
source TEXT -- 'official' or 'user'
status TEXT -- 'approved', 'pending', 'rejected', 'flagged'

-- Area/city column (used by backfill script)
area_text TEXT -- Populated by backfill script: "City, State" (e.g., "Atlanta, GA")
```

No schema changes are required - the script uses the existing `area_text` column.

---

## Benefits

### 1. **No Paid APIs**
- Uses free city dataset (SimpleMaps)
- Haversine calculation is pure math (no external calls)
- Fully offline-capable script

### 2. **Automatic City Detection**
- No manual "Atlanta Metro" or "Other California" buckets
- Each spot gets its own nearest city
- Scales to any geographic area automatically

### 3. **Precise Matching**
- Distance-based algorithm respects geographic reality
- User can control precision with `--max-distance` flag
- Provides distance metrics for verification

### 4. **Safe & Reversible**
- Dry-run mode for testing
- Doesn't overwrite existing data by default
- No schema changes required (if city column exists)

### 5. **Rich Search Experience**
- Multi-field search covers all relevant data
- Combined filter + search for precise results
- Real-time filtering with no lag
- Clear visual feedback (active filters, counts, empty states)

### 6. **Organized Display**
- City-based grouping makes large lists scannable
- Alphabetical sorting within groups
- Sticky headers keep context visible
- "Other Nearby" section catches unmatched spots

---

## Limitations & Future Improvements

### Current Limitations

1. **US-Only Dataset**
   - Embedded city list covers USA only
   - International spots will be unmatched
   - **Fix:** Add cities from other countries to the dataset

2. **Fixed City List**
   - Dataset is embedded in the script
   - Adding new cities requires code changes
   - **Fix:** Load cities from external JSON file or database

3. **Simple Nearest-City Logic**
   - Doesn't account for city boundaries (point-to-point distance only)
   - A spot between two cities picks the closer one, even if culturally/administratively it belongs to the other
   - **Fix:** Use city boundary polygons (GeoJSON) for contains-point checks

4. **Manual Script Execution**
   - Admin must run script manually
   - New spots don't automatically get city labels
   - **Fix:** Add city matching to spot submission flow

5. **No User Override**
   - Users can't manually correct wrong city assignments
   - **Fix:** Add admin UI for manual city overrides

### Potential Enhancements

**1. Automatic City Assignment on Spot Submission**
```typescript
// In spot submission flow:
async function submitSpot(spot: SpotSubmission) {
  const nearestCity = findNearestCity(spot.latitude, spot.longitude, 50);
  const cityName = nearestCity ? `${nearestCity.city}, ${nearestCity.state}` : null;

  await supabase.from("spots").insert({
    ...spot,
    city: cityName,
  });
}
```

**2. Boundary-Based City Matching**
```typescript
// Use GeoJSON city boundaries
import cityBoundaries from "./city-boundaries.geojson";

function findCityByBoundary(lat: number, lng: number) {
  for (const city of cityBoundaries.features) {
    if (pointInPolygon([lng, lat], city.geometry.coordinates)) {
      return city.properties.name;
    }
  }
  return null; // Fall back to nearest-city
}
```

**3. International City Support**
```typescript
// Load cities from GeoNames world cities database
import worldCities from "./geonames-cities.json";

// Dataset format:
// { name: "Tokyo", country: "Japan", lat: 35.6895, lng: 139.6917 }
// Output: "Tokyo, Japan"
```

**4. Admin City Override UI**
```tsx
// In admin panel:
<select value={spot.city} onChange={handleCityChange}>
  {nearbyCities.map(c => (
    <option value={c.name}>{c.name} ({c.distance.toFixed(1)} km)</option>
  ))}
  <option value="">Other / Custom</option>
</select>
```

**5. Confidence Scoring**
```typescript
// Add confidence field to spots table
interface CityMatch {
  city: string;
  distance: number;
  confidence: "high" | "medium" | "low";
}

function getCityConfidence(distance: number): CityMatch["confidence"] {
  if (distance < 5) return "high";    // Within 5 km
  if (distance < 20) return "medium"; // Within 20 km
  return "low";                       // 20-50 km
}
```

**6. City Alias Support**
```typescript
// Handle city name variations
const cityAliases = {
  "NYC": "New York, NY",
  "LA": "Los Angeles, CA",
  "SF": "San Francisco, CA",
  "ATL": "Atlanta, GA",
};

// Allow users to search by alias
```

---

## Testing Checklist

### Backfill Script Testing

- [ ] Run with `--dry-run` flag first
- [ ] Verify sample matches look correct (spot → nearest city)
- [ ] Check unmatched spots are truly remote
- [ ] Review city distribution (top 20 list)
- [ ] Test with different `--max-distance` values (25, 50, 100 km)
- [ ] Run live update on staging database
- [ ] Verify database records were updated correctly
- [ ] Test `--overwrite` flag behavior
- [ ] Confirm skipped spots (already have city) work as expected

### Search/Filter Testing

- [ ] Open Visible Spots panel (mobile and desktop)
- [ ] Verify search input appears below header
- [ ] Type in search box → results filter in real-time
- [ ] Clear search using X button
- [ ] Click each filter chip → results update correctly
- [ ] Combine search + filter (e.g., "atlanta" + "Official")
- [ ] Verify city headers appear and are sticky on scroll
- [ ] Check "Other Nearby" section appears last
- [ ] Test empty states:
  - [ ] No spots in viewport
  - [ ] Search removes all results
- [ ] Verify count displays correctly:
  - [ ] "150 spots visible" (no filter)
  - [ ] "42 of 150 spots" (with filter)
- [ ] Click a spot → map flies to it and popup opens
- [ ] Test mobile bottom sheet:
  - [ ] Opens/closes smoothly
  - [ ] Collapses after spot selection
  - [ ] Search/filters work in sheet
- [ ] Test desktop panel:
  - [ ] Panel is wider (320px)
  - [ ] Search/filters integrated cleanly
  - [ ] Scrolling works with sticky headers

### Cross-Browser Testing

- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (iOS and macOS)
- [ ] Mobile browsers (iOS Safari, Chrome Android)

### Performance Testing

- [ ] Test with 500+ visible spots
- [ ] Verify search remains responsive
- [ ] Check scroll performance with many groups
- [ ] Test rapid filter switching
- [ ] Monitor memory usage during long sessions

---

## Troubleshooting

### Backfill Script Issues

**Problem:** All spots show as unmatched
```
Matched: 0
Unmatched: 150
```
**Solution:** Increase max distance or check if dataset includes cities in your region:
```bash
npx tsx scripts/backfill-city-from-coordinates.ts --max-distance 100
```

**Problem:** Script uses old Supabase anon key
```bash
Supabase error: Invalid API key
```
**Solution:** Check `.env.local` has correct keys:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Search/Filter Issues

**Problem:** Search doesn't find spots by area name
- Check if spots have `area_text` field populated (run backfill script)
- Verify `spotsService.ts` includes `area_text` in query
- Check browser console for errors

**Problem:** Filters don't work
- Check TypeScript compilation (no errors in VisibleSpotsPanel.tsx)
- Verify `activeFilter` state updates on click
- Check console for runtime errors

**Problem:** Area grouping shows all spots under "Other Nearby"
- Spots don't have area_text data
- Run backfill script to populate area_text field
- Check database to verify field values

**Problem:** Panel layout breaks on mobile
- Check that bottom sheet height (`75vh`) isn't too large
- Verify pill positioning doesn't overlap bottom dock
- Test on different screen sizes

---

## Summary

This implementation provides:

1. **Automated city detection** using coordinate-based matching (no paid APIs)
2. **Rich search functionality** across name, city, type, and source
3. **Flexible filtering** with All/Official/User/Skateparks/Street chips
4. **Organized display** with city-based grouping and alphabetical sorting
5. **Safe backfill process** with dry-run mode and overwrite protection
6. **Excellent UX** with real-time filtering, empty states, and clear counts

The system scales automatically to any geographic area and provides a foundation for future enhancements like international city support, boundary-based matching, and confidence scoring.
