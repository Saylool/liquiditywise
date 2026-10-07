/*
 * Which of this site's pages a search engine may read, in one place — the
 * robots file, the sitemap and the test that holds every page's own metadata
 * to them all read it.
 *
 * Open: the front page, the hook directory and the quick guide with its
 * topics, the week's most traded pools, where smart liquidity sits and its
 * weekly digest, and the about, method and developers pages, which say the
 * same thing to everyone and cost nothing to render twice. Closed: every page that reads live data for
 * one pool, pair or address. Each render spends third-party
 * quota and is only true for the moment it was read, and a crawler walking
 * pool links would spend the quota a reader needs.
 */

export const SITE_URL = "https://liquiditywise.com";

/**
 * One page per quick-guide topic, so a search for one idea in one language
 * lands on that idea. Written out rather than built from the guide's ids,
 * because the proxy's matcher has to be, and a test holds the two together.
 */
export const LEARN_TOPIC_PAGES = [
  "/learn/concentrated",
  "/learn/in-range",
  "/learn/divergence",
  "/learn/width",
  "/learn/fee-tiers",
  "/learn/hooks",
  "/learn/smart-money",
] as const;

export const INDEXED_PAGES = [
  "/",
  "/hooks",
  "/learn",
  "/most-traded",
  "/smart-money",
  "/weekly",
  "/about",
  "/method",
  "/developers",
  ...LEARN_TOPIC_PAGES,
] as const;

/**
 * The pool card other sites frame, and the same figures as JSON. Served by
 * route handlers rather than pages — the card is written by hand, with none of
 * the site around it — and closed like every other address that reads one
 * pool live: the card under `/embed/`, the figures under `/api/`.
 */
export const EMBED_PAGES = ["/embed/pool", "/api/embed/pool"] as const;

/**
 * The card a holder shares about one open v3 position: an image, served by a
 * route handler and closed like the holdings page whose record it draws — it
 * reads that one position live, from the chain and its sources.
 */
export const SHARE_PAGES = ["/api/share/position"] as const;

/** Pages that read live data per request, plus the routes that are not pages at all. */
export const CLOSED_PATHS = ["/pool", "/v4", "/compare", "/pair", "/holdings", "/embed/", "/api/", "/__backup/"] as const;
