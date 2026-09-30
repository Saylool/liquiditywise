import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../chains/chainEnvironment", () => ({
  rpcUrlFor: (chainId: number) => `rpc-${chainId}`,
  v3SubgraphIdFor: (chainId: number) => `v3-${chainId}`,
}));
vi.mock("./getMostTraded", () => ({ getMostTraded: async () => ({ v3: null, v4: null }) }));

const state = vi.hoisted(() => ({
  reads: 0,
  outcome: "measured" as "measured" | "unavailable",
  release: null as (() => void) | null,
  hold: false,
  asked: [] as { readEarnings: unknown }[],
}));

vi.mock("./readSmartLiquidity", () => ({
  readSmartLiquidity: async (sources: { readEarnings: unknown }) => {
    state.reads += 1;
    state.asked.push(sources);
    if (state.hold) await new Promise<void>((resolve) => (state.release = resolve));
    return state.outcome === "measured"
      ? { status: "measured", data: { measured: state.reads, smart: [] }, poolsAsked: 12, poolsRead: 12, measuredAt: "t" }
      : { status: "unavailable", notice: "market-data-timed-out" };
  },
}));

import { forgetSmartLiquidity, getSmartLiquidity, peekSmartLiquidity, SMART_LIQUIDITY_TTL_MS } from "./getSmartLiquidity";

beforeEach(() => {
  forgetSmartLiquidity();
  Object.assign(state, { reads: 0, outcome: "measured", release: null, hold: false, asked: [] });
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the smart-money figures, kept", () => {
  it("are read nowhere positions cannot be listed", async () => {
    expect(await getSmartLiquidity(42161)).toBeNull();
    expect(await getSmartLiquidity(8453)).toBeNull();
    expect(state.reads).toBe(0);
  });

  it("are read once and kept for hours, per chain", async () => {
    vi.useFakeTimers();
    await getSmartLiquidity(1);
    await getSmartLiquidity(1);
    await getSmartLiquidity(137);
    expect(state.reads).toBe(2);

    vi.advanceTimersByTime(SMART_LIQUIDITY_TTL_MS);
    await getSmartLiquidity(1);
    expect(state.reads).toBe(3);
  });

  it("are read anew for the warmer whatever is kept", async () => {
    await getSmartLiquidity(1);
    await getSmartLiquidity(1, { refresh: true });

    expect(state.reads).toBe(2);
  });

  it("make readers who arrive during a read wait on that read, not start their own", async () => {
    state.hold = true;
    const first = getSmartLiquidity(1);
    const second = getSmartLiquidity(1);
    await vi.waitFor(() => expect(state.release).not.toBeNull());
    state.release?.();

    expect(await first).toBe(await second);
    expect(state.reads).toBe(1);
  });

  it("keep a failed read out, and serve the kept one while it lasts", async () => {
    const kept = await getSmartLiquidity(1);
    state.outcome = "unavailable";

    expect(await getSmartLiquidity(1, { refresh: true })).toBe(kept);
    forgetSmartLiquidity();
    expect(await getSmartLiquidity(1)).toMatchObject({ status: "unavailable" });
    /* Not kept: the next visit reads again rather than being served the failure. */
    expect(await getSmartLiquidity(1)).toMatchObject({ status: "unavailable" });
    expect(state.reads).toBe(4);
  });

  it("can be looked at without being read: nothing until a read has kept something, and nothing once it runs out", async () => {
    vi.useFakeTimers();
    expect(peekSmartLiquidity(1)).toBeNull();
    expect(state.reads).toBe(0);

    const measured = await getSmartLiquidity(1);
    expect(peekSmartLiquidity(1)).toBe(measured);
    expect(peekSmartLiquidity(137)).toBeNull();
    expect(peekSmartLiquidity(42161)).toBeNull();

    vi.advanceTimersByTime(SMART_LIQUIDITY_TTL_MS);
    expect(peekSmartLiquidity(1)).toBeNull();
    expect(state.reads).toBe(1);
  });
});
