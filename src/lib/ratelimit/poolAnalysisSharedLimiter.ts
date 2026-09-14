import type { RateLimitDecision } from "./fixedWindowLimiter";
import { POOL_ANALYSIS_REQUEST_LIMIT, POOL_ANALYSIS_WINDOW_MS } from "./poolAnalysisRateLimiter";
import { checkSharedWindow, type RateLimitStore } from "./rateLimitStore";
import { createUpstashRateLimitStore } from "./upstashRateLimitStore";

/*
 * The shared half of the limit, wired to the environment.
 *
 * Optional on purpose. With nothing configured this application behaves exactly
 * as it did before the shared counter existed — same limit, same code path, and
 * not one millisecond added to a request, because the decision to skip is made
 * before anything is awaited. A deployment that wants a real ceiling across its
 * instances sets two variables and gets one.
 *
 * The variable names are Upstash's own, which is what Vercel's integration sets
 * when a database is attached. Nothing has to be copied by hand for it to start
 * working, and nothing here reads a value it was not given.
 */

/** What a store needs to exist. Read per call, never captured at module load. */
export type SharedLimiterEnvironment = {
  readonly UPSTASH_REDIS_REST_URL?: string | undefined;
  readonly UPSTASH_REDIS_REST_TOKEN?: string | undefined;
};

/**
 * Builds the store this deployment is configured for, or `null` when it is
 * configured for none.
 *
 * Both halves are required. A URL without a token cannot authenticate and a
 * token without a URL has nowhere to go; either one alone is a half-finished
 * setup, and treating it as "no store" is what keeps a half-finished setup from
 * looking like a working one.
 */
export const sharedStoreFromEnvironment = (
  environment: SharedLimiterEnvironment,
): RateLimitStore | null => {
  const url = environment.UPSTASH_REDIS_REST_URL?.trim();
  const token = environment.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url === undefined || url === "" || token === undefined || token === "") return null;

  return createUpstashRateLimitStore({ url, token });
};

export type SharedLimitCheck = {
  readonly clientKey: string;
  readonly environment?: SharedLimiterEnvironment;
  readonly store?: RateLimitStore | null;
  readonly now?: () => number;
};

/**
 * Counts one request against the shared window.
 *
 * Returns `null` when there is no shared counter to consult, or when the one
 * there is could not answer. Both mean the same thing to the caller: this
 * request is governed by the local limiter alone, which is the limit this
 * application had all along.
 */
export const checkSharedPoolAnalysisLimit = async ({
  clientKey,
  /*
   * Named one by one rather than handed `process.env` whole, so a misspelled
   * variable is a compile error here instead of a store that silently never
   * exists. It also states, in one place, exactly which values this reads.
   */
  environment = {
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  },
  store,
  now = Date.now,
}: SharedLimitCheck): Promise<RateLimitDecision | null> => {
  const configured = store === undefined ? sharedStoreFromEnvironment(environment) : store;
  if (configured === null) return null;

  return checkSharedWindow(configured, clientKey, {
    limit: POOL_ANALYSIS_REQUEST_LIMIT,
    windowMs: POOL_ANALYSIS_WINDOW_MS,
    now,
  });
};
