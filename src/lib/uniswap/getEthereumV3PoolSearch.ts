import "server-only";

import type { DataResult, PoolSearchResults } from "../../schemas";
import { logDetail, loggingFetch, logUnavailable } from "../observability/serverDiagnostics";
import { fetchEthereumV3PoolSearch } from "./ethereumV3PoolSearch";

/** Identifies this reader in server-side diagnostics. */
const LABEL = "v3-pool-search";

/*
 * The server-only boundary for pool search.
 *
 * `import "server-only"` makes importing this module from a Client Component a
 * build-time error, which is the guarantee that `THE_GRAPH_API_KEY` cannot be
 * pulled into a browser bundle. Deliberately absent from every barrel file, like
 * the other credential paths.
 *
 * It holds no logic — only the two impure things the pure layer cannot own:
 * reading the environment and reading the clock.
 */

/**
 * Finds Ethereum mainnet Uniswap v3 pools matching one or two terms.
 *
 * Environment variables are read per call rather than captured at module load,
 * so configuration changes take effect without a restart and no stale credential
 * is held in a closure.
 *
 * A pool the adapter could not verify leaves the list quietly, because eleven
 * checked answers and one dropped is still a true answer to "which pools are
 * these". It is not quiet here: the count reaches the server log, which is where
 * someone can act on it.
 */
export const getEthereumV3PoolSearch = async (
  terms: readonly string[],
): Promise<DataResult<PoolSearchResults>> =>
  logUnavailable(
    LABEL,
    await fetchEthereumV3PoolSearch({
      terms,
      apiKey: process.env.THE_GRAPH_API_KEY,
      subgraphId: process.env.UNISWAP_V3_ETHEREUM_SUBGRAPH_ID,
      fetchImpl: loggingFetch(LABEL),
      now: () => new Date(),
      onDiagnostic: (detail) => {
        logDetail(LABEL, detail);
      },
    }),
  );
