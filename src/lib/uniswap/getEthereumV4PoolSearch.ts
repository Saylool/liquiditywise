import "server-only";

import type { DataResult, V4PoolSearchResults } from "../../schemas";
import { logDetail, loggingFetch, logUnavailable } from "../observability/serverDiagnostics";
import { fetchEthereumV4PoolSearch } from "./ethereumV4PoolSearch";
import { ethereumSubgraphId } from "./ethereumSubgraphs";

/** Identifies this reader in server-side diagnostics. */
const LABEL = "v4-pool-search";

/*
 * The server-only boundary for the v4 half of a pool search. Same shape and
 * same reasons as the v3 one beside it; deliberately absent from every barrel.
 */
export const getEthereumV4PoolSearch = async (
  terms: readonly string[],
): Promise<DataResult<V4PoolSearchResults>> =>
  logUnavailable(
    LABEL,
    await fetchEthereumV4PoolSearch({
      terms,
      apiKey: process.env.THE_GRAPH_API_KEY,
      subgraphId: ethereumSubgraphId("v4"),
      rpcUrl: process.env.ETHEREUM_RPC_URL,
      fetchImpl: loggingFetch(LABEL),
      now: () => new Date(),
      onDiagnostic: (detail) => {
        logDetail(LABEL, detail);
      },
    }),
  );
