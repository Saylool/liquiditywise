import type { V3PoolMetadata } from "../../schemas";
import type { PoolPositionEarnings } from "../uniswap/ethereumV3PositionEarnings";
import { amountsAt } from "./divergenceLoss";

/*
 * Where the liquidity providers who earn the most put their money.
 *
 * **"Smart" is measured, never assumed.** A position's fee yield is what it has
 * earned since it was last changed — read from the chain — against what it is
 * worth now, over the days between, annualised. The positions whose yield is in
 * the top fifth of everything measured are the smart ones; their pairs and
 * their ranges are what the page shows. Nothing here knows who anybody is, and
 * nothing is inferred from a wallet's size or its history elsewhere.
 *
 * **What the yield leaves out, and the page says so.** It is fees only: what
 * the position gave up against simply holding the two tokens is not in it. It
 * describes one window — since the position's last change — and a position
 * that has been rebalanced this morning has no window yet, which is why there
 * is a floor on its length. And it is a present-tense reading of positions
 * that are in range now; it says nothing about what they will earn.
 *
 * Pure: every figure is worked out from readings made upstream, and the same
 * readings give the same answer.
 */

/** A position smaller than this says little about skill and a lot about rounding. */
export const MIN_POSITION_USD = 10_000;

/** A window shorter than this is mostly noise: one busy afternoon reads as a year. */
export const MIN_WINDOW_DAYS = 3;

/** The share of measured positions, by yield, that counts as smart. */
export const SMART_SHARE = 0.2;

const DAY_SECONDS = 86_400;

export type PoolReading = {
  readonly pool: V3PoolMetadata;
  readonly usdPerToken0: number | null;
  readonly usdPerToken1: number | null;
  readonly earnings: PoolPositionEarnings;
  /** Each position's last change, in seconds since the epoch. */
  readonly lastChanges: ReadonlyMap<string, number>;
};

export type MeasuredPosition = {
  readonly pool: V3PoolMetadata;
  readonly tokenId: string;
  readonly owner: string;
  readonly valueUsd: number;
  readonly feesUsd: number;
  readonly days: number;
  /** Fees since the last change against the position's value now, per year, as a ratio (0.1 is 10%). */
  readonly yearlyYield: number;
  /** Prices as token0 in token1, the direction every price here is computed in. */
  readonly lowerPrice: number;
  readonly upperPrice: number;
  readonly currentPrice: number;
};

export type SmartPair = {
  readonly pool: V3PoolMetadata;
  readonly positions: number;
  readonly valueUsd: number;
  /** The middle smart position's range edges, each as a ratio to the price now. */
  readonly medianLowerRatio: number;
  readonly medianUpperRatio: number;
  readonly medianYearlyYield: number;
  readonly currentPrice: number;
};

export type SmartLiquidity = {
  /** Every position that met the size and window floors. */
  readonly measured: number;
  readonly medianYearlyYield: number | null;
  /** The lowest yield that still counts as smart. */
  readonly smartFrom: number | null;
  /** Highest yield first. */
  readonly smart: readonly MeasuredPosition[];
  /** Most smart money first. */
  readonly pairs: readonly SmartPair[];
};

const price = (tick: number, pool: V3PoolMetadata): number =>
  1.0001 ** tick * 10 ** (pool.token0.decimals - pool.token1.decimals);

const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[middle] as number) : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
};

/** The most positions per pool whose earnings are read from the chain. */
export const MAX_POSITIONS_PER_POOL = 100;

/** What a position of this liquidity and range is worth at a tick, in dollars. */
export const positionValueUsd = (
  pool: V3PoolMetadata,
  usdPerToken0: number,
  usdPerToken1: number,
  tick: number,
  position: { readonly liquidity: string; readonly tickLower: number; readonly tickUpper: number },
): number => {
  /* Amounts per unit of liquidity in raw units, from the pool's own price; scaled to whole tokens after. */
  const raw = amountsAt(1.0001 ** tick, 1.0001 ** (position.tickLower / 2), 1.0001 ** (position.tickUpper / 2));
  const liquidity = Number(position.liquidity);
  return (
    ((raw.amount0 * liquidity) / 10 ** pool.token0.decimals) * usdPerToken0 +
    ((raw.amount1 * liquidity) / 10 ** pool.token1.decimals) * usdPerToken1
  );
};

/**
 * Which listed positions are worth asking the chain about: the largest, and
 * none below the size floor. Chosen from the listing's liquidity; measured
 * again from the chain's.
 */
export const choosePositions = <P extends { readonly liquidity: string; readonly tickLower: number; readonly tickUpper: number }>(
  pool: V3PoolMetadata,
  usdPerToken0: number | null,
  usdPerToken1: number | null,
  tick: number,
  positions: readonly P[],
): readonly P[] => {
  if (usdPerToken0 === null || usdPerToken1 === null) return [];
  return positions
    .map((position) => ({ position, value: positionValueUsd(pool, usdPerToken0, usdPerToken1, tick, position) }))
    .filter(({ value }) => value >= MIN_POSITION_USD)
    .sort((a, b) => b.value - a.value)
    .slice(0, MAX_POSITIONS_PER_POOL)
    .map(({ position }) => position);
};

/** Every position in one pool that can be measured, with its yield. */
export const measurePositions = (reading: PoolReading, nowSeconds: number): readonly MeasuredPosition[] => {
  const { pool, usdPerToken0, usdPerToken1, earnings } = reading;
  if (usdPerToken0 === null || usdPerToken1 === null) return [];

  const current = price(earnings.tick, pool);
  const measured: MeasuredPosition[] = [];
  for (const position of earnings.positions) {
    const since = reading.lastChanges.get(position.tokenId);
    if (since === undefined) continue;
    const days = (nowSeconds - since) / DAY_SECONDS;
    if (!(days >= MIN_WINDOW_DAYS)) continue;

    const valueUsd = positionValueUsd(pool, usdPerToken0, usdPerToken1, earnings.tick, position);
    if (!(valueUsd >= MIN_POSITION_USD) || !Number.isFinite(valueUsd)) continue;

    const feesUsd =
      (Number(position.fees0) / 10 ** pool.token0.decimals) * usdPerToken0 +
      (Number(position.fees1) / 10 ** pool.token1.decimals) * usdPerToken1;
    if (!Number.isFinite(feesUsd) || feesUsd < 0) continue;

    measured.push({
      pool,
      tokenId: position.tokenId,
      owner: position.owner,
      valueUsd,
      feesUsd,
      days,
      yearlyYield: (feesUsd / valueUsd / days) * 365,
      lowerPrice: price(position.tickLower, pool),
      upperPrice: price(position.tickUpper, pool),
      currentPrice: current,
    });
  }
  return measured;
};

/** The smart fifth of every measured position, and the pairs it sits in. */
export const composeSmartLiquidity = (readings: readonly PoolReading[], nowSeconds: number): SmartLiquidity => {
  const measured = readings.flatMap((reading) => measurePositions(reading, nowSeconds));
  const ranked = [...measured].sort((a, b) => b.yearlyYield - a.yearlyYield);
  const smart = ranked.slice(0, Math.ceil(ranked.length * SMART_SHARE));

  const byPool = new Map<string, MeasuredPosition[]>();
  for (const position of smart) byPool.set(position.pool.id, [...(byPool.get(position.pool.id) ?? []), position]);

  const pairs: SmartPair[] = [...byPool.values()].map((positions) => {
    const first = positions[0] as MeasuredPosition;
    return {
      pool: first.pool,
      positions: positions.length,
      valueUsd: positions.reduce((sum, position) => sum + position.valueUsd, 0),
      medianLowerRatio: median(positions.map((position) => position.lowerPrice / position.currentPrice)) as number,
      medianUpperRatio: median(positions.map((position) => position.upperPrice / position.currentPrice)) as number,
      medianYearlyYield: median(positions.map((position) => position.yearlyYield)) as number,
      currentPrice: first.currentPrice,
    };
  });
  pairs.sort((a, b) => b.valueUsd - a.valueUsd);

  return {
    measured: measured.length,
    medianYearlyYield: median(measured.map((position) => position.yearlyYield)),
    smartFrom: smart.length === 0 ? null : (smart[smart.length - 1] as MeasuredPosition).yearlyYield,
    smart,
    pairs,
  };
};
