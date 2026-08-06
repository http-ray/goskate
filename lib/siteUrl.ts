// ============================================================
// siteUrl — the absolute production URL used for OG tags,
// canonical metadata, robots.txt, and sitemap.xml.
//
// Resolution order:
//   1. NEXT_PUBLIC_SITE_URL — explicit override, set in Vercel
//      project settings if you want full control.
//   2. VERCEL_PROJECT_PRODUCTION_URL — set automatically by
//      Vercel on every deploy, no manual config required. This
//      is what makes OG previews work in production even if
//      NEXT_PUBLIC_SITE_URL was never set.
//   3. http://localhost:3000 — local dev fallback.
// ============================================================

export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}
