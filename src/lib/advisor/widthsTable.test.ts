import { describe, expect, it } from "vitest";

import type { DataResult, PoolDailyPriceHistory, PoolMarketSnapshot, V3Pool, V4Pool } from "../../schemas";
import { calculateRangeBacktest } from "../analytics/rangeBacktest";
import {
  analysePoolRange,
  DEFAULT_DEPOSIT_USD,
  DEFAULT_PRICE_BAND_PARAMETERS,
  type PoolRangeAnalysis,
} from "./poolRangeAnalysis";
import { MULTIPLIER_CHOICES } from "./requestedParameters";
import { widthsTable } from "./widthsTable";

/*
 * The fixture is the width comparison's: a month that drifts away from the
 * price the range is centred on, so a tight range is left and a wide one is
 * not, and the rows have something to differ on. Fees on every day, so the
 * fee column is there to be withheld.
 */

const POOL_ID = `0x${"c".repeat(40)}`;
const V4_POOL_ID = `0x${"d".repeat(64)}`;
const FETCHED_AT = "2026-08-21T09:15:00.000Z";
const CURRENT_PRICE = 1 / 3000;
const DAY_MS = 86_400_000;
const RANGE_END = Date.parse("2026-08-21T00:00:00.000Z");

/** `beforeSwap`, `afterSwap` and `afterSwapReturnsDelta`: a hook that may change what a swap costs. */
const SWAP_HOOK = `0x${"1".repeat(36)}00c4`;
/** `beforeAddLiquidity` alone: it never runs on a swap. */
const LIQUIDITY_HOOK = `0x${"1".repeat(36)}0800`;

const tokens = {
  token0: { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: "USDC", decimals: 6 },
  token1: { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: "WETH", decimals: 18 },
};

type Ref = { readonly protocolVersion: "v3" | "v4"; readonly chainId: 1; readonly id: string };
const V3_REF: Ref = { protocolVersion: "v3", chainId: 1, id: POOL_ID };
const V4_REF: Ref = { protocolVersion: "v4", chainId: 1, id: V4_POOL_ID };

const v3Pool = (): V3Pool => ({ ...V3_REF, ...tokens, feePpm: 3000, tickSpacing: 60 }) as unknown as V3Pool;

const v4Pool = (hookAddress: string | null): V4Pool =>
  ({
    ...V4_REF,
    ...tokens,
    tickSpacing: 60,
    fee: { kind: "static", feePpm: 3000 },
    protocolFee: { zeroForOnePpm: 0, oneForZeroPpm: 0 },
    hookAddress,
  }) as unknown as V4Pool;

const snapshot = (ref: Ref): PoolMarketSnapshot =>
  ({
    pool: ref,
    fetchedAt: FETCHED_AT,
    sourceBlockNumber: "21500000",
    sourceBlockTimestamp: "2026-08-21T09:14:48.000Z",
    token0PriceInToken1: CURRENT_PRICE,
    token1PriceInToken0: 1 / CURRENT_PRICE,
    tvlUsd: 12_500_000,
    /* Half the value on each side, so a dollar converts back to $1 of USDC. */
    lockedToken0: 6_250_000,
    lockedToken1: 6_250_000 * CURRENT_PRICE,
    tick: 196_256,
    liquidity: "987654321",
    source: ref.protocolVersion === "v3" ? "uniswap-v3-subgraph" : "uniswap-v4-subgraph",
  }) as unknown as PoolMarketSnapshot;

/**
 * `days` closes ending at the current price, walked backwards from it in
 * four-percent steps, seven of every eleven the same way — so the older days
 * drift away from the price. Enough of the month then leaves a tight range
 * and stays inside a wide one.
 */
const history = (ref: Ref, days = 121): PoolDailyPriceHistory => {
  const start = RANGE_END - days * DAY_MS;
  const closes: number[] = new Array<number>(days);
  closes[days - 1] = CURRENT_PRICE;
  for (let day = days - 2; day >= 0; day -= 1) {
    const step = (day * 7) % 11 < 7 ? 1.04 : 1 / 1.04;
    closes[day] = (closes[day + 1] ?? CURRENT_PRICE) * step;
  }
  const points = closes.map((price, day) => ({
    timestamp: new Date(start + day * DAY_MS).toISOString(),
    price,
    low: price / 1.004,
    high: price * 1.004,
    volumeUsd: 1_000_000,
    feesUsd: 3_000,
    activeLiquidity: "1000000000000000000",
  }));
  return {
    pool: ref,
    fetchedAt: FETCHED_AT,
    sourceBlockNumber: "21500000",
    sourceBlockTimestamp: "2026-08-21T09:14:48.000Z",
    rangeStart: new Date(start).toISOString(),
    rangeEndExclusive: new Date(RANGE_END).toISOString(),
    interval: "1d",
    priceDirection: "token0PriceInToken1",
    points,
    source: ref.protocolVersion === "v3" ? "uniswap-v3-subgraph" : "uniswap-v4-subgraph",
  } as unknown as PoolDailyPriceHistory;
};

const ok = <T,>(data: T): DataResult<T> => ({ status: "success", data });

const analysis = ({
  standardDeviationMultiplier = 1,
  days = 121,
  hookAddress,
  recentreGasUsd,
}: {
  standardDeviationMultiplier?: number;
  days?: number;
  /** Given at all, the pool is v4 with this hook (or none); absent, it is v3. */
  hookAddress?: string | null;
  recentreGasUsd?: number;
} = {}): PoolRangeAnalysis => {
  const ref = hookAddress === undefined ? V3_REF : V4_REF;
  const result = analysePoolRange({
    pool: hookAddress === undefined ? ok(v3Pool()) : ok(v4Pool(hookAddress)),
    snapshot: ok(snapshot(ref)),
    history: ok(history(ref, days)),
    parameters: { ...DEFAULT_PRICE_BAND_PARAMETERS, standardDeviationMultiplier },
    depositUsd: DEFAULT_DEPOSIT_USD,
    recentreGasUsd,
  });
  if (result.status === "unavailable") throw new Error(`fixture should analyse: ${result.notice}`);
  return result.data;
};

const tableOf = (...args: Parameters<typeof analysis>) => {
  const table = widthsTable(analysis(...args));
  if (table === null) throw new Error("the fixture should hold a month to replay");
  return table;
};

describe("widthsTable", () => {
  it("has one row per offered width, ascending, and marks the one the page shows", () => {
    const table = tableOf({ standardDeviationMultiplier: 1.5 });

    expect(table.rows.map((row) => row.standardDeviationMultiplier)).toEqual([...MULTIPLIER_CHOICES]);
    expect(table.rows.map((row) => row.chosen)).toEqual([false, true, false, false]);
  });

  it("adds a width typed into the URL, in its place, and marks that one", () => {
    const table = tableOf({ standardDeviationMultiplier: 2.5 });

    expect(table.rows.map((row) => row.standardDeviationMultiplier)).toEqual([1, 1.5, 2, 2.5, 3]);
    expect(table.rows.filter((row) => row.chosen).map((row) => row.standardDeviationMultiplier)).toEqual([2.5]);
  });

  /*
   * The row for the page's own width is recomputed, not copied, and it must
   * come out as the two panels' own figures — the same calculators on the
   * same inputs — or the table would disagree with the panels above it.
   */
  it("reproduces the month replayed and the re-centring exactly, on the row the page shows", () => {
    for (const standardDeviationMultiplier of [1, 2]) {
      const shown = analysis({ standardDeviationMultiplier });
      const chosen = widthsTable(shown)?.rows.find((row) => row.chosen);
      if (shown.recentring === null) throw new Error("the fixture should re-centre");

      expect(chosen?.replay).toEqual(shown.backtest);
      expect(chosen?.recentring).toEqual({
        recentres: shown.recentring.recentres.length,
        outcome: shown.recentring.afterFees,
        withFees: true,
      });
    }
  });

  /* And every other row is what those panels would show if that width were chosen. */
  it("gives every other width the figures the panels would show with that width chosen", () => {
    const table = tableOf({ standardDeviationMultiplier: 1 });

    for (const row of table.rows) {
      const theirs = analysis({ standardDeviationMultiplier: row.standardDeviationMultiplier });
      if (theirs.recentring === null) throw new Error("the fixture should re-centre");

      expect(row.replay, `${row.standardDeviationMultiplier}σ`).toEqual(theirs.backtest);
      expect(row.recentring?.recentres, `${row.standardDeviationMultiplier}σ`).toBe(theirs.recentring.recentres.length);
      expect(row.recentring?.outcome, `${row.standardDeviationMultiplier}σ`).toEqual(theirs.recentring.afterFees);
    }
  });

  /* The month the fixture drifts through leaves a tight range and not a wide one, and the rows say so. */
  it("differs between the widths on the figures that depend on the width", () => {
    const [tight, , , wide] = tableOf().rows;

    expect(tight?.replay?.inside ?? 0).toBeLessThan(wide?.replay?.inside ?? 0);
    expect(tight?.recentring?.recentres ?? 0).toBeGreaterThan(wide?.recentring?.recentres ?? 0);
    expect(tight?.replay?.lowerPrice ?? 0).toBeGreaterThan(wide?.replay?.lowerPrice ?? 0);
  });

  it("opens every row at the close the month replayed opens at, and carries the deposit and horizon", () => {
    const shown = analysis();
    const table = widthsTable(shown);

    expect(table?.openedAt).toBe(shown.backtest?.openedAt);
    for (const row of table?.rows ?? []) expect(row.replay?.openedAt).toBe(shown.backtest?.openedAt);
    expect(table?.depositUsd).toBe(DEFAULT_DEPOSIT_USD);
    expect(table?.horizonDays).toBe(DEFAULT_PRICE_BAND_PARAMETERS.horizonDays);
    expect(table?.swapFee).toEqual({ zeroForOnePpm: 3000, oneForZeroPpm: 3000, basis: "stated" });
  });

  it("counts the gas the page counts, once per re-centre, on every row", () => {
    const free = tableOf();
    const paid = tableOf({ recentreGasUsd: 5 });

    expect(paid.gasPerRecentreUsd).toBe(5);
    expect(free.gasPerRecentreUsd).toBe(0);
    paid.rows.forEach((row, index) => {
      const without = free.rows[index]?.recentring;
      if (row.recentring === null || without === undefined || without === null) throw new Error("rows should re-centre");
      expect(row.recentring.outcome.recentredUsd).toBeCloseTo(without.outcome.recentredUsd - 5 * row.recentring.recentres, 6);
    });
  });

  it("is nothing when the history cannot hold a month to replay, as the month replayed is", () => {
    const shown = analysis({ days: 31 });

    expect(shown.backtest).toBeNull();
    expect(widthsTable(shown)).toBeNull();
  });

  /*
   * The hook rule, applied where the page applies it: a hook that may alter
   * what a swap pays means no fee is attributed to a range anywhere on the
   * page, so here the fees leave every row rather than waiting to be hidden,
   * and the re-centring outcome is the one before fees — the backtest and
   * re-centring panels' own behaviour, row by row.
   */
  it("withholds the fees on every row where a hook may alter a swap, and ends before fees", () => {
    const table = tableOf({ hookAddress: SWAP_HOOK });
    const unwithheld = analysis({ hookAddress: SWAP_HOOK });

    expect(table.hookMayAlterSwaps).toBe(true);
    expect(table.feesWithheld).toBe(true);
    table.rows.forEach((row, index) => {
      expect(row.replay?.fees, `${row.standardDeviationMultiplier}σ`).toBeNull();
      expect(row.recentring?.withFees, `${row.standardDeviationMultiplier}σ`).toBe(false);
      /* Everything but the fees is still the panel's figure. */
      const theirs = calculateRangeBacktest({
        history: unwithheld.history,
        snapshot: unwithheld.snapshot,
        parameters: { ...DEFAULT_PRICE_BAND_PARAMETERS, standardDeviationMultiplier: row.standardDeviationMultiplier },
        depositUsd: DEFAULT_DEPOSIT_USD,
        token0Decimals: 6,
        token1Decimals: 18,
      });
      expect(row.replay).toEqual({ ...theirs, fees: null });
      if (index === 0) expect(theirs?.fees).not.toBeNull();
    });
    /* The outcome before fees: the chosen row's is the page's own. */
    expect(table.rows.find((row) => row.chosen)?.recentring?.outcome).toEqual(unwithheld.recentring?.beforeFees);
  });

  it("leaves the fees alone where the hook never runs on a swap, or there is none", () => {
    for (const hookAddress of [LIQUIDITY_HOOK, null]) {
      const table = tableOf({ hookAddress });

      expect(table.hookMayAlterSwaps).toBe(false);
      expect(table.feesWithheld).toBe(false);
      for (const row of table.rows) {
        expect(row.replay?.fees).not.toBeNull();
        expect(row.recentring?.withFees).toBe(true);
      }
    }
  });

  it("re-centres nothing where nothing says what a swap pays, and still replays the month", () => {
    const shown = analysis();
    /* A v4 pool whose hook sets the fee per swap, with a month whose swaps paid no measurable rate. */
    const unpriced: PoolRangeAnalysis = {
      ...shown,
      pool: { ...v4Pool(null), fee: { kind: "dynamic" } } as unknown as V4Pool,
      realizedFee: { status: "unavailable", notice: "fee-rate-unmeasurable" } as unknown as PoolRangeAnalysis["realizedFee"],
      recentring: null,
    };
    const table = widthsTable(unpriced);

    expect(table?.swapFee).toBeNull();
    for (const row of table?.rows ?? []) {
      expect(row.recentring).toBeNull();
      expect(row.replay).not.toBeNull();
    }
  });
});
