import "server-only";

import type { AddressHoldings, DataResult } from "../../schemas";
import { logUnavailable } from "../observability/serverDiagnostics";
import { fetchEthereumBalances } from "../uniswap/ethereumBalances";
import { getEthereumV3TradedPools } from "../uniswap/getEthereumV3TradedPools";
import { getEthereumV4TradedPools } from "../uniswap/getEthereumV4TradedPools";
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
 * Finds which of the most-traded pools' currencies one address holds, across
 * both protocols.
 *
 * The lists are read together and the sweep after them, and that order is
 * forced: the currencies worth asking about come out of the lists. Nothing
 * anywhere can enumerate an address's tokens, so the candidates must be chosen
 * before they can be checked.
 */
export const getAddressHoldings = async (
  address: string,
): Promise<DataResult<AddressHoldings>> => {
  /*
   * Both behind a cache, because neither query takes input: every visitor asks
   * the same two questions, and the v3 one cost 3.7 seconds cold. See either
   * wrapper for why reusing a net is safe in a way that reusing a figure would
   * not be.
   */
  const [v3Candidates, v4Candidates] = await Promise.all([
    getEthereumV3TradedPools(),
    getEthereumV4TradedPools(),
  ]);

  /*
   * Both nets' currencies, together. The v4 list is what brings in the chain's
   * own ether, under the zero address, which the sweep asks about directly.
   */
  const tokenAddresses = [
    ...(v3Candidates.status === "unavailable" ? [] : v3Candidates.data.pools),
    ...(v4Candidates.status === "unavailable" ? [] : v4Candidates.data.pools),
  ].flatMap((pool) => [pool.token0.address, pool.token1.address]);

  const balances = await fetchEthereumBalances({
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
      v3Candidates,
      v4Candidates,
      balances,
      fetchedAt: new Date().toISOString(),
    }),
  );
};
