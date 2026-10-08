import type { V3PoolMetadata, V4Pool } from "../../schemas";
import type { ChainId } from "../chains/chains";
import { feeDisclosureFor } from "./feeDisclosure";
import type { MostTradedPool } from "./mostTraded";
import type { PoolRangeAnalysisResult } from "./poolRangeAnalysis";
import type { MostTraded } from "./readMostTraded";

/*
 * A month that already happened, as a case: one pool's own replay, reduced
 * to the figures a reader can carry away in a sentence.
 *
 * The pool page already replays the last thirty days for every pool it
 * shows — "opened thirty days ago" (rangeBacktest.ts), and the same month
 * re-centred whenever a day closed outside (recentringReplay.ts). This module
 * takes that analysis, exactly as the page computed it with its default
 * parameters, and keeps what a case needs: the range, how the days sat
 * against it, what the default deposit would have taken in fees, what the
 * position ended the month worth against simply holding, and what
 * re-centring would have changed. Nothing is computed anew here; a figure on
 * a case is the figure on the pool's page, so the two cannot disagree.
 *
 * **A case is whole or it is nothing.** A pool whose month cannot be replayed
 * — too young a history, a hook that may alter what swaps pay, a dollar rate
 * the source does not give, an inside day whose fees it did not publish — is
 * not a case with a blank in it. It is left out, and the page says how many
 * were. A card with "fees unread" on it would read as a smaller figure, and a
 * partial case is a claim the figures cannot carry.
 *
 * **The order is one figure, stated.** Best to worst by what the position,
 * opened in the suggested range and never re-centred, ended the month worth
 * with its fees against holding its opening tokens — in dollars, on the
 * default deposit. The never-re-centred strategy, because that is the
 * suggested range as drawn; the figure with fees in, because fees are what a
 * position is for; against holding, because that is the comparison every
 * other panel on the site makes. Nothing editorial sits beside it: a "best"
 * case is the one with the largest number, and the number is printed.
 *
 * Pure: no clock, no network, no environment.
 */

/** How many cases a chain's page shows, at most: the most-traded page's own count. */
export const CASES_SHOWN = 12;

export type MonthCase = {
  /** As the most-traded list names it: enough for a card and a link, never the tick spacing a v3 read adds. */
  readonly pool: V3PoolMetadata | V4Pool;
  readonly chainId: ChainId;
  /**
   * The pool's own price at the analysis, token1 per token0. Kept so the card
   * can quote the range the way the pool's page does — which way round is
   * decided from this price (priceQuote.ts) — rather than deciding here.
   */
  readonly currentPrice: number;
  /** The close the position opened at, and the last close it was read to. */
  readonly openedAt: string;
  readonly closedAt: string;
  /** The suggested range, in the pool's own direction. */
  readonly lowerPrice: number;
  readonly upperPrice: number;
  /** The window's days against the range: wholly inside, wholly outside, across an edge. */
  readonly inside: number;
  readonly outside: number;
  readonly crossed: number;
  /** Worth against holding at the last close, fees aside. */
  readonly endValueVsHold: number;
  /** The deposit every dollar figure below is for. */
  readonly depositUsd: number;
  /** The fees the deposit would have taken on the wholly-inside days, and those over the deposit. */
  readonly feesUsd: number;
  readonly feesOfDeposit: number;
  /**
   * The ordering figure: the never-re-centred position's end value, fees in,
   * less what holding the opening tokens would be worth at the last close.
   * Positive is better than holding.
   */
  readonly resultVsHeldUsd: number;
  /** How many times the re-centring strategy re-centred over the same month. */
  readonly recentres: number;
  /** Re-centred less never re-centred, everything counted; gas not counted, as the page's default. */
  readonly recentringDifferenceUsd: number;
};

/**
 * One case from one pool's analysis, or `null` when the month is not whole.
 *
 * Every refusal is a figure the card would have had to leave blank:
 *   - the analysis stopped before a range (`unavailable`);
 *   - the hook may alter what swaps pay, so no fee may be attributed to a
 *     range here (feeDisclosure.ts) — the page withholds the figure, and a
 *     case without fees is not a case;
 *   - the history cannot open a position thirty days before its end;
 *   - the dollar rate was unread, so the deposit could not be sized;
 *   - a wholly-inside day had no published fees or active liquidity;
 *   - the re-centring strategy could not be replayed beside it, or its own
 *     fees could not be sized, so there is no verdict to give.
 *
 * A `partial` analysis is read like a `success`: its warnings are the
 * source's caveats about figures this case does not carry (a snapshot
 * missing rolling volume, say), and every figure it does carry is present
 * or the checks below refuse it.
 */
export const caseOf = (analysis: PoolRangeAnalysisResult, chainId: ChainId): MonthCase | null => {
  if (analysis.status === "unavailable") return null;
  const { pool, band, backtest, recentring, depositUsd } = analysis.data;

  if (!feeDisclosureFor(pool).mayAttributeFeesToRange) return null;
  if (backtest === null || backtest.fees === null || backtest.fees.daysUnmeasurable > 0) return null;
  if (recentring === null || recentring.afterFees === null || recentring.fees === null) return null;
  if (recentring.fees.daysUnmeasurable > 0) return null;

  const lastDay = backtest.days[backtest.days.length - 1];
  if (lastDay === undefined) return null;

  const listed: V3PoolMetadata | V4Pool =
    pool.protocolVersion === "v3"
      ? {
          protocolVersion: "v3",
          chainId: pool.chainId,
          id: pool.id,
          token0: pool.token0,
          token1: pool.token1,
          feePpm: pool.feePpm,
        }
      : pool;

  return {
    pool: listed,
    chainId,
    currentPrice: band.currentPrice,
    openedAt: backtest.openedAt,
    closedAt: lastDay.timestamp,
    lowerPrice: backtest.lowerPrice,
    upperPrice: backtest.upperPrice,
    inside: backtest.inside,
    outside: backtest.outside,
    crossed: backtest.crossed,
    endValueVsHold: backtest.endValueVsHold,
    depositUsd,
    feesUsd: backtest.fees.usd,
    feesOfDeposit: backtest.fees.ofDeposit,
    resultVsHeldUsd: recentring.afterFees.neverVsHeldUsd,
    recentres: recentring.recentres.length,
    recentringDifferenceUsd: recentring.afterFees.differenceUsd,
  };
};

/**
 * Best first, by the one figure the page states; a tie by pool id, so two
 * reads of the same month put the same case first.
 */
export const orderCases = (cases: readonly MonthCase[]): readonly MonthCase[] =>
  [...cases].sort((left, right) =>
    right.resultVsHeldUsd !== left.resultVsHeldUsd
      ? right.resultVsHeldUsd - left.resultVsHeldUsd
      : left.pool.id < right.pool.id
        ? -1
        : left.pool.id > right.pool.id
          ? 1
          : 0,
  );

/** What the reader needs of a pool before its month is read: which it is, and how much it traded. */
export type CaseCandidate = {
  readonly protocolVersion: "v3" | "v4";
  readonly id: string;
  readonly volumeUsd: number;
};

/**
 * The week's pools worth replaying, busiest first across both protocols.
 *
 * A pool whose hook may alter swaps is left out here rather than after its
 * reads: the case would be refused anyway (see {@link caseOf}), and the three
 * reads an analysis costs are better spent on a pool that can become one.
 * The two halves are merged by volume — unlike the most-traded page, which
 * keeps them apart — because this list decides which pools are *read*, not
 * how any is ranked; the ranking is the figure, later.
 */
export const caseCandidates = (listed: MostTraded): readonly CaseCandidate[] => {
  const pools = (half: MostTraded["v3"]): readonly MostTradedPool[] =>
    half === null || half.status !== "listed" ? [] : half.pools;

  return [...pools(listed.v3), ...pools(listed.v4)]
    .filter((entry) => !entry.hookAltersSwaps)
    .map(({ pool, volumeUsd }) => ({ protocolVersion: pool.protocolVersion, id: pool.id, volumeUsd }))
    .sort((left, right) => right.volumeUsd - left.volumeUsd);
};
