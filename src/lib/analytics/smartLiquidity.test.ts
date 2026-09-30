import { describe, expect, it } from "vitest";

import type { V3PoolMetadata } from "../../schemas";
import type { PositionEarnings } from "../uniswap/ethereumV3PositionEarnings";
import {
  choosePositions,
  composeSmartLiquidity,
  MAX_POSITIONS_PER_POOL,
  measurePositions,
  MIN_POSITION_USD,
  MIN_WINDOW_DAYS,
  type PoolReading,
  positionValueUsd,
} from "./smartLiquidity";

const NOW = 1_790_000_000;
const DAY = 86_400;

const poolOf = (id: string, symbols: [string, string] = ["USDC", "WETH"]): V3PoolMetadata => ({
  protocolVersion: "v3",
  chainId: 1,
  id,
  feePpm: 500,
  token0: { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: symbols[0], decimals: 6 },
  token1: { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: symbols[1], decimals: 18 },
});

const POOL = poolOf(`0x${"1".repeat(40)}`);
/** About 2,500 USDC per WETH, as USDC/WETH's own tick has it. */
const TICK = 198_080;
const USD0 = 1;
const USD1 = 1 / (1.0001 ** TICK * 1e-12);

/** The position formulas written out here, independently of the module's, to check it against. */
const expectedValue = (liquidity: number, lower: number, upper: number): number => {
  const s = Math.sqrt(1.0001 ** TICK);
  const a = Math.sqrt(1.0001 ** lower);
  const b = Math.sqrt(1.0001 ** upper);
  return ((liquidity * (b - s)) / (s * b) / 1e6) * USD0 + ((liquidity * (s - a)) / 1e18) * USD1;
};

const earning = (tokenId: string, overrides: Partial<PositionEarnings> = {}): PositionEarnings => ({
  tokenId,
  owner: `0x${"c".repeat(40)}`,
  liquidity: "10000000000000000",
  tickLower: TICK - 600,
  tickUpper: TICK + 600,
  fees0: "10000000",
  fees1: "4000000000000000",
  ...overrides,
});

const reading = (
  positions: readonly PositionEarnings[],
  daysAgo: number | Readonly<Record<string, number>> = 10,
  pool: V3PoolMetadata = POOL,
): PoolReading => ({
  pool,
  usdPerToken0: USD0,
  usdPerToken1: USD1,
  earnings: { tick: TICK, positions },
  lastChanges: new Map(
    positions.map(({ tokenId }) => [tokenId, NOW - (typeof daysAgo === "number" ? daysAgo : (daysAgo[tokenId] ?? 10)) * DAY]),
  ),
});

describe("a position's worth", () => {
  it("is its two amounts at the pool's price, in dollars", () => {
    const value = positionValueUsd(POOL, USD0, USD1, TICK, earning("1"));

    expect(value).toBeCloseTo(expectedValue(1e16, TICK - 600, TICK + 600), 6);
    expect(value).toBeGreaterThan(MIN_POSITION_USD);
  });
});

describe("measuring one pool", () => {
  it("reads a position's yield as its fees since the last change, against its worth, per year", () => {
    const [measured] = measurePositions(reading([earning("1")]), NOW);
    const value = expectedValue(1e16, TICK - 600, TICK + 600);
    const fees = 10 * USD0 + 0.004 * USD1;

    expect(measured?.valueUsd).toBeCloseTo(value, 6);
    expect(measured?.feesUsd).toBeCloseTo(fees, 9);
    expect(measured?.days).toBe(10);
    expect(measured?.yearlyYield).toBeCloseTo((fees / value / 10) * 365, 12);
  });

  it("gives the range and the price in token0 in token1, the direction every price is computed in", () => {
    const [measured] = measurePositions(reading([earning("1")]), NOW);

    expect(measured?.currentPrice).toBeCloseTo(1.0001 ** TICK * 1e-12, 15);
    expect(measured?.lowerPrice).toBeCloseTo(1.0001 ** (TICK - 600) * 1e-12, 15);
    expect(measured?.upperPrice).toBeCloseTo(1.0001 ** (TICK + 600) * 1e-12, 15);
  });

  it("leaves out a position too small, too recently changed, or never dated", () => {
    const small = earning("small", { liquidity: "1000000000" });
    const recent = earning("recent");
    const undated = earning("undated");
    const kept = earning("kept");
    const pool = reading([small, recent, kept], { recent: MIN_WINDOW_DAYS - 0.01, kept: MIN_WINDOW_DAYS });
    const withUndated = { ...pool, earnings: { ...pool.earnings, positions: [...pool.earnings.positions, undated] } };

    expect(measurePositions(withUndated, NOW).map(({ tokenId }) => tokenId)).toEqual(["kept"]);
  });

  it("measures nothing in a pool whose tokens the source could not price", () => {
    expect(measurePositions({ ...reading([earning("1")]), usdPerToken1: null }, NOW)).toEqual([]);
    expect(measurePositions({ ...reading([earning("1")]), usdPerToken0: null }, NOW)).toEqual([]);
  });
});

describe("choosing which positions to ask the chain about", () => {
  it("takes the largest first, none under the floor, and at most the per-pool limit", () => {
    const listed = [
      { tokenId: "tiny", liquidity: "1000000000", tickLower: TICK - 600, tickUpper: TICK + 600 },
      ...Array.from({ length: MAX_POSITIONS_PER_POOL + 5 }, (_unused, index) => ({
        tokenId: String(index),
        liquidity: String((index + 1) * 1e16),
        tickLower: TICK - 600,
        tickUpper: TICK + 600,
      })),
    ];
    const chosen = choosePositions(POOL, USD0, USD1, TICK, listed);

    expect(chosen).toHaveLength(MAX_POSITIONS_PER_POOL);
    expect(chosen[0]?.tokenId).toBe(String(MAX_POSITIONS_PER_POOL + 4));
    expect(chosen.map(({ tokenId }) => tokenId)).not.toContain("tiny");
    expect(choosePositions(POOL, null, USD1, TICK, listed)).toEqual([]);
    expect(choosePositions(POOL, USD0, null, TICK, listed)).toEqual([]);
  });

  it("leaves out a position under the floor even when there is room for it", () => {
    const few = [
      { tokenId: "tiny", liquidity: "1000000000", tickLower: TICK - 600, tickUpper: TICK + 600 },
      { tokenId: "big", liquidity: "10000000000000000", tickLower: TICK - 600, tickUpper: TICK + 600 },
    ];

    expect(choosePositions(POOL, USD0, USD1, TICK, few).map(({ tokenId }) => tokenId)).toEqual(["big"]);
  });
});

describe("the smart fifth", () => {
  /* Ten positions whose yields rise with their number: fees grow, worth stays. */
  const ranked = Array.from({ length: 10 }, (_unused, index) =>
    earning(String(index + 1), { fees0: String((index + 1) * 10_000_000), fees1: "0" }),
  );

  it("is the top fifth by yield, highest first, with the lowest yield that still counts", () => {
    const result = composeSmartLiquidity([reading(ranked)], NOW);

    expect(result.measured).toBe(10);
    expect(result.smart.map(({ tokenId }) => tokenId)).toEqual(["10", "9"]);
    expect(result.smartFrom).toBe(result.smart[1]?.yearlyYield);
  });

  it("gives the median yield of everything measured", () => {
    const result = composeSmartLiquidity([reading(ranked)], NOW);
    const yields = measurePositions(reading(ranked), NOW)
      .map(({ yearlyYield }) => yearlyYield)
      .sort((a, b) => a - b);

    expect(result.medianYearlyYield).toBeCloseTo(((yields[4] as number) + (yields[5] as number)) / 2, 12);
  });

  it("groups the smart positions by pool, most money first, with their median range and yield", () => {
    const other = poolOf(`0x${"2".repeat(40)}`, ["WBTC", "USDT"]);
    const inOther = [
      earning("big-a", { liquidity: "90000000000000000", fees0: "3000000000", fees1: "0", tickLower: TICK - 1200, tickUpper: TICK + 200 }),
      earning("big-b", { liquidity: "90000000000000000", fees0: "3000000000", fees1: "0", tickLower: TICK - 200, tickUpper: TICK + 1200 }),
      earning("big-c", { liquidity: "90000000000000000", fees0: "3000000000", fees1: "0", tickLower: TICK - 400, tickUpper: TICK + 400 }),
    ];
    const result = composeSmartLiquidity([reading(ranked), reading(inOther, 10, other)], NOW);

    /* Thirteen measured, so three are smart: all three of the other pool's, which earn the most for their size. */
    expect(result.smart.map(({ tokenId }) => tokenId).sort()).toEqual(["big-a", "big-b", "big-c"]);
    expect(result.pairs).toHaveLength(1);
    const [pair] = result.pairs;
    expect(pair?.pool.id).toBe(other.id);
    expect(pair?.positions).toBe(3);
    expect(pair?.valueUsd).toBeCloseTo(result.smart.reduce((sum, { valueUsd }) => sum + valueUsd, 0), 6);
    expect(pair?.medianLowerRatio).toBeCloseTo(1.0001 ** -400, 12);
    expect(pair?.medianUpperRatio).toBeCloseTo(1.0001 ** 400, 12);
  });

  it("orders the pairs by the smart money in them", () => {
    const other = poolOf(`0x${"2".repeat(40)}`, ["WBTC", "USDT"]);
    const small = [earning("s1", { fees0: "90000000000", fees1: "0" })];
    const large = [earning("l1", { liquidity: "50000000000000000", fees0: "450000000000", fees1: "0" })];
    const result = composeSmartLiquidity([reading([...ranked, ...small]), reading(large, 10, other)], NOW);

    expect(result.pairs.map(({ pool }) => pool.id)).toEqual([other.id, POOL.id]);
  });

  it("is empty, with no figures, when nothing could be measured", () => {
    expect(composeSmartLiquidity([], NOW)).toEqual({
      measured: 0,
      medianYearlyYield: null,
      smartFrom: null,
      smart: [],
      pairs: [],
    });
  });
});
