import type { MetadataRoute } from "next";

import { INDEXED_PAGES, SITE_URL } from "../lib/site/indexing";

/*
 * The pages worth a search engine's visit. No dates: nothing here knows when a
 * page's words last changed, and a date that is just "now" on every build is
 * a claim a crawler learns to ignore.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXED_PAGES.map((path) => ({ url: `${SITE_URL}${path === "/" ? "" : path}` }));
}
