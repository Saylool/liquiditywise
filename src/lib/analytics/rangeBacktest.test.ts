import { describe, expect, it } from "vitest";

import type { PoolDailyPriceHistory, PoolMarketSnapshot } from "../../schemas";
import { amountsAt, valueInToken1 } from "./divergenceLoss";
import { calculateCustomRangeBacktest, calculateRangeBacktest } from "./rangeBacktest";
import { liquidityPerUnitValue } from "./rangeConcentration";

const DAY_MS = 86_400_000;
const END = Date.parse("2026-09-27T00:00:00.000Z");
const POOL = { protocolVersion: "v3", chainId: 1, id: `0x${"d".repeat(40)}` };

type Day = { price: number; low?: number | null | undefined; high?: number | null | undefined; fees?: number | null | undefined; active?: string | null | undefined };

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
      const day = dayAt(before);
      return {
        timestamp: new Date(END - before * DAY_MS).toISOString(),
        price: day.price,
        low: day.low === undefined ? day.price * 0.999 : day.low,
        high: day.high === undefined ? day.price * 1.001 : day.high,
        volumeUsd: null,
        feesUsd: day.fees ?? null,
        activeLiquidity: day.active === undefined ? "1000000000000000000" : day.active,
      };
    }),
    source: "uniswap-v3-subgraph",
  }) as PoolDailyPriceHistory;

/** A pool worth $2 per token1 and holding a little of each. */
const snapshot = (tvlUsd: number | null = 2_000) =>
  ({ tvlUsd, lockedToken0: 5, lockedToken1: 500, token0PriceInToken1: 100 }) as unknown as PoolMarketSnapshot;

/** Prices wobbling ±1% around 100 before the window, so the range has a width. */
const wobble = (before: number) => 100 * (before % 2 === 0 ? 1.01 : 0.99);

const run = (days: PoolDailyPriceHistory, tvlUsd: number | null = 2_000) =>
  calculateRangeBacktest({
    history: days,
    snapshot: snapshot(tvlUsd),
    parameters: { horizonDays: 30, standardDeviationMultiplier: 1 },
    depositUsd: 1_000,
    token0Decimals: 18,
    token1Decimals: 18,
  });

describe("a position opened thirty days ago in the range drawn then", () => {
  it("draws its range from the days before the window, around the last close before it", () => {
    const result = run(history(61, (before) => ({ price: before > 30 ? wobble(before) : 100 })));

    expect(result?.openedAt).toBe(new Date(END - 31 * DAY_MS).toISOString());
    expect(result?.openingPrice).toBe(wobble(31));
    expect(result!.lowerPrice).toBeLessThan(result!.openingPrice);
    expect(result!.upperPrice).toBeGreaterThan(result!.openingPrice);
    expect(result?.days).toHaveLength(30);
  });

  it("draws the same range whatever the window's own days did: no hindsight", () => {
    const calm = run(history(61, (before) => ({ price: before > 30 ? wobble(before) : 100 })));
    const wild = run(history(61, (before) => ({ price: before > 30 ? wobble(before) : 300 })));

    expect([wild?.lowerPrice, wild?.upperPrice]).toEqual([calm?.lowerPrice, calm?.upperPrice]);
  });

  it("reads each day's worth against holding from the exact amounts at its close", () => {
    const result = run(history(61, (before) => ({ price: before > 30 ? wobble(before) : before > 10 ? 100 : 104 })));
    const lowerRoot = Math.sqrt(result!.lowerPrice);
    const upperRoot = Math.sqrt(result!.upperPrice);
    const started = amountsAt(result!.openingPrice, lowerRoot, upperRoot);
    const expected = valueInToken1(amountsAt(104, lowerRoot, upperRoot), 104) / valueInToken1(started, 104);

    expect(result?.endValueVsHold).toBeCloseTo(expected, 12);
    expect(result?.days.at(-1)?.valueVsHold).toBe(result?.endValueVsHold);
    /* Held beside the pool, a moved price always leaves the position behind holding, or level with it. */
    expect(result!.endValueVsHold).toBeLessThanOrEqual(1);
  });

  it("counts the window's days inside, outside and across an edge, as the pool page does", () => {
    const result = run(
      history(61, (before) =>
        before > 30
          ? { price: wobble(before) }
          : before > 18
            ? { price: 100 }
            : before > 8
              ? { price: 500 }
              : { price: 100, low: 50, high: 150 },
      ),
    );

    expect([result?.inside, result?.outside, result?.crossed]).toEqual([12, 10, 8]);
    expect(result?.days.slice(0, 1)[0]?.placement).toBe("inside");
  });

  it("takes the deposit's share of each wholly-inside day's fees, at today's dollar rate", () => {
    const result = run(
      history(61, (before) => (before > 30 ? { price: wobble(before) } : before > 1 ? { price: 100, fees: 50 } : { price: 500, fees: 50 })),
    );
    const perUnit = liquidityPerUnitValue({ lowerPrice: result!.lowerPrice, upperPrice: result!.upperPrice }, result!.openingPrice)!;
    const liquidity = (1_000 / 2) * 1e18 * perUnit;
    const perDay = 50 * (liquidity / (1e18 + liquidity));

    expect(result?.fees?.daysCounted).toBe(29);
    expect(result?.fees?.usd).toBeCloseTo(29 * perDay, 9);
    expect(result?.fees?.ofDeposit).toBeCloseTo((29 * perDay) / 1_000, 12);
  });

  it("counts apart the inside days whose fees or liquidity the source did not give", () => {
    const result = run(
      history(61, (before) =>
        before > 30 ? { price: wobble(before) } : before > 2 ? { price: 100, fees: 10 } : { price: 100, fees: before === 1 ? null : 10, active: before === 2 ? "0" : undefined },
      ),
    );

    expect(result?.fees).toMatchObject({ daysCounted: 28, daysUnmeasurable: 2 });
  });

  it("has no fees when the pool's dollar rate cannot be read, and still reads the days", () => {
    const result = run(history(61, (before) => ({ price: before > 30 ? wobble(before) : 100, fees: 10 })), null);

    expect(result?.fees).toBeNull();
    expect(result?.inside).toBe(30);
  });

  it("draws the range for the reader's own horizon: a shorter one, a narrower range", () => {
    const days = history(61, (before) => ({ price: before > 30 ? wobble(before) : 100 }));
    const month = run(days)!;
    const week = calculateRangeBacktest({
      history: days,
      snapshot: snapshot(),
      parameters: { horizonDays: 7, standardDeviationMultiplier: 1 },
      depositUsd: 1_000,
      token0Decimals: 18,
      token1Decimals: 18,
    })!;

    expect(week.upperPrice / week.lowerPrice).toBeLessThan(month.upperPrice / month.lowerPrice);
  });

  it("is nothing when the history cannot hold a range drawn before the window", () => {
    expect(run(history(50, (before) => ({ price: wobble(before) })))).toBeNull();
  });
});

const custom = (days: PoolDailyPriceHistory, lowerPrice: number, upperPrice: number, tvlUsd: number | null = 2_000) =>
  calculateCustomRangeBacktest({
    history: days,
    snapshot: snapshot(tvlUsd),
    lowerPrice,
    upperPrice,
    depositUsd: 1_000,
    token0Decimals: 18,
    token1Decimals: 18,
  });

describe("the same month, replayed in a range the reader chose", () => {
  const month = history(61, (before) =>
    before > 30 ? { price: wobble(before) } : before > 10 ? { price: 100, fees: 50 } : { price: 104, fees: 50 },
  );

  it("is the drawn replay, figure for figure, when handed the drawn range", () => {
    const drawn = run(month)!;
    const chosen = custom(month, drawn.lowerPrice, drawn.upperPrice)!;
    const { openedInside, ...rest } = chosen;

    expect(rest).toEqual(drawn);
    expect(openedInside).toBe(true);
  });

  it("opens at the same close and reads the same thirty days, whatever the range", () => {
    const drawn = run(month)!;
    const chosen = custom(month, 50, 200)!;

    expect(chosen.openedAt).toBe(drawn.openedAt);
    expect(chosen.openingPrice).toBe(drawn.openingPrice);
    expect(chosen.days.map(({ timestamp }) => timestamp)).toEqual(drawn.days.map(({ timestamp }) => timestamp));
    expect([chosen.lowerPrice, chosen.upperPrice]).toEqual([50, 200]);
  });

  it("counts its own days against its own edges", () => {
    /* 102 sits between the window's two prices: the first twenty days below it, the last ten above. */
    const chosen = custom(month, 102, 200)!;

    expect([chosen.inside, chosen.outside, chosen.crossed]).toEqual([10, 20, 0]);
  });

  it("takes a smaller share of the same fees in a wider range", () => {
    const narrow = custom(month, 90, 110)!;
    const wide = custom(month, 50, 200)!;

    expect(narrow.fees!.daysCounted).toBe(30);
    expect(wide.fees!.daysCounted).toBe(30);
    expect(wide.fees!.usd).toBeLessThan(narrow.fees!.usd);
  });

  it("opens one-sided when its range sits away from the opening close, and still reads the days", () => {
    const opening = wobble(31);
    const above = custom(month, 103, 120)!;
    const lowerRoot = Math.sqrt(103);
    const upperRoot = Math.sqrt(120);
    const started = amountsAt(opening, lowerRoot, upperRoot);

    expect(above.openedInside).toBe(false);
    /* Below the range at the opening, the position holds token0 only. */
    expect(started.amount1).toBe(0);
    expect(above.endValueVsHold).toBeCloseTo(
      valueInToken1(amountsAt(104, lowerRoot, upperRoot), 104) / valueInToken1(started, 104),
      12,
    );
    /* The ten days at 104 are inside it, and the fees are sized from what a one-sided deposit buys. */
    const liquidity = (1_000 / 2) * 1e18 * (1 / valueInToken1(started, opening));
    expect(above.fees?.daysCounted).toBe(10);
    expect(above.fees?.usd).toBeCloseTo(10 * 50 * (liquidity / (1e18 + liquidity)), 9);
  });

  it("has no fees when the pool's dollar rate cannot be read, as the drawn replay does not", () => {
    expect(custom(month, 90, 110, null)?.fees).toBeNull();
  });

  it.each([
    ["a lower edge at zero", 0, 110],
    ["a negative lower edge", -1, 110],
    ["edges the wrong way round", 110, 90],
    ["edges that meet", 100, 100],
    ["an infinite upper edge", 90, Infinity],
    ["an edge that is not a number", Number.NaN, 110],
  ])("is refused for %s", (_, lowerPrice, upperPrice) => {
    expect(custom(month, lowerPrice, upperPrice)).toBeNull();
  });

  it("is refused wherever the drawn replay is: a history too short to open before the window", () => {
    expect(custom(history(50, (before) => ({ price: wobble(before) })), 90, 110)).toBeNull();
  });
});
