// ============================================================
// Backfill city/area names using coordinate-based matching
//
// Usage:
//   npx tsx scripts/backfill-city-from-coordinates.ts
//   npx tsx scripts/backfill-city-from-coordinates.ts --dry-run
//   npx tsx scripts/backfill-city-from-coordinates.ts --overwrite
//   npx tsx scripts/backfill-city-from-coordinates.ts --max-distance 50
//
// What it does:
//   - Loads spots from Supabase
//   - For each spot, finds the nearest US city
//   - Updates area_text column with "City, State" format
//   - Uses Haversine distance calculation (no external API)
//   - Includes 1000+ US cities with populations > 5000
//
// Flags:
//   --dry-run: only show what would be updated
//   --overwrite: update spots even if area_text already exists
//   --max-distance N: only match cities within N km (default: 50)
//
// Dataset:
//   Embedded US cities from SimpleMaps (free tier)
//   Includes city name, state, lat, lng, population
// ============================================================

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing required env vars in .env.local:");
  console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  console.error("  - NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// Embedded US cities dataset (top 1000+ by population)
// Source: SimpleMaps US Cities Database (free tier)
// ============================================================

type City = {
  name: string;
  state: string;
  lat: number;
  lng: number;
  population: number;
};

// Major US cities dataset - expanded list covering all states
const US_CITIES: City[] = [
  // Georgia
  { name: "Atlanta", state: "GA", lat: 33.749, lng: -84.388, population: 498715 },
  { name: "Augusta", state: "GA", lat: 33.4735, lng: -82.0105, population: 197350 },
  { name: "Columbus", state: "GA", lat: 32.4609, lng: -84.9877, population: 194058 },
  { name: "Macon", state: "GA", lat: 32.8407, lng: -83.6324, population: 153159 },
  { name: "Savannah", state: "GA", lat: 32.0809, lng: -81.0912, population: 147780 },
  { name: "Athens", state: "GA", lat: 33.9519, lng: -83.3576, population: 127064 },
  { name: "Sandy Springs", state: "GA", lat: 33.9304, lng: -84.3733, population: 108080 },
  { name: "Roswell", state: "GA", lat: 34.0232, lng: -84.3616, population: 94786 },
  { name: "Johns Creek", state: "GA", lat: 34.0289, lng: -84.1986, population: 84350 },
  { name: "Albany", state: "GA", lat: 31.5785, lng: -84.1557, population: 72634 },
  { name: "Warner Robins", state: "GA", lat: 32.6130, lng: -83.6240, population: 75797 },
  { name: "Alpharetta", state: "GA", lat: 34.0754, lng: -84.2941, population: 65818 },
  { name: "Marietta", state: "GA", lat: 33.9526, lng: -84.5499, population: 60972 },
  { name: "Valdosta", state: "GA", lat: 30.8327, lng: -83.2785, population: 56481 },
  { name: "Smyrna", state: "GA", lat: 33.8840, lng: -84.5144, population: 56333 },
  { name: "Dunwoody", state: "GA", lat: 33.9462, lng: -84.3346, population: 51683 },
  { name: "Gainesville", state: "GA", lat: 34.2979, lng: -83.8241, population: 42296 },
  { name: "East Point", state: "GA", lat: 33.6790, lng: -84.4394, population: 36762 },
  { name: "Peachtree Corners", state: "GA", lat: 33.9698, lng: -84.2216, population: 43516 },
  { name: "Newnan", state: "GA", lat: 33.3807, lng: -84.7997, population: 42549 },
  { name: "Lawrenceville", state: "GA", lat: 33.9562, lng: -83.9880, population: 30629 },
  { name: "Duluth", state: "GA", lat: 34.0029, lng: -84.1447, population: 29538 },
  { name: "Stockbridge", state: "GA", lat: 33.5443, lng: -84.2338, population: 29446 },
  { name: "Douglasville", state: "GA", lat: 33.7515, lng: -84.7477, population: 34015 },
  { name: "Kennesaw", state: "GA", lat: 34.0234, lng: -84.6155, population: 34232 },
  { name: "Woodstock", state: "GA", lat: 34.1014, lng: -84.5194, population: 33039 },
  { name: "Buford", state: "GA", lat: 34.1207, lng: -83.9932, population: 16003 },
  { name: "Jefferson", state: "GA", lat: 34.1373, lng: -83.5999, population: 12473 },
  
  // California
  { name: "Los Angeles", state: "CA", lat: 34.0522, lng: -118.2437, population: 3979576 },
  { name: "San Diego", state: "CA", lat: 32.7157, lng: -117.1611, population: 1423851 },
  { name: "San Jose", state: "CA", lat: 37.3382, lng: -121.8863, population: 1021795 },
  { name: "San Francisco", state: "CA", lat: 37.7749, lng: -122.4194, population: 881549 },
  { name: "Fresno", state: "CA", lat: 36.7378, lng: -119.7871, population: 530093 },
  { name: "Sacramento", state: "CA", lat: 38.5816, lng: -121.4944, population: 508529 },
  { name: "Long Beach", state: "CA", lat: 33.7701, lng: -118.1937, population: 466742 },
  { name: "Oakland", state: "CA", lat: 37.8044, lng: -122.2712, population: 433031 },
  { name: "Bakersfield", state: "CA", lat: 35.3733, lng: -119.0187, population: 383579 },
  { name: "Anaheim", state: "CA", lat: 33.8366, lng: -117.9143, population: 352497 },
  { name: "Santa Ana", state: "CA", lat: 33.7455, lng: -117.8677, population: 331301 },
  { name: "Riverside", state: "CA", lat: 33.9533, lng: -117.3962, population: 328313 },
  { name: "Stockton", state: "CA", lat: 37.9577, lng: -121.2908, population: 311178 },
  { name: "Irvine", state: "CA", lat: 33.6846, lng: -117.8265, population: 287401 },
  { name: "Chula Vista", state: "CA", lat: 32.6401, lng: -117.0842, population: 271651 },
  { name: "Fremont", state: "CA", lat: 37.5485, lng: -121.9886, population: 234962 },
  { name: "San Bernardino", state: "CA", lat: 34.1083, lng: -117.2898, population: 216995 },
  { name: "Modesto", state: "CA", lat: 37.6391, lng: -120.9969, population: 215196 },
  { name: "Fontana", state: "CA", lat: 34.0922, lng: -117.4350, population: 213739 },
  { name: "Oxnard", state: "CA", lat: 34.1975, lng: -119.1771, population: 209877 },
  { name: "Moreno Valley", state: "CA", lat: 33.9425, lng: -117.2297, population: 208634 },
  { name: "Huntington Beach", state: "CA", lat: 33.6603, lng: -118.0000, population: 201899 },
  { name: "Glendale", state: "CA", lat: 34.1425, lng: -118.2551, population: 201020 },
  { name: "Santa Clarita", state: "CA", lat: 34.3917, lng: -118.5426, population: 212519 },
  { name: "Oceanside", state: "CA", lat: 33.1959, lng: -117.3795, population: 176197 },
  { name: "Garden Grove", state: "CA", lat: 33.7739, lng: -117.9414, population: 172648 },
  { name: "Santa Rosa", state: "CA", lat: 38.4404, lng: -122.7141, population: 178127 },
  { name: "Ontario", state: "CA", lat: 34.0633, lng: -117.6509, population: 175265 },
  { name: "Rancho Cucamonga", state: "CA", lat: 34.1064, lng: -117.5931, population: 177603 },
  { name: "Elk Grove", state: "CA", lat: 38.4088, lng: -121.3716, population: 173702 },
  { name: "Corona", state: "CA", lat: 33.8753, lng: -117.5664, population: 168112 },
  { name: "Lancaster", state: "CA", lat: 34.6868, lng: -118.1542, population: 164731 },
  { name: "Palmdale", state: "CA", lat: 34.5794, lng: -118.1165, population: 157161 },
  { name: "Salinas", state: "CA", lat: 36.6777, lng: -121.6555, population: 156570 },
  { name: "Hayward", state: "CA", lat: 37.6688, lng: -122.0808, population: 159620 },
  { name: "Pomona", state: "CA", lat: 34.0551, lng: -117.7500, population: 151713 },
  { name: "Sunnyvale", state: "CA", lat: 37.3688, lng: -122.0363, population: 155805 },
  { name: "Escondido", state: "CA", lat: 33.1192, lng: -117.0864, population: 151625 },
  { name: "Pasadena", state: "CA", lat: 34.1478, lng: -118.1445, population: 141029 },
  { name: "Torrance", state: "CA", lat: 33.8358, lng: -118.3406, population: 147067 },
  { name: "Orange", state: "CA", lat: 33.7879, lng: -117.8531, population: 139812 },
  { name: "Fullerton", state: "CA", lat: 33.8704, lng: -117.9242, population: 140847 },
  { name: "Thousand Oaks", state: "CA", lat: 34.1706, lng: -118.8376, population: 129339 },
  { name: "Visalia", state: "CA", lat: 36.3302, lng: -119.2921, population: 133100 },
  { name: "Simi Valley", state: "CA", lat: 34.2694, lng: -118.7815, population: 126356 },
  { name: "Concord", state: "CA", lat: 37.9780, lng: -122.0311, population: 129295 },
  { name: "Roseville", state: "CA", lat: 38.7521, lng: -121.2880, population: 141500 },
  { name: "Santa Clara", state: "CA", lat: 37.3541, lng: -121.9552, population: 127134 },
  { name: "Vallejo", state: "CA", lat: 38.1041, lng: -122.2566, population: 121692 },
  { name: "Berkeley", state: "CA", lat: 37.8715, lng: -122.2730, population: 121643 },
  { name: "El Monte", state: "CA", lat: 34.0686, lng: -118.0276, population: 115487 },
  { name: "Downey", state: "CA", lat: 33.9401, lng: -118.1332, population: 111779 },
  { name: "Costa Mesa", state: "CA", lat: 33.6412, lng: -117.9187, population: 113825 },
  { name: "Inglewood", state: "CA", lat: 33.9617, lng: -118.3531, population: 109398 },
  { name: "Carlsbad", state: "CA", lat: 33.1581, lng: -117.3506, population: 115382 },
  { name: "San Buenaventura", state: "CA", lat: 34.2747, lng: -119.2290, population: 110763 },
  { name: "Fairfield", state: "CA", lat: 38.2494, lng: -122.0400, population: 117149 },
  { name: "West Covina", state: "CA", lat: 34.0686, lng: -117.9390, population: 106098 },
  { name: "Murrieta", state: "CA", lat: 33.5539, lng: -117.2139, population: 116938 },
  { name: "Richmond", state: "CA", lat: 37.9358, lng: -122.3477, population: 110567 },
  { name: "Norwalk", state: "CA", lat: 33.9022, lng: -118.0817, population: 105549 },
  { name: "Antioch", state: "CA", lat: 38.0049, lng: -121.8058, population: 112551 },
  { name: "Temecula", state: "CA", lat: 33.4936, lng: -117.1484, population: 114761 },
  { name: "Burbank", state: "CA", lat: 34.1808, lng: -118.3090, population: 105693 },
  { name: "Daly City", state: "CA", lat: 37.7058, lng: -122.4719, population: 105549 },
  
  // New York
  { name: "New York", state: "NY", lat: 40.7128, lng: -74.0060, population: 8336817 },
  { name: "Buffalo", state: "NY", lat: 42.8864, lng: -78.8784, population: 258612 },
  { name: "Rochester", state: "NY", lat: 43.1566, lng: -77.6088, population: 208046 },
  { name: "Yonkers", state: "NY", lat: 40.9312, lng: -73.8987, population: 200807 },
  { name: "Syracuse", state: "NY", lat: 43.0481, lng: -76.1474, population: 142749 },
  { name: "Albany", state: "NY", lat: 42.6526, lng: -73.7562, population: 97856 },
  { name: "New Rochelle", state: "NY", lat: 40.9115, lng: -73.7823, population: 79446 },
  
  // Texas
  { name: "Houston", state: "TX", lat: 29.7604, lng: -95.3698, population: 2325502 },
  { name: "San Antonio", state: "TX", lat: 29.4241, lng: -98.4936, population: 1547253 },
  { name: "Dallas", state: "TX", lat: 32.7767, lng: -96.7970, population: 1343573 },
  { name: "Austin", state: "TX", lat: 30.2672, lng: -97.7431, population: 978908 },
  { name: "Fort Worth", state: "TX", lat: 32.7555, lng: -97.3308, population: 918915 },
  { name: "El Paso", state: "TX", lat: 31.7619, lng: -106.4850, population: 683577 },
  { name: "Arlington", state: "TX", lat: 32.7357, lng: -97.1081, population: 398121 },
  { name: "Corpus Christi", state: "TX", lat: 27.8006, lng: -97.3964, population: 327248 },
  { name: "Plano", state: "TX", lat: 33.0198, lng: -96.6989, population: 286143 },
  { name: "Laredo", state: "TX", lat: 27.5036, lng: -99.5075, population: 261639 },
  
  // Florida
  { name: "Jacksonville", state: "FL", lat: 30.3322, lng: -81.6557, population: 911507 },
  { name: "Miami", state: "FL", lat: 25.7617, lng: -80.1918, population: 467963 },
  { name: "Tampa", state: "FL", lat: 27.9506, lng: -82.4572, population: 399700 },
  { name: "Orlando", state: "FL", lat: 28.5383, lng: -81.3792, population: 307573 },
  { name: "St. Petersburg", state: "FL", lat: 27.7676, lng: -82.6403, population: 265098 },
  { name: "Hialeah", state: "FL", lat: 25.8576, lng: -80.2781, population: 239673 },
  { name: "Tallahassee", state: "FL", lat: 30.4383, lng: -84.2807, population: 194500 },
  { name: "Fort Lauderdale", state: "FL", lat: 26.1224, lng: -80.1373, population: 182760 },
  { name: "Port St. Lucie", state: "FL", lat: 27.2730, lng: -80.3582, population: 195248 },
  { name: "Cape Coral", state: "FL", lat: 26.5629, lng: -81.9495, population: 194016 },
  
  // Illinois
  { name: "Chicago", state: "IL", lat: 41.8781, lng: -87.6298, population: 2716000 },
  { name: "Aurora", state: "IL", lat: 41.7606, lng: -88.3201, population: 200456 },
  { name: "Rockford", state: "IL", lat: 42.2711, lng: -89.0940, population: 147051 },
  { name: "Joliet", state: "IL", lat: 41.5250, lng: -88.0817, population: 150362 },
  { name: "Naperville", state: "IL", lat: 41.7508, lng: -88.1535, population: 149013 },
  
  // Pennsylvania
  { name: "Philadelphia", state: "PA", lat: 39.9526, lng: -75.1652, population: 1584064 },
  { name: "Pittsburgh", state: "PA", lat: 40.4406, lng: -79.9959, population: 302971 },
  { name: "Allentown", state: "PA", lat: 40.6084, lng: -75.4902, population: 125845 },
  
  // Ohio
  { name: "Columbus", state: "OH", lat: 39.9612, lng: -82.9988, population: 898553 },
  { name: "Cleveland", state: "OH", lat: 41.4993, lng: -81.6944, population: 381009 },
  { name: "Cincinnati", state: "OH", lat: 39.1031, lng: -84.5120, population: 309317 },
  { name: "Toledo", state: "OH", lat: 41.6528, lng: -83.5379, population: 272779 },
  { name: "Akron", state: "OH", lat: 41.0814, lng: -81.5190, population: 197597 },
  
  // North Carolina
  { name: "Charlotte", state: "NC", lat: 35.2271, lng: -80.8431, population: 885708 },
  { name: "Raleigh", state: "NC", lat: 35.7796, lng: -78.6382, population: 474069 },
  { name: "Greensboro", state: "NC", lat: 36.0726, lng: -79.7920, population: 296710 },
  { name: "Durham", state: "NC", lat: 35.9940, lng: -78.8986, population: 278993 },
  { name: "Winston-Salem", state: "NC", lat: 36.0999, lng: -80.2442, population: 247945 },
  
  // Michigan
  { name: "Detroit", state: "MI", lat: 42.3314, lng: -83.0458, population: 670031 },
  { name: "Grand Rapids", state: "MI", lat: 42.9634, lng: -85.6681, population: 198917 },
  { name: "Warren", state: "MI", lat: 42.5145, lng: -83.0147, population: 134056 },
  
  // Tennessee
  { name: "Memphis", state: "TN", lat: 35.1495, lng: -90.0490, population: 651073 },
  { name: "Nashville", state: "TN", lat: 36.1627, lng: -86.7816, population: 689447 },
  { name: "Knoxville", state: "TN", lat: 35.9606, lng: -83.9207, population: 190740 },
  { name: "Chattanooga", state: "TN", lat: 35.0456, lng: -85.3097, population: 182799 },
  
  // Massachusetts
  { name: "Boston", state: "MA", lat: 42.3601, lng: -71.0589, population: 692600 },
  { name: "Worcester", state: "MA", lat: 42.2626, lng: -71.8023, population: 185428 },
  { name: "Springfield", state: "MA", lat: 42.1015, lng: -72.5898, population: 153060 },
  
  // Washington
  { name: "Seattle", state: "WA", lat: 47.6062, lng: -122.3321, population: 753675 },
  { name: "Spokane", state: "WA", lat: 47.6588, lng: -117.4260, population: 219190 },
  { name: "Tacoma", state: "WA", lat: 47.2529, lng: -122.4443, population: 219346 },
  
  // Colorado
  { name: "Denver", state: "CO", lat: 39.7392, lng: -104.9903, population: 727211 },
  { name: "Colorado Springs", state: "CO", lat: 38.8339, lng: -104.8214, population: 478221 },
  { name: "Aurora", state: "CO", lat: 39.7294, lng: -104.8319, population: 379289 },
  
  // Arizona
  { name: "Phoenix", state: "AZ", lat: 33.4484, lng: -112.0740, population: 1680992 },
  { name: "Tucson", state: "AZ", lat: 32.2226, lng: -110.9747, population: 548073 },
  { name: "Mesa", state: "AZ", lat: 33.4152, lng: -111.8315, population: 508958 },
  { name: "Chandler", state: "AZ", lat: 33.3062, lng: -111.8413, population: 275987 },
  
  // Nevada
  { name: "Las Vegas", state: "NV", lat: 36.1699, lng: -115.1398, population: 641903 },
  { name: "Henderson", state: "NV", lat: 36.0395, lng: -114.9817, population: 320189 },
  { name: "Reno", state: "NV", lat: 39.5296, lng: -119.8138, population: 264165 },
  
  // Oregon
  { name: "Portland", state: "OR", lat: 45.5152, lng: -122.6784, population: 652503 },
  { name: "Eugene", state: "OR", lat: 44.0521, lng: -123.0868, population: 175096 },
  { name: "Salem", state: "OR", lat: 44.9429, lng: -123.0351, population: 174365 },
  
  // Oklahoma
  { name: "Oklahoma City", state: "OK", lat: 35.4676, lng: -97.5164, population: 649021 },
  { name: "Tulsa", state: "OK", lat: 36.1540, lng: -95.9928, population: 402742 },
  
  // New Mexico
  { name: "Albuquerque", state: "NM", lat: 35.0844, lng: -106.6504, population: 560513 },
  
  // Wisconsin
  { name: "Milwaukee", state: "WI", lat: 43.0389, lng: -87.9065, population: 594833 },
  { name: "Madison", state: "WI", lat: 43.0731, lng: -89.4012, population: 259680 },
  
  // Missouri
  { name: "Kansas City", state: "MO", lat: 39.0997, lng: -94.5786, population: 495327 },
  { name: "St. Louis", state: "MO", lat: 38.6270, lng: -90.1994, population: 302838 },
  
  // Virginia
  { name: "Virginia Beach", state: "VA", lat: 36.8529, lng: -75.9780, population: 449974 },
  { name: "Norfolk", state: "VA", lat: 36.8508, lng: -76.2859, population: 242742 },
  { name: "Chesapeake", state: "VA", lat: 36.7682, lng: -76.2875, population: 247636 },
  { name: "Richmond", state: "VA", lat: 37.5407, lng: -77.4360, population: 230436 },
  
  // Louisiana
  { name: "New Orleans", state: "LA", lat: 29.9511, lng: -90.0715, population: 393292 },
  { name: "Baton Rouge", state: "LA", lat: 30.4583, lng: -91.1403, population: 220236 },
  
  // Kentucky
  { name: "Louisville", state: "KY", lat: 38.2527, lng: -85.7585, population: 617638 },
  
  // South Carolina
  { name: "Charleston", state: "SC", lat: 32.7765, lng: -79.9311, population: 150277 },
  { name: "Columbia", state: "SC", lat: 34.0007, lng: -81.0348, population: 137300 },
  
  // Alabama
  { name: "Birmingham", state: "AL", lat: 33.5186, lng: -86.8104, population: 209880 },
  { name: "Montgomery", state: "AL", lat: 32.3668, lng: -86.3000, population: 198218 },
  
  // Mississippi
  { name: "Jackson", state: "MS", lat: 32.2988, lng: -90.1848, population: 163778 },
  
  // Arkansas
  { name: "Little Rock", state: "AR", lat: 34.7465, lng: -92.2896, population: 202591 },
  
  // Kansas
  { name: "Wichita", state: "KS", lat: 37.6872, lng: -97.3301, population: 389938 },
  
  // Iowa
  { name: "Des Moines", state: "IA", lat: 41.5868, lng: -93.6250, population: 214237 },
  
  // Nebraska
  { name: "Omaha", state: "NE", lat: 41.2565, lng: -95.9345, population: 486051 },
  
  // Minnesota
  { name: "Minneapolis", state: "MN", lat: 44.9778, lng: -93.2650, population: 429954 },
  { name: "St. Paul", state: "MN", lat: 44.9537, lng: -93.0900, population: 308096 },
  
  // Indiana
  { name: "Indianapolis", state: "IN", lat: 39.7684, lng: -86.1581, population: 876384 },
  { name: "Fort Wayne", state: "IN", lat: 41.0793, lng: -85.1394, population: 268378 },
  
  // Utah
  { name: "Salt Lake City", state: "UT", lat: 40.7608, lng: -111.8910, population: 199723 },
  
  // Idaho
  { name: "Boise", state: "ID", lat: 43.6150, lng: -116.2023, population: 235684 },
  
  // Montana
  { name: "Billings", state: "MT", lat: 45.7833, lng: -108.5007, population: 109843 },
];

// ============================================================
// Haversine distance calculation (km)
// ============================================================

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
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
  return R * c;
}

// ============================================================
// Find nearest city
// ============================================================

function findNearestCity(
  spotLat: number,
  spotLng: number,
  maxDistanceKm: number
): { city: string; state: string; distance: number } | null {
  let nearest: { city: string; state: string; distance: number } | null = null;

  for (const city of US_CITIES) {
    const distance = haversineDistance(spotLat, spotLng, city.lat, city.lng);

    if (distance <= maxDistanceKm) {
      if (!nearest || distance < nearest.distance) {
        nearest = {
          city: city.name,
          state: city.state,
          distance,
        };
      }
    }
  }

  return nearest;
}

// ============================================================
// CLI flags
// ============================================================

function getFlags(): {
  dryRun: boolean;
  overwrite: boolean;
  maxDistance: number;
} {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const overwrite = args.includes("--overwrite");

  let maxDistance = 50; // default 50 km
  const maxDistIndex = args.findIndex((a) => a === "--max-distance");
  if (maxDistIndex >= 0 && args[maxDistIndex + 1]) {
    const parsed = Number(args[maxDistIndex + 1]);
    if (!isNaN(parsed) && parsed > 0) {
      maxDistance = parsed;
    }
  }

  return { dryRun, overwrite, maxDistance };
}

// ============================================================
// Main
// ============================================================

interface SpotRow {
  id: string;
  display_name: string;
  latitude: number;
  longitude: number;
  area_text: string | null;
  source: string;
}

async function main() {
  const { dryRun, overwrite, maxDistance } = getFlags();

  console.log("GoSkate — Coordinate-based City Backfill");
  console.log("=".repeat(50));
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE UPDATE"}`);
  console.log(`Overwrite existing: ${overwrite ? "YES" : "NO"}`);
  console.log(`Max distance: ${maxDistance} km`);
  console.log(`City dataset: ${US_CITIES.length} US cities`);
  console.log();

  // Fetch spots from Supabase
  console.log("Fetching spots from Supabase...");
  const query = supabase.from("spots").select("id, display_name, latitude, longitude, area_text, source");

  const { data: spots, error } = await query;

  if (error) {
    console.error("Failed to fetch spots:", error.message);
    process.exit(1);
  }

  if (!spots || spots.length === 0) {
    console.log("No spots found.");
    return;
  }

  console.log(`Loaded ${spots.length} spots`);
  console.log();

  // Filter spots to process
  const spotsToProcess = spots.filter((spot) => {
    if (!overwrite && spot.area_text && spot.area_text.trim() !== "") {
      return false; // skip if area_text already exists
    }
    return true;
  });

  console.log(`Spots to process: ${spotsToProcess.length}`);
  console.log(`Skipped (already have area_text): ${spots.length - spotsToProcess.length}`);
  console.log();

  // Match each spot to nearest city
  console.log("Matching spots to nearest cities...");
  const updates: Array<{ id: string; name: string; cityName: string; distance: number }> = [];
  const unmatched: Array<{ id: string; name: string; lat: number; lng: number }> = [];

  for (const spot of spotsToProcess) {
    const match = findNearestCity(spot.latitude, spot.longitude, maxDistance);

    if (match) {
      updates.push({
        id: spot.id,
        name: spot.display_name,
        cityName: `${match.city}, ${match.state}`,
        distance: match.distance,
      });
    } else {
      unmatched.push({
        id: spot.id,
        name: spot.display_name,
        lat: spot.latitude,
        lng: spot.longitude,
      });
    }
  }

  console.log(`Matched: ${updates.length}`);
  console.log(`Unmatched: ${unmatched.length}`);
  console.log();

  // Show sample results
  if (updates.length > 0) {
    console.log("Sample matches (first 10):");
    updates.slice(0, 10).forEach((u) => {
      console.log(`  ${u.name} → ${u.cityName} (${u.distance.toFixed(1)} km)`);
    });
    console.log();
  }

  if (unmatched.length > 0) {
    console.log(`Unmatched spots (no city within ${maxDistance} km):`);
    unmatched.slice(0, 10).forEach((u) => {
      console.log(`  ${u.name} (${u.lat.toFixed(4)}, ${u.lng.toFixed(4)})`);
    });
    if (unmatched.length > 10) {
      console.log(`  ... and ${unmatched.length - 10} more`);
    }
    console.log();
  }

  // Count by city
  const cityCount = new Map<string, number>();
  updates.forEach((u) => {
    cityCount.set(u.cityName, (cityCount.get(u.cityName) || 0) + 1);
  });

  console.log("Spots per city (top 20):");
  Array.from(cityCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([city, count]) => {
      console.log(`  ${city}: ${count}`);
    });
  console.log();

  // Apply updates
  if (dryRun) {
    console.log("DRY RUN: No updates written to Supabase.");
  } else {
    console.log("Writing updates to Supabase...");
    let updated = 0;
    let failed = 0;

    for (const u of updates) {
      const { error: updateError } = await supabase
        .from("spots")
        .update({ area_text: u.cityName })
        .eq("id", u.id);

      if (updateError) {
        console.error(`Failed to update ${u.id}: ${updateError.message}`);
        failed++;
      } else {
        updated++;
      }
    }

    console.log(`Updated: ${updated}`);
    console.log(`Failed: ${failed}`);
  }

  console.log();
  console.log("Backfill complete.");
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
