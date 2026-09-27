import type { PoolDailyPriceHistory, PoolMarketSnapshot, PriceBandParameters } from "../../schemas";
import { VOLATILITY_WINDOW_DAYS } from "../../schemas";
import { takeDaysEnding } from "./dailyHistoryWindows";
import { usdPerToken1 } from "./depositFeeShare";
import { amountsAt, valueInToken1 } from "./divergenceLoss";
import { calculateHistoricalVolatility } from "./historicalVolatility";
import { projectLogSymmetricBand } from "./logSymmetricBand";
import { ACTIVITY_WINDOW_DAYS } from "./poolActivity";
import { liquidityPerUnitValue } from "./rangeConcentration";
import { type Placement, placeDay } from "./rangeOccupancy";

/*
 * What a position would have done had it been opened thirty days ago, in the
 * range this site would have drawn then.
 *
 * No hindsight in the range: it is drawn from the thirty-one closes that ended
 * the day before the window, around the last of them, exactly as the
 * out-of-sample check draws its own. Then every day of the window since is
 * read against it.
 *
 * Two figures, kept apart because they rest on different things:
 *
 *   - **Worth against holding**, each day, from the exact concentrated-
 *     liquidity amounts at that day's close. A ratio of two holdings priced in
 *     the same token, so it needs no dollar rate and carries none.
 *   - **Fees**, from the pool's own daily fees on the days the price stayed
 *     wholly inside, shared as the deposit panel shares them. The history has
 *     no daily dollar rate for either token, so the deposit is turned into
 *     liquidity at today's rate — the same rate, and the same caveat, as the
 *     deposit panel; the page says so.
 *
 * Pure: no clock, no network, no environment. `null` when the history is too
 * short to draw a range before the window, or the range cannot be drawn.
 */

export type RangeBacktestDay = {
  readonly timestamp: string;
  readonly placement: Placement;
  /** The position's worth at the day's close over the worth of holding what it started with. */
  readonly valueVsHold: number;
};

export type RangeBacktest = {
  /** The last close the range was drawn from: the position's opening. */
  readonly openedAt: string;
  readonly openingPrice: number;
  readonly lowerPrice: number;
  readonly upperPrice: number;
  readonly days: readonly RangeBacktestDay[];
  readonly inside: number;
  readonly outside: number;
  readonly crossed: number;
  /** Worth against holding at the last close. */
  readonly endValueVsHold: number;
  /** `null` when the pool's dollar rate cannot be read, so no deposit can be sized. */
  readonly fees: {
    readonly usd: number;
    /** The fees over the deposit. */
    readonly ofDeposit: number;
    readonly daysCounted: number;
    /** Wholly-inside days whose fees or active liquidity the source did not give. */
    readonly daysUnmeasurable: number;
  } | null;
};

export type RangeBacktestInput = {
  readonly history: PoolDailyPriceHistory;
  readonly snapshot: PoolMarketSnapshot;
  readonly parameters: PriceBandParameters;
  readonly depositUsd: number;
  readonly token0Decimals: number;
  readonly token1Decimals: number;
};

export const calculateRangeBacktest = ({
  history,
  snapshot,
  parameters,
  depositUsd,
  token0Decimals,
  token1Decimals,
}: RangeBacktestInput): RangeBacktest | null => {
  const measured = takeDaysEnding(history, history.rangeEndExclusive, ACTIVITY_WINDOW_DAYS);
  if (measured === null || measured.points.length === 0) return null;
  const fitted = takeDaysEnding(history, measured.rangeStart, VOLATILITY_WINDOW_DAYS);
  const opening = fitted?.points.at(-1);
  if (fitted === null || opening === undefined || fitted.points.length < VOLATILITY_WINDOW_DAYS) return null;

  const volatility = calculateHistoricalVolatility(fitted);
  if (volatility.status === "unavailable") return null;
  const band = projectLogSymmetricBand({
    price: opening.price,
    annualizedVolatility: volatility.data.annualizedVolatility,
    horizonDays: parameters.horizonDays,
    standardDeviationMultiplier: parameters.standardDeviationMultiplier,
  });
  /* A band with no width holds nothing; the ratio below then is not a number, and the check on it refuses it. */
  if (band === null) return null;

  const lowerRoot = Math.sqrt(band.lowerPrice);
  const upperRoot = Math.sqrt(band.upperPrice);
  const started = amountsAt(opening.price, lowerRoot, upperRoot);

  const days = measured.points.map((point) => ({
    timestamp: point.timestamp,
    placement: placeDay(point, band.lowerPrice, band.upperPrice),
    valueVsHold: valueInToken1(amountsAt(point.price, lowerRoot, upperRoot), point.price) / valueInToken1(started, point.price),
  }));
  const last = days.at(-1);
  if (last === undefined || !Number.isFinite(last.valueVsHold)) return null;

  return {
    openedAt: opening.timestamp,
    openingPrice: opening.price,
    lowerPrice: band.lowerPrice,
    upperPrice: band.upperPrice,
    days,
    inside: days.filter(({ placement }) => placement === "inside").length,
    outside: days.filter(({ placement }) => placement === "outside").length,
    crossed: days.filter(({ placement }) => placement === "undetermined").length,
    endValueVsHold: last.valueVsHold,
    fees: feesTaken(measured, days, band, opening.price, snapshot, depositUsd, token0Decimals, token1Decimals),
  };
};

/** The deposit's share of each wholly-inside day's fees, as the deposit panel shares them. */
const feesTaken = (
  measured: PoolDailyPriceHistory,
  days: readonly RangeBacktestDay[],
  band: { readonly lowerPrice: number; readonly upperPrice: number },
  openingPrice: number,
  snapshot: PoolMarketSnapshot,
  depositUsd: number,
  token0Decimals: number,
  token1Decimals: number,
): RangeBacktest["fees"] => {
  const rate = usdPerToken1(snapshot);
  const perUnitValue = liquidityPerUnitValue(band, openingPrice);
  if (rate === null || perUnitValue === null) return null;
  const liquidity = (depositUsd / rate) * 10 ** ((token0Decimals + token1Decimals) / 2) * perUnitValue;

  let usd = 0;
  let daysCounted = 0;
  let daysUnmeasurable = 0;
  measured.points.forEach((point, index) => {
    if (days[index]?.placement !== "inside") return;
    const active = Number(point.activeLiquidity);
    if (point.feesUsd === null || !(active > 0)) {
      daysUnmeasurable += 1;
      return;
    }
    usd += point.feesUsd * (liquidity / (active + liquidity));
    daysCounted += 1;
  });

  return { usd, ofDeposit: usd / depositUsd, daysCounted, daysUnmeasurable };
};
