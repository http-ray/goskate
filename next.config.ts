import type { NextConfig } from "next";

// Conservative security headers. We intentionally do NOT set a strict
// Content-Security-Policy: the app loads external map tiles
// (OpenStreetMap) and embeds TikTok/Instagram iframes, so a tight CSP
// would break core functionality. These headers are the safe subset.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Permissions-Policy",
    // Geolocation is used by "Locate Me"; keep it same-origin only.
    value: "geolocation=(self), camera=(), microphone=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
