import "server-only";

import type { DataResult, PoolMarketSnapshot, ProtocolVersion } from "../../schemas";
import { loggingFetch, logUnavailable } from "../observability/serverDiagnostics";
import { fetchEthereumPoolMarketSnapshot } from "./ethereumPoolMarketSnapshot";
import { ethereumSubgraphId } from "./ethereumSubgraphs";

/*
 * The server-only boundary.
 *
 * `import "server-only"` makes importing this module from a Client Component a
 * build-time error, which is the guarantee that `THE_GRAPH_API_KEY` cannot be
 * pulled into a browser bundle. Next.js resolves the specifier itself, so no
 * package needs installing.
 *
 * This module is deliberately absent from any barrel file: a barrel that
 * re-exported it would let client code import the credential path by accident
 * while looking for something unrelated.
 *
 * It holds no logic — only the two impure things the pure layer cannot own:
 * reading the environment and reading the clock.
 */

/**
 * Fetches a verified market snapshot for one Ethereum mainnet Uniswap pool.
 *
 * Environment variables are read per call rather than captured at module load, so
 * configuration changes take effect without a restart and no stale credential is
 * held in a closure.
 *
 * The diagnostics label carries the protocol, so a v3 read and a v4 read of the
 * same entity are distinguishable in a log rather than appearing as one reader
 * behaving inconsistently.
 */
export const getEthereumPoolMarketSnapshot = async (
  protocolVersion: ProtocolVersion,
  poolId: string,
): Promise<DataResult<PoolMarketSnapshot>> => {
  const label = `${protocolVersion}-snapshot`;

  return logUnavailable(
    label,
    await fetchEthereumPoolMarketSnapshot({
      protocolVersion,
      poolId,
      apiKey: process.env.THE_GRAPH_API_KEY,
      subgraphId: ethereumSubgraphId(protocolVersion),
      fetchImpl: loggingFetch(label),
      now: () => new Date(),
    }),
  );
};
