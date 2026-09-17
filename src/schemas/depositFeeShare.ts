import { z } from "zod";

import { UsdAmountSchema } from "./primitives";

/*
 * What a deposit of a stated size would have taken of the fees a pool charged.
 *
 * Every fee figure elsewhere in this application is the *pool's*: what it
 * charged, what rate it charged at, how much of that it charged while the
 * suggested range was active. The page said so in as many words, and the front
 * page listed the missing half under "not built yet" — that what a particular
 * deposit would take of those fees needs a position size and its share of the
 * liquidity active at each price, and this application read neither.
 *
 * It reads both now, and neither costs a request. The size is the reader's, from
 * the form beside the range. The liquidity active on a day is `liquidity` on the
 * same `PoolDayData` rows the volatility figure is measured from — one more
 * field on a query that was already being made.
 *
 * The arithmetic is a share, not a model:
 *
 *   A position of liquidity `L` in a pool whose active liquidity is `A` takes
 *   `L / (A + L)` of everything charged while the price sits inside its range.
 *
 * The `+ L` is the deposit diluting itself, which is the part that surprises
 * people: doubling a deposit does not double what it collects, and on a pool
 * small enough the second half of the money earns visibly less than the first.
 * That is why the interface offers sizes a thousandfold apart rather than
 * printing a rate per dollar — the figure is not linear, and the non-linearity
 * is worth seeing.
 *
 * **It is arithmetic about days that have already happened.** It says what this
 * deposit would have taken had it been open, at today's prices for sizing, over
 * days it was not open for. It is not a yield, it is not annualised, and it is
 * not what the next thirty days will pay. It also counts fees only — what the
 * position gives up against simply holding the two tokens is the divergence
 * figure further down the same page, and the two have to be read together.
 */

/**
 * The smallest and largest deposit this will size.
 *
 * A dollar at the bottom because nothing below it is a deposit anybody makes,
 * and the arithmetic underflows into noise long before it. A billion at the top
 * because past it the share is almost entirely dilution — the answer is "you
 * would be the pool", which is true, useless, and not what the page is for.
 */
export const DEPOSIT_USD_MINIMUM = 1;
export const DEPOSIT_USD_MAXIMUM = 1_000_000_000;

/** A deposit, in US dollars, as the reader stated it. */
export const DepositUsdSchema = z
  .number()
  .min(DEPOSIT_USD_MINIMUM)
  .max(DEPOSIT_USD_MAXIMUM);

export type DepositUsd = z.infer<typeof DepositUsdSchema>;

/**
 * The published figure, checked before anything may print it.
 *
 * `daysCounted` is the days the pool's price never left the range *and* both
 * figures needed to divide that day's fees were present. `daysUnmeasurable` is
 * the rest of the first set: days inside the range that the source could not
 * answer for. They are separate because a figure covering nineteen of thirty
 * in-range days and one covering all thirty are different claims, and the page
 * has to be able to say which it is holding.
 */
const DepositFeeShareObject = z.strictObject({
  /** The size this was worked out for. Printed wherever the figure is. */
  depositUsd: DepositUsdSchema,
  /** Days fully inside the range whose fees and liquidity were both readable. */
  daysCounted: z.int().positive(),
  /** Days fully inside the range that the source could not answer for. */
  daysUnmeasurable: z.int().nonnegative(),
  /** What the whole pool charged over exactly `daysCounted` days. */
  poolFeesUsd: UsdAmountSchema,
  /** What this deposit would have taken of it. */
  depositFeesUsd: UsdAmountSchema,
  /**
   * Those fees as a fraction of the deposit, over those days and no others.
   *
   * Not a rate and deliberately not annualised: multiplying a month of one
   * pool's fees by twelve states a year nobody measured, and the days counted
   * are not a month in the first place — they are however many of it the price
   * spent inside the range.
   */
  shareOfDeposit: z.number().nonnegative(),
});

export const DepositFeeShareSchema = DepositFeeShareObject.refine(
  (share) => share.depositFeesUsd <= share.poolFeesUsd,
  {
    /*
     * A share of something cannot exceed it. Reachable only through a bug — a
     * share above one, a mismatched day set — and it is the one invariant that
     * would otherwise print a deposit collecting more than the pool charged.
     */
    error: "A deposit cannot take more in fees than the pool charged.",
    path: ["depositFeesUsd"],
  },
);

export type DepositFeeShare = z.infer<typeof DepositFeeShareSchema>;
