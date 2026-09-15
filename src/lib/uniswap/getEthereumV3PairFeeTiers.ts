import "server-only";

import type { DataResult, PairFeeTiers, V3PoolMetadata } from "../../schemas";
import { logDetail, loggingFetch, logUnavailable } from "../observability/serverDiagnostics";
import { fetchEthereumV3PairFeeTiers } from "./ethereumV3PairFeeTiers";

/** Identifies this reader in server-side diagnostics. */
const LABEL = "v3-pair-fee-tiers";

/*
 * The server-only boundary for the fee tiers of one pair.
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
 * Finds every Ethereum mainnet Uniswap v3 pool trading the same pair as `pool`.
 *
 * Takes the verified pool rather than three loose strings, because the pair has
 * to be passed in the pool's own address order and a verified `V3PoolMetadata`
 * is the thing that guarantees it.
 *
 * Environment variables are read per call rather than captured at module load,
 * so configuration changes take effect without a restart and no stale credential
 * is held in a closure.
 */
export const getEthereumV3PairFeeTiers = async (
  pool: V3PoolMetadata,
): Promise<DataResult<PairFeeTiers>> =>
  logUnavailable(
    LABEL,
    await fetchEthereumV3PairFeeTiers({
      poolAddress: pool.id,
      token0Address: pool.token0.address,
      token1Address: pool.token1.address,
      apiKey: process.env.THE_GRAPH_API_KEY,
      subgraphId: process.env.UNISWAP_V3_ETHEREUM_SUBGRAPH_ID,
      rpcUrl: process.env.ETHEREUM_RPC_URL,
      fetchImpl: loggingFetch(LABEL),
      now: () => new Date(),
      onDiagnostic: (detail) => {
        logDetail(LABEL, detail);
      },
    }),
  );
