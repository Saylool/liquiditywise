import type { HistoricalPricePoint, PoolDailyPriceHistory, PoolMarketSnapshot, PriceBandParameters } from "../../schemas";
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
 * The same replay runs in a range the reader chose, too: same opening, same
 * days, same fee sharing, only the range differs — which is what lets the page
 * set the two side by side and say the difference is the range's.
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

/**
 * The window replayed and the close it opens at, or `null` when the history
 * cannot hold both.
 *
 * Shared, so a range the reader chose opens on exactly the day the drawn one
 * does and is read over exactly the same days — and is refused on exactly the
 * same histories, even though it needs no volatility of its own. A reader
 * comparing the two should never be comparing two different months.
 */
const replayWindow = (
  history: PoolDailyPriceHistory,
): { readonly measured: PoolDailyPriceHistory; readonly fitted: PoolDailyPriceHistory; readonly opening: HistoricalPricePoint } | null => {
  const measured = takeDaysEnding(history, history.rangeEndExclusive, ACTIVITY_WINDOW_DAYS);
  if (measured === null || measured.points.length === 0) return null;
  const fitted = takeDaysEnding(history, measured.rangeStart, VOLATILITY_WINDOW_DAYS);
  const opening = fitted?.points.at(-1);
  if (fitted === null || opening === undefined || fitted.points.length < VOLATILITY_WINDOW_DAYS) return null;

  return { measured, fitted, opening };
};

export const calculateRangeBacktest = ({
  history,
  snapshot,
  parameters,
  depositUsd,
  token0Decimals,
  token1Decimals,
}: RangeBacktestInput): RangeBacktest | null => {
  const window = replayWindow(history);
  if (window === null) return null;
  const { measured, fitted, opening } = window;

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

  return replayBand({ measured, opening, band, snapshot, depositUsd, token0Decimals, token1Decimals });
};

export type CustomRangeBacktest = RangeBacktest & {
  /**
   * Whether the opening close sat inside the chosen range.
   *
   * Always true of a drawn range, which is centred on that close; a chosen one
   * can sit wholly to one side of it, and then the position opened holding
   * only one of the two tokens. The page says so, because every figure in the
   * panel reads differently for a position that started out of range.
   */
  readonly openedInside: boolean;
};

export type CustomRangeBacktestInput = {
  readonly history: PoolDailyPriceHistory;
  readonly snapshot: PoolMarketSnapshot;
  /**
   * The chosen range's edges, in the history's own units: whole token1 per
   * whole token0, the direction every computed price here is in. Turning the
   * prices a reader typed — in whichever direction the page showed them — into
   * these is the caller's job, and `priceQuote.ts` is where it is done.
   */
  readonly lowerPrice: number;
  readonly upperPrice: number;
  readonly depositUsd: number;
  readonly token0Decimals: number;
  readonly token1Decimals: number;
};

/**
 * The same replay, in a range the reader chose rather than one drawn from
 * volatility.
 *
 * Everything but the range is the drawn replay's: the same opening close, the
 * same thirty days, the same worth against holding, the same fee sharing — so
 * the two can sit side by side and differ only by the range. It is also
 * refused wherever the drawn one is, for the same reason: on a history too
 * short to open before the window there is nothing to compare it with.
 *
 * Its own refusals are the range's: edges that are not positive and finite,
 * and a lower edge that is not below the upper. Pure, like everything above.
 */
export const calculateCustomRangeBacktest = ({
  history,
  snapshot,
  lowerPrice,
  upperPrice,
  depositUsd,
  token0Decimals,
  token1Decimals,
}: CustomRangeBacktestInput): CustomRangeBacktest | null => {
  if (!Number.isFinite(lowerPrice) || !Number.isFinite(upperPrice)) return null;
  if (!(lowerPrice > 0) || !(lowerPrice < upperPrice)) return null;

  const window = replayWindow(history);
  if (window === null) return null;
  const { measured, opening } = window;

  const replayed = replayBand({
    measured,
    opening,
    band: { lowerPrice, upperPrice },
    snapshot,
    depositUsd,
    token0Decimals,
    token1Decimals,
  });
  if (replayed === null) return null;

  return { ...replayed, openedInside: lowerPrice <= opening.price && opening.price <= upperPrice };
};

/**
 * One range, opened at one close and read over the window: the part both
 * replays share, so a drawn range and a chosen one cannot be counted two ways.
 */
const replayBand = ({
  measured,
  opening,
  band,
  snapshot,
  depositUsd,
  token0Decimals,
  token1Decimals,
}: {
  readonly measured: PoolDailyPriceHistory;
  readonly opening: HistoricalPricePoint;
  readonly band: { readonly lowerPrice: number; readonly upperPrice: number };
  readonly snapshot: PoolMarketSnapshot;
  readonly depositUsd: number;
  readonly token0Decimals: number;
  readonly token1Decimals: number;
}): RangeBacktest | null => {
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

/**
 * The liquidity one unit of value buys in the range, opened at a price.
 *
 * Inside the range it is the deposit panel's own figure, unchanged. Outside it
 * — which only a chosen range can be, since a drawn one is centred on the
 * opening — the deposit buys a one-sided position, and the same identity holds:
 * one unit of liquidity is worth exactly what the amounts it holds at that
 * price are worth. `amountsAt` already pins those amounts to the nearer edge,
 * and the decimal factor applied after this is the same either side of an edge.
 */
const liquidityPerUnitValueAt = (
  band: { readonly lowerPrice: number; readonly upperPrice: number },
  price: number,
): number | null => {
  if (band.lowerPrice <= price && price <= band.upperPrice) return liquidityPerUnitValue(band, price);

  const perUnitLiquidity = valueInToken1(amountsAt(price, Math.sqrt(band.lowerPrice), Math.sqrt(band.upperPrice)), price);
  return Number.isFinite(perUnitLiquidity) && perUnitLiquidity > 0 ? 1 / perUnitLiquidity : null;
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
  const perUnitValue = liquidityPerUnitValueAt(band, openingPrice);
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
