import type { PoolDailyPriceHistory, Position, PriceBandParameters } from "../../schemas";
import { takeRecentDays } from "../analytics/dailyHistoryWindows";
import { calculateHistoricalVolatility } from "../analytics/historicalVolatility";
import { projectLogSymmetricBand } from "../analytics/logSymmetricBand";
import { ACTIVITY_WINDOW_DAYS } from "../analytics/poolActivity";
import { countOccupancy } from "../analytics/rangeOccupancy";
import { VOLATILITY_WINDOW_DAYS } from "../../schemas";
import { priceAtTick } from "../uniswap/v3TickMath";

/*
 * How one open position has fared against its pool's own recent days, and
 * the range this site would suggest for that pool beside it.
 *
 * Two figures a holder can check against their own choice, both from the
 * pool's daily history and nothing else: how many of the last thirty days
 * the price spent wholly inside the position's range, wholly outside it, or
 * across an edge — counted exactly as the pool page counts its own range —
 * and the band the same method draws at the default horizon and width.
 * Neither is a verdict on the position; the page says what each is.
 *
 * Pure: no clock, no network, no environment.
 */

export type PositionOutlook = {
  /** The last days of history counted, at most thirty. */
  readonly days: number;
  readonly inside: number;
  readonly outside: number;
  /** Days whose high and low straddled an edge, which a daily bar cannot place. */
  readonly crossed: number;
  /** The suggested range for the pool, token1 per token0 like the position's own, or `null` when it cannot be drawn. */
  readonly suggested: { readonly lowerPrice: number; readonly upperPrice: number } | null;
};

/** The pool's price now, from the position's own tick: the same price its "in range" was read at. */
const priceNow = (position: Position): number | null =>
  position.currentTick === null
    ? null
    : priceAtTick({
        tick: position.currentTick,
        token0Decimals: position.pool.token0.decimals,
        token1Decimals: position.pool.token1.decimals,
      });

/** The band the pool page would draw, at these parameters, around the price now. */
const suggestedBand = (
  history: PoolDailyPriceHistory,
  price: number | null,
  parameters: PriceBandParameters,
): PositionOutlook["suggested"] => {
  if (price === null) return null;
  const window = takeRecentDays(history, VOLATILITY_WINDOW_DAYS);
  if (window === null) return null;
  const volatility = calculateHistoricalVolatility(window);
  if (volatility.status === "unavailable") return null;
  const band = projectLogSymmetricBand({
    price,
    annualizedVolatility: volatility.data.annualizedVolatility,
    horizonDays: parameters.horizonDays,
    standardDeviationMultiplier: parameters.standardDeviationMultiplier,
  });

  return band === null ? null : { lowerPrice: band.lowerPrice, upperPrice: band.upperPrice };
};

/**
 * One position's outlook from its pool's history, or `null` when the history
 * is another pool's or holds no days at all.
 */
export const positionOutlook = ({
  position,
  history,
  parameters,
}: {
  readonly position: Position;
  readonly history: PoolDailyPriceHistory;
  readonly parameters: PriceBandParameters;
}): PositionOutlook | null => {
  const { pool } = position;
  const same =
    history.pool.protocolVersion === pool.protocolVersion &&
    history.pool.chainId === pool.chainId &&
    history.pool.id.toLowerCase() === pool.id.toLowerCase();
  if (!same) return null;

  const recent = history.points.slice(-ACTIVITY_WINDOW_DAYS);
  if (recent.length === 0) return null;
  const { occupancy } = countOccupancy(recent, position.lowerPrice, position.upperPrice);

  return {
    days: recent.length,
    inside: occupancy.fullyInside,
    outside: occupancy.fullyOutside,
    crossed: occupancy.undetermined,
    suggested: suggestedBand(history, priceNow(position), parameters),
  };
};
