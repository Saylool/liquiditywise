import type { ProtocolVersion } from "../../schemas";
import type { ChainId } from "../chains/chains";

/*
 * When a watched pool's suggested range has moved far enough to say so.
 *
 * Pure. The range compared is the one the pool page draws for the default
 * horizon and width, read through the same cached pipeline the embedded card
 * reads (poolWatchReads.ts), as two prices in the pool's own direction — the
 * way smartShift.ts compares the smart money's range, and never as ratios to
 * the price, which would make a price that moved on its own look like a
 * range that moved.
 *
 * **A tenth of the range's own width.** A range drawn from thirty days of
 * movement drifts with every day that closes, and a message for every drift
 * would be the measurement itself, daily. So an edge has to have moved by more
 * than a tenth of the range's log-width — the same share that counts a
 * position as "near" its edge (positionChanges.ts) — and once it has, the
 * range told becomes the new baseline. A slow drift is told when it has gone
 * far enough, once, and not with every step on the way.
 *
 * **Once a day at most.** The pass runs oftener than that, and a volatile
 * pool could cross the tenth on several passes in one day; the second
 * message would say what the first one did, from a day's new baseline. What
 * was told is kept with when it was told, and nothing is said again inside a
 * day of it, whatever the range does. The first range — the one the bot
 * answered `/watch` with — counts as told.
 */

/** How far an edge has to have moved, as a share of the range's own width in log space. */
export const POOL_RANGE_SHIFT_SHARE = 0.1;

/** The least time between two messages about one pool. */
export const POOL_RANGE_RETELL_MS = 24 * 60 * 60 * 1_000;

/** Two edges in the pool's own direction, lower first. */
export type PriceRange = readonly [number, number];

/**
 * What one read of a watched pool gives: the pool's name, the figures the
 * message prints, and the range in the pool's own direction, token1 per
 * token0, as every calculator here works.
 */
export type PoolRangeReading = {
  readonly protocol: ProtocolVersion;
  readonly chainId: ChainId;
  readonly poolId: string;
  readonly pair: { readonly token0: string; readonly token1: string };
  /** The fee providers are paid, in millionths; `null` when the pool's hook sets it per swap. */
  readonly lpFeePpm: number | null;
  readonly currentPrice: number;
  readonly range: PriceRange;
};

/** Whether either edge has moved by more than a tenth of the range's width it is compared with. */
export const hasRangeMoved = (then: PriceRange, now: PriceRange): boolean => {
  const width = Math.log(then[1] / then[0]);
  if (!(width > 0) || !(now[0] > 0) || !(now[1] > 0)) return false;

  return Math.max(Math.abs(Math.log(now[0] / then[0])), Math.abs(Math.log(now[1] / then[1]))) > POOL_RANGE_SHIFT_SHARE * width;
};

/** Whether a day has passed since the range was last told, so it may be told again. */
export const mayRetell = (toldAt: string, now: Date): boolean => {
  const told = Date.parse(toldAt);
  return Number.isNaN(told) || now.getTime() - told >= POOL_RANGE_RETELL_MS;
};

/** Both rules at once: the range read now is worth a message against the one last told at `toldAt`. */
export const shouldTell = (told: PriceRange, toldAt: string, now: PriceRange, at: Date): boolean =>
  hasRangeMoved(told, now) && mayRetell(toldAt, at);
