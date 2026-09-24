import type { MetadataRoute } from "next";

import { CLOSED_PATHS, SITE_URL } from "../lib/site/indexing";

/** What a crawler may read: see src/lib/site/indexing.ts for why these and no others. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...CLOSED_PATHS] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
