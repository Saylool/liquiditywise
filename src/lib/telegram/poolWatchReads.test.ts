import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { PoolEmbedFigures } from "../embed/poolEmbed";
import { readingFromFigures } from "./poolWatchReads";

/*
 * The card quotes USDC/WETH as USDC per WETH — 2,000 to 3,333 — because WETH
 * is the dearer token; the pool's own prices are WETH per USDC, 0.0003 to
 * 0.0005, and that is what the bot keeps and compares.
 */
const figures = (overrides: Partial<PoolEmbedFigures> = {}): PoolEmbedFigures => ({
  protocol: "v3",
  chain: { id: 1, slug: "ethereum", name: "Ethereum" },
  pool: `0x${"c".repeat(40)}`,
  pair: { token0: "USDC", token1: "WETH" },
  lpFeePpm: 500,
  price: { base: "WETH", quote: "USDC", current: 2500 },
  range: { lower: 2000, upper: 1 / 0.0003, currentInRange: true, lowerTruncated: false, upperTruncated: false },
  parameters: { horizonDays: 30, standardDeviationMultiplier: 1 },
  hookMayAlterSwaps: false,
  analysedAt: "2026-10-07T12:00:00.000Z",
  poolUrl: "https://liquiditywise.com/pool?address=0x",
  ...overrides,
});

const target = { protocol: "v3" as const, chainId: 1 as const, poolId: `0x${"c".repeat(40)}` };

describe("a watched pool read through the card", () => {
  it("turns the card's quoted figures back into the pool's own direction, lower edge first", () => {
    const reading = readingFromFigures(figures(), target);

    expect(reading.range[0]).toBeCloseTo(0.0003, 10);
    expect(reading.range[1]).toBeCloseTo(0.0005, 10);
    expect(reading.currentPrice).toBeCloseTo(1 / 2500, 10);
    expect(reading).toMatchObject({ protocol: "v3", chainId: 1, poolId: target.poolId, pair: { token0: "USDC", token1: "WETH" }, lpFeePpm: 500 });
  });

  it("leaves figures the card did not turn as they are", () => {
    const reading = readingFromFigures(
      figures({ pair: { token0: "WETH", token1: "USDT" }, price: { base: "WETH", quote: "USDT", current: 3000 }, range: { ...figures().range, lower: 2800, upper: 3200 } }),
      target,
    );

    expect(reading.range).toEqual([2800, 3200]);
    expect(reading.currentPrice).toBe(3000);
  });

  it("carries a hook-set fee as none, for the message to name as the page does", () => {
    expect(readingFromFigures(figures({ lpFeePpm: null }), { ...target, protocol: "v4" }).lpFeePpm).toBeNull();
  });
});
