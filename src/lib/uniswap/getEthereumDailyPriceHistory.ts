import "server-only";

import type { DataResult, PoolDailyPriceHistory, ProtocolVersion } from "../../schemas";
import { logDetail, loggingFetch, logUnavailable } from "../observability/serverDiagnostics";
import { createDailyHistoryReader } from "./dailyHistoryReader";
import { fetchEthereumDailyPriceHistory } from "./ethereumDailyPriceHistory";
import { subgraphIdFor } from "../chains/chainEnvironment";
import type { ChainId } from "../chains/chains";

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
 * It holds no logic — only the impure things the pure layer cannot own: reading
 * the environment, reading the clock, and writing the log. What is kept for the
 * day and when a second ask is made is decided in `dailyHistoryReader.ts`.
 */

const labelOf = (protocolVersion: ProtocolVersion): string => `${protocolVersion}-daily-history`;

/*
 * Each ask is logged on its own, so a timeout that a second ask recovered from
 * still leaves its line — followed by the line saying a second ask was made,
 * and by nothing else if that one came back.
 *
 * The first ask waits 25 seconds, longer than the shared default: this is the
 * largest query the application sends and the gateway's cold path for it is
 * slow. Measured on the live endpoint: 5.5 seconds on a first ask, then 280
 * milliseconds on every repeat. At the default ten seconds a cold ask on a bad
 * day failed the whole analysis and the page said the pool had no range —
 * which was true of nothing except the timeout.
 */
const reader = createDailyHistoryReader(
  async (protocolVersion, poolId, timeoutMs, chainId) =>
    logUnavailable(
      labelOf(protocolVersion),
      await fetchEthereumDailyPriceHistory({
        protocolVersion,
        poolId,
        chainId,
        apiKey: process.env.THE_GRAPH_API_KEY,
        subgraphId: subgraphIdFor(protocolVersion, chainId),
        fetchImpl: loggingFetch(labelOf(protocolVersion)),
        timeoutMs,
        now: () => new Date(),
      }),
    ),
  Date.now,
  (protocolVersion) => logDetail(labelOf(protocolVersion), "timed out; asking once more"),
);

/**
 * The previous completed UTC days of closing prices for one Ethereum mainnet
 * Uniswap pool — from the day's copy when there is one.
 *
 * Environment variables are read per ask rather than captured at module load, so
 * configuration changes take effect without a restart and no stale credential is
 * held in a closure.
 */
export const getEthereumDailyPriceHistory = (
  protocolVersion: ProtocolVersion,
  poolId: string,
  chainId: ChainId = 1,
): Promise<DataResult<PoolDailyPriceHistory>> => reader.read(protocolVersion, poolId, chainId);
