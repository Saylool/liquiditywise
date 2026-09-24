import type { MetadataRoute } from "next";

import { languageAlternates } from "../lib/i18n/localePath";
import { INDEXED_PAGES } from "../lib/site/indexing";

/*
 * The pages worth a search engine's visit: each open page at its every
 * address — the one that follows the browser, and one per language — and
 * beside each, where the others are, so a crawler reads them as one page in
 * eleven forms rather than eleven pages saying the same thing.
 *
 * No dates: nothing here knows when a page's words last changed, and a date
 * that is just "now" on every build is a claim a crawler learns to ignore.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXED_PAGES.flatMap((path) => {
    const languages = languageAlternates(path);
    return Object.values(languages).map((url) => ({ url, alternates: { languages } }));
  });
}
