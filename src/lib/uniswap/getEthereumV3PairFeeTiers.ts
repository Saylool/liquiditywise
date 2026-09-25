import "server-only";

import type { DataResult, PairFeeTiers, V3PoolMetadata } from "../../schemas";
import { logDetail, loggingFetch, logUnavailable } from "../observability/serverDiagnostics";
import { fetchEthereumV3PairFeeTiers } from "./ethereumV3PairFeeTiers";
import { rpcUrlFor, v3SubgraphIdFor } from "../chains/chainEnvironment";
import { type ChainId, isSupportedChainId } from "../chains/chains";
import { SEARCH_SUBGRAPH_TIMEOUT_MS } from "./v3SubgraphTransport";

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
  getEthereumV3PoolsOfPair({
    analysedPoolId: pool.id,
    token0Address: pool.token0.address,
    token1Address: pool.token1.address,
    chainId: isSupportedChainId(pool.chainId) ? pool.chainId : 1,
  });

/**
 * The same read for a pair named from elsewhere — a v4 pool's page, asking
 * where its two token contracts trade on v3. No entry is then the pool being
 * read, and an empty list is a real answer.
 */
export const getEthereumV3PoolsOfPair = async (pair: {
  readonly analysedPoolId: string | null;
  readonly token0Address: string;
  readonly token1Address: string;
  /** The chain to look on; mainnet when not said, as from a v4 page. */
  readonly chainId?: ChainId;
}): Promise<DataResult<PairFeeTiers>> =>
  logUnavailable(
    LABEL,
    await fetchEthereumV3PairFeeTiers({
      poolAddress: pair.analysedPoolId,
      chainId: pair.chainId ?? 1,
      token0Address: pair.token0Address,
      token1Address: pair.token1Address,
      apiKey: process.env.THE_GRAPH_API_KEY,
      subgraphId: v3SubgraphIdFor(pair.chainId ?? 1),
      rpcUrl: rpcUrlFor(pair.chainId ?? 1),
      /*
       * Off mainnet the search timeout rather than the default ten seconds.
       * Measured on 2026-09-25 against the Base subgraph: this pair query
       * answered in 10.5 to 14.5 seconds every time, whatever the ordering or
       * the fields, and so was cut off at ten on every page. It is its own
       * panel, streamed after the analysis, so the wait delays nothing else.
       */
      ...((pair.chainId ?? 1) === 1 ? {} : { timeoutMs: SEARCH_SUBGRAPH_TIMEOUT_MS }),
      fetchImpl: loggingFetch(LABEL),
      now: () => new Date(),
      onDiagnostic: (detail) => {
        logDetail(LABEL, detail);
      },
    }),
  );
