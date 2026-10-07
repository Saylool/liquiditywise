import type { MetadataRoute } from "next";

import { languageAlternates } from "../lib/i18n/localePath";
import { INDEXED_PAGES } from "../lib/site/indexing";

/*
 * The pages worth a search engine's visit: each open page at each of its ten
 * language addresses, and beside each, where the others are — the unprefixed
 * address among them as x-default — so a crawler reads them as one page in
 * ten forms rather than ten pages saying the same thing.
 *
 * The unprefixed address is not listed as a page of its own: it shows
 * whichever language the browser asks for and names that language's address
 * canonical (requestLocale.ts), so listing it only handed the crawler a
 * duplicate to report.
 *
 * No dates: nothing here knows when a page's words last changed, and a date
 * that is just "now" on every build is a claim a crawler learns to ignore.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXED_PAGES.flatMap((path) => {
    const languages = languageAlternates(path);
    return Object.entries(languages)
      .filter(([hreflang]) => hreflang !== "x-default")
      .map(([, url]) => ({ url, alternates: { languages } }));
  });
}
