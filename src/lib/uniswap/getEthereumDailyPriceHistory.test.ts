import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The warmer runs from a bundle of its own, so its copy of this module is not
 * the one the pages import. What it reads has to land where they look: a
 * second copy of the module, made the way a second bundle makes one, must be
 * served from what the first kept.
 */

vi.mock("server-only", () => ({}));
vi.mock("../chains/chainEnvironment", () => ({ subgraphIdFor: () => "subgraph" }));
vi.mock("../observability/serverDiagnostics", () => ({
  logDetail: () => undefined,
  loggingFetch: () => fetch,
  logUnavailable: (_label: string, result: unknown) => result,
}));

const state = vi.hoisted(() => ({ fetches: 0 }));
vi.mock("./ethereumDailyPriceHistory", () => ({
  fetchEthereumDailyPriceHistory: async () => {
    state.fetches += 1;
    const now = Date.now();
    return {
      status: "success",
      data: {
        rangeEndExclusive: new Date(now - 3_600_000).toISOString(),
        sourceBlockTimestamp: new Date(now).toISOString(),
      },
    };
  },
}));

const POOL = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";
const KEYS = ["daily-history.kept", "daily-history.asking"].map((name) => Symbol.for(`liquiditywise.${name}`));

const freshBundle = async () => {
  vi.resetModules();
  return import("./getEthereumDailyPriceHistory");
};

beforeEach(() => {
  state.fetches = 0;
  for (const key of KEYS) delete (globalThis as unknown as Record<symbol, unknown>)[key];
});

afterEach(() => {
  for (const key of KEYS) delete (globalThis as unknown as Record<symbol, unknown>)[key];
});

describe("a pool's history, across bundles", () => {
  it("is read once however many copies of the module ask, the way the warmer's and the pages' do", async () => {
    const warmer = await freshBundle();
    const pages = await freshBundle();
    expect(pages.getEthereumDailyPriceHistory).not.toBe(warmer.getEthereumDailyPriceHistory);

    await warmer.getEthereumDailyPriceHistory("v3", POOL, 1);
    await pages.getEthereumDailyPriceHistory("v3", POOL, 1);

    expect(state.fetches).toBe(1);
  });

  it("keeps a pool on another chain apart from the same address on mainnet", async () => {
    const bundle = await freshBundle();

    await bundle.getEthereumDailyPriceHistory("v3", POOL, 1);
    await bundle.getEthereumDailyPriceHistory("v3", POOL, 42161);

    expect(state.fetches).toBe(2);
  });
});
