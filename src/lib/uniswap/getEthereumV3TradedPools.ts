import "server-only";

import type { DataResult, PoolCandidateList } from "../../schemas";
import { loggingFetch, logUnavailable } from "../observability/serverDiagnostics";
import { fetchEthereumV3TradedPools } from "./ethereumV3TradedPools";

/** Identifies this reader in server-side diagnostics. */
const LABEL = "v3-traded-pools";

/*
 * The server-only boundary for the candidate pool list, with a cache in front.
 *
 * `import "server-only"` makes importing this from a Client Component a build
 * error, which is the guarantee that `THE_GRAPH_API_KEY` cannot be pulled into a
 * browser bundle. Deliberately absent from every barrel file.
 */

/**
 * How long a candidate list may be reused.
 *
 * This is the one read here that is the same for every visitor: the query takes
 * no input at all. Measured on the live endpoint it costs 3.7 seconds cold and
 * 1.2 warm, and it was the largest single part of a holdings lookup.
 *
 * Reusing it is safe in a way that reusing a *figure* would not be. The list is
 * a net, not something shown to the reader — nothing on the page is derived from
 * it except which token contracts get asked. A ten-minute-old net can only mean
 * a pool listed in the last ten minutes has not had its tokens asked about yet,
 * which is a narrower version of the limit the page already states: this is a
 * search, and something outside the set searched is absent because nobody asked.
 *
 * Per instance, like every other store here. A platform running several copies
 * keeps several, and an entry is either valid or absent — never stale in one
 * place and fresh in another.
 */
const CACHE_TTL_MS = 10 * 60 * 1000;

type Entry = {
  readonly value: DataResult<PoolCandidateList>;
  readonly writtenAt: number;
};

let cached: Entry | null = null;

/** Exposed so a test can start from nothing rather than from another test's read. */
export const forgetTradedPools = (): void => {
  cached = null;
};

/**
 * Reads the most-traded pools, or hands back a recent read of them.
 *
 * Only a success is kept. Caching a failure would pin whatever went wrong in
 * place for ten minutes — a rate limit that has since cleared, a key that has
 * since been fixed — and the failure costs one query to discover again.
 */
export const getEthereumV3TradedPools = async (): Promise<DataResult<PoolCandidateList>> => {
  const now = Date.now();
  if (cached !== null && now - cached.writtenAt < CACHE_TTL_MS) return cached.value;

  const result = await logUnavailable(
    LABEL,
    await fetchEthereumV3TradedPools({
      apiKey: process.env.THE_GRAPH_API_KEY,
      subgraphId: process.env.UNISWAP_V3_ETHEREUM_SUBGRAPH_ID,
      fetchImpl: loggingFetch(LABEL),
      now: () => new Date(),
    }),
  );

  if (result.status === "success") cached = { value: result, writtenAt: now };

  return result;
};
