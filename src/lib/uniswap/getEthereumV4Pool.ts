import "server-only";

import type { DataResult, V4Pool } from "../../schemas";
import { rpcUrlFor, v4SubgraphIdFor } from "../chains/chainEnvironment";
import type { ChainId } from "../chains/chains";
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
 *
 * On a chain v4 is not read on there is no subgraph, and the read reports
 * itself unconfigured rather than asking mainnet's.
 */
export const getEthereumV4Pool = async (poolId: string, chainId: ChainId = 1): Promise<DataResult<V4Pool>> =>
  logUnavailable(
    LABEL,
    await fetchEthereumV4Pool({
      poolId,
      apiKey: process.env.THE_GRAPH_API_KEY,
      subgraphId: v4SubgraphIdFor(chainId),
      rpcUrl: rpcUrlFor(chainId),
      fetchImpl: loggingFetch(LABEL),
      chainId,
    }),
  );
