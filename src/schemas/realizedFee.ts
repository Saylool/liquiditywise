import { z } from "zod";

/*
 * What a pool actually charged, measured rather than declared.
 *
 * Every other fee figure in this application is the pool's *declared* rate: the
 * number in the v3 factory's fee tier, or in a v4 PoolKey. In v3 that number is
 * the whole truth — the fee is fixed at deployment and nothing can move it.
 *
 * v4 broke the equivalence, and this module exists because of it. A hook runs on
 * every swap and can rewrite what the swap costs, so a v4 pool's declared tier is
 * a starting point rather than a rate. The difference is not small and not
 * theoretical: measured over the 31 days to 2026-09-14, the busiest hooked pool
 * on mainnet — USDC/WETH behind hook 0x0000000aa232… — declares 250 ppm and
 * charged between 25 and 230 ppm depending on the day. Ninefold, inside one
 * month, on a pool whose page would otherwise print "0.025%" and stop.
 *
 * So the rate is divided back out of figures the source already publishes:
 * `feesUSD / volumeUSD` for a day is what that day's swappers actually paid,
 * whoever decided it. It costs no request — every day it reads was fetched for
 * the volatility figure — and it needs to know nothing about the hook.
 *
 * **It is a measurement of the past, and it is not a forecast.** A hook that
 * charged 25 ppm yesterday may charge 500 today. What the spread says is that
 * there is no single number to put on the page, which is the thing a reader most
 * needs to know and the thing a fee tier alone would hide.
 */

/**
 * How far a measured rate may sit from the declared one before they are called
 * different.
 *
 * Chosen from the noise floor, not from an opinion. Across 1517 pool-days on
 * fifty pools where nothing can rewrite the fee — 25 v3 pools and 25 hookless v4
 * pools, the busiest of each — the measured rate never departed from the declared
 * tier by more than 2.8e-16 relative: one double-precision ulp, which is the
 * source dividing and this module multiplying back. 1e-9 sits six orders of
 * magnitude above that.
 *
 * It sits further still below any real disagreement. The smallest genuine one
 * found in the same sweep was a hooked pool charging 92% of its declared tier —
 * eight parts in a hundred, seven orders above this bound. There is nothing in
 * between for a threshold to get wrong.
 */
export const DECLARED_FEE_TOLERANCE = 1e-9;

/**
 * A rate in parts-per-million of the amount swapped, as measured.
 *
 * A float, unlike {@link V3FeePpmSchema} and its v4 counterpart, which are
 * integers: those are on-chain values stored as integers, this is a quotient of
 * two dollar figures and lands wherever the division lands. Rounding it to an
 * integer would report a hook charging 0.4 ppm as charging nothing.
 *
 * Bounded above by a whole swap. A pool cannot charge more than it traded, and a
 * figure claiming otherwise is a source contradiction rather than an expensive
 * pool.
 */
export const MeasuredFeePpmSchema = z.number().min(0).max(1_000_000);

export type MeasuredFeePpm = z.infer<typeof MeasuredFeePpmSchema>;

export const RealizedFeeRateSchema = z
  .strictObject({
    /**
     * Days the rate could actually be divided out of: both figures present, and
     * volume above zero.
     *
     * At least one, because this type does not exist otherwise — a pool that
     * traded nothing all month has no realized rate, and the calculator reports
     * that as absence rather than as a rate of zero.
     */
    daysMeasured: z.int().min(1),
    /**
     * Days in the window that could not be measured: no volume, or a figure the
     * source did not report.
     *
     * Carried rather than dropped, because it is what says how much of the month
     * the spread below actually describes. Three measured days out of thirty is
     * a different claim from thirty out of thirty, and the numbers look the same.
     */
    daysUnmeasurable: z.int().min(0),

    /** The cheapest and dearest days. Equal when the rate never moved. */
    lowestPpm: MeasuredFeePpmSchema,
    highestPpm: MeasuredFeePpmSchema,
    /**
     * The middle day, which is where the rate usually sat.
     *
     * Reported beside the extremes because a single unusual day should not be
     * able to describe the month on its own — and on a hooked pool one of the
     * extremes very often is exactly that.
     */
    medianPpm: MeasuredFeePpmSchema,
    /**
     * The whole window's fees over the whole window's volume.
     *
     * Volume-weighted by construction, which is the honest average of a rate:
     * the mean of the daily rates would give a quiet Sunday the same say as the
     * day that traded a hundred times as much.
     */
    aggregatePpm: MeasuredFeePpmSchema,
  })
  .refine(({ lowestPpm, highestPpm }) => lowestPpm <= highestPpm, {
    error: "The lowest measured rate cannot exceed the highest.",
    path: ["highestPpm"],
  })
  .refine(
    ({ lowestPpm, highestPpm, medianPpm }) => lowestPpm <= medianPpm && medianPpm <= highestPpm,
    {
      error: "The median rate must sit between the lowest and the highest measured day.",
      path: ["medianPpm"],
    },
  )
  /*
   * A weighted mean of values cannot leave their range, so this catches a
   * calculator that summed the wrong columns rather than a pool doing something
   * unusual.
   *
   * With a tolerance, unlike the median above, and the difference is not
   * fussiness. The median is *selected* from the daily rates — or averaged from
   * two of them, which IEEE-754 keeps inside the pair — so it cannot leave their
   * range at all. The aggregate is a different division: the sum of fees over
   * the sum of volumes, never touching the daily quotients. On a pool that
   * charged the same rate every day the two disagree in the last bit, and this
   * refusing it is not theoretical — Uniswap v3's busiest pool, USDC/WETH at 5
   * bps, produced daily rates spanning 499.99999999999989 to 500.00000000000011
   * and an aggregate of 500.00000000000023: one ulp above the highest day, which
   * took the whole panel off the page. The tolerance is the same 1e-9 the
   * declared-rate comparison uses, seven orders above that and far below any
   * difference a summing mistake would produce.
   */
  .refine(
    ({ lowestPpm, highestPpm, aggregatePpm }) =>
      aggregatePpm >= lowestPpm - DECLARED_FEE_TOLERANCE * Math.max(1, lowestPpm) &&
      aggregatePpm <= highestPpm + DECLARED_FEE_TOLERANCE * Math.max(1, highestPpm),
    {
      error: "The window's aggregate rate must sit between the lowest and highest day.",
      path: ["aggregatePpm"],
    },
  );

export type RealizedFeeRate = z.infer<typeof RealizedFeeRateSchema>;

/**
 * What the measurement says about the rate the pool declares.
 *
 * A verdict rather than a boolean, because the three cases call for three
 * different sentences and collapsing them would lose the one that matters. A
 * pool with no declared rate at all — v4's dynamic fee, where the PoolKey
 * carries a sentinel instead of a number — is not a pool that "disagrees": there
 * is nothing to disagree with, and the measurement is the only rate there is.
 */
export type DeclaredFeeVerdict =
  | {
      /** Every measured day matched the declared rate. */
      readonly kind: "matches";
      readonly declaredPpm: number;
    }
  | {
      /** At least one day did not. The declared rate is not what swappers paid. */
      readonly kind: "differs";
      readonly declaredPpm: number;
      /** How many of the measured days departed from it. */
      readonly daysDiffering: number;
    }
  | {
      /** The pool declares no fixed rate; its hook sets one per swap. */
      readonly kind: "none-declared";
    };
