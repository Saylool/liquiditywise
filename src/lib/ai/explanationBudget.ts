import { createFixedWindowRateLimiter, type RateLimiter } from "../ratelimit/fixedWindowLimiter";

/*
 * A ceiling on how many explanations this server has written in the last
 * hour, whoever asked for them.
 *
 * The per-reader rate limit in the proxy counts by the reader's address, and
 * it is only as good as that address: until nginx accepted Cloudflare alone,
 * a forged header was a fresh count every request, and the model was paid for
 * each. This counts nothing about who asks. It is the second lock — the one
 * that still holds if the first is ever picked — with OpenAI's own monthly
 * limit behind it.
 *
 * Only new explanations count. One already in the cache costs nothing and is
 * served whatever this says. Past the ceiling the figures are shown as ever,
 * and the explanation's place says why it is missing.
 */

/**
 * Sixty an hour: at about $0.0015 each, $65 a month if every hour of it were
 * full — far above anything this site has seen, and small enough that a
 * month-long flood costs a dinner rather than a rent.
 */
export const EXPLANATIONS_PER_HOUR = 60;

const HOUR_MS = 60 * 60 * 1_000;

/** One key: the count is the server's, not any reader's. */
const EVERYONE = "everyone";

export type ExplanationBudget = { readonly take: () => boolean };

export const createExplanationBudget = (now: () => number = Date.now): ExplanationBudget => {
  const limiter: RateLimiter = createFixedWindowRateLimiter({
    limit: EXPLANATIONS_PER_HOUR,
    windowMs: HOUR_MS,
    maxTrackedKeys: 1,
    now,
  });
  return { take: () => limiter.check(EVERYONE).allowed };
};
