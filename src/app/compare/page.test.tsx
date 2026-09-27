import { describe, expect, it, vi } from "vitest";

/*
 * The comparison reads every v4 pool of the pair in full, beside the v3
 * tiers. Those reads once named no chain and fell back to mainnet, so on any
 * other chain every v4 column said its pool could not be found. This holds
 * each read to the chain the page was asked about.
 */

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({ analyses: [] as unknown[][], v4Pairs: [] as unknown[][] }));

const TOKEN0 = { chainId: 137, address: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", symbol: "USDC", decimals: 6 };
const TOKEN1 = { chainId: 137, address: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", symbol: "USDT", decimals: 6 };
const V3 = "0x9b08288c3be4f62bbf8d1c20ac9c5e6f9467d8b7";
const V4 = [`0x${"a1".repeat(32)}`, `0x${"b2".repeat(32)}`];

vi.mock("@/lib/i18n/requestLocale", async () => {
  const { getDictionary } = await import("@/lib/i18n/dictionaries");
  return { getRequestDictionary: async () => ({ locale: "en", t: getDictionary("en") }) };
});
vi.mock("@/lib/advisor/requestRangePreferences", async () => {
  const { DEFAULT_PRICE_BAND_PARAMETERS } = await import("@/lib/advisor/poolRangeAnalysis");
  return { getRangePreferences: async () => ({ parameters: DEFAULT_PRICE_BAND_PARAMETERS, depositUsd: 1_000 }) };
});
vi.mock("@/components/WorkspaceShell", () => ({ WorkspaceShell: () => null }));
vi.mock("@/components/PoolComparison", () => ({ PoolComparison: () => null }));
vi.mock("@/lib/advisor/getPoolRangeAnalysis", () => ({
  getPoolRangeAnalysis: async (...args: unknown[]) => {
    state.analyses.push(args);
    return {
      status: "success",
      data: { pool: { protocolVersion: "v3", chainId: 137, id: V3, feePpm: 500, token0: TOKEN0, token1: TOKEN1 } },
    };
  },
}));
vi.mock("@/lib/uniswap/getEthereumV3PairFeeTiers", () => ({
  getEthereumV3PairFeeTiers: async () => ({ status: "success", data: { tiers: [] } }),
}));
vi.mock("@/lib/uniswap/getEthereumV4PairPools", () => ({
  getEthereumV4PairPools: async (...args: unknown[]) => {
    state.v4Pairs.push(args);
    return {
      status: "success",
      data: {
        analysedPoolId: null,
        pools: V4.map((id) => ({
          pool: {
            protocolVersion: "v4",
            chainId: 137,
            id,
            token0: TOKEN0,
            token1: TOKEN1,
            tickSpacing: 10,
            fee: { kind: "static", feePpm: 100 },
            protocolFee: null,
            hookAddress: null,
          },
        })),
      },
    };
  },
}));

import ComparePage from "./page";

describe("the comparison on a chain other than mainnet", () => {
  it("reads the pool, the v4 pair list and every v4 pool on that chain", async () => {
    await ComparePage({ searchParams: Promise.resolve({ chain: "polygon", address: V3 }) });

    expect(state.v4Pairs.map((args) => args[1])).toEqual([137]);
    expect(state.analyses.map(([protocol, id, , , , chainId]) => [protocol, id, chainId])).toEqual([
      ["v3", V3, 137],
      ["v4", V4[0], 137],
      ["v4", V4[1], 137],
    ]);
  });
});
