import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({ peeked: [] as number[], kept: null as unknown }));
vi.mock("../advisor/getSmartLiquidity", () => ({
  peekSmartLiquidity: (chainId: number) => {
    state.peeked.push(chainId);
    return state.kept;
  },
}));

import { readSmartCard } from "./readSmartCard";

const measured = {
  status: "measured",
  poolsAsked: 1,
  poolsRead: 1,
  measuredAt: "t",
  data: {
    measured: 10,
    medianYearlyYield: 0.1,
    smartFrom: 0.3,
    smart: [null, null],
    pairs: [
      {
        pool: {
          protocolVersion: "v3",
          chainId: 137,
          id: `0x${"1".repeat(40)}`,
          feePpm: 500,
          token0: { chainId: 137, address: `0x${"a".repeat(40)}`, symbol: "WETH", decimals: 18 },
          token1: { chainId: 137, address: `0x${"b".repeat(40)}`, symbol: "USDC", decimals: 6 },
        },
        positions: 2,
        valueUsd: 1,
        medianLowerRatio: 0.9,
        medianUpperRatio: 1.1,
        medianYearlyYield: 0.3,
        currentPrice: 2500,
      },
    ],
  },
};

beforeEach(() => {
  state.peeked = [];
  state.kept = measured;
});

describe("the smart-money card for a chain", () => {
  it("is drawn from what is kept for the chain asked about, and never starts a measurement", () => {
    expect(readSmartCard(new URLSearchParams({ chain: "polygon" }))?.pair).toBe("WETH / USDC · 0.05%");
    expect(state.peeked).toEqual([137]);
  });

  it("reads mainnet when it names no chain", () => {
    readSmartCard(new URLSearchParams());

    expect(state.peeked).toEqual([1]);
  });

  it("is nothing for a chain nobody reads, one whose positions cannot be listed, or before a measurement is kept", () => {
    expect(readSmartCard(new URLSearchParams({ chain: "solana" }))).toBeNull();
    expect(readSmartCard(new URLSearchParams({ chain: "arbitrum" }))).toBeNull();
    expect(state.peeked).toEqual([]);

    state.kept = null;
    expect(readSmartCard(new URLSearchParams({ chain: "polygon" }))).toBeNull();
  });
});
