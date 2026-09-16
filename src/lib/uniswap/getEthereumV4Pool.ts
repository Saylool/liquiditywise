import "server-only";

import type { DataResult, V4Pool } from "../../schemas";
import { loggingFetch, logUnavailable } from "../observability/serverDiagnostics";
import { fetchEthereumV4Pool } from "./ethereumV4Pool";

/** Identifies this reader in server-side diagnostics. */
const LABEL = "v4-pool";

/*
 * The server-only boundary for one v4 pool.
 *
 * `import "server-only"` makes importing this from a Client Component a build
 * error, which is the guarantee that `THE_GRAPH_API_KEY` cannot be pulled into a
 * browser bundle. Deliberately absent from every barrel file.
 */

export const getEthereumV4Pool = async (poolId: string): Promise<DataResult<V4Pool>> =>
  logUnavailable(
    LABEL,
    await fetchEthereumV4Pool({
      poolId,
      apiKey: process.env.THE_GRAPH_API_KEY,
      subgraphId: process.env.UNISWAP_V4_ETHEREUM_SUBGRAPH_ID,
      rpcUrl: process.env.ETHEREUM_RPC_URL,
      fetchImpl: loggingFetch(LABEL),
    }),
  );
