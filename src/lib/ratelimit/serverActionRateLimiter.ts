import { createFixedWindowRateLimiter } from "./fixedWindowLimiter";

/*
 * The proxy's count of Server Actions, per client (chargeableRequest.ts says
 * which requests are one).
 *
 * Every form on the site that does something is an action — the language
 * switcher, the Telegram button and the one that forgets a link, the weekly
 * page's e-mail form — and a reader presses a few of them in a visit. Thirty
 * in ten minutes is far past that, and well short of a loop. A module-level
 * singleton like the pool pages' limiter, with the same honest limit: one
 * process's memory, a first line rather than a guarantee. The actions that
 * write to the store hold their own, shared budget inside themselves.
 */

/** Actions per window per client. */
export const SERVER_ACTION_REQUEST_LIMIT = 30;

/** Ten minutes. */
export const SERVER_ACTION_WINDOW_MS = 10 * 60_000;

/** As for the pool pages: a flood of distinct clients evicts the oldest. */
const MAX_TRACKED_CLIENTS = 10_000;

export const serverActionRateLimiter = createFixedWindowRateLimiter({
  limit: SERVER_ACTION_REQUEST_LIMIT,
  windowMs: SERVER_ACTION_WINDOW_MS,
  maxTrackedKeys: MAX_TRACKED_CLIENTS,
  now: () => Date.now(),
});
