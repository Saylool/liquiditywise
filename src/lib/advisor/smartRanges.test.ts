import { describe, expect, it } from "vitest";

import type { V3PoolMetadata } from "../../schemas";
import type { SmartPair } from "../analytics/smartLiquidity";
import type { SmartLiquidityRead } from "./readSmartLiquidity";
import { smartRangeKey, smartRangesByPool } from "./smartRanges";

const pool = (chainId: number, id: string): V3PoolMetadata => ({
  protocolVersion: "v3",
  chainId,
  id,
  feePpm: 500,
  token0: { chainId, address: `0x${"a".repeat(40)}`, symbol: "USDC", decimals: 6 },
  token1: { chainId, address: `0x${"b".repeat(40)}`, symbol: "WETH", decimals: 18 },
});

const measured = (pairs: readonly SmartPair[]): SmartLiquidityRead => ({
  status: "measured",
  poolsAsked: 12,
  poolsRead: 12,
  measuredAt: "t",
  data: { measured: 10, medianYearlyYield: 0.1, smartFrom: 0.2, smart: [], pairs },
});

describe("the smart range of each pool", () => {
  it("is the pair's median edges and count, keyed by chain and lower-cased address", () => {
    const ranges = smartRangesByPool(
      measured([
        { pool: pool(137, "0xABCD"), positions: 4, valueUsd: 1, medianLowerRatio: 0.9, medianUpperRatio: 1.1, medianLowerPrice: 0.9, medianUpperPrice: 1.1, medianYearlyYield: 0.3, currentPrice: 1 },
      ]),
    );

    expect(ranges.get(smartRangeKey(137, "0xabcd"))).toEqual({ lowerRatio: 0.9, upperRatio: 1.1, positions: 4 });
    expect(ranges.get(smartRangeKey(1, "0xabcd"))).toBeUndefined();
    expect(ranges.size).toBe(1);
  });

  it("is empty when nothing was measured, or the read failed", () => {
    expect(smartRangesByPool(null).size).toBe(0);
    expect(smartRangesByPool({ status: "unavailable", notice: "market-data-timed-out" }).size).toBe(0);
    expect(smartRangesByPool(measured([])).size).toBe(0);
  });
});
