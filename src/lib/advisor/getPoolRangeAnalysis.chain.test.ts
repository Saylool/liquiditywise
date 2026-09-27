import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_DEPOSIT_USD, DEFAULT_PRICE_BAND_PARAMETERS } from "./poolRangeAnalysis";

/*
 * The one place the three reads of an analysis meet: each must be asked about
 * the chain the page was asked about, or two of them would describe a
 * different pool that happens to share the address.
 */

vi.mock("server-only", () => ({}));

const asked = vi.hoisted(() => ({ pool: [] as unknown[], snapshot: [] as unknown[], history: [] as unknown[] }));
const unavailable = { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" } as const;

vi.mock("../uniswap/getEthereumV3Pool", () => ({
  getEthereumV3Pool: async (...args: unknown[]) => {
    asked.pool.push(args);
    return unavailable;
  },
}));
vi.mock("../uniswap/getEthereumV4Pool", () => ({
  getEthereumV4Pool: async (...args: unknown[]) => {
    asked.pool.push(args);
    return unavailable;
  },
}));
vi.mock("../uniswap/getEthereumPoolMarketSnapshot", () => ({
  getEthereumPoolMarketSnapshot: async (...args: unknown[]) => {
    asked.snapshot.push(args);
    return unavailable;
  },
}));
vi.mock("../uniswap/getEthereumDailyPriceHistory", () => ({
  getEthereumDailyPriceHistory: async (...args: unknown[]) => {
    asked.history.push(args);
    return unavailable;
  },
}));

const POOL = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";

beforeEach(() => {
  asked.pool = [];
  asked.snapshot = [];
  asked.history = [];
});

describe("an analysis on a chain", () => {
  it("asks every read about that chain", async () => {
    const { getPoolRangeAnalysis } = await import("./getPoolRangeAnalysis");

    await getPoolRangeAnalysis("v3", POOL, DEFAULT_PRICE_BAND_PARAMETERS, DEFAULT_DEPOSIT_USD, undefined, 8453);

    expect(asked.pool).toEqual([[POOL, 8453]]);
    expect(asked.snapshot).toEqual([["v3", POOL, 8453]]);
    expect(asked.history).toEqual([["v3", POOL, 8453]]);
  });

  it("asks a v4 pool's reads about its own chain too", async () => {
    const { getPoolRangeAnalysis } = await import("./getPoolRangeAnalysis");
    const id = `0x${"e5".repeat(32)}`;

    await getPoolRangeAnalysis("v4", id, DEFAULT_PRICE_BAND_PARAMETERS, DEFAULT_DEPOSIT_USD, undefined, 137);

    expect(asked.pool).toEqual([[id, 137]]);
    expect(asked.snapshot).toEqual([["v4", id, 137]]);
    expect(asked.history).toEqual([["v4", id, 137]]);
  });
});
