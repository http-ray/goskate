import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

const siteUrl = getSiteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep the moderation queue out of search indexes.
      disallow: ["/admin/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
