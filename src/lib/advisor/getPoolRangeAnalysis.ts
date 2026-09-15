import "server-only";

import type {
  DataResult,
  PriceBandParameters,
  ProtocolVersion,
  V3Pool,
  V4Pool,
} from "../../schemas";
import { getEthereumDailyPriceHistory } from "../uniswap/getEthereumDailyPriceHistory";
import { getEthereumPoolMarketSnapshot } from "../uniswap/getEthereumPoolMarketSnapshot";
import { getEthereumV3Pool } from "../uniswap/getEthereumV3Pool";
import { getEthereumV4Pool } from "../uniswap/getEthereumV4Pool";
import {
  analysePoolRange,
  DEFAULT_PRICE_BAND_PARAMETERS,
  type PoolRangeAnalysisResult,
} from "./poolRangeAnalysis";

/*
 * The server-only boundary for the whole advisor pipeline.
 *
 * `import "server-only"` makes importing this from a Client Component a build
 * error, which is what keeps `THE_GRAPH_API_KEY` and the RPC endpoint out of a
 * browser bundle. It is deliberately absent from every barrel file.
 *
 * It holds no logic of its own: the three reads happen here because they need
 * credentials, and everything downstream of them is the pure module next door.
 */

/**
 * How a pool's fixed configuration is read, per protocol.
 *
 * This is the one read that genuinely differs between them, and the difference
 * is a whole request: a v3 pool's tick spacing appears in no subgraph and has to
 * come from the pool contract, while a v4 pool's is part of the PoolKey its id is
 * derived from. The snapshot and the daily history below are the same query
 * against a different subgraph.
 *
 * `satisfies Record<ProtocolVersion, …>` makes adding a protocol a compile error
 * here rather than a v4 pool quietly read as a v3 address.
 */
const POOL_READERS = {
  v3: getEthereumV3Pool,
  v4: getEthereumV4Pool,
} as const satisfies Record<
  ProtocolVersion,
  (id: string) => Promise<DataResult<V3Pool> | DataResult<V4Pool>>
>;

/**
 * Reads one Ethereum mainnet Uniswap pool and works it through to a tick range.
 *
 * The three reads run concurrently because none depends on another's result, so
 * the page waits for the slowest rather than the sum. Each returns its own
 * `DataResult`, and a failure in one is reported by the stage that needed it
 * rather than collapsing the whole call into a single opaque error.
 *
 * `poolId` is a v3 pool address or a v4 PoolId, and which of those it has to be
 * follows from `protocolVersion`. Each reader validates it against the spelling
 * its own protocol uses before anything reaches the network.
 *
 * `poolRead` defaults to starting the read, and exists so a page that already
 * needs the pool for something else — the v4 page prints its hook's permissions
 * above the analysis — can hand over the promise it already has rather than pay
 * for the same pool twice. Passing a promise rather than a resolved value is
 * what keeps all three reads concurrent: awaiting the pool first would put the
 * slow one, the daily history, behind it.
 */
export const getPoolRangeAnalysis = async (
  protocolVersion: ProtocolVersion,
  poolId: string,
  parameters: PriceBandParameters = DEFAULT_PRICE_BAND_PARAMETERS,
  poolRead: Promise<DataResult<V3Pool> | DataResult<V4Pool>> = POOL_READERS[protocolVersion](
    poolId,
  ),
): Promise<PoolRangeAnalysisResult> => {
  const [pool, snapshot, history] = await Promise.all([
    poolRead,
    getEthereumPoolMarketSnapshot(protocolVersion, poolId),
    getEthereumDailyPriceHistory(protocolVersion, poolId),
  ]);

  return analysePoolRange({ pool, snapshot, history, parameters });
};
