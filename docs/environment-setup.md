# Environment Setup Guide

## Required Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Google Maps API Key (for address search in Add Spot flow)
GOOGLE_MAPS_API_KEY=your-google-api-key
```

---

## Google Maps API Setup

The Add Spot flow uses Google Places API for address/place search.

### 1. Get an API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Places API**
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy the generated key

### 2. Secure Your API Key

**Restrict by HTTP Referrer:**
1. Click on your API key in Google Cloud Console
2. Under "Application restrictions", select "HTTP referrers"
3. Add your domains:
   ```
   localhost:3000/*
   yourdomain.com/*
   ```

**Restrict by API:**
1. Under "API restrictions", select "Restrict key"
2. Select only: **Places API**

### 3. Enable Billing

Google requires billing to be enabled (has free tier):
- $200 free credit per month
- Places Text Search: $0.032 per request
- ~6,250 free searches/month

### 4. Add to .env.local

```bash
GOOGLE_MAPS_API_KEY=AIzaSy...your-key-here
```

### 5. Restart Dev Server

```bash
npm run dev
```

---

## Testing the API Key

### Test in Browser
```javascript
fetch('/api/search-places?query=skatepark')
  .then(r => r.json())
  .then(console.log);
```

### Test Direct API Call
```bash
curl "https://maps.googleapis.com/maps/api/place/textsearch/json?query=skatepark&key=YOUR_KEY"
```

### Expected Response
```json
{
  "results": [
    {
      "name": "Some Skatepark",
      "formatted_address": "123 Main St, City, State",
      "geometry": {
        "location": {
          "lat": 33.7490,
          "lng": -84.3880
        }
      }
    }
  ],
  "status": "OK"
}
```

---

## Troubleshooting

### "API key not configured" error
- Verify GOOGLE_MAPS_API_KEY is in .env.local
- Restart dev server after adding key
- Check for typos in variable name

### "Search failed" error
- Verify Places API is enabled in Google Cloud
- Check API key restrictions
- Ensure billing is enabled
- Check browser console for detailed error

### "Zero results" but places exist
- API key may be restricted by IP/domain
- Try unrestricted key for testing
- Verify query string format

---

## Supabase Setup

Supabase is already configured if you have the URL and anon key.

### Database Schema

Run these SQL files in order:
1. `supabase/schema.sql` - Base spots table
2. `supabase/profiles-schema.sql` - Profiles table
3. `supabase/spots-moderation-schema.sql` - Moderation columns

### RLS Policies

All tables have Row Level Security enabled. See schema files for policy details.

---

## Local Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Open browser
http://localhost:3000
```

---

## Production Deployment

### Environment Variables

Set these in your hosting platform (Vercel, Netlify, etc.):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GOOGLE_MAPS_API_KEY`

### Google API Key

**Important:** Use a production key with proper restrictions:
- HTTP referrer restricted to production domain
- API restricted to Places API only
- Monitor usage in Google Cloud Console

---

## API Cost Monitoring

### Google Cloud Console

1. Go to **Billing** → **Reports**
2. Filter by **Places API**
3. Monitor daily/monthly usage

### Set Budget Alerts

1. Go to **Billing** → **Budgets & alerts**
2. Create budget (e.g., $50/month)
3. Set alert at 50%, 90%, 100%

### Expected Costs

**MVP (50 users, 2 submissions/month, 3 searches each):**
- ~300 searches/month
- ~$10/month (under free tier)

**Production (1000 users):**
- ~6,000 searches/month
- Still under $200 free tier!

---

## Security Notes

### Never Commit API Keys

`.env.local` is in `.gitignore` - keep it there!

### API Key Best Practices

✅ Use separate keys for dev/staging/prod  
✅ Restrict by HTTP referrer  
✅ Restrict to specific APIs  
✅ Rotate keys periodically  
✅ Monitor usage for anomalies  

### Supabase Security

✅ Anon key is safe to expose (RLS protects data)  
✅ Service role key must NEVER be exposed  
✅ All queries filtered by RLS policies  

---

## Need Help?

- Google Maps API: [https://developers.google.com/maps/documentation/places](https://developers.google.com/maps/documentation/places)
- Supabase: [https://supabase.com/docs](https://supabase.com/docs)
- Next.js: [https://nextjs.org/docs](https://nextjs.org/docs)
