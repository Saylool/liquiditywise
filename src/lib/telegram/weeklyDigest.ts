import { type Mover, type SmartSnapshot, trendOf } from "../analytics/smartHistory";
import { type ChainId, readsV3Positions } from "../chains/chains";
import { hasShifted, MIN_SMART_POSITIONS } from "./smartShift";

/*
 * The Monday digest of where the smart money moved: when a chat that asked for
 * it is due one, and what it says.
 *
 * Pure. Nothing here measures anything: the digest is read off the series the
 * six-hourly measurement already keeps, through the same trend the
 * smart-money page draws, so a digest and the page it links to say the same
 * thing about the same week.
 *
 * **Due once a week, on Monday from 08:00 UTC.** What is kept per chat is only
 * when the last digest went out, and a chat is due when it is Monday, at or
 * after eight, and the last one went out before eight this Monday. The check
 * runs every few minutes, so the first pass after eight sends and every later
 * one finds it already sent — and since the time is in the store, not in the
 * process, a restart in between changes nothing. A send that fails records
 * nothing, so the next pass tries again; a Monday the server is down for
 * entirely is a week without a digest, not a digest on Tuesday.
 *
 * **Nothing rather than an empty message.** Until a day of measurements is
 * kept the trend says nothing (see MIN_TREND_MS), and a week in which no
 * pair's share or range moved enough to name has nothing to tell either; then
 * no message is sent and nothing is recorded, so a pass later that Monday,
 * with a measurement more, may still have something to say.
 *
 * **One reading, two readers.** The bot wants the digest or nothing; the
 * /weekly page wants to say *which* nothing — not a day measured yet, or a
 * week in which nothing moved — and the dates of the week it read. So the
 * whole composition is `weeklyReadingOf`, which says which of the three it
 * found, and `weeklyDigestOf` is that reading with everything but a digest
 * read as `null`. The arithmetic is in one place, and the page and the
 * message cannot drift apart on what counts as a move.
 */

/** The hour, UTC, on Monday from which the week's digest goes out. */
export const DIGEST_HOUR_UTC = 8;

/** How many pairs whose range moved are named. */
export const DIGEST_RANGES = 3;

const DAY_MS = 24 * 60 * 60 * 1_000;

/** Eight o'clock UTC on the Monday of `now`'s week (weeks starting Monday), whether or not it has passed. */
export const digestWeekStart = (now: Date): Date => {
  const sinceMonday = (now.getUTCDay() + 6) % 7;
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), DIGEST_HOUR_UTC) - sinceMonday * DAY_MS,
  );
};

/** Whether a chat whose last digest went out at `sentAt` (`null`: never) is due one at `now`. */
export const isDigestDue = (sentAt: string | null, now: Date): boolean => {
  if (now.getUTCDay() !== 1 || now.getUTCHours() < DIGEST_HOUR_UTC) return false;
  return sentAt === null || Date.parse(sentAt) < digestWeekStart(now).getTime();
};

/**
 * Which chain a link's digest is about: the link's own, where the smart
 * money is measured there, and Ethereum otherwise.
 *
 * A link with no chain in it is a mainnet link (see links.ts). One on a chain
 * whose positions cannot be listed — Unichain — has no smart-money series of
 * its own, and the digest is about the market rather than the address, so it
 * gets Ethereum's, the page's own default; the message names the chain, so it
 * cannot be read as being about the link's.
 */
export const digestChainOf = (chainId: ChainId | undefined): ChainId =>
  chainId !== undefined && readsV3Positions(chainId) ? chainId : 1;

export type RangeMove = {
  readonly pool: string;
  /** "USDC / WETH", as the page names it: token0 first. */
  readonly pair: string;
  readonly feePpm: number;
  /** The median smart range's edges as prices in the pool's own direction, at the first and the latest measurement of the week. */
  readonly then: readonly [number, number];
  readonly now: readonly [number, number];
  /** The price now, in the pool's direction: what chooses which way both ranges are quoted. */
  readonly currentPrice: number;
};

export type WeeklyDigest = {
  /** The days between the first measurement compared and the latest. */
  readonly days: number;
  readonly gaining: readonly Mover[];
  readonly losing: readonly Mover[];
  readonly ranges: readonly RangeMove[];
};

/** How many pairs are named for the yield of their smart positions. */
export const TOP_YIELDS = 3;

/** The week a reading is of: the first measurement compared and the latest, as the series dates them. */
export type WeeklyWindow = {
  readonly from: string;
  readonly to: string;
  /** The days between the two; what the digest's heading counts. */
  readonly days: number;
};

/** A pair at the latest measurement, by what its smart positions' median earns. */
export type TopYield = {
  readonly pool: string;
  /** "USDC / WETH", as the page names it: token0 first. */
  readonly pair: string;
  readonly feePpm: number;
  /** The median yearly fee yield of its smart positions, as a ratio. */
  readonly yearlyYield: number;
  readonly positions: number;
};

/**
 * What the kept series says about the week, for the page that shows it.
 *
 * `not-yet` until a day lies between the first measurement in the window and
 * the latest, which is when the trend first speaks (see MIN_TREND_MS);
 * `quiet` when there is a week to read and nothing in it moved enough to
 * name; `moved` with the digest the bot would send. The window and the top
 * yields are there whenever there is a week at all, so a quiet week still
 * says which week it was and what earned the most in it.
 */
export type WeeklyReading =
  | { readonly status: "not-yet" }
  | { readonly status: "quiet"; readonly window: WeeklyWindow; readonly topYields: readonly TopYield[] }
  | {
      readonly status: "moved";
      readonly window: WeeklyWindow;
      readonly topYields: readonly TopYield[];
      readonly digest: WeeklyDigest;
    };

/** How far a range moved, as its farther-moved edge over the width it had: the measure `hasShifted` holds to its threshold. */
const moveOf = (then: readonly [number, number], now: readonly [number, number]): number =>
  Math.max(Math.abs(Math.log(now[0] / then[0])), Math.abs(Math.log(now[1] / then[1]))) / Math.log(then[1] / then[0]);

/**
 * The pairs whose smart positions' median earned the most at the latest
 * measurement, highest first. A median of too few positions is one position's
 * yield with a word in front of it, so the floor the ranges keep applies
 * here too; a pair under it is left out rather than listed on one holder's
 * luck.
 */
const topYieldsOf = (latest: SmartSnapshot): readonly TopYield[] =>
  latest.pairs
    .filter(({ positions }) => positions >= MIN_SMART_POSITIONS)
    .map(({ pool, pair, feePpm, yearlyYield, positions }): TopYield => ({ pool, pair, feePpm, yearlyYield, positions }))
    .sort((a, b) => b.yearlyYield - a.yearlyYield)
    .slice(0, TOP_YIELDS);

/**
 * What the week's reading is — nothing to compare yet, a quiet week, or a
 * digest (see `WeeklyReading`).
 *
 * The movers are the trend's own. A range is named when the pair is one the
 * trend follows, its median was of enough positions at both ends of the week
 * to be a range at all, and it moved as far as the smart-money alert needs —
 * the same bar, so the digest does not call a drift a move that the alert
 * would not. The farthest moves first.
 */
export const weeklyReadingOf = (series: readonly SmartSnapshot[]): WeeklyReading => {
  const trend = trendOf(series);
  const latest = series[series.length - 1];
  const reference = series.find(({ at }) => at === trend?.since);
  if (trend === null || latest === undefined || reference === undefined) return { status: "not-yet" };

  const window: WeeklyWindow = { from: reference.at, to: latest.at, days: trend.days };
  const topYields = topYieldsOf(latest);

  const followed = new Set(trend.pairs.map(({ pool }) => pool));
  const ranges = latest.pairs
    .flatMap((now): { readonly range: RangeMove; readonly move: number }[] => {
      const before = reference.pairs.find(({ pool }) => pool === now.pool);
      if (!followed.has(now.pool) || before === undefined) return [];
      if (before.positions < MIN_SMART_POSITIONS || now.positions < MIN_SMART_POSITIONS) return [];

      const then = [before.lowerPrice, before.upperPrice] as const;
      const edges = [now.lowerPrice, now.upperPrice] as const;
      if (!hasShifted(then, edges)) return [];
      return [
        {
          range: { pool: now.pool, pair: now.pair, feePpm: now.feePpm, then, now: edges, currentPrice: now.currentPrice },
          move: moveOf(then, edges),
        },
      ];
    })
    .sort((a, b) => b.move - a.move)
    .slice(0, DIGEST_RANGES)
    .map(({ range }) => range);

  if (trend.gaining.length === 0 && trend.losing.length === 0 && ranges.length === 0) return { status: "quiet", window, topYields };
  return {
    status: "moved",
    window,
    topYields,
    digest: { days: trend.days, gaining: trend.gaining, losing: trend.losing, ranges },
  };
};

/** What the week's digest says, or `null` when it would say nothing: the bot's view of the reading. */
export const weeklyDigestOf = (series: readonly SmartSnapshot[]): WeeklyDigest | null => {
  const reading = weeklyReadingOf(series);
  return reading.status === "moved" ? reading.digest : null;
};
