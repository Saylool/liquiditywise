import { calculateRangeBacktest, type RangeBacktest } from "../analytics/rangeBacktest";
import {
  calculateRecentringReplay,
  type RecentreSwapFee,
  type RecentringOutcome,
  recentreSwapFee,
} from "../analytics/recentringReplay";
import { feeDisclosureFor } from "./feeDisclosure";
import type { PoolRangeAnalysis } from "./poolRangeAnalysis";
import { comparedWidths } from "./widthComparison";

/*
 * Narrow or wide? The same month, replayed at every width the form offers, in
 * one table.
 *
 * The question a provider most often argues about is already answered on the
 * page — but one width at a time, and across four panels: the month replayed
 * ("opened thirty days ago"), the fees a deposit would have taken of it, the
 * worth against holding, and the re-centring strategy set beside it. A reader
 * who wants the answer for a wider range submits the form, waits, and holds
 * the last page in their head. This puts every width on one page, one row
 * each, computed by the very functions those panels are computed by.
 *
 * No arithmetic of its own. Each row is `calculateRangeBacktest` at that
 * width — the backtest panel's figure for that width, to the last bit — and
 * `calculateRecentringReplay` opened on it, which is the re-centring panel's.
 * The row for the width the page is showing therefore reproduces the two
 * panels exactly, which its test pins; the other rows are what those panels
 * would say if that width were chosen. The widths are the ones the widths
 * panel compares, through the same helper, so the two tables name the same
 * rows in the same order.
 *
 * It reads nothing. Every day it replays was fetched for the volatility
 * figure, and the extra widths cost one pass over a month of closes each, in
 * the same render; no request is made for them.
 *
 * What the fee figures may say is decided where it is decided for every other
 * fee figure on the page — `feeDisclosure.ts`. On a pool whose hook may alter
 * what a swap pays, the fees are not attributed to a range anywhere, and here
 * they are removed from every row rather than left for a consumer to hide:
 * `fees` is `null` on each, `feesWithheld` says why, and the re-centring
 * outcome is the one before fees, exactly as that panel reads it.
 *
 * Pure: no clock, no network, no environment. `null` when the history cannot
 * hold a month to replay, which is when the backtest panel is absent too.
 */

export type WidthsTableRecentring = {
  /** How many closes outside the range there were to re-centre on. */
  readonly recentres: number;
  /**
   * The re-centring panel's own outcome for this width: with the fees in
   * where that panel counts them, before them everywhere else.
   */
  readonly outcome: RecentringOutcome;
  /** Whether `outcome` counts the fees taken — the same gate as the panel's. */
  readonly withFees: boolean;
};

export type WidthsTableRow = {
  readonly standardDeviationMultiplier: number;
  /** The width the page's own range was drawn with. */
  readonly chosen: boolean;
  /**
   * The month replayed at this width: the range the method would have drawn
   * at the start of the month, the days against it, the worth against
   * holding, the fees on the deposit. `null` where that month could not be
   * replayed at this width.
   */
  readonly replay: RangeBacktest | null;
  /**
   * The same month re-centred whenever a day closed outside, at this width.
   * `null` wherever the re-centring panel says nothing: no replay to open on,
   * or a pool where nothing says what a swap pays.
   */
  readonly recentring: WidthsTableRecentring | null;
};

export type WidthsTable = {
  readonly rows: readonly WidthsTableRow[];
  /** The close every row opens at: the month replayed's own. */
  readonly openedAt: string;
  readonly horizonDays: number;
  /** The deposit every fee figure is sized for. */
  readonly depositUsd: number;
  /** What a re-centre was charged, or `null` when nothing could say and no row re-centres. */
  readonly swapFee: RecentreSwapFee | null;
  /** The cost per re-centre the page counts; zero counts none. */
  readonly gasPerRecentreUsd: number;
  /** Whether a hook on this pool may change what a swap costs or pays. */
  readonly hookMayAlterSwaps: boolean;
  /** True exactly when the hook rule removed the fees from every row. */
  readonly feesWithheld: boolean;
};

/**
 * Every offered width, and the chosen one if it was typed, replayed over the
 * month the backtest panel replays, each as the panels would show it.
 */
export const widthsTable = (analysis: PoolRangeAnalysis): WidthsTable | null => {
  const { pool, snapshot, history, realizedFee, backtest, recentring, parameters, depositUsd } = analysis;
  if (backtest === null) return null;

  const disclosure = feeDisclosureFor(pool);
  const feesWithheld = !disclosure.mayAttributeFeesToRange;
  const swapFee = recentreSwapFee(pool, realizedFee);
  /*
   * The cost the page counts, read off the page's own replay. Where that
   * replay is absent no row can re-centre either, and the figure is only
   * printed beside rows that do.
   */
  const gasPerRecentreUsd = recentring?.gas.perRecentreUsd ?? 0;
  const decimals = { token0Decimals: pool.token0.decimals, token1Decimals: pool.token1.decimals };

  const rows = comparedWidths(parameters.standardDeviationMultiplier).map((standardDeviationMultiplier): WidthsTableRow => {
    const replayed = calculateRangeBacktest({
      history,
      snapshot,
      parameters: { horizonDays: parameters.horizonDays, standardDeviationMultiplier },
      depositUsd,
      ...decimals,
    });
    const recentred =
      replayed === null || swapFee === null
        ? null
        : calculateRecentringReplay({
            history,
            snapshot,
            suggested: replayed,
            swapFee,
            depositUsd,
            gasUsdPerRecentre: gasPerRecentreUsd,
            ...decimals,
          });

    /*
     * With the fees in only where the re-centring panel has them in: the hook
     * rule first, then whether both strategies' fees could be sized.
     */
    const afterFees = feesWithheld || recentred === null ? null : recentred.afterFees;

    return {
      standardDeviationMultiplier,
      chosen: standardDeviationMultiplier === parameters.standardDeviationMultiplier,
      replay: replayed === null ? null : feesWithheld ? { ...replayed, fees: null } : replayed,
      recentring:
        recentred === null
          ? null
          : {
              recentres: recentred.recentres.length,
              outcome: afterFees ?? recentred.beforeFees,
              withFees: afterFees !== null,
            },
    };
  });

  return {
    rows,
    openedAt: backtest.openedAt,
    horizonDays: parameters.horizonDays,
    depositUsd,
    swapFee,
    gasPerRecentreUsd,
    hookMayAlterSwaps: disclosure.hookMayAlterSwaps,
    feesWithheld,
  };
};
