import { argumentWord, decodeInt24, decodeUint, words } from "./abiWords";

/*
 * The four things a v3 pool has to be asked before anybody's fees can be worked
 * out, and how to read its answers.
 *
 * Pure: no network, no environment. A pool keeps no record of what any one
 * position is owed — it keeps running totals, and each initialised tick keeps
 * those totals as they stood on the far side of it. Turning that into one
 * position's earnings needs the totals, both of its ticks, and where the price
 * is now, because which side of a tick counts as "inside" depends on that.
 */

/**
 * The selectors, each the first four bytes of the keccak of its own signature.
 * Written out rather than hashed at load, and a test derives every one from its
 * signature so a wrong digit cannot survive.
 */
export const POOL_SLOT0_SELECTOR = "0x3850c7bd";
export const FEE_GROWTH_GLOBAL0_SELECTOR = "0xf3058399";
export const FEE_GROWTH_GLOBAL1_SELECTOR = "0x46141319";
export const TICKS_SELECTOR = "0xf30dba93";

/** The widest and narrowest tick the protocol admits, from `TickMath`. */
const MIN_TICK = -887_272;
const MAX_TICK = 887_272;

/** `ticks(tick)`: what the pool records at one initialised tick. */
export const ticksCalldata = (tick: number): string | null => {
  if (!Number.isInteger(tick) || tick < MIN_TICK || tick > MAX_TICK) return null;

  return `${TICKS_SELECTOR}${argumentWord(BigInt.asUintN(256, BigInt(tick)).toString(16))}`;
};

/** A running total from a one-word answer. */
export const decodeFeeGrowthGlobal = (data: unknown): bigint | null => {
  const parts = words(data);
  if (parts === null || parts.length !== 1) return null;

  const value = decodeUint(data, 0);

  return value === null ? null : BigInt(value);
};

/**
 * `slot0()`: only the tick is read from it.
 *
 * Seven words — the square-root price, the tick, three observation fields, the
 * protocol fee and the unlocked flag — and exactly seven is required, because
 * an answer of another width is another function's and the tick would be read
 * out of somebody else's field.
 */
export const decodePoolTick = (data: unknown): number | null => {
  const parts = words(data);

  return parts === null || parts.length !== 7 ? null : decodeInt24(data, 1);
};

/** What one tick records about fees, which is the far-side total per token. */
export type TickFeeGrowth = {
  readonly outside0: bigint;
  readonly outside1: bigint;
};

/**
 * Reads one `ticks(tick)` answer.
 *
 * Eight words: two liquidity figures packed as one, the two fee totals, then
 * the oracle's three and the initialised flag. Exactly eight is required for
 * the same reason as above — and a tick nobody has initialised answers with
 * eight zero words, which is a true answer: nothing has ever been outside it.
 */
export const decodeTickFeeGrowth = (data: unknown): TickFeeGrowth | null => {
  const parts = words(data);
  if (parts === null || parts.length !== 8) return null;

  const outside0 = decodeUint(data, 2);
  const outside1 = decodeUint(data, 3);
  if (outside0 === null || outside1 === null) return null;

  return { outside0: BigInt(outside0), outside1: BigInt(outside1) };
};
