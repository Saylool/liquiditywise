/*
 * Which of this site's pages a search engine may read, in one place — the
 * robots file, the sitemap and the test that holds every page's own metadata
 * to them all read it.
 *
 * Open: the front page and the hook directory, which say the same thing to
 * everyone and cost nothing to render twice. Closed: every page that reads
 * live data for one pool, pair or address. Each render spends third-party
 * quota and is only true for the moment it was read, and a crawler walking
 * pool links would spend the quota a reader needs.
 */

export const SITE_URL = "https://liquiditywise.com";

export const INDEXED_PAGES = ["/", "/hooks"] as const;

/** Pages that read live data per request, plus the routes that are not pages at all. */
export const CLOSED_PATHS = ["/pool", "/v4", "/compare", "/holdings", "/api/", "/__backup/"] as const;
