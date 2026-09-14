import { describe, expect, it, vi } from "vitest";

import {
  POOL_ANALYSIS_REQUEST_LIMIT,
  POOL_ANALYSIS_WINDOW_MS,
} from "./poolAnalysisRateLimiter";
import {
  checkSharedPoolAnalysisLimit,
  sharedStoreFromEnvironment,
} from "./poolAnalysisSharedLimiter";
import type { RateLimitStore } from "./rateLimitStore";

const CONFIGURED = {
  UPSTASH_REDIS_REST_URL: "https://example-db.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "upstash-token",
};

const storeReturning = (count: number | null) => {
  const increment = vi.fn<RateLimitStore["increment"]>(async () => count);
  return { store: { increment }, increment };
};

describe("sharedStoreFromEnvironment", () => {
  it("builds a store when both halves are configured", () => {
    expect(sharedStoreFromEnvironment(CONFIGURED)).not.toBeNull();
  });

  /*
   * A URL with no token cannot authenticate and a token with no URL has nowhere
   * to go. Treating either alone as "no store" is what keeps a half-finished
   * setup from looking like a working one.
   */
  it.each([
    ["nothing configured", {}],
    ["only a URL", { UPSTASH_REDIS_REST_URL: CONFIGURED.UPSTASH_REDIS_REST_URL }],
    ["only a token", { UPSTASH_REDIS_REST_TOKEN: CONFIGURED.UPSTASH_REDIS_REST_TOKEN }],
    ["a blank URL", { ...CONFIGURED, UPSTASH_REDIS_REST_URL: "   " }],
    ["a blank token", { ...CONFIGURED, UPSTASH_REDIS_REST_TOKEN: "" }],
  ])("builds none for %s", (_label, environment) => {
    expect(sharedStoreFromEnvironment(environment)).toBeNull();
  });
});

describe("checkSharedPoolAnalysisLimit", () => {
  /*
   * The default, and the one that must cost nothing: with no store configured
   * the answer comes back without a single await on anything remote.
   */
  it("says nothing when this deployment has no shared counter", async () => {
    expect(await checkSharedPoolAnalysisLimit({ clientKey: "a", environment: {} })).toBeNull();
  });

  it("says nothing when the configured counter could not answer", async () => {
    const { store } = storeReturning(null);

    expect(await checkSharedPoolAnalysisLimit({ clientKey: "a", store })).toBeNull();
  });

  it("allows a request the shared count leaves inside the limit", async () => {
    const { store } = storeReturning(POOL_ANALYSIS_REQUEST_LIMIT);

    expect(await checkSharedPoolAnalysisLimit({ clientKey: "a", store })).toMatchObject({
      allowed: true,
    });
  });

  it("refuses the one past it", async () => {
    const { store } = storeReturning(POOL_ANALYSIS_REQUEST_LIMIT + 1);

    expect(await checkSharedPoolAnalysisLimit({ clientKey: "a", store })).toMatchObject({
      allowed: false,
    });
  });

  /* One limit, counted twice — not two different allowances. */
  it("counts against the same limit and window as the local one", async () => {
    const { store, increment } = storeReturning(1);

    await checkSharedPoolAnalysisLimit({ clientKey: "a", store, now: () => 0 });

    expect(increment.mock.calls[0]?.[1]).toBe(POOL_ANALYSIS_WINDOW_MS * 2);
  });

  it("counts two clients separately", async () => {
    const { store, increment } = storeReturning(1);

    await checkSharedPoolAnalysisLimit({ clientKey: "a", store, now: () => 0 });
    await checkSharedPoolAnalysisLimit({ clientKey: "b", store, now: () => 0 });

    expect(increment.mock.calls[0]?.[0]).not.toBe(increment.mock.calls[1]?.[0]);
  });
});
