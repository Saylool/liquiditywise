import type { DataFailureNotice, DivergenceLoss, DivergenceLossPoint, TickRange } from "../../schemas";
import { DivergenceLossSchema } from "../../schemas";

/*
 * What a position in this range is worth against simply holding the two tokens.
 *
 * The interface calls it impermanent loss because that is what everyone calls
 * it. The name is slightly wrong and the page says so: nothing about it is
 * impermanent once a position is closed at a different price than it opened —
 * it is only undone if price comes back. "Divergence" is what it actually
 * measures, so that is what it is called here.
 *
 * Unlike everything else in this directory it needs no market data at all. Two
 * range bounds, an entry price and a price to evaluate at, and the answer is
 * exact. There is no forecast in it and nothing to estimate: it says what the
 * arithmetic of a constant-product curve does between two prices, which is a
 * fact about the protocol rather than a claim about the future.
 *
 * **It is size-independent.** Liquidity cancels out of the ratio — both the
 * position and the holding scale with it — so this can be reported without ever
 * sizing a deposit, which this project does not do.
 */

/**
 * The amounts one unit of liquidity holds at a price, in a range.
 *
 * Uniswap v3's position formulas with `L = 1`. Outside the range the position is
 * entirely one token, which the clamp expresses: below it `s` sticks at `sa` and
 * `amount1` is zero; above it `s` sticks at `sb` and `amount0` is zero.
 */
const amountsAt = (
  price: number,
  lowerRoot: number,
  upperRoot: number,
): { readonly amount0: number; readonly amount1: number } => {
  const root = Math.min(Math.max(Math.sqrt(price), lowerRoot), upperRoot);

  return { amount0: 1 / root - 1 / upperRoot, amount1: root - lowerRoot };
};

/** A holding of both tokens, priced in token1. */
const valueInToken1 = (
  amounts: { readonly amount0: number; readonly amount1: number },
  price: number,
): number => amounts.amount0 * price + amounts.amount1;

/**
 * Log-spaced prices to evaluate at: each range edge, the current price, and the
 * geometric midpoint between the current price and each edge.
 *
 * Geometric rather than arithmetic because the band that produced this range is
 * symmetric in log space, and so is price movement. Five points are enough to
 * show that the curve is not a straight line, which is the part a reader is most
 * likely to guess wrong.
 */
const evaluationPrices = (
  lowerPrice: number,
  upperPrice: number,
  currentPrice: number,
): readonly number[] => {
  const midpoint = (a: number, b: number) => Math.sqrt(a * b);
  const prices = [
    lowerPrice,
    midpoint(lowerPrice, currentPrice),
    currentPrice,
    midpoint(currentPrice, upperPrice),
    upperPrice,
  ];

  // Sorted and deduplicated: a current price sitting on an edge would otherwise
  // produce two rows saying the same thing.
  return [...new Set(prices)].sort((a, b) => a - b);
};

export type DivergenceLossResult =
  | { readonly status: "success"; readonly data: DivergenceLoss }
  | { readonly status: "unavailable"; readonly notice: DataFailureNotice };

/**
 * Measures the divergence of one tick range against holding, at several prices.
 *
 * Pure: no clock, no network, no environment. The entry price is the pool's
 * current price — the only entry this application can speak about, since it does
 * not know when anyone opened anything.
 */
export const calculateDivergenceLoss = (range: TickRange): DivergenceLossResult => {
  const entryPrice = range.band.currentPrice;
  const lowerRoot = Math.sqrt(range.lowerPrice);
  const upperRoot = Math.sqrt(range.upperPrice);

  const entryAmounts = amountsAt(entryPrice, lowerRoot, upperRoot);

  const points: DivergenceLossPoint[] = [];
  for (const price of evaluationPrices(range.lowerPrice, range.upperPrice, entryPrice)) {
    const held = valueInToken1(entryAmounts, price);
    const position = valueInToken1(amountsAt(price, lowerRoot, upperRoot), price);

    /*
     * A holding worth nothing has no ratio. It needs an entry sitting exactly on
     * an edge *and* a zero-width range, which the range schema already refuses —
     * but a division that can produce Infinity is not left to an argument about
     * why it cannot happen.
     */
    if (!(held > 0)) return { status: "unavailable", notice: "divergence-unverifiable" };

    points.push({ price, lossRatio: position / held - 1 });
  }

  const candidate = {
    entryPrice,
    lowerPrice: range.lowerPrice,
    upperPrice: range.upperPrice,
    points,
  };

  /*
   * The schema is the authority, and for this it re-derives every ratio with
   * token0 as the numéraire instead of token1. A ratio of two portfolio values
   * cannot depend on which token they are priced in, so an arrangement that
   * agrees in both is one that got the algebra right — where re-running this
   * function's own expression would agree with itself whatever it did.
   */
  const verified = DivergenceLossSchema.safeParse(candidate);
  if (!verified.success) return { status: "unavailable", notice: "divergence-unverifiable" };

  return { status: "success", data: verified.data };
};
