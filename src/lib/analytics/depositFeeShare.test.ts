import { describe, expect, it } from "vitest";

import type { HistoricalPricePoint, PoolMarketSnapshot, TickRange } from "../../schemas";
import { calculateDepositFeeShare, usdPerToken1 } from "./depositFeeShare";

/*
 * The fixture is built so every answer can be worked out by hand.
 *
 * Token decimals of 6 and 18 put the scale factor at `10^((6+18)/2)` = 1e12,
 * and a price of 1e-12 makes the *raw* price exactly 1. The range is a quarter
 * of the price to four times it, so with `√P` = 1e-6:
 *
 *   2√P − √pa − P/√pb = 2e-6 − 5e-7 − 5e-7 = 1e-6
 *
 * One token1 of value therefore buys 1e6 of liquidity, and the pool is priced so
 * that one dollar is one token1. A one-dollar deposit is then exactly 1e18 of
 * liquidity — which is what ACTIVE_LIQUIDITY is set to, so the deposit and the
 * rest of the pool are equal and the deposit takes exactly half of every day.
 *
 * Nothing here is approximate, which is the point: a wrong power of ten in the
 * scale factor moves the share by six orders of magnitude and every expectation
 * below fails by a mile rather than by a rounding.
 */

const PRICE = 1e-12;
const ACTIVE_LIQUIDITY = "1000000000000000000";
const DAY_MS = 86_400_000;
const START = Date.parse("2026-08-01T00:00:00.000Z");

/** Only three fields are read from a range, and these are them. */
const range = (lowerPrice = PRICE / 4, upperPrice = PRICE * 4): TickRange =>
  ({ lowerPrice, upperPrice, band: { currentPrice: PRICE } }) as unknown as TickRange;

/** Priced so that one whole token1 is worth one dollar. */
const snapshot = (overrides: Partial<PoolMarketSnapshot> = {}): PoolMarketSnapshot =>
  ({
    token0PriceInToken1: PRICE,
    tvlUsd: 1_000,
    lockedToken0: 0,
    lockedToken1: 1_000,
    ...overrides,
  }) as unknown as PoolMarketSnapshot;

const day = (
  index: number,
  overrides: Partial<HistoricalPricePoint> = {},
): HistoricalPricePoint =>
  ({
    timestamp: new Date(START + index * DAY_MS).toISOString(),
    price: PRICE,
    low: PRICE / 2,
    high: PRICE * 2,
    volumeUsd: 200_000,
    feesUsd: 100,
    activeLiquidity: ACTIVE_LIQUIDITY,
    ...overrides,
  }) as HistoricalPricePoint;

const share = (
  points: readonly HistoricalPricePoint[],
  depositUsd = 1,
  overrides: Partial<PoolMarketSnapshot> = {},
) =>
  calculateDepositFeeShare({
    points,
    range: range(),
    snapshot: snapshot(overrides),
    token0Decimals: 6,
    token1Decimals: 18,
    depositUsd,
  });

const succeed = (...args: Parameters<typeof share>) => {
  const result = share(...args);
  if (result.status === "unavailable") throw new Error(`expected a figure: ${result.notice}`);
  return result.data;
};

describe("usdPerToken1", () => {
  /*
   * The cross-check that makes the whole conversion falsifiable. A pool holding
   * $6.25M of a dollar-stablecoin and the same value of a $3,000 token must
   * price token1 at $3,000 — and pricing token0 back through the pool's own rate
   * must return a dollar. It does that only if the direction of
   * `token0PriceInToken1` is the one this module assumes.
   */
  it("derives the token price the source's own figures imply", () => {
    const priceOfToken0InToken1 = 1 / 3_000;
    const rate = usdPerToken1(
      snapshot({
        token0PriceInToken1: priceOfToken0InToken1,
        tvlUsd: 12_500_000,
        lockedToken0: 6_250_000,
        lockedToken1: 6_250_000 * priceOfToken0InToken1,
      }),
    );

    expect(rate).toBeCloseTo(3_000, 6);
    expect((rate ?? 0) * priceOfToken0InToken1).toBeCloseTo(1, 9);
  });

  it.each([
    ["no TVL in dollars", { tvlUsd: null }],
    ["no token0 balance", { lockedToken0: null }],
    ["no token1 balance", { lockedToken1: null }],
    ["no price", { token0PriceInToken1: null }],
    ["a pool the source does not price", { tvlUsd: 0, lockedToken0: 0, lockedToken1: 0 }],
    ["a pool holding nothing", { lockedToken0: 0, lockedToken1: 0 }],
  ])("refuses to price %s", (_label, overrides) => {
    expect(usdPerToken1(snapshot(overrides as Partial<PoolMarketSnapshot>))).toBeNull();
  });
});

describe("calculateDepositFeeShare", () => {
  it("shares a day in the proportion the two liquidities stand in", () => {
    const result = succeed([day(0)]);

    expect(result.daysCounted).toBe(1);
    expect(result.poolFeesUsd).toBe(100);
    /* The deposit mints exactly what the pool already had, so it takes half. */
    expect(result.depositFeesUsd).toBeCloseTo(50, 9);
    expect(result.shareOfDeposit).toBeCloseTo(50, 9);
  });

  it("adds up over every day it counts", () => {
    const result = succeed([day(0), day(1), day(2)]);

    expect(result.daysCounted).toBe(3);
    expect(result.poolFeesUsd).toBe(300);
    expect(result.depositFeesUsd).toBeCloseTo(150, 9);
  });

  /*
   * The reason the interface offers sizes a thousandfold apart rather than
   * printing a rate per dollar.
   */
  it("does not pay a deposit ten times larger ten times as much", () => {
    const small = succeed([day(0)], 1);
    const large = succeed([day(0)], 10);

    expect(large.depositFeesUsd).toBeGreaterThan(small.depositFeesUsd);
    expect(large.depositFeesUsd).toBeLessThan(small.depositFeesUsd * 10);
    /* Ten units of liquidity against the pool's one: ten elevenths of the day. */
    expect(large.depositFeesUsd).toBeCloseTo((100 * 10) / 11, 9);
  });

  /*
   * The direction of the conversion, pinned on its own.
   *
   * Every fixture above prices one token1 at one dollar, which is convenient and
   * makes multiplying by the rate and dividing by it the same operation. Here
   * token1 is worth two dollars, so a dollar buys half as much of it — and half
   * the liquidity, and a third of the day rather than a half.
   */
  it("buys less liquidity in a pool whose token is worth more", () => {
    const dearer = succeed([day(0)], 1, { tvlUsd: 2_000 });

    expect(dearer.depositFeesUsd).toBeCloseTo(100 / 3, 9);
  });

  /*
   * The scale factor, pinned on its own. Moving token0 from six decimals to
   * eighteen multiplies the liquidity a dollar buys by `10^((18-6)/2)` = 1e6,
   * and nothing else about the pool changes.
   */
  it("sizes the deposit in the protocol's units, decimals included", () => {
    const result = calculateDepositFeeShare({
      points: [day(0)],
      range: range(),
      snapshot: snapshot(),
      token0Decimals: 18,
      token1Decimals: 18,
      depositUsd: 1,
    });
    if (result.status === "unavailable") throw new Error(result.notice);

    expect(result.data.depositFeesUsd).toBeCloseTo((100 * 1e6) / (1 + 1e6), 6);
  });

  it("counts only the days the price never left the range", () => {
    const result = succeed([
      day(0),
      /* Entirely below the range. */
      day(1, { price: PRICE / 8, low: PRICE / 9, high: PRICE / 7 }),
      /* Straddling the upper edge: part of the day was outside it. */
      day(2, { price: PRICE * 3, low: PRICE * 2, high: PRICE * 5 }),
    ]);

    expect(result.daysCounted).toBe(1);
    expect(result.daysUnmeasurable).toBe(0);
    expect(result.poolFeesUsd).toBe(100);
  });

  it.each([
    ["published no fees", { feesUsd: null }],
    ["published no liquidity", { activeLiquidity: null }],
    ["reported no liquidity active at all", { activeLiquidity: "0" }],
  ])("counts a day inside the range that %s as unmeasurable", (_label, overrides) => {
    const result = succeed([day(0), day(1, overrides as Partial<HistoricalPricePoint>)]);

    expect(result.daysCounted).toBe(1);
    expect(result.daysUnmeasurable).toBe(1);
    expect(result.poolFeesUsd).toBe(100);
  });

  it("reports absence rather than nothing when no day can be shared out", () => {
    const outside = day(0, { price: PRICE / 8, low: PRICE / 9, high: PRICE / 7 });

    expect(share([outside])).toEqual({
      status: "unavailable",
      notice: "deposit-share-no-days",
    });
  });

  it("refuses a pool whose holdings the source does not price", () => {
    expect(share([day(0)], 1, { tvlUsd: null })).toEqual({
      status: "unavailable",
      notice: "deposit-share-unpriceable",
    });
  });

  /*
   * The case the guard on the rate exists for: a pool of tokens the source does
   * not price publishes real balances and zero dollars.
   */
  it("refuses a pool the source reports balances but no value for", () => {
    expect(share([day(0)], 1, { tvlUsd: 0 })).toEqual({
      status: "unavailable",
      notice: "deposit-share-unpriceable",
    });
  });

  /*
   * Unreachable through this application's pipeline — a `TickRange` is refused
   * by its own schema unless it contains the price it was drawn around — and
   * checked because this function is callable without one.
   */
  it("refuses a range the current price does not sit inside", () => {
    const result = calculateDepositFeeShare({
      points: [day(0)],
      range: range(PRICE * 2, PRICE * 4),
      snapshot: snapshot(),
      token0Decimals: 6,
      token1Decimals: 18,
      depositUsd: 1,
    });

    expect(result).toEqual({ status: "unavailable", notice: "deposit-share-unpriceable" });
  });

  /* The schema is the last authority, and it bounds the size it will publish. */
  it("publishes nothing for a deposit larger than the schema accepts", () => {
    expect(share([day(0)], 2_000_000_000)).toEqual({
      status: "unavailable",
      notice: "deposit-share-unverifiable",
    });
  });
});
