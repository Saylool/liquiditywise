/*
 * What a position has earned and not yet taken out.
 *
 * Pure, and the same arithmetic for both protocols — v3 and v4 keep fees the
 * same way, so this is written once and the two readers differ only in where
 * they find the words to hand it.
 *
 * **A pool never stores what any one position is owed.** It stores one running
 * total per token, "fees per unit of liquidity since the pool began", and each
 * tick stores that total as it stood on the far side of it. A position's share
 * is the total inside its range now, less the total inside its range when the
 * position was last touched, multiplied by its liquidity. Nothing is iterated
 * and nothing is estimated: the figure is exact, and it is the same one the
 * contract would arrive at.
 *
 * **The subtraction wraps, and that is not a bug to guard against.** These
 * totals are uint256 counters that overflow and keep counting; Solidity does it
 * `unchecked` on purpose, and the difference between two of them is correct
 * modulo 2^256 even when the later one is numerically smaller. Measured on
 * 2026-09-18, a live mainnet v4 position stored a `feeGrowthInside0LastX128` of
 * about 2^256 - 5.8e38 — so this is not a hypothetical: arithmetic that refused
 * to wrap would have reported that position's fees as an astronomical number.
 */

const MASK = (1n << 256n) - 1n;

/** `FixedPoint128.Q128`: fee growth is carried as a fixed-point fraction. */
const Q128 = 1n << 128n;

/**
 * The largest amount either protocol can record as owed.
 *
 * Both hold it as a `uint128`, and the v3 manager is Solidity 0.7.6, where the
 * cast wraps silently rather than reverting. So a share that does not fit is
 * not a large number — it is a number the protocol's own accounting has lost,
 * and the pool's aggregate for that range has usually lost it too.
 *
 * Measured on 2026-09-18: two live positions in a junk-token pool overflowed
 * it. Unwrapped arithmetic reported one of them as holding 10^35 of a token;
 * wrapping instead gave 3.2 x 10^38, and `collect` offered a third figure again
 * — the same one for both positions, because the pool's shared record had
 * wrapped as well. None of the three is what anyone earned, which is why this
 * reports that it could not be read.
 */
const MAX_OWED = (1n << 128n) - 1n;

/** Subtraction as the contracts do it: uint256, unchecked, wrapping. */
const minus = (left: bigint, right: bigint): bigint => (left - right) & MASK;

export type FeeGrowthInsideInput = {
  /** `feeGrowthGlobal{0,1}X128`: the pool's running total for one token. */
  readonly global: bigint;
  /** The same total as it stood outside the lower tick, and outside the upper. */
  readonly outsideLower: bigint;
  readonly outsideUpper: bigint;
  readonly tickCurrent: number;
  readonly tickLower: number;
  readonly tickUpper: number;
};

/**
 * `Tick.getFeeGrowthInside`, transcribed.
 *
 * A tick's stored total is "outside" relative to where the price was when that
 * tick was last crossed, so which side it describes depends on where the price
 * is now — which is why the current tick is an input and why a position's earned
 * fees cannot be read from the position alone.
 */
export const feeGrowthInside = ({
  global,
  outsideLower,
  outsideUpper,
  tickCurrent,
  tickLower,
  tickUpper,
}: FeeGrowthInsideInput): bigint => {
  const below = tickCurrent >= tickLower ? outsideLower : minus(global, outsideLower);
  const above = tickCurrent < tickUpper ? outsideUpper : minus(global, outsideUpper);

  /*
   * Taken away together rather than one after the other. Solidity's own line
   * subtracts them in sequence, and either order gives the same answer — which
   * is the point: an order that cannot be got wrong is one nobody has to check.
   */
  return minus(global, below + above);
};

export type UncollectedFeeInput = {
  /** Fee growth inside the range now, from {@link feeGrowthInside}. */
  readonly growthInside: bigint;
  /** The same, as it stood when this position was last touched. */
  readonly growthInsideLast: bigint;
  readonly liquidity: bigint;
  /**
   * What the manager had already credited at that moment. v3 records it per
   * token id; v4 keeps nothing of the kind and passes zero.
   */
  readonly owed: bigint;
};

/**
 * One token's uncollected fee, in that token's smallest unit.
 *
 * Floor division, because that is what `FullMath.mulDiv` does and the contract
 * never credits a fraction of a unit. `null` when the result would not fit the
 * `uint128` the protocol keeps it in — see {@link MAX_OWED}. Measured against the chain's own answer on
 * 2026-09-18: for sixteen live v3 positions this reproduced what `collect`
 * would have paid, exactly, for fifteen of them. The sixteenth came out one unit
 * apart, and not from rounding here — the manager and the pool each hold their
 * own snapshot of the same range, taken at different moments, so each floors a
 * different difference. This figure is the position's own accounting, which is
 * the one a holder is asking about; what the pool would hand over can differ
 * from it by a unit in either direction.
 */
export const uncollectedFee = ({
  growthInside,
  growthInsideLast,
  liquidity,
  owed,
}: UncollectedFeeInput): bigint | null => {
  const earned = owed + (minus(growthInside, growthInsideLast) * liquidity) / Q128;

  return earned > MAX_OWED ? null : earned;
};

/** One position's uncollected fees, in each token's smallest unit. */
export type PositionFees = {
  readonly token0: string;
  readonly token1: string;
};
