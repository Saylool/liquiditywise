import { ANNUALIZATION_DAYS } from "../../schemas";

/*
 * The arithmetic behind every band this application draws, in one place.
 *
 * Two callers need it and they need it to agree exactly: the band centred on the
 * pool's current price, and the same band fitted at a point in the past so the
 * method can be checked against the days that followed. A second copy of this
 * formula would let the check measure something the page never suggested.
 *
 * Pure: no clock, no network, no environment, no schema. Everything it is given
 * has already been validated by the caller that owns the contract, and
 * everything it returns is validated by that caller on the way out.
 */

export type LogSymmetricBandInput = {
  /** The price the band is centred on. Positive and finite. */
  readonly price: number;
  readonly annualizedVolatility: number;
  readonly horizonDays: number;
  readonly standardDeviationMultiplier: number;
};

export type LogSymmetricBand = {
  readonly horizonVolatility: number;
  readonly logPriceDistance: number;
  readonly lowerPrice: number;
  readonly upperPrice: number;
};

/**
 * Scales an annualised volatility onto a horizon and lays it symmetrically in
 * log space around a price.
 *
 * Zero drift: the band is centred on the price it was given, never on a
 * projected one. Symmetric in logs, which makes it deliberately asymmetric in
 * percentage terms — a move to half price and a move to double price are the
 * same distance in logs, and only one of them is "50%".
 *
 * Returns `null` when anything the exponential produced is not representable. An
 * underflowed lower bound arrives as exactly 0 and an overflowed upper bound as
 * Infinity; both are refused rather than replaced with an artificial bound,
 * because a substituted number is indistinguishable from a real one downstream.
 */
export const projectLogSymmetricBand = ({
  price,
  annualizedVolatility,
  horizonDays,
  standardDeviationMultiplier,
}: LogSymmetricBandInput): LogSymmetricBand | null => {
  const timeFractionYears = horizonDays / ANNUALIZATION_DAYS;
  const horizonVolatility = annualizedVolatility * Math.sqrt(timeFractionYears);
  const logPriceDistance = standardDeviationMultiplier * horizonVolatility;

  /*
   * A zero distance is a real state — a pool whose price never moved has no
   * measured dispersion — and its band is the price itself. It is computed by
   * identity rather than through `exp(log(p))`, which does not round-trip exactly
   * and for some prices lands a few ulps *above* `p`; that would invert the band
   * and turn a valid collapsed result into a failure.
   *
   * This is not a minimum width and not a clamp. Deciding whether a zero-width
   * band is deployable belongs to the later tick-alignment and policy layers.
   */
  const logPrice = Math.log(price);
  const lowerPrice = logPriceDistance === 0 ? price : Math.exp(logPrice - logPriceDistance);
  const upperPrice = logPriceDistance === 0 ? price : Math.exp(logPrice + logPriceDistance);

  if (
    !Number.isFinite(horizonVolatility) ||
    !Number.isFinite(logPriceDistance) ||
    !Number.isFinite(lowerPrice) ||
    !Number.isFinite(upperPrice) ||
    lowerPrice <= 0 ||
    upperPrice <= 0
  ) {
    return null;
  }

  return { horizonVolatility, logPriceDistance, lowerPrice, upperPrice };
};
