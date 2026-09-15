import "server-only";

import type { DataResult, V4PoolCandidateList } from "../../schemas";
import { loggingFetch, logUnavailable } from "../observability/serverDiagnostics";
import { fetchEthereumV4TradedPools } from "./ethereumV4TradedPools";
import { ethereumSubgraphId } from "./ethereumSubgraphs";

/** Identifies this reader in server-side diagnostics. */
const LABEL = "v4-traded-pools";

/*
 * The server-only boundary for the v4 candidate list, with the same ten-minute
 * cache in front of it as the v3 list, for the reasons given there: the query
 * takes no input, the list is a net rather than a figure, and a ten-minute-old
 * net only means a pool listed since has not had its currencies asked about.
 */
const CACHE_TTL_MS = 10 * 60 * 1000;

type Entry = {
  readonly value: DataResult<V4PoolCandidateList>;
  readonly writtenAt: number;
};

let cached: Entry | null = null;

/** Exposed so a test can start from nothing rather than from another test's read. */
export const forgetV4TradedPools = (): void => {
  cached = null;
};

export const getEthereumV4TradedPools = async (): Promise<DataResult<V4PoolCandidateList>> => {
  const now = Date.now();
  if (cached !== null && now - cached.writtenAt < CACHE_TTL_MS) return cached.value;

  const result = await logUnavailable(
    LABEL,
    await fetchEthereumV4TradedPools({
      apiKey: process.env.THE_GRAPH_API_KEY,
      subgraphId: ethereumSubgraphId("v4"),
      fetchImpl: loggingFetch(LABEL),
      now: () => new Date(),
    }),
  );

  if (result.status === "success") cached = { value: result, writtenAt: now };

  return result;
};
