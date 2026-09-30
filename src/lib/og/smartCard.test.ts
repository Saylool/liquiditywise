import { describe, expect, it } from "vitest";

import type { SmartPair } from "../analytics/smartLiquidity";
import type { SmartLiquidityRead } from "../advisor/readSmartLiquidity";
import type { V3PoolMetadata } from "../../schemas";
import { smartCardPath, smartCardText } from "./smartCard";

const pool = (symbols: [string, string]): V3PoolMetadata => ({
  protocolVersion: "v3",
  chainId: 1,
  id: `0x${"1".repeat(40)}`,
  feePpm: 500,
  token0: { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: symbols[0], decimals: 6 },
  token1: { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: symbols[1], decimals: 18 },
});

const pair = (symbols: [string, string], currentPrice: number): SmartPair => ({
  pool: pool(symbols),
  positions: 4,
  valueUsd: 1,
  medianLowerRatio: 0.95,
  medianUpperRatio: 1.02,
  medianYearlyYield: 0.3,
  currentPrice,
});

const measured = (pairs: readonly SmartPair[], smartFrom: number | null = 0.2152): SmartLiquidityRead => ({
  status: "measured",
  poolsAsked: 12,
  poolsRead: 12,
  measuredAt: "t",
  data: { measured: 683, medianYearlyYield: 0.09, smartFrom, smart: new Array(137).fill(null), pairs },
});

describe("a smart-money card's text", () => {
  it("names the pair with the most smart money, its range around the price, and how many earn how much", () => {
    const text = smartCardText(measured([pair(["USDC", "WETH"], 0.0004), pair(["WBTC", "USDT"], 1e-4)]));

    expect(text).toEqual({
      pair: "USDC / WETH · 0.05%",
      /* Quoted WETH in USDC, so the edges invert and swap: 1/1.02 - 1 and 1/0.95 - 1. */
      range: "-1.96% to +5.26% around the price",
      summary: "137 of 683 positions earn at least 21.52% a year in fees",
    });
  });

  it("writes a pair already quoted token0 in token1 as it stands", () => {
    expect(smartCardText(measured([pair(["WETH", "USDC"], 2500)]))?.range).toBe("-5.00% to +2.00% around the price");
  });

  it("is nothing when there is no measurement, it failed, or it found nowhere the smart liquidity sits", () => {
    expect(smartCardText(null)).toBeNull();
    expect(smartCardText({ status: "unavailable", notice: "market-data-timed-out" })).toBeNull();
    expect(smartCardText(measured([]))).toBeNull();
    expect(smartCardText(measured([pair(["USDC", "WETH"], 0.0004)], null))).toBeNull();
  });
});

describe("where the card is drawn", () => {
  it("says nothing of the chain on mainnet, and names it elsewhere", () => {
    expect(smartCardPath("ethereum")).toBe("/og/smart");
    expect(smartCardPath("polygon")).toBe("/og/smart?chain=polygon");
  });
});
