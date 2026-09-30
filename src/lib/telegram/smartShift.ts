import type { SmartPair } from "../analytics/smartLiquidity";
import type { Position } from "../../schemas";

/*
 * When the best-earning liquidity of a pool has moved, for the alert that says
 * so — only for a chat that asked for it, and only about pools its address
 * holds a position in.
 *
 * Pure. What is compared is the smart positions' median range as prices in the
 * pool's own direction, so a price that moved on its own is not a shift: the
 * range of a pool's smart liquidity only changes when the liquidity does.
 *
 * **Told once per move.** What was last told is kept as the baseline and only
 * replaced when it is told again, so a range drifting slowly is told when it
 * has drifted far enough, once, and not with every measurement on the way.
 * The first reading of a pool is a baseline and never an alert, as the
 * position alerts' first reading is.
 */

/** How far an edge has to have moved, as a share of the range's own width in log space. */
export const SMART_SHIFT_SHARE = 0.5;

/** A median of fewer positions than this moves with any one of them; it is not a range to alert on. */
export const MIN_SMART_POSITIONS = 5;

export type SmartRangeBaselines = Readonly<Record<string, readonly [number, number]>>;

export type SmartShift = {
  readonly pair: SmartPair;
  readonly then: readonly [number, number];
  readonly now: readonly [number, number];
};

export const smartPoolKey = (poolId: string): string => poolId.toLowerCase();

/** Whether a range's edges have moved far enough from another's to be told. */
export const hasShifted = (then: readonly [number, number], now: readonly [number, number]): boolean => {
  const width = Math.log(then[1] / then[0]);
  if (!(width > 0) || !(now[0] > 0) || !(now[1] > 0)) return false;

  return Math.max(Math.abs(Math.log(now[0] / then[0])), Math.abs(Math.log(now[1] / then[1]))) / width >= SMART_SHIFT_SHARE;
};

/**
 * The shifts to tell, and the baselines to keep for next time.
 *
 * A held pool the measurement has nothing solid on this time keeps the
 * baseline it had, and a pool no longer held loses it.
 */
export const smartShifts = (
  baselines: SmartRangeBaselines,
  positions: readonly Position[],
  pairs: ReadonlyMap<string, SmartPair>,
): { readonly shifts: readonly SmartShift[]; readonly ranges: SmartRangeBaselines } => {
  const held = new Set(positions.filter(({ pool }) => pool.protocolVersion === "v3").map(({ pool }) => smartPoolKey(pool.id)));
  const shifts: SmartShift[] = [];
  const ranges: Record<string, readonly [number, number]> = {};

  for (const key of held) {
    const before = baselines[key];
    const pair = pairs.get(key);
    const solid = pair !== undefined && pair.positions >= MIN_SMART_POSITIONS;

    if (!solid) {
      if (before !== undefined) ranges[key] = before;
      continue;
    }

    const now: readonly [number, number] = [pair.medianLowerPrice, pair.medianUpperPrice];
    if (before !== undefined && hasShifted(before, now)) {
      shifts.push({ pair, then: before, now });
      ranges[key] = now;
    } else {
      ranges[key] = before ?? now;
    }
  }

  return { shifts, ranges };
};
