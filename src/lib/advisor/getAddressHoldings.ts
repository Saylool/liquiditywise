import "server-only";

import type { AddressHoldings, DataResult } from "../../schemas";
import { logUnavailable, loggingFetch } from "../observability/serverDiagnostics";
import { fetchEthereumErc20Balances } from "../uniswap/ethereumErc20Balances";
import { fetchEthereumV3TradedPools } from "../uniswap/ethereumV3TradedPools";
import { composeAddressHoldings } from "./addressHoldings";

/** Identifies this reader in server-side diagnostics. */
const LABEL = "address-holdings";

/*
 * The server-only boundary for a holdings lookup.
 *
 * `import "server-only"` makes importing this from a Client Component a build
 * error, which is what keeps `THE_GRAPH_API_KEY` and the RPC endpoint out of a
 * browser bundle. Deliberately absent from every barrel file.
 *
 * The address arrives from the browser, where a wallet handed it over. It is
 * public data, it is not stored, and the only thing done with it here is to ask
 * token contracts what they have recorded against it.
 */

/**
 * Finds which of the most-traded pools' tokens one address holds.
 *
 * The two reads are sequential and have to be: the tokens worth asking about
 * come out of the pool list. Nothing anywhere can enumerate an address's tokens,
 * so the candidates must be chosen before they can be checked.
 */
export const getAddressHoldings = async (
  address: string,
): Promise<DataResult<AddressHoldings>> => {
  const candidates = await fetchEthereumV3TradedPools({
    apiKey: process.env.THE_GRAPH_API_KEY,
    subgraphId: process.env.UNISWAP_V3_ETHEREUM_SUBGRAPH_ID,
    fetchImpl: loggingFetch(LABEL),
    now: () => new Date(),
  });

  const tokenAddresses =
    candidates.status === "unavailable"
      ? []
      : candidates.data.pools.flatMap((pool) => [pool.token0.address, pool.token1.address]);

  const balances = await fetchEthereumErc20Balances({
    holder: address,
    tokenAddresses,
    rpcUrl: process.env.ETHEREUM_RPC_URL,
    /*
     * Not the logging fetch. One lookup is up to a couple of hundred contract
     * calls, and a line each would bury every other diagnostic the server
     * writes — the composed result is logged once below instead.
     */
    fetchImpl: fetch,
  });

  return logUnavailable(
    LABEL,
    composeAddressHoldings({
      address,
      candidates,
      balances,
      fetchedAt: new Date().toISOString(),
    }),
  );
};
