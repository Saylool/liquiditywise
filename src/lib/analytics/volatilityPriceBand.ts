import type { DataFailureNotice, DataWarningNotice } from "../../schemas";
import {
  type AnalyticsResult,
  ANNUALIZATION_DAYS,
  type HistoricalVolatility,
  HistoricalVolatilitySchema,
  type PoolMarketSnapshot,
  PoolMarketSnapshotSchema,
  PRICE_BAND_METHOD,
  type PriceBandParameters,
  PriceBandParametersSchema,
  VOLATILITY_METHOD,
  type VolatilityPriceBand,
  VolatilityPriceBandSchema,
} from "../../schemas";
import { projectLogSymmetricBand } from "./logSymmetricBand";

export type VolatilityPriceBandResult = AnalyticsResult<VolatilityPriceBand>;

const INVALID_INPUT = "band-invalid-input";
const NO_CURRENT_PRICE = "band-no-current-price";
const CALCULATION_ERROR = "band-unverifiable";

/*
 * Fixed warning text in a fixed order, so identical inputs warn identically and
 * nothing from the wire — pool address, timestamp, provider message — leaks into
 * something a user may eventually read.
 */
const INCOMPLETE_COVERAGE_WARNING = "band-window-incomplete";
const CURRENT_PRICE_FRESHNESS_WARNING = "band-price-block-time-unreported";
const VOLATILITY_FRESHNESS_WARNING = "band-volatility-block-time-unreported";

const unavailable = (
  reason: "invalid-input" | "insufficient-data" | "calculation-error",
  notice: DataFailureNotice,
): VolatilityPriceBandResult => ({ status: "unavailable", reason, notice });

export type VolatilityPriceBandInput = {
  readonly snapshot: PoolMarketSnapshot;
  readonly volatility: HistoricalVolatility;
} & PriceBandParameters;

/**
 * Builds a continuous, log-symmetric price band around the current pool price.
 *
 * Pure and clock-free: identical input always yields a deeply equal result.
 *
 * The model assumes zero drift — the band is centred on today's price, not on a
 * projected one — and is symmetric in log space, which makes it asymmetric in
 * percentage terms. It describes how far price has moved historically over a
 * horizon. It is not a forecast, and the multiplier is not a confidence level:
 * calling `2` a "95% band" would require a distributional assumption nothing here
 * establishes.
 *
 * The output is *not* a deployable Uniswap range. Converting these prices to
 * ticks needs the pool's verified tick spacing, token ordering and token
 * decimals, which the normalized snapshot does not yet carry.
 *
 * Both inputs are re-parsed through their own schemas even though they arrive
 * typed: this is a public boundary, and a cast or a JSON payload can deliver
 * something the arithmetic's invariants do not hold for.
 */
export const calculateVolatilityPriceBand = (
  input: VolatilityPriceBandInput,
): VolatilityPriceBandResult => {
  const parameters = PriceBandParametersSchema.safeParse({
    horizonDays: input.horizonDays,
    standardDeviationMultiplier: input.standardDeviationMultiplier,
  });
  if (!parameters.success) return unavailable("invalid-input", INVALID_INPUT);

  const snapshot = PoolMarketSnapshotSchema.safeParse(input.snapshot);
  if (!snapshot.success) return unavailable("invalid-input", INVALID_INPUT);

  const volatility = HistoricalVolatilitySchema.safeParse(input.volatility);
  if (!volatility.success) return unavailable("invalid-input", INVALID_INPUT);

  const { data: price } = snapshot;
  const { data: vol } = volatility;

  /*
   * Both inputs must describe the same pool. Without this, a band could centre
   * one pool's price on another pool's volatility and look entirely well-formed —
   * the single most dangerous way this calculation could be wrong.
   */
  if (
    price.pool.protocolVersion !== vol.pool.protocolVersion ||
    price.pool.chainId !== vol.pool.chainId ||
    price.pool.id !== vol.pool.id
  ) {
    return unavailable("invalid-input", INVALID_INPUT);
  }

  // Both sides must quote the same direction, or the band would be built around
  // one price and measured with the other's dispersion.
  if (vol.priceDirection !== "token0PriceInToken1") {
    return unavailable("invalid-input", INVALID_INPUT);
  }

  // Guard the provenance the band inherits: a differently-derived volatility
  // would make the horizon scaling below mean something else.
  if (vol.method !== VOLATILITY_METHOD || vol.annualizationDays !== ANNUALIZATION_DAYS) {
    return unavailable("invalid-input", INVALID_INPUT);
  }

  const currentPrice = price.token0PriceInToken1;
  if (currentPrice === null) return unavailable("insufficient-data", NO_CURRENT_PRICE);

  const projected = projectLogSymmetricBand({
    price: currentPrice,
    annualizedVolatility: vol.annualizedVolatility,
    horizonDays: parameters.data.horizonDays,
    standardDeviationMultiplier: parameters.data.standardDeviationMultiplier,
  });
  if (projected === null) return unavailable("calculation-error", CALCULATION_ERROR);

  const { horizonVolatility, logPriceDistance, lowerPrice, upperPrice } = projected;

  const candidate = {
    pool: price.pool,
    priceDirection: vol.priceDirection,
    method: PRICE_BAND_METHOD,
    annualizationDays: ANNUALIZATION_DAYS,

    horizonDays: parameters.data.horizonDays,
    standardDeviationMultiplier: parameters.data.standardDeviationMultiplier,

    currentPrice,
    currentPriceFetchedAt: price.fetchedAt,
    currentPriceSourceBlockNumber: price.sourceBlockNumber,
    currentPriceSourceBlockTimestamp: price.sourceBlockTimestamp,

    volatilitySourceFetchedAt: vol.sourceFetchedAt,
    volatilitySourceBlockNumber: vol.sourceBlockNumber,
    volatilitySourceBlockTimestamp: vol.sourceBlockTimestamp,
    volatilityRangeStart: vol.rangeStart,
    volatilityRangeEndExclusive: vol.rangeEndExclusive,
    volatilityReturnCoverageRatio: vol.returnCoverageRatio,

    annualizedVolatility: vol.annualizedVolatility,
    horizonVolatility,
    logPriceDistance,

    lowerPrice,
    upperPrice,
    downsideDistanceRatio: 1 - lowerPrice / currentPrice,
    upsideDistanceRatio: upperPrice / currentPrice - 1,
  };

  // The schema is the final authority: it re-derives every figure independently,
  // so an arithmetic slip cannot be published.
  const band = VolatilityPriceBandSchema.safeParse(candidate);
  if (!band.success) return unavailable("calculation-error", CALCULATION_ERROR);

  const warnings: DataWarningNotice[] = [];
  if (vol.returnCoverageRatio < 1) warnings.push(INCOMPLETE_COVERAGE_WARNING);
  if (price.sourceBlockTimestamp === null) warnings.push(CURRENT_PRICE_FRESHNESS_WARNING);
  if (vol.sourceBlockTimestamp === null) warnings.push(VOLATILITY_FRESHNESS_WARNING);

  if (warnings.length > 0) return { status: "partial", data: band.data, warnings };

  return { status: "success", data: band.data };
};
