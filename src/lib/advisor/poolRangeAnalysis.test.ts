import { describe, expect, it } from "vitest";

import type {
  DataResult,
  PoolDailyPriceHistory,
  PoolMarketSnapshot,
  V3Pool,
} from "../../schemas";
import {
  analysePoolRange,
  DEFAULT_DEPOSIT_USD,
  DEFAULT_PRICE_BAND_PARAMETERS,
  type PoolRangeAnalysisInput,
} from "./poolRangeAnalysis";

const POOL_ID = `0x${"c".repeat(40)}`;
const POOL_REF = { protocolVersion: "v3", chainId: 1, id: POOL_ID } as const;

const FETCHED_AT = "2026-08-21T09:15:00.000Z";
const BLOCK_NUMBER = "21500000";
const BLOCK_TIMESTAMP = "2026-08-21T09:14:48.000Z";

/** USDC (6 decimals) sorts before WETH (18), as it does on mainnet. */
const CURRENT_PRICE = 1 / 3000;
const CURRENT_TICK = 196_256;

const pool = (token0Decimals = 6, token1Decimals = 18): V3Pool =>
  ({
    ...POOL_REF,
    token0: { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: "USDC", decimals: token0Decimals },
    token1: { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: "WETH", decimals: token1Decimals },
    feePpm: 3000,
    tickSpacing: 60,
  }) as unknown as V3Pool;

const snapshot = (overrides: Record<string, unknown> = {}): PoolMarketSnapshot =>
  ({
    pool: POOL_REF,
    fetchedAt: FETCHED_AT,
    sourceBlockNumber: BLOCK_NUMBER,
    sourceBlockTimestamp: BLOCK_TIMESTAMP,
    token0PriceInToken1: CURRENT_PRICE,
    token1PriceInToken0: 1 / CURRENT_PRICE,
    tvlUsd: 12_500_000,
    /* Half the value on each side, so a dollar converts back to $1 of USDC. */
    lockedToken0: 6_250_000,
    lockedToken1: 6_250_000 * CURRENT_PRICE,
    tick: CURRENT_TICK,
    liquidity: "987654321",
    source: "uniswap-v3-subgraph",
    ...overrides,
  }) as unknown as PoolMarketSnapshot;

const DAY_MS = 86_400_000;
const RANGE_START = Date.parse("2026-07-21T00:00:00.000Z");

/**
 * 31 completed daily closes alternating ±1% in log terms, which gives a sample
 * standard deviation near 0.00995 per day and an annualised figure near 19% —
 * an ordinary number for a major pair, so the band it produces is realistic.
 *
 * `skipDays` drops calendar days from the series to model an indexer gap.
 */
const history = (
  pointCount = 31,
  skipDays: readonly number[] = [],
): PoolDailyPriceHistory => {
  const points: {
    timestamp: string;
    price: number;
    low: null;
    high: null;
    volumeUsd: null;
    feesUsd: null;
    activeLiquidity: string;
  }[] = [];
  let price = CURRENT_PRICE;

  for (let day = 0; day < pointCount; day += 1) {
    if (day > 0) price *= day % 2 === 0 ? 1.01 : 1 / 1.01;
    if (skipDays.includes(day)) continue;
    points.push({
      timestamp: new Date(RANGE_START + day * DAY_MS).toISOString(),
      price,
      low: null,
      high: null,
      volumeUsd: null,
      feesUsd: null,
      activeLiquidity: "1000000000000000000",
    });
  }

  return {
    pool: POOL_REF,
    fetchedAt: FETCHED_AT,
    sourceBlockNumber: BLOCK_NUMBER,
    sourceBlockTimestamp: BLOCK_TIMESTAMP,
    rangeStart: "2026-07-21T00:00:00.000Z",
    rangeEndExclusive: new Date(RANGE_START + pointCount * DAY_MS).toISOString(),
    interval: "1d",
    priceDirection: "token0PriceInToken1",
    points,
    source: "uniswap-v3-subgraph",
  } as unknown as PoolDailyPriceHistory;
};

const ok = <T,>(data: T): DataResult<T> => ({ status: "success", data });

const input = (overrides: Partial<PoolRangeAnalysisInput> = {}): PoolRangeAnalysisInput => ({
  pool: ok(pool()),
  snapshot: ok(snapshot()),
  history: ok(history()),
  parameters: DEFAULT_PRICE_BAND_PARAMETERS,
  depositUsd: DEFAULT_DEPOSIT_USD,
  ...overrides,
});

const succeed = (overrides: Partial<PoolRangeAnalysisInput> = {}) => {
  const result = analysePoolRange(input(overrides));
  if (result.status === "unavailable") {
    throw new Error(`expected data, got ${result.step}/${result.reason}: ${result.notice}`);
  }
  return result;
};

describe("analysePoolRange", () => {
  it("runs a whole pool through to a deployable tick range", () => {
    const { data } = succeed();

    expect(data.range.lowerTick).toBeLessThan(data.range.upperTick);
    expect(data.range.lowerTick % data.pool.tickSpacing).toBe(0);
    expect(data.range.upperTick % data.pool.tickSpacing).toBe(0);
    expect(data.range.containsCurrentPrice).toBe(true);
  });

  it("wires each stage's output into the next", () => {
    const { data } = succeed();

    // A mis-wired pipeline would still produce plausible numbers, so the links
    // themselves are asserted rather than only the final figures.
    expect(data.band.currentPrice).toBe(data.snapshot.token0PriceInToken1);
    expect(data.band.annualizedVolatility).toBe(data.volatility.annualizedVolatility);
    expect(data.range.band).toEqual(data.band);
    expect(data.range.pool).toEqual(data.pool);
    expect(data.volatility.pool).toEqual(data.history.pool);
  });

  it("measures a realistic annualised volatility from the series", () => {
    const { data } = succeed();

    // Alternating ±1% daily log moves: sd ~0.00995/day, ~19% annualised.
    expect(data.volatility.annualizedVolatility).toBeGreaterThan(0.15);
    expect(data.volatility.annualizedVolatility).toBeLessThan(0.25);
  });

  it("passes the caller's band parameters through rather than its own", () => {
    const wide = succeed({ parameters: { horizonDays: 365, standardDeviationMultiplier: 2 } });
    const narrow = succeed();

    expect(wide.data.band.horizonDays).toBe(365);
    expect(wide.data.band.standardDeviationMultiplier).toBe(2);
    expect(wide.data.parameters).toEqual({ horizonDays: 365, standardDeviationMultiplier: 2 });

    // A longer horizon and a larger multiplier must widen the range, not just
    // relabel it.
    expect(wide.data.range.upperTick - wide.data.range.lowerTick).toBeGreaterThan(
      narrow.data.range.upperTick - narrow.data.range.lowerTick,
    );
  });

  it("is deterministic", () => {
    expect(analysePoolRange(input())).toEqual(analysePoolRange(input()));
  });

  it("keeps every stage's own provenance", () => {
    const { data } = succeed();

    expect(data.band.currentPriceSourceBlockNumber).toBe(BLOCK_NUMBER);
    expect(data.band.currentPriceSourceBlockTimestamp).toBe(BLOCK_TIMESTAMP);
    expect(data.range.chainReportedTick).toBe(CURRENT_TICK);
    expect(data.snapshot.fetchedAt).toBe(FETCHED_AT);
  });
});

describe("a stage that cannot produce a figure", () => {
  const unreachable = <T,>(): DataResult<T> => ({
    status: "unavailable",
    reason: "network-error",
    notice: "market-data-unreachable",
  });

  it.each([
    ["pool", { pool: unreachable<V3Pool>() }],
    ["snapshot", { snapshot: unreachable<PoolMarketSnapshot>() }],
    ["history", { history: unreachable<PoolDailyPriceHistory>() }],
  ])("names %s as the step that stopped it", (step, overrides) => {
    const result = analysePoolRange(input(overrides));

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.step).toBe(step);
    expect(result.reason).toBe("network-error");
    expect(result.notice).toBe("market-data-unreachable");
  });

  it("stops at the volatility step when the history is too short", () => {
    const result = analysePoolRange(input({ history: ok(history(2)) }));

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.step).toBe("volatility");
    expect(result.reason).toBe("insufficient-data");
  });

  it("stops at the band step when the pool has no current price", () => {
    const result = analysePoolRange(
      input({
        snapshot: ok(snapshot({ token0PriceInToken1: null, token1PriceInToken0: null })),
      }),
    );

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.step).toBe("band");
    expect(result.reason).toBe("insufficient-data");
  });

  it("stops at the range step when the pool's decimals contradict its reported tick", () => {
    const result = analysePoolRange(input({ pool: ok(pool(18, 6)) }));

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.step).toBe("range");
    expect(result.reason).toBe("invalid-input");
  });

  it("carries no data when it stops", () => {
    const result = analysePoolRange(input({ pool: unreachable<V3Pool>() }));

    expect(result).not.toHaveProperty("data");
  });

  it.each([
    ["the history", { history: unreachable<PoolDailyPriceHistory>() }],
    ["the snapshot", { snapshot: unreachable<PoolMarketSnapshot>() }],
  ])("names the pool rather than %s when both are unusable", (_label, alsoFailing) => {
    /*
     * Order is part of the contract, not an accident of how the code reads. The
     * pool's configuration is what gives every later figure its meaning, so when
     * more than one read failed it is the one worth reporting.
     */
    const result = analysePoolRange(input({ pool: unreachable<V3Pool>(), ...alsoFailing }));

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.step).toBe("pool");
  });
});

describe("caveats", () => {
  it("uses a partial fetch rather than refusing it", () => {
    // A snapshot missing rolling volume still carries the price and tick this
    // pipeline needs.
    const result = analysePoolRange(
      input({
        snapshot: {
          status: "partial",
          data: snapshot(),
          missingFields: ["sourceBlockTimestamp", "sourceBlockNumber", "sourceBlockNumber"],
          warnings: ["block-time-unreported"],
        },
      }),
    );

    expect(result.status).toBe("partial");
    if (result.status !== "partial") return;
    expect(result.data.range.lowerTick).toBeLessThan(result.data.range.upperTick);
    expect(result.warnings).toContain("block-time-unreported");
  });

  it("gathers caveats from every stage in pipeline order", () => {
    const result = analysePoolRange(
      input({
        snapshot: {
          status: "partial",
          data: snapshot(),
          missingFields: ["sourceBlockTimestamp"],
          warnings: ["block-time-unreported"],
        },
        // Two missing days leave the volatility window incomplete.
        history: ok(history(31, [7, 8])),
      }),
    );

    expect(result.status).toBe("partial");
    if (result.status !== "partial") return;
    expect(result.data.volatility.returnCoverageRatio).toBeLessThan(1);

    /*
     * Pinned exactly, because each stage speaks for its own output and two of
     * them have something to say about the same gap: the volatility figure was
     * measured from fewer returns, and the band was built on that figure. The
     * wording differs, and so does what each one is about.
     */
    expect(result.warnings).toHaveLength(3);
    expect(result.warnings[0]).toBe("block-time-unreported");
    expect(result.warnings[1]).toBe("volatility-window-incomplete");
    expect(result.warnings[2]).toBe("band-window-incomplete");
  });

  it("reports a clean run with no caveats as a success", () => {
    const result = analysePoolRange(input());

    expect(result.status).toBe("success");
    expect(result).not.toHaveProperty("warnings");
  });

  it("warns when an edge runs past what the pool can express", () => {
    // A 365-day horizon at a 40-sigma multiplier reaches far beyond TickMath.
    const result = analysePoolRange(
      input({ parameters: { horizonDays: 365, standardDeviationMultiplier: 400 } }),
    );

    expect(result.status).toBe("partial");
    if (result.status !== "partial") return;
    expect(
      result.warnings.some(
        (warning) =>
          warning === "range-lower-edge-truncated" || warning === "range-upper-edge-truncated",
      ),
    ).toBe(true);
  });
});

describe("DEFAULT_PRICE_BAND_PARAMETERS", () => {
  it("is a plain one-sigma band over the history window the reader fetches", () => {
    expect(DEFAULT_PRICE_BAND_PARAMETERS).toEqual({
      horizonDays: 30,
      standardDeviationMultiplier: 1,
    });
  });
});

/*
 * A range the reader typed in, in the direction the page shows it. The same
 * pair both ways round: USDC/WETH, which the page shows inverted as USDC per
 * WETH, and WETH/USDC, which it shows as the pool quotes it. A reader types
 * "2,900 – 3,100 USDC per WETH" into either, and both must replay the same
 * prices of ether — in each pool's own direction.
 */
describe("the reader's own range", () => {
  const longHistory = (prices: (day: number) => number, days = 121) => {
    const base = history(days);
    return {
      ...base,
      points: base.points.map((point, day) => ({ ...point, price: prices(day) })),
    } as PoolDailyPriceHistory;
  };
  /* Ether wobbling ±1% around 3,000 dollars, written each pool's way round. */
  const etherInDollars = (day: number) => 3000 * (day % 2 === 0 ? 1.01 : 1 / 1.01);

  it("is turned back into the pool's direction on a pool the page shows inverted", () => {
    const { data } = succeed({
      history: ok(longHistory((day) => 1 / etherInDollars(day))),
      customRange: { lower: 2900, upper: 3100 },
    });

    expect(data.customBacktest).not.toBeNull();
    /* The pool's own direction is WETH per USDC: the reciprocals, ends swapped. */
    expect(data.customBacktest!.lowerPrice).toBeCloseTo(1 / 3100, 15);
    expect(data.customBacktest!.upperPrice).toBeCloseTo(1 / 2900, 15);
    expect(data.customBacktest!.openedInside).toBe(true);
  });

  /* The same pair with WETH as token0; addresses swapped too, since a pool's token0 is the lower address. */
  const upright = (customRange: { lower: number; upper: number }) =>
    succeed({
      pool: ok({
        ...pool(),
        token0: { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: "WETH", decimals: 18 },
        token1: { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: "USDC", decimals: 6 },
      } as unknown as V3Pool),
      snapshot: ok(
        snapshot({
          token0PriceInToken1: 3000,
          token1PriceInToken0: 1 / 3000,
          lockedToken0: 6_250_000 / 3000,
          lockedToken1: 6_250_000,
          tick: -CURRENT_TICK - 1,
        }),
      ),
      history: ok(longHistory(etherInDollars)),
      customRange,
    }).data;
  const inverted = (customRange: { lower: number; upper: number }) =>
    succeed({ history: ok(longHistory((day) => 1 / etherInDollars(day))), customRange }).data;

  it("is left as typed on a pool the page shows its own way round, decimals and all", () => {
    expect(upright({ lower: 2900, upper: 3100 }).customBacktest).toMatchObject({
      lowerPrice: 2900,
      upperPrice: 3100,
      openedInside: true,
    });
  });

  it("replays the same days the same way, whichever way round the pool quotes", () => {
    for (const typed of [{ lower: 2900, upper: 3100 }, { lower: 3010, upper: 3500 }]) {
      const one = inverted(typed).customBacktest!;
      const other = upright(typed).customBacktest!;

      expect([one.inside, one.outside, one.crossed]).toEqual([other.inside, other.outside, other.crossed]);
      expect(one.openedInside).toBe(other.openedInside);
      /* Worth against holding is the same ratio priced in either token. */
      expect(one.endValueVsHold).toBeCloseTo(other.endValueVsHold, 9);
    }
  });

  it("is nothing when none was asked for, beside a drawn replay that is there", () => {
    const { data } = succeed({ history: ok(longHistory((day) => 1 / etherInDollars(day))) });

    expect(data.backtest).not.toBeNull();
    expect(data.customBacktest).toBeNull();
  });

  it("costs the rest of the analysis nothing when it cannot be replayed", () => {
    const { data } = succeed({ customRange: { lower: 2900, upper: 3100 } });

    expect(data.backtest).toBeNull();
    expect(data.customBacktest).toBeNull();
    expect(data.range.lowerTick).toBeLessThan(data.range.upperTick);
  });
});

describe("the strategy re-centred whenever the price leaves", () => {
  const longHistory = (prices: (day: number) => number) => {
    const base = history(121);
    return { ...base, points: base.points.map((point, day) => ({ ...point, price: prices(day) })) } as PoolDailyPriceHistory;
  };
  /* Ether wobbling ±1% around 3,000 for ninety-one days, then climbing 2% a day through the month replayed. */
  const etherInDollars = (day: number) =>
    day <= 90 ? 3000 * (day % 2 === 0 ? 1.01 : 1 / 1.01) : 3000 * 1.02 ** (day - 90);
  const inverted = (overrides: Partial<PoolRangeAnalysisInput> = {}) =>
    succeed({ history: ok(longHistory((day) => 1 / etherInDollars(day))), ...overrides }).data;
  const upright = () =>
    succeed({
      pool: ok({
        ...pool(),
        token0: { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: "WETH", decimals: 18 },
        token1: { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: "USDC", decimals: 6 },
      } as unknown as V3Pool),
      snapshot: ok(
        snapshot({
          token0PriceInToken1: 3000,
          token1PriceInToken0: 1 / 3000,
          lockedToken0: 6_250_000 / 3000,
          lockedToken1: 6_250_000,
          tick: -CURRENT_TICK - 1,
        }),
      ),
      history: ok(longHistory(etherInDollars)),
    }).data;

  it("opens where the month replayed opens, in its range, at the pool's tier", () => {
    const { backtest, recentring } = inverted();

    expect(recentring).not.toBeNull();
    expect(recentring!.openedAt).toBe(backtest!.openedAt);
    expect([recentring!.lowerPrice, recentring!.upperPrice]).toEqual([backtest!.lowerPrice, backtest!.upperPrice]);
    expect(recentring!.swapFee).toEqual({ zeroForOnePpm: 3000, oneForZeroPpm: 3000, basis: "stated" });
    /* A month climbing 2% a day leaves a range a few percent wide every few days. */
    expect(recentring!.recentres.length).toBeGreaterThan(3);
  });

  it("counts the reader's gas cost once per re-centre, and none unless asked", () => {
    const free = inverted().recentring!;
    const paid = inverted({ recentreGasUsd: 5 }).recentring!;

    expect(free.gas).toEqual({ perRecentreUsd: 0, usd: 0 });
    expect(paid.gas).toEqual({ perRecentreUsd: 5, usd: 5 * paid.recentres.length });
  });

  /* As ether climbs the position ends up all USDC, whichever token the pool calls token0, and sells USDC to re-centre. */
  it("re-centres on the same days, sells the same token and ends the same against holding, whichever way round the pool quotes", () => {
    const one = inverted().recentring!;
    const other = upright().recentring!;

    expect(one.recentres.map(({ timestamp }) => timestamp)).toEqual(other.recentres.map(({ timestamp }) => timestamp));
    expect(new Set(one.recentres.map(({ sold }) => sold))).toEqual(new Set(["token0"]));
    expect(new Set(other.recentres.map(({ sold }) => sold))).toEqual(new Set(["token1"]));
    /*
     * A ratio at one close, so priced in either token it is the same. The
     * dollar figures are not held to this: they follow the deposit, which is
     * sized in the pool's token1 at today's rate, as the deposit panel sizes it.
     */
    expect(one.endValueVsHold).toBeCloseTo(other.endValueVsHold, 9);
  });

  it("is nothing where the month cannot be replayed, and costs the rest of the analysis nothing", () => {
    const { data } = succeed();

    expect(data.backtest).toBeNull();
    expect(data.recentring).toBeNull();
    expect(data.range.lowerTick).toBeLessThan(data.range.upperTick);
  });

  describe("on a v4 pool whose hook sets the fee per swap", () => {
    const V4_REF = { protocolVersion: "v4", chainId: 1, id: `0x${"d".repeat(64)}` } as const;
    const dynamic = (feesPerMillion: number | null) => {
      const days = longHistory((day) => 1 / etherInDollars(day));
      return succeed({
        pool: ok({
          ...V4_REF,
          token0: { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: "USDC", decimals: 6 },
          token1: { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: "WETH", decimals: 18 },
          tickSpacing: 60,
          fee: { kind: "dynamic", currentFeePpm: 9000 },
          protocolFee: { zeroForOnePpm: 0, oneForZeroPpm: 0 },
          hookAddress: `0x${"1".repeat(36)}00c4`,
        } as unknown as V3Pool),
        snapshot: ok(snapshot({ pool: V4_REF, source: "uniswap-v4-subgraph" })),
        history: ok({
          ...days,
          pool: V4_REF,
          source: "uniswap-v4-subgraph",
          points: days.points.map((point) => ({
            ...point,
            volumeUsd: feesPerMillion === null ? null : 1_000_000,
            feesUsd: feesPerMillion,
          })),
        } as unknown as PoolDailyPriceHistory),
      }).data;
    };

    it("charges each swap what the month's swaps paid, measured, never the hook's passing reading", () => {
      expect(dynamic(420).recentring?.swapFee).toEqual({ zeroForOnePpm: 420, oneForZeroPpm: 420, basis: "measured" });
    });

    it("is not replayed when no swap of the month could be measured either", () => {
      const data = dynamic(null);

      expect(data.backtest).not.toBeNull();
      expect(data.recentring).toBeNull();
    });
  });
});
