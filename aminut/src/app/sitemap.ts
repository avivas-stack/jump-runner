import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteConfig";

// Deliberately lists only the homepage, not every /report/[id] — those are discovered
// organically when someone shares a link (each still carries its own proper metadata
// and is allowed by robots.txt), rather than bulk-publishing an index of every claim
// anyone has ever submitted, which could include low-confidence reports about real
// people that shouldn't be handed to crawlers in bulk.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    {
      url: `${SITE_URL}/what-is-fake-news`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
