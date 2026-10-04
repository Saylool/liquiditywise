import { describe, expect, it } from "vitest";

import type { Pool, PoolDailyPriceHistory, PoolMarketSnapshot } from "../../schemas";
import { amountsAt, valueInToken1 } from "./divergenceLoss";
import { calculateRangeBacktest, type RangeBacktest } from "./rangeBacktest";
import { liquidityPerUnitValue } from "./rangeConcentration";
import type { RealizedFeeRateResult } from "./realizedFeeRate";
import {
  calculateRecentringReplay,
  rebalanceInto,
  recentreSwapFee,
  type RecentreSwapFee,
} from "./recentringReplay";

const DAY_MS = 86_400_000;
const END = Date.parse("2026-09-27T00:00:00.000Z");
const POOL = { protocolVersion: "v3", chainId: 1, id: `0x${"d".repeat(40)}` };
/** The last close before the thirty days replayed: where both strategies open. */
const OPENED_AT = new Date(END - 31 * DAY_MS).toISOString();
const day = (before: number) => new Date(END - before * DAY_MS).toISOString();

type Day = { price: number; low?: number | null; high?: number | null; fees?: number | null; active?: string | null };

/** `count` days ending the day before END, oldest first; `dayAt(i)` draws day i counted back from the last. */
const history = (count: number, dayAt: (daysBeforeEnd: number) => Day): PoolDailyPriceHistory =>
  ({
    pool: POOL,
    fetchedAt: "2026-09-27T09:00:00.000Z",
    sourceBlockNumber: "21500000",
    sourceBlockTimestamp: "2026-09-27T08:59:48.000Z",
    rangeStart: new Date(END - count * DAY_MS).toISOString(),
    rangeEndExclusive: new Date(END).toISOString(),
    interval: "1d",
    priceDirection: "token0PriceInToken1",
    points: Array.from({ length: count }, (_, index) => {
      const before = count - index;
      const point = dayAt(before);
      return {
        timestamp: day(before),
        price: point.price,
        low: point.low === undefined ? point.price * 0.999 : point.low,
        high: point.high === undefined ? point.price * 1.001 : point.high,
        volumeUsd: null,
        feesUsd: point.fees ?? null,
        activeLiquidity: point.active === undefined ? "1000000000000000000" : point.active,
      };
    }),
    source: "uniswap-v3-subgraph",
  }) as PoolDailyPriceHistory;

/**
 * Thirty-one closes at 100 before the window, then the window's thirty: the
 * days given, oldest first, the last of them repeated to fill it.
 */
const month = (window: readonly Day[]) =>
  history(61, (before) => (before > 30 ? { price: 100 } : (window[30 - before] ?? window.at(-1)!)));

/** A pool worth $2 per token1: tvl 2,000 over 500 token1 plus 5 token0 at 100. */
const snapshot = (tvlUsd: number | null = 2_000) =>
  ({ tvlUsd, lockedToken0: 5, lockedToken1: 500, token0PriceInToken1: 100 }) as unknown as PoolMarketSnapshot;

/**
 * The month never re-centred, written by hand so the range is a round one:
 * 80 to 125 around 100, which is symmetric in logarithms (×0.8, ×1.25).
 */
const suggested = (overrides: Partial<RangeBacktest> = {}): RangeBacktest => ({
  openedAt: OPENED_AT,
  openingPrice: 100,
  lowerPrice: 80,
  upperPrice: 125,
  days: [],
  inside: 0,
  outside: 0,
  crossed: 0,
  endValueVsHold: 0.98,
  fees: { usd: 7, ofDeposit: 0.007, daysCounted: 3, daysUnmeasurable: 0 },
  ...overrides,
});

const FEE: RecentreSwapFee = { zeroForOnePpm: 3000, oneForZeroPpm: 3000, basis: "stated" };

const replay = (
  days: PoolDailyPriceHistory,
  {
    from = suggested(),
    fee = FEE,
    gas = 0,
    tvlUsd = 2_000 as number | null,
  }: { from?: RangeBacktest; fee?: RecentreSwapFee; gas?: number; tvlUsd?: number | null } = {},
) =>
  calculateRecentringReplay({
    history: days,
    snapshot: snapshot(tvlUsd),
    suggested: from,
    swapFee: fee,
    depositUsd: 1_000,
    gasUsdPerRecentre: gas,
    token0Decimals: 18,
    token1Decimals: 18,
  });

const valueAt = (amounts: { amount0: number; amount1: number }, price: number) => valueInToken1(amounts, price);
const unitAmounts = (price: number, lower: number, upper: number) => amountsAt(price, Math.sqrt(lower), Math.sqrt(upper));

describe("the swap that fills a re-centred range", () => {
  /* 80 to 125 around 100: symmetric in logs, so it holds equal worth of each token at 100. */
  const RANGE = { lowerPrice: 80, upperPrice: 125 };
  const target = unitAmounts(100, 80, 125);
  const mixOf = (amounts: { amount0: number; amount1: number }) => amounts.amount0 / amounts.amount1;

  it("sells part of an all-token0 holding, at the pool's fee on what goes in", () => {
    const swap = rebalanceInto({ amount0: 2, amount1: 0 }, 100, RANGE, FEE);

    expect(swap.sold).toBe("token0");
    expect(swap.amountIn).toBeCloseTo(2 / (2 - 0.003), 12);
    expect(swap.valueIn).toBeCloseTo(swap.amountIn * 100, 12);
    expect(swap.fee).toBeCloseTo(0.003 * swap.amountIn * 100, 12);
    expect(swap.amount0).toBeCloseTo(2 - swap.amountIn, 12);
    expect(swap.amount1).toBeCloseTo(0.997 * swap.amountIn * 100, 12);
    /* What is left is exactly the range's mix, and worth the holding less the fee. */
    expect(mixOf(swap)).toBeCloseTo(mixOf(target), 12);
    expect(valueAt(swap, 100)).toBeCloseTo(200 - swap.fee, 10);
  });

  it("sells part of an all-token1 holding the other way, at the fee for that direction", () => {
    const swap = rebalanceInto({ amount0: 0, amount1: 200 }, 100, RANGE, { zeroForOnePpm: 3000, oneForZeroPpm: 10_000 });

    expect(swap.sold).toBe("token1");
    expect(swap.amountIn).toBeCloseTo(200 / (2 - 0.01), 10);
    expect(swap.valueIn).toBe(swap.amountIn);
    expect(swap.fee).toBeCloseTo(0.01 * swap.amountIn, 12);
    expect(swap.amount1).toBeCloseTo(200 - swap.amountIn, 10);
    expect(swap.amount0).toBeCloseTo((0.99 * swap.amountIn) / 100, 12);
    expect(mixOf(swap)).toBeCloseTo(mixOf(target), 12);
    expect(valueAt(swap, 100)).toBeCloseTo(200 - swap.fee, 10);
  });

  it("swaps exactly half of a one-sided holding into a range centred on the price, when nothing is charged", () => {
    const free = { zeroForOnePpm: 0, oneForZeroPpm: 0 };

    expect(rebalanceInto({ amount0: 2, amount1: 0 }, 100, RANGE, free).valueIn).toBeCloseTo(100, 10);
    expect(rebalanceInto({ amount0: 0, amount1: 200 }, 100, RANGE, free).valueIn).toBeCloseTo(100, 10);
  });

  it("sells only the surplus from a holding of both tokens, whichever is in surplus", () => {
    /* 1 token0 (worth 100) beside 20 token1: 40 of worth too much token0. */
    const heavy0 = rebalanceInto({ amount0: 1, amount1: 20 }, 100, RANGE, FEE);
    expect(heavy0.sold).toBe("token0");
    expect(heavy0.amountIn).toBeCloseTo((1 * target.amount1 - 20 * target.amount0) / (target.amount1 + 0.997 * 100 * target.amount0), 12);
    expect(heavy0.valueIn).toBeCloseTo(80 / 1.997, 10);
    expect(mixOf(heavy0)).toBeCloseTo(mixOf(target), 12);
    expect(valueAt(heavy0, 100)).toBeCloseTo(120 - heavy0.fee, 10);

    /* 0.1 token0 (worth 10) beside 90 token1: the other way. */
    const heavy1 = rebalanceInto({ amount0: 0.1, amount1: 90 }, 100, RANGE, FEE);
    expect(heavy1.sold).toBe("token1");
    expect(heavy1.valueIn).toBeCloseTo(80 / 1.997, 10);
    expect(mixOf(heavy1)).toBeCloseTo(mixOf(target), 12);
    expect(valueAt(heavy1, 100)).toBeCloseTo(100 - heavy1.fee, 10);
  });

  it("swaps nothing, and pays nothing, for a holding already in the range's mix", () => {
    const swap = rebalanceInto({ amount0: target.amount0 * 7, amount1: target.amount1 * 7 }, 100, RANGE, FEE);

    expect(swap).toEqual({ sold: null, amountIn: 0, valueIn: 0, fee: 0, amount0: target.amount0 * 7, amount1: target.amount1 * 7 });
  });
});

describe("re-centring when the price leaves", () => {
  it("opens where the month never re-centred opens, in its range", () => {
    const result = replay(month([{ price: 100 }]))!;

    expect(result.openedAt).toBe(OPENED_AT);
    expect(result.openingPrice).toBe(100);
    expect([result.lowerPrice, result.upperPrice]).toEqual([80, 125]);
    expect(result.days).toHaveLength(30);
    expect(result.days[0]?.timestamp).toBe(day(30));
  });

  it("does not re-centre on a close exactly on the lower edge, and does just below it", () => {
    const onEdge = replay(month([{ price: 100 }, { price: 80 }, { price: 80 }]))!;
    expect(onEdge.recentres).toHaveLength(0);

    const below = replay(month([{ price: 100 }, { price: 79.9 }, { price: 79.9 }]))!;
    expect(below.recentres).toHaveLength(1);
    expect(below.recentres[0]).toMatchObject({ timestamp: day(29), price: 79.9, sold: "token0" });
    expect(below.recentres[0]?.lowerPrice).toBeCloseTo(79.9 * 0.8, 10);
    expect(below.recentres[0]?.upperPrice).toBeCloseTo(79.9 * 1.25, 10);
    expect(below.days[1]).toMatchObject({ recentred: true, lowerPrice: 80, upperPrice: 125 });
    /* The day after holds the new range, centred on that close. */
    expect(below.days[2]?.lowerPrice).toBeCloseTo(79.9 * 0.8, 10);
  });

  it("does not re-centre on a close exactly on the upper edge, and does just above it", () => {
    expect(replay(month([{ price: 100 }, { price: 125 }]))!.recentres).toHaveLength(0);

    const above = replay(month([{ price: 100 }, { price: 125.1 }]))!;
    expect(above.recentres).toHaveLength(1);
    expect(above.recentres[0]).toMatchObject({ timestamp: day(29), price: 125.1, sold: "token1" });
    expect(above.recentres[0]?.upperPrice).toBeCloseTo(125.1 * 1.25, 10);
  });

  /* What daily closes cannot see: a day that left the range and came back is not a re-centre. */
  it("reads only the close: a day that left and came back is not a re-centre", () => {
    const result = replay(month([{ price: 100, low: 50, high: 200 }, { price: 100 }]))!;

    expect(result.recentres).toHaveLength(0);
    expect(result.days[0]?.placement).toBe("undetermined");
  });

  it("re-centres only once for a price that stays where it went", () => {
    const result = replay(month([{ price: 100 }, { price: 70 }]))!;

    expect(result.recentres).toHaveLength(1);
    expect(result.inside).toBe(29);
    expect(result.outside).toBe(1);
  });

  it("keeps the books across several re-centres: each sale's fee comes out of the position", () => {
    const f = 0.003;
    /* 100, then 70 (below 80: re-centre into 56–87.5), then 100 (above 87.5: back into 80–125). */
    const result = replay(month([{ price: 100 }, { price: 70 }, { price: 70 }, { price: 100 }]))!;

    const opened = 1 / valueAt(unitAmounts(100, 80, 125), 100);
    /* At 70 the position is all token0; centred, half its worth is sold, and the fee leaves 2(1 − f)/(2 − f) of it. */
    const atSeventy = valueAt(unitAmounts(70, 80, 125), 70) * opened;
    const afterFirst = atSeventy * ((2 * (1 - f)) / (2 - f));
    const second = afterFirst / valueAt(unitAmounts(70, 56, 87.5), 70);
    const atHundred = valueAt(unitAmounts(100, 56, 87.5), 100) * second;
    const afterSecond = atHundred * ((2 * (1 - f)) / (2 - f));

    expect(result.recentres.map(({ timestamp, sold }) => [timestamp, sold])).toEqual([
      [day(29), "token0"],
      [day(27), "token1"],
    ]);
    expect(result.recentres[0]?.swappedOfDeposit).toBeCloseTo(atSeventy / (2 - f), 12);
    expect(result.recentres[0]?.swapFeeOfDeposit).toBeCloseTo((f * atSeventy) / (2 - f), 12);
    expect(result.recentres[0]?.swappedUsd).toBeCloseTo((1_000 * atSeventy) / (2 - f), 9);
    expect(result.recentres[0]?.swapFeeUsd).toBeCloseTo((1_000 * f * atSeventy) / (2 - f), 9);
    expect(result.recentres[1]?.swapFeeOfDeposit).toBeCloseTo((f * atHundred) / (2 - f), 12);
    expect(result.swapFees.ofDeposit).toBeCloseTo((f * (atSeventy + atHundred)) / (2 - f), 12);
    expect(result.swapFees.usd).toBeCloseTo((1_000 * f * (atSeventy + atHundred)) / (2 - f), 9);

    /* Holding is worth exactly the deposit at 100, so the worth against holding is the position's worth. */
    expect(result.days[1]?.valueVsHold).toBeCloseTo(afterFirst / (valueAt(unitAmounts(100, 80, 125), 70) * opened), 12);
    expect(result.endValueVsHold).toBeCloseTo(afterSecond, 12);
    expect(result.heldUsd).toBeCloseTo(1_000, 9);
    expect(result.endValueVsHold).toBeLessThan(1);
  });

  it("charges each sale the fee for its own direction", () => {
    const days = month([{ price: 100 }, { price: 70 }, { price: 70 }, { price: 100 }]);
    const sellingToken1Only = replay(days, { fee: { zeroForOnePpm: 0, oneForZeroPpm: 10_000, basis: "stated" } })!;

    expect(sellingToken1Only.recentres[0]?.swapFeeOfDeposit).toBe(0);
    expect(sellingToken1Only.recentres[1]?.swapFeeOfDeposit).toBeGreaterThan(0);
  });

  it("values holding at the last close against the opening, in dollars of the deposit", () => {
    const result = replay(month([{ price: 100 }, { price: 70 }]))!;
    const started = unitAmounts(100, 80, 125);

    expect(result.heldUsd).toBeCloseTo((1_000 * valueAt(started, 70)) / valueAt(started, 100), 9);
  });
});

describe("the fees it would have taken, day by day", () => {
  /* At $2 per token1 and 18 decimals each, a $1,000 deposit is 500 token1 of worth, times 1e18 in the protocol's units. */
  const share = (fees: number, perUnit: number) => {
    const liquidity = 500 * 1e18 * perUnit;
    return fees * (liquidity / (1e18 + liquidity));
  };

  it("shares each wholly-inside day out for the range held that day, and none on the day it re-centres", () => {
    const f = 0.003;
    const result = replay(
      month([
        { price: 100, fees: 50 },
        /* Outside the range held, and inside the one it is re-centred into: it must not count. */
        { price: 70, fees: 50 },
        { price: 70, fees: 50 },
      ]),
    )!;
    const opened = liquidityPerUnitValue({ lowerPrice: 80, upperPrice: 125 }, 100)!;
    const worthAfter = valueAt(unitAmounts(70, 80, 125), 70) * opened * ((2 * (1 - f)) / (2 - f));
    const second = worthAfter * liquidityPerUnitValue({ lowerPrice: 56, upperPrice: 87.5 }, 70)!;

    expect(result.days[0]?.feesUsd).toBeCloseTo(share(50, opened), 9);
    expect(result.days[1]).toMatchObject({ recentred: true, placement: "outside", feesUsd: null });
    expect(result.days[2]?.feesUsd).toBeCloseTo(share(50, second), 9);
    expect(result.fees?.daysCounted).toBe(29);
    expect(result.fees?.usd).toBeCloseTo(share(50, opened) + 28 * share(50, second), 8);
    expect(result.fees?.ofDeposit).toBeCloseTo((share(50, opened) + 28 * share(50, second)) / 1_000, 11);
  });

  /* A day that crossed an edge earned some of its fees in range and some out, and a high and low cannot say how much. */
  it("counts no fees for a day that crossed an edge and closed back inside, as the month never re-centred does not", () => {
    const result = replay(month([{ price: 100, fees: 50 }, { price: 100, low: 79, high: 101, fees: 50 }, { price: 100, fees: 50 }]))!;

    expect(result.recentres).toHaveLength(0);
    expect(result.days[1]).toMatchObject({ placement: "undetermined", feesUsd: null });
    expect(result.fees).toMatchObject({ daysCounted: 29, daysUnmeasurable: 0 });
  });

  it("counts apart the inside days whose fees or liquidity the source did not give", () => {
    const result = replay(month([{ price: 100, fees: null }, { price: 100, fees: 10, active: "0" }, { price: 100, fees: 10 }]))!;

    expect(result.fees).toMatchObject({ daysCounted: 28, daysUnmeasurable: 2 });
    expect(result.days[0]?.feesUsd).toBeNull();
  });

  it("has no fees when the pool's dollar rate cannot be read, and still keeps the books", () => {
    const result = replay(month([{ price: 100, fees: 10 }, { price: 70, fees: 10 }]), { tvlUsd: null })!;

    expect(result.fees).toBeNull();
    expect(result.afterFees).toBeNull();
    expect(result.recentres).toHaveLength(1);
    expect(result.beforeFees.differenceUsd).toBeCloseTo(result.heldUsd * (result.endValueVsHold - 0.98), 9);
  });
});

describe("gas, and the month set against holding and against never re-centring", () => {
  const twice = month([{ price: 100, fees: 20 }, { price: 70 }, { price: 70, fees: 20 }, { price: 100, fees: 20 }]);

  it("counts nothing for gas unless a cost per re-centre is set", () => {
    const result = replay(twice)!;

    expect(result.gas).toEqual({ perRecentreUsd: 0, usd: 0 });
    expect(result.beforeFees.recentredUsd).toBeCloseTo(result.heldUsd * result.endValueVsHold, 9);
  });

  it("charges the cost once per re-centre, from outside the position", () => {
    const free = replay(twice)!;
    const paid = replay(twice, { gas: 7.5 })!;

    expect(paid.gas).toEqual({ perRecentreUsd: 7.5, usd: 15 });
    /* Nothing about the position moves; only the result does, by the gas. */
    expect(paid.endValueVsHold).toBe(free.endValueVsHold);
    expect(paid.beforeFees.recentredUsd).toBeCloseTo(free.beforeFees.recentredUsd - 15, 9);
    expect(paid.afterFees!.recentredUsd).toBeCloseTo(free.afterFees!.recentredUsd - 15, 9);
    expect(paid.afterFees!.neverUsd).toBe(free.afterFees!.neverUsd);
  });

  it("sets each end value against holding and against the range never re-centred, the static figure reused", () => {
    const from = suggested({ endValueVsHold: 0.96, fees: { usd: 9, ofDeposit: 0.009, daysCounted: 20, daysUnmeasurable: 0 } });
    const result = replay(twice, { from, gas: 2 })!;
    const held = result.heldUsd;

    expect(result.beforeFees).toEqual({
      recentredUsd: held * result.endValueVsHold - 4,
      neverUsd: held * 0.96,
      recentredVsHeldUsd: held * result.endValueVsHold - 4 - held,
      neverVsHeldUsd: held * 0.96 - held,
      differenceUsd: held * result.endValueVsHold - 4 - held * 0.96,
    });
    expect(result.afterFees?.recentredUsd).toBeCloseTo(held * result.endValueVsHold + result.fees!.usd - 4, 9);
    expect(result.afterFees?.neverUsd).toBeCloseTo(held * 0.96 + 9, 9);
    expect(result.afterFees?.neverVsHeldUsd).toBeCloseTo(held * 0.96 + 9 - held, 9);
    expect(result.afterFees?.differenceUsd).toBeCloseTo(
      held * result.endValueVsHold + result.fees!.usd - 4 - (held * 0.96 + 9),
      9,
    );
  });

  it("has nothing with fees in when the month never re-centred has no fees to set beside them", () => {
    expect(replay(twice, { from: suggested({ fees: null }) })?.afterFees).toBeNull();
  });

  it.each([
    ["a negative cost", -1],
    ["a cost that is not a number", Number.NaN],
    ["an unbounded cost", Infinity],
  ])("is refused for %s", (_, gas) => {
    expect(replay(twice, { gas })).toBeNull();
  });
});

describe("a month in which the price never left", () => {
  /* Wobbling ±1% before the window, so the drawn range has a width; calm and inside through it. */
  const wobble = (before: number) => 100 * (before % 2 === 0 ? 1.01 : 0.99);
  const calm = history(61, (before) => (before > 30 ? { price: wobble(before) } : { price: 100, fees: 40 }));
  const drawn = calculateRangeBacktest({
    history: calm,
    snapshot: snapshot(),
    parameters: { horizonDays: 30, standardDeviationMultiplier: 1 },
    depositUsd: 1_000,
    token0Decimals: 18,
    token1Decimals: 18,
  })!;

  it("is the month never re-centred, figure for figure", () => {
    const result = replay(calm, { from: drawn, gas: 5 })!;

    expect(result.recentres).toEqual([]);
    expect(result.endValueVsHold).toBe(drawn.endValueVsHold);
    expect(result.days.map(({ valueVsHold }) => valueVsHold)).toEqual(drawn.days.map(({ valueVsHold }) => valueVsHold));
    expect(result.fees).toEqual(drawn.fees);
    expect([result.inside, result.outside, result.crossed]).toEqual([drawn.inside, drawn.outside, drawn.crossed]);
    expect(result.swapFees).toEqual({ ofDeposit: 0, usd: 0 });
    expect(result.gas.usd).toBe(0);
    expect(result.beforeFees.differenceUsd).toBe(0);
    expect(result.afterFees?.differenceUsd).toBe(0);
  });
});

describe("what it refuses", () => {
  it("is nothing when the history cannot hold a range drawn before the window", () => {
    expect(replay(history(50, () => ({ price: 100 })))).toBeNull();
  });

  it("is nothing when handed a month never re-centred that opened somewhere else", () => {
    const days = month([{ price: 100 }]);

    expect(replay(days, { from: suggested({ openedAt: day(40) }) })).toBeNull();
    expect(replay(days, { from: suggested({ openingPrice: 101 }) })).toBeNull();
  });

  it("is nothing for a range with no width, which holds nothing to re-centre", () => {
    expect(replay(month([{ price: 100 }]), { from: suggested({ lowerPrice: 100, upperPrice: 100 }) })).toBeNull();
  });
});

describe("the fee a re-centre's swap is charged", () => {
  const v3 = { protocolVersion: "v3", feePpm: 3000 } as unknown as Pool;
  const v4 = (fee: unknown, protocolFee: unknown) => ({ protocolVersion: "v4", fee, protocolFee }) as unknown as Pool;
  const measured = { status: "success", rate: { aggregatePpm: 420 } } as unknown as RealizedFeeRateResult;
  const unmeasured = { status: "unavailable", notice: "fee-rate-unmeasurable" } as unknown as RealizedFeeRateResult;

  it("is a v3 pool's tier, both ways", () => {
    expect(recentreSwapFee(v3, measured)).toEqual({ zeroForOnePpm: 3000, oneForZeroPpm: 3000, basis: "stated" });
  });

  it("is a v4 key's fee with the protocol's cut, per direction, combined as the chain combines them", () => {
    expect(recentreSwapFee(v4({ kind: "static", feePpm: 500 }, { zeroForOnePpm: 100, oneForZeroPpm: 125 }), measured)).toEqual({
      zeroForOnePpm: 600,
      oneForZeroPpm: 625,
      basis: "stated",
    });
  });

  it("is what the month's swaps paid where nothing fixed says", () => {
    const dynamic = v4({ kind: "dynamic", currentFeePpm: 9000 }, { zeroForOnePpm: 0, oneForZeroPpm: 0 });
    const unread = v4({ kind: "static", feePpm: 500 }, null);

    expect(recentreSwapFee(dynamic, measured)).toEqual({ zeroForOnePpm: 420, oneForZeroPpm: 420, basis: "measured" });
    expect(recentreSwapFee(unread, measured)?.basis).toBe("measured");
    expect(recentreSwapFee(dynamic, unmeasured)).toBeNull();
  });
});
