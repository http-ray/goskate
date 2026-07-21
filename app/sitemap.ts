import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  // Public, indexable routes. Per-spot and per-user pages are dynamic and
  // intentionally omitted from the static sitemap.
  const routes = ["", "/map", "/users/search", "/profile"];

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
  }));
}
