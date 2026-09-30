import { z } from "zod";

import type { MeasuredPosition, SmartLiquidity } from "./smartLiquidity";

/*
 * The smart-money measurements over time: what each six-hourly measurement
 * found, kept as a series, and the two questions a series can answer that one
 * measurement cannot — where the liquidity has been moving, and which holders
 * keep turning up.
 *
 * Pure. What is kept is compact and public: pool summaries, and the addresses
 * of the positions' holders, which anybody can read off the chain. Nothing
 * about who reads the page.
 *
 * **A range is compared as prices, never as ratios.** A pair's median range is
 * shown as how far its edges sit from the price now, and that moves when the
 * price does even if nobody touches a position. What a change over time has to
 * compare is where the edges are, in the pool's own direction — which moves
 * only when the liquidity does.
 */

/** Four a day for four weeks. */
export const SERIES_MAX = 112;

/** Four a day for a week: what "keeps turning up" is counted over. */
export const OWNER_SETS_MAX = 28;

/** Two measurements closer than this are one: a refresh and a reader's read of the same hour. */
export const MIN_GAP_MS = 60 * 60 * 1_000;

/** What a trend needs before it says anything: a day between the first measurement it compares and the last. */
export const MIN_TREND_MS = 24 * 60 * 60 * 1_000;

/** How far back a trend looks. */
export const TREND_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;

/** How many measurements a holder has to have been counted in before "keeps turning up" is said of anyone. */
export const MIN_OWNER_SETS = 8;

/** The share of those measurements a holder has to be in. */
export const PERSISTENT_SHARE = 0.5;

/** How many holders are listed. */
export const PERSISTENT_SHOWN = 20;

/** How many pairs a trend follows, and how many movers it names each way. */
export const TREND_PAIRS = 8;
export const MOVERS_SHOWN = 3;

/** A move of the share of smart money smaller than this, in ratio terms, is not a move. */
export const MOVE_THRESHOLD = 0.02;

export const SnapshotPairSchema = z.object({
  pool: z.string(),
  /** "USDC / WETH", as the page names it. */
  pair: z.string(),
  feePpm: z.number(),
  positions: z.number(),
  valueUsd: z.number(),
  lowerPrice: z.number(),
  upperPrice: z.number(),
  currentPrice: z.number(),
  yearlyYield: z.number(),
});
export type SnapshotPair = z.infer<typeof SnapshotPairSchema>;

export const SmartSnapshotSchema = z.object({
  at: z.string(),
  measured: z.number(),
  smart: z.number(),
  medianYearlyYield: z.number().nullable(),
  smartFrom: z.number().nullable(),
  pairs: z.array(SnapshotPairSchema),
});
export type SmartSnapshot = z.infer<typeof SmartSnapshotSchema>;

export const OwnerSetSchema = z.object({
  at: z.string(),
  wallets: z.array(z.string()),
  contracts: z.array(z.string()),
});
export type OwnerSet = z.infer<typeof OwnerSetSchema>;

export const snapshotOf = (data: SmartLiquidity, at: string): SmartSnapshot => ({
  at,
  measured: data.measured,
  smart: data.smart.length,
  medianYearlyYield: data.medianYearlyYield,
  smartFrom: data.smartFrom,
  pairs: data.pairs.map((pair) => ({
    pool: pair.pool.id.toLowerCase(),
    pair: `${pair.pool.token0.symbol} / ${pair.pool.token1.symbol}`,
    feePpm: pair.pool.feePpm,
    positions: pair.positions,
    valueUsd: pair.valueUsd,
    lowerPrice: pair.medianLowerPrice,
    upperPrice: pair.medianUpperPrice,
    currentPrice: pair.currentPrice,
    yearlyYield: pair.medianYearlyYield,
  })),
});

/** The distinct holders of the smart positions, split by whether the chain says code sits at the address. */
export const ownerSetOf = (
  data: SmartLiquidity,
  at: string,
  kinds: ReadonlyMap<string, "wallet" | "contract">,
): OwnerSet => {
  const owners = [...new Set(data.smart.map(({ owner }) => owner.toLowerCase()))];
  return {
    at,
    wallets: owners.filter((owner) => kinds.get(owner) === "wallet").sort(),
    contracts: owners.filter((owner) => kinds.get(owner) === "contract").sort(),
  };
};

/** Adds a measurement to a series, replacing the last when it is too close to it, and keeping the newest `max`. */
export const appendTo = <T extends { readonly at: string }>(series: readonly T[], next: T, max: number): T[] => {
  const last = series[series.length - 1];
  const kept =
    last !== undefined && Date.parse(next.at) - Date.parse(last.at) < MIN_GAP_MS ? series.slice(0, -1) : series;
  return [...kept, next].slice(-max);
};

export type PairTrend = {
  readonly pool: string;
  readonly pair: string;
  readonly feePpm: number;
  /** The price now, in the pool's direction, for choosing which way the range is quoted. */
  readonly currentPrice: number;
  /** The median smart range then and now, each as its edges over the price of its own moment; `null` where the pair was not there then. */
  readonly then: { readonly lowerRatio: number; readonly upperRatio: number } | null;
  readonly now: { readonly lowerRatio: number; readonly upperRatio: number };
  /** Its share of all the smart money then, and now. */
  readonly shareThen: number | null;
  readonly shareNow: number;
  /** Its range's width, upper edge over lower, at each measurement it was in, oldest first. */
  readonly widths: readonly number[];
  readonly positionsNow: number;
};

export type Mover = {
  readonly pool: string;
  readonly pair: string;
  readonly feePpm: number;
  readonly from: number;
  readonly to: number;
};

export type Trend = {
  /** The measurement everything is compared with, and the days between it and the latest. */
  readonly since: string;
  readonly days: number;
  readonly pairs: readonly PairTrend[];
  readonly gaining: readonly Mover[];
  readonly losing: readonly Mover[];
};

const totalOf = (snapshot: SmartSnapshot): number => snapshot.pairs.reduce((sum, { valueUsd }) => sum + valueUsd, 0);

const ratios = (pair: SnapshotPair) => ({
  lowerRatio: pair.lowerPrice / pair.currentPrice,
  upperRatio: pair.upperPrice / pair.currentPrice,
});

/**
 * How the smart liquidity moved over the last week, or `null` when there is
 * not yet a day between the measurements to say anything: a trend from two
 * readings an hour apart is noise with a chart on it.
 */
export const trendOf = (series: readonly SmartSnapshot[]): Trend | null => {
  const latest = series[series.length - 1];
  if (latest === undefined) return null;

  const from = Date.parse(latest.at) - TREND_WINDOW_MS;
  const inWindow = series.filter((snapshot) => Date.parse(snapshot.at) >= from);
  const reference = inWindow[0];
  if (reference === undefined || Date.parse(latest.at) - Date.parse(reference.at) < MIN_TREND_MS) return null;

  const totalNow = totalOf(latest);
  const totalThen = totalOf(reference);
  if (!(totalNow > 0)) return null;

  const pairs = [...latest.pairs]
    .sort((a, b) => b.valueUsd - a.valueUsd)
    .slice(0, TREND_PAIRS)
    .map((now): PairTrend => {
      const before = reference.pairs.find(({ pool }) => pool === now.pool);
      return {
        pool: now.pool,
        pair: now.pair,
        feePpm: now.feePpm,
        currentPrice: now.currentPrice,
        then: before === undefined ? null : ratios(before),
        now: ratios(now),
        shareThen: before === undefined || !(totalThen > 0) ? null : before.valueUsd / totalThen,
        shareNow: now.valueUsd / totalNow,
        widths: inWindow.flatMap((snapshot) => {
          const there = snapshot.pairs.find(({ pool }) => pool === now.pool);
          return there === undefined ? [] : [there.upperPrice / there.lowerPrice - 1];
        }),
        positionsNow: now.positions,
      };
    });

  const pools = new Map<string, { pair: string; feePpm: number; from: number; to: number }>();
  for (const pair of reference.pairs) {
    pools.set(pair.pool, { pair: pair.pair, feePpm: pair.feePpm, from: totalThen > 0 ? pair.valueUsd / totalThen : 0, to: 0 });
  }
  for (const pair of latest.pairs) {
    const seen = pools.get(pair.pool);
    pools.set(pair.pool, {
      pair: pair.pair,
      feePpm: pair.feePpm,
      from: seen?.from ?? 0,
      to: pair.valueUsd / totalNow,
    });
  }
  const moves = [...pools].map(([pool, share]): Mover => ({ pool, ...share })).filter(({ from, to }) => Math.abs(to - from) >= MOVE_THRESHOLD);

  return {
    since: reference.at,
    days: (Date.parse(latest.at) - Date.parse(reference.at)) / 86_400_000,
    pairs,
    gaining: moves.filter(({ from, to }) => to > from).sort((a, b) => b.to - b.from - (a.to - a.from)).slice(0, MOVERS_SHOWN),
    losing: moves.filter(({ from, to }) => to < from).sort((a, b) => a.to - a.from - (b.to - b.from)).slice(0, MOVERS_SHOWN),
  };
};

/** What each holder has in the smart positions of the latest measurement: how many, and how much they are worth. */
export const currentHoldings = (
  smart: readonly MeasuredPosition[],
): ReadonlyMap<string, { readonly positions: number; readonly valueUsd: number }> => {
  const holdings = new Map<string, { positions: number; valueUsd: number }>();
  for (const { owner, valueUsd } of smart) {
    const address = owner.toLowerCase();
    const held = holdings.get(address) ?? { positions: 0, valueUsd: 0 };
    holdings.set(address, { positions: held.positions + 1, valueUsd: held.valueUsd + valueUsd });
  }
  return holdings;
};

export type PersistentHolder = {
  readonly address: string;
  /** In how many of the last `of` measurements it held a smart position. */
  readonly appeared: number;
  readonly of: number;
  readonly contract: boolean;
};

/**
 * The holders who keep turning up in the smart fifth, or `null` when there are
 * too few measurements to say anyone does. One measurement's smart fifth is
 * partly luck — a position that had a busy day — and only being in it again and
 * again is not.
 */
export const persistentHolders = (sets: readonly OwnerSet[]): readonly PersistentHolder[] | null => {
  const recent = sets.slice(-OWNER_SETS_MAX);
  if (recent.length < MIN_OWNER_SETS) return null;

  const counts = new Map<string, number>();
  const contract = new Map<string, boolean>();
  for (const set of recent) {
    for (const address of set.wallets) {
      counts.set(address, (counts.get(address) ?? 0) + 1);
      contract.set(address, false);
    }
    for (const address of set.contracts) {
      counts.set(address, (counts.get(address) ?? 0) + 1);
      contract.set(address, true);
    }
  }

  return [...counts]
    .filter(([, appeared]) => appeared / recent.length >= PERSISTENT_SHARE)
    .map(([address, appeared]): PersistentHolder => ({ address, appeared, of: recent.length, contract: contract.get(address) === true }))
    .sort((a, b) => b.appeared - a.appeared || a.address.localeCompare(b.address))
    .slice(0, PERSISTENT_SHOWN);
};
