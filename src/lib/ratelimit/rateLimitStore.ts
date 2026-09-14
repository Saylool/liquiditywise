import type { RateLimitDecision } from "./fixedWindowLimiter";

/*
 * A counter the instances of this application share.
 *
 * The in-memory limiter next door counts in one process's memory, so a platform
 * running four warm copies enforces four times the limit. This is the missing
 * half: one counter every copy increments.
 *
 * It does not replace the local one. Both run, and a request has to satisfy
 * both — which is what makes the store's failure survivable. When it cannot
 * answer, the limit degrades to exactly what it was before this module existed
 * rather than disappearing.
 */

/**
 * One shared counter.
 *
 * `increment` counts a request and returns the running total for the window, or
 * `null` when the store could not answer. It must never throw and never hang:
 * the caller is a proxy that runs before rendering, and an exception or a stall
 * there is a broken site rather than a missed count.
 */
export type RateLimitStore = {
  readonly increment: (key: string, ttlMs: number) => Promise<number | null>;
};

/**
 * Namespaces the keys, so a store shared with anything else cannot collide with
 * a counter, and a counter cannot read something else's value as one.
 */
export const RATE_LIMIT_KEY_PREFIX = "uniswapadvisor:ratelimit:";

export type SharedWindowOptions = {
  /** Requests allowed per window. The same number the local limiter uses. */
  readonly limit: number;
  readonly windowMs: number;
  readonly now: () => number;
};

/**
 * Counts one request against the shared store, or returns `null` if the store
 * could not answer.
 *
 * The window is aligned to the clock — every instance derives the same boundary
 * from `now`, which is what lets them agree without coordinating. The local
 * limiter starts a window at a client's first request instead, so the two
 * boundaries rarely line up; a request has to pass both, so the pair is at worst
 * slightly stricter than either. That is the right direction to be wrong in for
 * a cost control.
 *
 * The key carries the window start, so an expired window is a key nothing writes
 * to again and the store's own TTL clears it. No sweep, no eviction policy, no
 * memory that grows with the number of clients seen.
 */
export const checkSharedWindow = async (
  store: RateLimitStore,
  clientKey: string,
  options: SharedWindowOptions,
): Promise<RateLimitDecision | null> => {
  const now = options.now();
  const windowStart = now - (now % options.windowMs);
  const key = `${RATE_LIMIT_KEY_PREFIX}${clientKey}:${windowStart}`;

  /*
   * The TTL is two windows rather than one. A key written at the very end of a
   * window would otherwise expire at almost the same moment, and a store whose
   * clock differs from this one's by a little could drop the count while the
   * window is still open. Nothing reads the key after its window ends, so the
   * extra life costs one unread entry.
   */
  const count = await store.increment(key, options.windowMs * 2);
  if (count === null) return null;

  if (count > options.limit) {
    const millisecondsLeft = windowStart + options.windowMs - now;

    return {
      allowed: false,
      remaining: 0,
      // Rounded up, so it can never be zero and invite an immediate retry that
      // this same branch would refuse.
      retryAfterSeconds: Math.max(1, Math.ceil(millisecondsLeft / 1000)),
    };
  }

  return { allowed: true, remaining: options.limit - count, retryAfterSeconds: 0 };
};
