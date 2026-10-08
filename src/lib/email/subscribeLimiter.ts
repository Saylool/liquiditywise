import type { ActionBudget } from "../ratelimit/actionBudget";
import { createFixedWindowRateLimiter } from "../ratelimit/fixedWindowLimiter";

/*
 * The limiter guarding the form that sends a confirmation e-mail.
 *
 * A module-level singleton, like the pool pages' (ratelimit/
 * poolAnalysisRateLimiter.ts), so the count lives as long as the process. It
 * counts the one thing on this site that sends a stranger a message: a form
 * anybody can put anybody's address into. Each submission that names an
 * address not yet confirmed costs one mail from the provider's allowance and
 * one unasked-for mail in somebody's inbox, so the ceiling is lower than the
 * pool pages' and the window longer — a reader has one address, perhaps two,
 * and a script has a list.
 *
 * Keyed as the pool pages are, by the client address nginx hands on
 * (ratelimit/clientKey.ts), with the same honest limit: one process's
 * memory, a deterrent rather than a guarantee.
 *
 * The guarantee is the second count, `SUBSCRIBE_BUDGET`, kept in the store
 * every process shares (ratelimit/actionBudget.ts): per client, and over
 * everybody, which is the one no number of clients can get round. Twenty an
 * hour over everybody is far past what the form is asked for, and keeps what
 * a flood can cost to a few hundred mails a day and as many pending records,
 * each of which lapses within the day.
 */

/** Submissions per window per client. Five: a typo or two, and a second address. */
export const SUBSCRIBE_REQUEST_LIMIT = 5;

/** Fifteen minutes. Long enough that a list cannot be worked through by waiting it out quickly. */
export const SUBSCRIBE_WINDOW_MS = 15 * 60_000;

/** As for the pool pages: a few hundred kilobytes at most, and a flood of distinct clients evicts the oldest. */
const MAX_TRACKED_CLIENTS = 10_000;

export const subscribeRateLimiter = createFixedWindowRateLimiter({
  limit: SUBSCRIBE_REQUEST_LIMIT,
  windowMs: SUBSCRIBE_WINDOW_MS,
  maxTrackedKeys: MAX_TRACKED_CLIENTS,
  now: () => Date.now(),
});

/** The shared count: per client and over everybody, per hour. */
export const SUBSCRIBE_BUDGET: ActionBudget = {
  action: "email-digest",
  perClient: SUBSCRIBE_REQUEST_LIMIT,
  global: 20,
  windowMs: 60 * 60_000,
};
