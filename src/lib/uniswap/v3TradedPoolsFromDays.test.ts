import { describe, expect, it } from "vitest";

import { TRADED_POOL_LIMIT } from "./ethereumV3TradedPools";
import { normalizeV3TradedPoolsFromDays } from "./v3TradedPoolsAdapter";

const FETCHED_AT = "2026-09-26T12:00:00.000Z";
const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const WETH = "0x4200000000000000000000000000000000000006";

const card = (index: number) => ({
  id: `0x${index.toString(16).padStart(40, "0")}`,
  feeTier: "500",
  totalValueLockedUSD: "1000",
  poolDayData: [{ date: 1_790_380_800 }],
  token0: { id: WETH, symbol: "WETH", name: "Wrapped Ether", decimals: "18", derivedETH: "1" },
  token1: { id: USDC, symbol: "USDC", name: "USD Coin", decimals: "6", derivedETH: "0.0004" },
});

const payload = (cards: unknown[], meta = { hasIndexingErrors: false }) => ({
  data: { poolDayDatas: cards.map((pool) => ({ date: 1, volumeUSD: "1", feesUSD: "0", pool })), _meta: meta },
});

describe("the candidate net from a week of days", () => {
  it("names each pool once, busiest first, on the chain the table was read on", () => {
    const result = normalizeV3TradedPoolsFromDays({ payload: payload([card(2), card(1), card(2)]), fetchedAt: FETCHED_AT, chainId: 8453 });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.pools.map(({ id }) => id)).toEqual([card(2).id, card(1).id]);
    expect(result.data.pools.every(({ chainId }) => chainId === 8453)).toBe(true);
  });

  it("casts no wider than the mainnet net", () => {
    const many = Array.from({ length: TRADED_POOL_LIMIT + 10 }, (_, index) => card(index + 1));
    const result = normalizeV3TradedPoolsFromDays({ payload: payload(many), fetchedAt: FETCHED_AT, chainId: 42161 });

    expect(result.status === "success" && result.data.pools).toHaveLength(TRADED_POOL_LIMIT);
  });

  it("says why when the table cannot be trusted", () => {
    expect(normalizeV3TradedPoolsFromDays({ payload: { nope: 1 }, fetchedAt: FETCHED_AT, chainId: 8453 })).toMatchObject({
      status: "unavailable",
      notice: "market-data-malformed",
    });
    expect(
      normalizeV3TradedPoolsFromDays({ payload: payload([card(1)], { hasIndexingErrors: true }), fetchedAt: FETCHED_AT, chainId: 8453 }),
    ).toMatchObject({ status: "unavailable", notice: "market-data-indexing-errors" });
    expect(
      normalizeV3TradedPoolsFromDays({ payload: { ...payload([card(1)]), errors: ["x"] }, fetchedAt: FETCHED_AT, chainId: 8453 }),
    ).toMatchObject({ status: "unavailable", notice: "market-data-malformed" });
  });
});
