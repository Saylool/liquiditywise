import {
  calculateDepositFeeShare,
  type DepositFeeShareResult,
} from "../analytics/depositFeeShare";
import { calculateDivergenceLoss } from "../analytics/divergenceLoss";
import { calculateRangeOrders, type RangeOrdersResult } from "../analytics/rangeOrder";
import { ACTIVITY_WINDOW_DAYS, calculatePoolActivity } from "../analytics/poolActivity";
import {
  type AnalyticsFailureReason,
  type DataFailureNotice,
  type DataFailureReason,
  type DataResult,
  type DivergenceLoss,
  type PoolActivity,
  type DataWarningNotice,
  statedSwapFee,
  type HistoricalVolatility,
  type Pool,
  type V3Pool,
  type V4Pool,
  type PoolDailyPriceHistory,
  type PoolMarketSnapshot,
  type PriceBandParameters,
  type TickRange,
  VOLATILITY_WINDOW_DAYS,
  type VolatilityPriceBand,
} from "../../schemas";
import { takeRecentDays } from "../analytics/dailyHistoryWindows";
import {
  calculateOutOfSampleCheck,
  type OutOfSampleCheckResult,
} from "../analytics/outOfSampleCheck";
import { calculateHistoricalVolatility } from "../analytics/historicalVolatility";
import {
  calculateRealizedFeeRate,
  type RealizedFeeRateResult,
} from "../analytics/realizedFeeRate";
import { calculateTickRange } from "../analytics/tickRange";
import { calculateVolatilityPriceBand } from "../analytics/volatilityPriceBand";

/*
 * The pure composition: three fetched inputs in, one range analysis out.
 *
 * This module performs no I/O and reads no clock. It takes the `DataResult`s a
 * caller already fetched, so the whole pipeline is testable without a network,
 * without credentials and without a server. The server-only wrapper beside it
 * supplies the fetches and nothing else.
 *
 * Pool identity is not re-checked here. Each calculator already refuses inputs
 * that describe different pools — volatility inherits the history's pool, the
 * band compares that against the snapshot's, and the range compares both against
 * the pool's — so a duplicate check here would add a second place to get it
 * wrong without adding a guarantee.
 */

/** Which stage of the pipeline produced a failure. */
export type PoolRangeAnalysisStep =
  | "pool"
  | "snapshot"
  | "history"
  | "volatility"
  | "band"
  | "range"
  | "divergence"
  | "activity";

/**
 * Everything the pipeline produced, each stage kept rather than summarised.
 *
 * A consumer that only wants the two ticks reads `range.lowerTick`; one that
 * needs to explain where they came from has the snapshot, the volatility and the
 * band that produced them, with all of their provenance intact.
 */
export type PoolRangeAnalysis = {
  readonly pool: Pool;
  readonly snapshot: PoolMarketSnapshot;
  readonly history: PoolDailyPriceHistory;
  readonly volatility: HistoricalVolatility;
  readonly band: VolatilityPriceBand;
  readonly range: TickRange;
  /** What that range is worth against holding, at a few prices. Needs no source. */
  readonly divergence: DivergenceLoss;
  /** What the pool did over the window, and how those days sat against the range. */
  readonly activity: PoolActivity;
  /**
   * The same method stepped back one horizon and checked against what followed.
   *
   * Carried as a *result* rather than as data, unlike every stage above it: a
   * pool too young to fit a band in the past still has every other figure on
   * this page, so failing to check costs the reader a panel and nothing else.
   */
  readonly outOfSample: OutOfSampleCheckResult;
  /**
   * What the pool actually charged over the same days, and whether that is what
   * it says it charges.
   *
   * Carried as a *result* like the check above it, for the same reason: a pool
   * that traded nothing this month has every other figure on the page, and the
   * honest answer to "what rate does it charge" is then that nobody paid one.
   *
   * It exists because v4 severed the link between the two. A v3 tier is the rate;
   * a v4 pool's hook may rewrite it on every swap, and this is the only way to
   * find out what it did without trusting the hook's author.
   */
  readonly realizedFee: RealizedFeeRateResult;
  /**
   * What a deposit of {@link depositUsd} would have taken of those fees.
   *
   * A result rather than data, like the two above it and for the same reason,
   * plus one of its own: it is the only figure on the page that needs the pool's
   * holdings to be priced in dollars, and a pool of two tokens the source does
   * not track cannot have one. Every other figure on such a pool is unaffected.
   */
  readonly depositFeeShare: DepositFeeShareResult;
  /**
   * The same range split at the price, as the two one-sided positions it
   * contains.
   *
   * A result rather than data, like the three above it, and the only one whose
   * absence is a property of the range itself: a range one price step wide has
   * no half to describe. It reads nothing — every figure in it comes from the
   * range and the pool's tick grid — so it cannot fail for want of a source.
   */
  readonly rangeOrders: RangeOrdersResult;
  readonly parameters: PriceBandParameters;
  /** The size the figure above was worked out for. Printed wherever it is. */
  readonly depositUsd: number;
};

export type PoolRangeAnalysisResult =
  | { readonly status: "success"; readonly data: PoolRangeAnalysis }
  | {
      readonly status: "partial";
      readonly data: PoolRangeAnalysis;
      /** Caveats gathered from every stage, in pipeline order. */
      readonly warnings: readonly DataWarningNotice[];
    }
  | {
      readonly status: "unavailable";
      /** Where it stopped, so a reader is not left guessing which figure is missing. */
      readonly step: PoolRangeAnalysisStep;
      readonly reason: DataFailureReason | AnalyticsFailureReason;
      /** What the stage that stopped says to tell the reader, as a code. */
      readonly notice: DataFailureNotice;
    };

export type PoolRangeAnalysisInput = {
  /**
   * Either protocol's pool, as its own reader returned it.
   *
   * A union of two results rather than one result of a union, because
   * `DataResult` names the fields a partial read is missing — and the fields a
   * `Pool` has in common are the ones both protocols share, which is not the set
   * either reader can report. Widening here would make `feePpm` unnameable.
   */
  readonly pool: DataResult<V3Pool> | DataResult<V4Pool>;
  readonly snapshot: DataResult<PoolMarketSnapshot>;
  readonly history: DataResult<PoolDailyPriceHistory>;
  readonly parameters: PriceBandParameters;
  /**
   * The deposit to size against the suggested range, in US dollars.
   *
   * Separate from {@link PriceBandParameters} because it is a different kind of
   * knob. The horizon and the multiplier decide *which range is suggested*; this
   * decides nothing at all about the analysis, and only scales one figure at the
   * end of it. Folding it in would have put a deposit into the band's schema,
   * into the out-of-sample check that refits that band, and into the cache key
   * of every reading — for a number none of them look at.
   */
  readonly depositUsd: number;
};

/**
 * A starting point for display, not a recommendation.
 *
 * A 30-day horizon matches the history window the daily reader fetches, and a
 * multiplier of 1 is the plainest thing to explain: one horizon standard
 * deviation. Neither number encodes a view about what range anyone should hold.
 */
export const DEFAULT_PRICE_BAND_PARAMETERS: PriceBandParameters = {
  horizonDays: 30,
  standardDeviationMultiplier: 1,
};

/**
 * The deposit the page works out a fee share for when nobody has said one.
 *
 * A thousand dollars, and it is a worked example rather than a suggestion: it is
 * printed beside every figure derived from it, and changed from the same form
 * that sets the band. Something had to be chosen — a page that asked for a
 * number before it would show anything would show nothing to most readers — and
 * a round figure in the middle of the offered sizes is the plainest thing to
 * label.
 */
export const DEFAULT_DEPOSIT_USD = 1_000;

/**
 * The part of a `DataResult` this composition reads.
 *
 * Narrower than `DataResult<T>` on purpose: that type also names which fields a
 * partial read is missing, and those names differ per pool protocol. Depending on
 * them here would stop one helper from accepting both readers' results, for a
 * field this module never looks at.
 */
type UnwrappableResult<T> =
  | { readonly status: "success"; readonly data: T }
  | {
      readonly status: "partial";
      readonly data: T;
      readonly warnings: readonly DataWarningNotice[];
    }
  | {
      readonly status: "unavailable";
      readonly reason: DataFailureReason;
      readonly notice: DataFailureNotice;
    };

/**
 * Unwraps a fetched result, collecting the caveats a partial one carries.
 *
 * A `partial` fetch is used, not refused: a snapshot that is missing rolling
 * volume still carries the price and tick this pipeline needs, and every figure
 * it *is* missing is either irrelevant here or fails a later stage on its own.
 * Its warnings are carried forward as they are — a fixed set of codes by
 * contract, so nothing from the wire can be copied into them here.
 */
const unwrap = <T,>(
  result: UnwrappableResult<T>,
  warnings: DataWarningNotice[],
):
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: DataFailureReason; readonly notice: DataFailureNotice } => {
  if (result.status === "unavailable") {
    return { ok: false, reason: result.reason, notice: result.notice };
  }
  if (result.status === "partial") warnings.push(...result.warnings);
  return { ok: true, value: result.data };
};

/**
 * Runs the deterministic half of the advisor: volatility, then a price band,
 * then the tick range that band aligns onto.
 *
 * Pure and clock-free. Identical input always produces a deeply equal result.
 *
 * Stops at the first stage that cannot produce a figure and says which one, so a
 * pool with two days of history and a pool behind an unreachable subgraph are
 * never reported the same way.
 */
export const analysePoolRange = (input: PoolRangeAnalysisInput): PoolRangeAnalysisResult => {
  const warnings: DataWarningNotice[] = [];

  /* Annotated, because inference from a union of results picks its first member. */
  const pool = unwrap<Pool>(input.pool, warnings);
  if (!pool.ok) {
    return { status: "unavailable", step: "pool", reason: pool.reason, notice: pool.notice };
  }

  const snapshot = unwrap(input.snapshot, warnings);
  if (!snapshot.ok) {
    return {
      status: "unavailable",
      step: "snapshot",
      reason: snapshot.reason,
      notice: snapshot.notice,
    };
  }

  const history = unwrap(input.history, warnings);
  if (!history.ok) {
    return {
      status: "unavailable",
      step: "history",
      reason: history.reason,
      notice: history.notice,
    };
  }

  /*
   * Measured over the most recent window only, not over everything fetched.
   *
   * The reader deliberately asks for far more days than a volatility figure
   * needs, so that a band can later be fitted at a point in the past and checked
   * against the days that followed. Handing the whole span to this calculator
   * would quietly turn a 30-day figure into a 120-day one.
   */
  const measured = takeRecentDays(history.value, VOLATILITY_WINDOW_DAYS);
  if (measured === null) {
    return {
      status: "unavailable",
      step: "volatility",
      reason: "invalid-input",
      notice: "volatility-invalid-input",
    };
  }

  const volatility = calculateHistoricalVolatility(measured);
  if (volatility.status === "unavailable") {
    return {
      status: "unavailable",
      step: "volatility",
      reason: volatility.reason,
      notice: volatility.notice,
    };
  }
  if (volatility.status === "partial") warnings.push(...volatility.warnings);

  const band = calculateVolatilityPriceBand({
    snapshot: snapshot.value,
    volatility: volatility.data,
    horizonDays: input.parameters.horizonDays,
    standardDeviationMultiplier: input.parameters.standardDeviationMultiplier,
  });
  if (band.status === "unavailable") {
    return { status: "unavailable", step: "band", reason: band.reason, notice: band.notice };
  }
  if (band.status === "partial") warnings.push(...band.warnings);

  const range = calculateTickRange({
    pool: pool.value,
    band: band.data,
    snapshot: snapshot.value,
  });
  if (range.status === "unavailable") {
    return { status: "unavailable", step: "range", reason: range.reason, notice: range.notice };
  }
  if (range.status === "partial") warnings.push(...range.warnings);

  /*
   * Last, and unlike every stage before it this one reads nothing. It compares
   * the range that came out of the pipeline against simply holding the two
   * tokens, which is arithmetic the protocol fixes — no window, no sample, no
   * source to be unavailable.
   */
  const divergence = calculateDivergenceLoss(range.data);
  if (divergence.status === "unavailable") {
    return {
      status: "unavailable",
      step: "divergence",
      reason: "calculation-error",
      notice: divergence.notice,
    };
  }

  /*
   * Also costs no request: every day it reads was already fetched for the
   * volatility figure.
   */
  const activity = calculatePoolActivity({ history: history.value, range: range.data });
  if (activity.status === "unavailable") {
    return {
      status: "unavailable",
      step: "activity",
      reason: "calculation-error",
      notice: activity.notice,
    };
  }

  /*
   * Last, and the only stage allowed to fail without stopping the pipeline. It
   * reads no source of its own — every day it uses was fetched for the
   * volatility figure — and it answers a question none of the figures above it
   * can: whether a band built this way has held, on days it was not fitted to.
   */
  const outOfSample = calculateOutOfSampleCheck({
    history: history.value,
    parameters: input.parameters,
  });

  /*
   * Measured over exactly the days the activity figures cover, because the two
   * are read together: the rate here is the one that produced the fees there,
   * and a spread measured over a different window would quietly be a spread of
   * something else.
   *
   * Like the check above, it cannot stop the pipeline. A pool with no volume has
   * no rate to measure and every other figure on this page is unaffected.
   */
  const realizedFee = calculateRealizedFeeRate({
    points: history.value.points.slice(-ACTIVITY_WINDOW_DAYS),
    stated: statedSwapFee(pool.value),
  });

  /*
   * Over exactly the days the two figures above cover, for the same reason they
   * cover each other's: the fees this divides up are the fees the activity panel
   * reports, and a share taken over a different set of days would sit beside a
   * total it is not a share of.
   *
   * Cannot stop the pipeline either. It is the only stage that needs the pool's
   * holdings priced in dollars, and a pool the source does not price still has
   * every other figure on the page.
   */
  /*
   * Costs nothing and reads nothing: the range is already computed and the tick
   * grid is the pool's. It is last among the calculators for the same reason it
   * is last on the page — it describes another use of the range rather than
   * another property of it.
   */
  const rangeOrders = calculateRangeOrders({ pool: pool.value, range: range.data });

  const depositFeeShare = calculateDepositFeeShare({
    points: history.value.points.slice(-ACTIVITY_WINDOW_DAYS),
    range: range.data,
    snapshot: snapshot.value,
    token0Decimals: pool.value.token0.decimals,
    token1Decimals: pool.value.token1.decimals,
    depositUsd: input.depositUsd,
  });

  const data: PoolRangeAnalysis = {
    pool: pool.value,
    snapshot: snapshot.value,
    history: history.value,
    volatility: volatility.data,
    band: band.data,
    range: range.data,
    divergence: divergence.data,
    activity: activity.data,
    outOfSample,
    realizedFee,
    depositFeeShare,
    rangeOrders,
    parameters: input.parameters,
    depositUsd: input.depositUsd,
  };

  if (warnings.length > 0) return { status: "partial", data, warnings };

  return { status: "success", data };
};
