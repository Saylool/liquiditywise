import "server-only";

import { warmRangeInterpretation } from "../ai/getRangeInterpretation";
import { getMostTraded } from "./getMostTraded";
import { getPoolRangeAnalysis } from "./getPoolRangeAnalysis";
import { FRONT_PAGE_POOLS, type MostTradedList } from "./mostTraded";
import { DEFAULT_DEPOSIT_USD, DEFAULT_PRICE_BAND_PARAMETERS } from "./poolRangeAnalysis";

/*
 * Writes the explanation for the front page's pools before their first
 * reader, so the prose under the figures is there when the page is.
 *
 * Only the pools the front page shows, in English, at the default band the
 * front page's links carry, and only when none is kept for the pool as it
 * reads now: the key includes the range's ticks, so a pool whose price has
 * moved needs a new one, and one whose price has not costs nothing. Whether
 * that pays is in the weekly report, which counts explanations written ahead
 * and explanations served from the cache.
 */

/** Every fifty minutes: inside the explanation cache's hour. */
export const EXPLANATION_WARM_EVERY_MS = 50 * 60 * 1000;

/** After the most-traded warmer's first round, which reads the list this takes its pools from. */
export const EXPLANATION_FIRST_WARM_AFTER_MS = 2 * 60 * 1000;

/** The locale the front page is read in most, and the one crawlers are served. */
export const WARMED_LOCALE = "en";

const front = (list: MostTradedList | null) =>
  list === null || list.status !== "listed" ? [] : list.pools.slice(0, FRONT_PAGE_POOLS).map(({ pool }) => pool);

/** One round: each front-page pool analysed as a reader would open it, and its explanation written if missing. */
export const warmFrontPageExplanations = async (): Promise<readonly ("kept" | "written" | "failed" | "unread")[]> => {
  const data = await getMostTraded(1);
  const outcomes: ("kept" | "written" | "failed" | "unread")[] = [];

  for (const pool of [...front(data.v3), ...front(data.v4)]) {
    const analysis = await getPoolRangeAnalysis(
      pool.protocolVersion,
      pool.id,
      DEFAULT_PRICE_BAND_PARAMETERS,
      DEFAULT_DEPOSIT_USD,
      undefined,
      1,
    );
    if (analysis.status === "unavailable") {
      outcomes.push("unread");
      continue;
    }
    outcomes.push(
      await warmRangeInterpretation({
        analysis: analysis.data,
        warnings: analysis.status === "partial" ? analysis.warnings : [],
        locale: WARMED_LOCALE,
      }),
    );
  }

  return outcomes;
};
