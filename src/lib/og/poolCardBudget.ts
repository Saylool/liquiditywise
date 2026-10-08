import { concurrencyBudget } from "../cache/concurrency";
import { processShared } from "../cache/processShared";

/*
 * How many pool cards this process draws at once, and how many it lets wait.
 *
 * A card is the one address on the site that crawlers are meant to fetch,
 * from anywhere, at whatever rate a feed unfurls links — so the per-visitor
 * limit in the proxy is not the whole answer for it. A crawler's addresses
 * are many and its own, and a card's work is two costs that limit does not
 * see together: the read of the pool, from The Graph or a chain endpoint,
 * when the card is not kept yet; and the drawing, which is CPU in this
 * process whether the card was kept or not.
 *
 * So the whole of it — read and draw — runs inside one budget for the
 * process. Four at once is more than real sharing ever asks for; sixteen in
 * line covers a burst of unfurls arriving together. Past that the card is
 * not started, and the route says to try again shortly rather than holding
 * the request open behind everyone else's (app/og/pool/route.tsx).
 *
 * Process-wide like every cache here (processShared.ts), so a module loaded
 * twice still keeps one budget.
 */

export const POOL_CARDS_AT_ONCE = 4;

export const POOL_CARDS_WAITING = 16;

/** How long a turned-away card is told to wait: the time a few cards take to draw. */
export const POOL_CARD_RETRY_AFTER_SECONDS = 5;

export const poolCardBudget = processShared("og.pool.budget", () =>
  concurrencyBudget(POOL_CARDS_AT_ONCE, POOL_CARDS_WAITING),
);
