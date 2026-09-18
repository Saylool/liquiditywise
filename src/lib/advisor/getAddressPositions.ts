import "server-only";

import { logUnavailable } from "../observability/serverDiagnostics";
import { loggingFetch } from "../observability/serverDiagnostics";
import { ethereumSubgraphId } from "../uniswap/ethereumSubgraphs";
import { fetchEthereumV3PoolsByIds } from "../uniswap/ethereumV3PoolsByIds";
import { fetchEthereumV3Positions } from "../uniswap/ethereumV3Positions";
import {
  composeAddressPositions,
  type AddressPositionsResult,
  derivedPoolAddresses,
} from "./addressPositions";

/** Identifies this reader in server-side diagnostics. */
const LABEL = "address-positions";

/*
 * The server-only boundary for one address's open positions.
 *
 * `import "server-only"` keeps the RPC endpoint and the Graph key out of a
 * browser bundle, as everywhere else. Deliberately absent from every barrel.
 *
 * Two reads, and the second cannot start before the first: the pools come out of
 * the positions, derived from the pair and the fee each one names. The address
 * is public data, it is not stored, and nothing here remembers it.
 */
export const getAddressPositions = async (address: string): Promise<AddressPositionsResult> => {
  const positions = await fetchEthereumV3Positions({
    owner: address,
    rpcUrl: process.env.ETHEREUM_RPC_URL,
    /* Not the logging fetch: the composed result is logged once, below. */
    fetchImpl: fetch,
  });
  if (positions.status === "unavailable") {
    await logUnavailable(LABEL, positions);
    return { status: "unavailable", notice: positions.notice };
  }

  const pools = await fetchEthereumV3PoolsByIds({
    poolAddresses: derivedPoolAddresses(positions.data),
    apiKey: process.env.THE_GRAPH_API_KEY,
    subgraphId: ethereumSubgraphId("v3"),
    fetchImpl: loggingFetch(LABEL),
  });
  if (pools.status === "unavailable") {
    await logUnavailable(LABEL, pools);
    return { status: "unavailable", notice: pools.notice };
  }

  return composeAddressPositions({
    address,
    raw: positions.data,
    pools: pools.data,
    fetchedAt: new Date().toISOString(),
  });
};
