import { describe, expect, it, vi } from "vitest";

import { checkSharedWindow, RATE_LIMIT_KEY_PREFIX, type RateLimitStore } from "./rateLimitStore";

const CLIENT = "203.0.113.7";
const WINDOW_MS = 60_000;

/** A store that answers with whatever the test hands it, and records the call. */
const storeReturning = (...counts: readonly (number | null)[]) => {
  const queue = [...counts];
  const increment = vi.fn<RateLimitStore["increment"]>(async () => queue.shift() ?? null);
  return { store: { increment }, increment };
};

const check = (store: RateLimitStore, now: number, limit = 10) =>
  checkSharedWindow(store, CLIENT, { limit, windowMs: WINDOW_MS, now: () => now });

describe("checkSharedWindow", () => {
  it("allows a request inside the limit and says what is left", async () => {
    const { store } = storeReturning(3);

    expect(await check(store, 1_000)).toEqual({
      allowed: true,
      remaining: 7,
      retryAfterSeconds: 0,
    });
  });

  it("allows the request that reaches the limit exactly", async () => {
    const { store } = storeReturning(10);

    expect(await check(store, 1_000)).toMatchObject({ allowed: true, remaining: 0 });
  });

  it("refuses the one after it", async () => {
    const { store } = storeReturning(11);

    expect(await check(store, 1_000)).toMatchObject({ allowed: false, remaining: 0 });
  });

  it("says how long the window has left when it refuses", async () => {
    const { store } = storeReturning(11);

    // 12s into a 60s window, so 48 remain.
    expect(await check(store, WINDOW_MS * 4 + 12_000)).toMatchObject({ retryAfterSeconds: 48 });
  });

  /*
   * A `Retry-After: 0` invites an immediate retry that the same branch would
   * refuse, so the answer is rounded up and floored at one.
   */
  it("never tells a refused visitor to retry immediately", async () => {
    const { store } = storeReturning(11);
    const attheveryend = WINDOW_MS * 4 + WINDOW_MS - 1;

    expect(await check(store, attheveryend)).toMatchObject({ retryAfterSeconds: 1 });
  });

  /*
   * The whole point of the aligned window: every instance derives the same
   * boundary from the clock, so they agree on which counter to increment
   * without coordinating.
   */
  it("counts two requests in the same window against one key", async () => {
    const { store, increment } = storeReturning(1, 2);

    await check(store, WINDOW_MS * 4 + 1_000);
    await check(store, WINDOW_MS * 4 + 59_000);

    expect(increment.mock.calls[0]?.[0]).toBe(increment.mock.calls[1]?.[0]);
  });

  it("counts a request after the boundary against a different key", async () => {
    const { store, increment } = storeReturning(1, 1);

    await check(store, WINDOW_MS * 4 + 59_999);
    await check(store, WINDOW_MS * 5);

    expect(increment.mock.calls[0]?.[0]).not.toBe(increment.mock.calls[1]?.[0]);
  });

  it("namespaces the key and names the client and the window", async () => {
    const { store, increment } = storeReturning(1);

    await check(store, WINDOW_MS * 4 + 1_000);

    expect(increment.mock.calls[0]?.[0]).toBe(
      `${RATE_LIMIT_KEY_PREFIX}${CLIENT}:${WINDOW_MS * 4}`,
    );
  });

  /*
   * Two windows, not one. A key written at the very end of a window would
   * otherwise expire at almost the same moment, and a store whose clock differs
   * a little could drop a count while the window is still open.
   */
  it("gives the key more life than the window it counts", async () => {
    const { store, increment } = storeReturning(1);

    await check(store, 1_000);

    expect(increment.mock.calls[0]?.[1]).toBe(WINDOW_MS * 2);
  });

  /*
   * The store failing must not refuse anyone. The local limiter is still
   * counting, so this degrades to the limit the application had before a shared
   * store was possible.
   */
  it("says nothing at all when the store could not answer", async () => {
    const { store } = storeReturning(null);

    expect(await check(store, 1_000)).toBeNull();
  });
});
