import "server-only";

import type { DataResult, PoolDailyPriceHistory, ProtocolVersion } from "../../schemas";
import { loggingFetch, logUnavailable } from "../observability/serverDiagnostics";
import { fetchEthereumDailyPriceHistory } from "./ethereumDailyPriceHistory";
import { ethereumSubgraphId } from "./ethereumSubgraphs";

/** See the note where it is used: the cold path for 121 days is seconds long. */
const DAILY_HISTORY_TIMEOUT_MS = 25_000;

/*
 * The server-only boundary for daily price history.
 *
 * `import "server-only"` makes importing this module from a Client Component a
 * build-time error, which is the guarantee that `THE_GRAPH_API_KEY` cannot be
 * pulled into a browser bundle. Next.js resolves the specifier itself, so no
 * package needs installing.
 *
 * Deliberately absent from every barrel file: a barrel that re-exported it would
 * let client code reach the credential path by accident.
 *
 * It holds no logic — only the two impure things the pure layer cannot own:
 * reading the environment and reading the clock.
 */

/**
 * Fetches the previous 31 completed UTC days of closing prices for one Ethereum
 * mainnet Uniswap pool.
 *
 * Environment variables are read per call rather than captured at module load, so
 * configuration changes take effect without a restart and no stale credential is
 * held in a closure.
 */
export const getEthereumDailyPriceHistory = async (
  protocolVersion: ProtocolVersion,
  poolId: string,
): Promise<DataResult<PoolDailyPriceHistory>> => {
  const label = `${protocolVersion}-daily-history`;

  return logUnavailable(
    label,
    await fetchEthereumDailyPriceHistory({
      protocolVersion,
      poolId,
      apiKey: process.env.THE_GRAPH_API_KEY,
      subgraphId: ethereumSubgraphId(protocolVersion),
      fetchImpl: loggingFetch(label),
      /*
       * Longer than the shared default, because this is the largest query the
       * application sends and the gateway's cold path for it is slow. Measured
       * on the live endpoint: 5.5 seconds on a first ask, then 280 milliseconds
       * on every repeat. At the default ten seconds a cold ask on a bad day
       * failed the whole analysis and the page said the pool had no range —
       * which was true of nothing except the timeout.
       */
      timeoutMs: DAILY_HISTORY_TIMEOUT_MS,
      now: () => new Date(),
    }),
  );
};
