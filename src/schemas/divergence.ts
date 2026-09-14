import { z } from "zod";

import { ANALYTICS_CONSISTENCY_TOLERANCE } from "./analytics";
import { PositivePriceSchema } from "./primitives";

/*
 * What a position is worth against holding the two tokens, at a few prices.
 *
 * The one figure in this application that owes nothing to a data source. Two
 * range bounds and two prices determine it exactly, by the arithmetic of the
 * curve a Uniswap pool trades on — so unlike volatility or a band, there is no
 * window, no sample and no estimate anywhere in it.
 *
 * That makes the verification below different in kind from the others. Where the
 * band schema recomputes a statistic and the tick-range schema re-derives prices
 * from ticks, this one re-derives every ratio **in the other numéraire**: a
 * portfolio compared against another portfolio cannot depend on which of the two
 * tokens they are priced in. An arrangement that agrees in both is one that got
 * the algebra right, where re-running the calculator's own expression would
 * agree with itself whatever it did.
 */

/**
 * How far a ratio computed in token1 may sit from the same ratio computed in
 * token0 before it is treated as a disagreement.
 *
 * The two arrangements are algebraically identical, so any gap is floating-point
 * only. Shared with the other analytics schemas so the layers agree on what
 * "consistent" means.
 */
const TOLERANCE = ANALYTICS_CONSISTENCY_TOLERANCE;

export const DivergenceLossPointSchema = z.strictObject({
  /** The price the position is valued at. */
  price: PositivePriceSchema,
  /**
   * Position value over holding value, minus one, at that price.
   *
   * Never positive: a constant-product position cannot beat holding on price
   * movement alone — what it is paid for the difference is fee income, which
   * this figure deliberately says nothing about. Never below -1 either: a
   * position cannot be worth less than nothing.
   *
   * A ratio, not a percentage, like every other ratio in these schemas.
   */
  lossRatio: z.number().min(-1).max(0),
});

export type DivergenceLossPoint = z.infer<typeof DivergenceLossPointSchema>;

/** Amounts of one unit of liquidity, priced in whichever token the caller wants. */
const amountsAt = (price: number, lowerRoot: number, upperRoot: number) => {
  const root = Math.min(Math.max(Math.sqrt(price), lowerRoot), upperRoot);
  return { amount0: 1 / root - 1 / upperRoot, amount1: root - lowerRoot };
};

type Shape = {
  readonly lowerPrice: number;
  readonly upperPrice: number;
  readonly entryPrice: number;
  readonly points: readonly DivergenceLossPoint[];
};

const isCloseEnough = (actual: number, expected: number): boolean =>
  Math.abs(actual - expected) <= TOLERANCE * Math.max(1, Math.abs(expected));

/** Ascending, and each price appearing once. Two rows for one price say nothing. */
const pricesAreOrderedAndDistinct = ({ points }: Shape): boolean =>
  points.every((point, index) => {
    const previous = points[index - 1];
    return previous === undefined || previous.price < point.price;
  });

/**
 * Holding is worth exactly as much as the position when nothing has moved, so a
 * row at the entry price must read zero.
 *
 * The one value in here that can be checked without doing the arithmetic at all,
 * which is what makes it worth checking.
 */
const noLossWithoutMovement = ({ entryPrice, points }: Shape): boolean =>
  points.every((point) => point.price !== entryPrice || point.lossRatio === 0);

/**
 * Re-derives every ratio with token0 as the numéraire.
 *
 * The bounds are carried on the value rather than inferred from the points. They
 * were inferred at first — the outermost prices evaluated look like the range's
 * own edges — and that is true only while the pool's price is inside the range.
 * When it is not, an evaluated price sits outside, the inferred range is wider
 * than the real one, and this check rejects correct arithmetic. A value that
 * says which range it describes cannot be misread that way.
 */
const agreesInTheOtherNumeraire = ({
  lowerPrice,
  upperPrice,
  entryPrice,
  points,
}: Shape): boolean => {
  const lowerRoot = Math.sqrt(lowerPrice);
  const upperRoot = Math.sqrt(upperPrice);
  if (!(upperRoot > lowerRoot)) return false;

  const entryAmounts = amountsAt(entryPrice, lowerRoot, upperRoot);

  return points.every((point) => {
    const positionAmounts = amountsAt(point.price, lowerRoot, upperRoot);
    // Priced in token0: one token1 buys 1/price of token0.
    const held = entryAmounts.amount0 + entryAmounts.amount1 / point.price;
    const position = positionAmounts.amount0 + positionAmounts.amount1 / point.price;
    if (!(held > 0)) return false;

    return isCloseEnough(point.lossRatio, position / held - 1);
  });
};

export const DivergenceLossSchema = z
  .strictObject({
    /**
     * The price the position is treated as having been opened at.
     *
     * The pool's current price, because it is the only entry this application
     * can speak about: it does not know when anyone opened anything, and
     * inventing an entry would invent the whole figure.
     */
    entryPrice: PositivePriceSchema,
    /** The range being compared against holding. Stated, never inferred. */
    lowerPrice: PositivePriceSchema,
    upperPrice: PositivePriceSchema,
    points: z.array(DivergenceLossPointSchema).min(2),
  })
  .refine(({ lowerPrice, upperPrice }) => lowerPrice < upperPrice, {
    error: "A range's lower price must sit strictly below its upper price.",
    path: ["upperPrice"],
  })
  .refine(pricesAreOrderedAndDistinct, {
    error: "Divergence points must be ordered by price, with each price appearing once.",
    path: ["points"],
  })
  .refine(noLossWithoutMovement, {
    error: "A position valued at the price it was opened at has not diverged from holding.",
    path: ["points"],
  })
  .refine(agreesInTheOtherNumeraire, {
    error: "A divergence ratio must be the same whichever token the portfolios are priced in.",
    path: ["points"],
  });

export type DivergenceLoss = z.infer<typeof DivergenceLossSchema>;
