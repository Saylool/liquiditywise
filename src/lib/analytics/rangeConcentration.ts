/*
 * How much of a pool's fees the same deposit would take, in one range against
 * another, while the price sits inside both.
 *
 * Unlike almost everything else in this directory it needs no market data: two
 * range bounds and a price, and the answer is exact. It is the arithmetic of
 * v3's position formulas rather than a claim about the future, and it is the
 * figure behind the sentence everybody repeats about concentrated liquidity —
 * that a narrower range does more with the same money.
 *
 * A position's share of the fees charged at a price is its share of the
 * liquidity active there, so comparing two ranges means comparing the liquidity
 * a fixed deposit buys in each. For a position of liquidity `L` in `[pa, pb]`
 * with the price `P` inside it:
 *
 *   amount0 = L · (1/√P − 1/√pb)
 *   amount1 = L · (√P − √pa)
 *
 * and the two together, priced in token1, come to
 *
 *   value = amount0 · P + amount1 = L · (2√P − √pa − P/√pb)
 *
 * so one unit of value buys `1 / (2√P − √pa − P/√pb)` of liquidity. The
 * bracket shrinks as the bounds close in on the price, which is the whole
 * effect: the same deposit becomes more liquidity over fewer prices.
 *
 * **It is a ratio between two ranges and nothing else.** The figure on its own
 * is in units of nothing — it depends on which token the deposit is measured in
 * — but that dependence is a constant factor shared by every range at one
 * price, so it cancels out of a ratio and the comparison is exact. Writing every
 * price the other way round cancels the same way, which is pinned by a test.
 *
 * **It assumes the rest of the pool is unchanged.** A deposit large enough to
 * move the total liquidity at a price would dilute its own share, and nothing
 * here knows how large a deposit is — this project does not size one.
 */

/**
 * The liquidity one unit of value buys in a range, at a price inside it.
 *
 * `null` when the price is not inside the range, and when the arithmetic does
 * not produce a positive finite number: a range that cannot hold the price is
 * not a range this figure means anything for, and a zero denominator is a
 * degenerate range rather than infinite concentration.
 */
export const liquidityPerUnitValue = (
  range: { readonly lowerPrice: number; readonly upperPrice: number },
  price: number,
): number | null => {
  const { lowerPrice, upperPrice } = range;
  if (!Number.isFinite(price) || price <= 0) return null;
  if (!(lowerPrice <= price && price <= upperPrice)) return null;

  const valuePerUnitLiquidity =
    2 * Math.sqrt(price) - Math.sqrt(lowerPrice) - price / Math.sqrt(upperPrice);
  if (!Number.isFinite(valuePerUnitLiquidity) || valuePerUnitLiquidity <= 0) return null;

  return 1 / valuePerUnitLiquidity;
};

/**
 * How much more of the fees charged at `price` a deposit takes in `range` than
 * the same deposit would take in `against`, on a day the price stays inside
 * both. `1` means the two are the same; `null` when either range cannot be
 * valued at that price.
 */
export const relativeFeeShare = (
  range: { readonly lowerPrice: number; readonly upperPrice: number },
  against: { readonly lowerPrice: number; readonly upperPrice: number },
  price: number,
): number | null => {
  const mine = liquidityPerUnitValue(range, price);
  const theirs = liquidityPerUnitValue(against, price);
  if (mine === null || theirs === null) return null;

  return mine / theirs;
};
