import type { DataFailureNotice } from "../../schemas";
import type { ChainId } from "../chains/chains";
import { type CaseCandidate, caseCandidates, CASES_SHOWN, caseOf, type MonthCase, orderCases } from "./monthCases";
import type { PoolRangeAnalysisResult } from "./poolRangeAnalysis";
import type { MostTraded } from "./readMostTraded";

/*
 * One chain's cases, with every source handed in: the week's most traded
 * pools, and each pool's analysis exactly as its own page computes it.
 *
 * Pools are read busiest first, a few at a time, until there are enough
 * whole cases or no pools left — so a chain whose busiest pools all replay
 * stops after a dozen reads, and one where half of them cannot goes on into
 * the list until it has its dozen or has asked them all. A read that throws
 * costs that pool and nothing else, as it does for the smart-money page.
 *
 * Pure but for the sources; the server-only wrapper beside it supplies them.
 */

/** Pools analysed at once: a few, so a round does not queue at the gateway against a reader. */
const CONCURRENCY = 3;

export type MonthCasesRead =
  | {
      readonly status: "measured";
      readonly chainId: ChainId;
      readonly measuredAt: string;
      /** How many of the week's pools were read, and how many of those became cases. */
      readonly poolsAsked: number;
      readonly cases: readonly MonthCase[];
    }
  | { readonly status: "unavailable"; readonly notice: DataFailureNotice };

export type MonthCasesSources = {
  readonly listPools: () => Promise<MostTraded>;
  readonly analyse: (candidate: CaseCandidate) => Promise<PoolRangeAnalysisResult>;
  readonly now: () => Date;
};

const analyseOne = async (
  candidate: CaseCandidate,
  chainId: ChainId,
  sources: MonthCasesSources,
): Promise<MonthCase | null> => {
  try {
    return caseOf(await sources.analyse(candidate), chainId);
  } catch {
    return null;
  }
};

export const readMonthCases = async (chainId: ChainId, sources: MonthCasesSources): Promise<MonthCasesRead> => {
  const listed = await sources.listPools();
  const halves = [listed.v3, listed.v4].filter((half) => half !== null);
  /* Nothing listed at all is the list's failure, said as the list says it; a chain with no half is unreadable. */
  const failed = halves.find((half) => half.status === "unavailable");
  if (halves.length === 0 || (failed !== undefined && halves.every((half) => half.status === "unavailable"))) {
    return {
      status: "unavailable",
      notice: failed !== undefined && failed.status === "unavailable" ? failed.notice : "chain-data-not-configured",
    };
  }

  const candidates = caseCandidates(listed);
  const cases: MonthCase[] = [];
  let asked = 0;
  for (let start = 0; start < candidates.length && cases.length < CASES_SHOWN; start += CONCURRENCY) {
    const batch = candidates.slice(start, start + CONCURRENCY);
    asked += batch.length;
    const read = await Promise.all(batch.map((candidate) => analyseOne(candidate, chainId, sources)));
    for (const one of read) if (one !== null) cases.push(one);
  }

  return {
    status: "measured",
    chainId,
    measuredAt: sources.now().toISOString(),
    poolsAsked: asked,
    cases: orderCases(cases).slice(0, CASES_SHOWN),
  };
};
