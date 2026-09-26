import "server-only";

import type { AddressHoldings, DataResult } from "../../schemas";
import { logUnavailable } from "../observability/serverDiagnostics";
import { fetchEthereumBalances } from "../uniswap/ethereumBalances";
import { fetchEthereumV4PoolKeys } from "../uniswap/ethereumV4PoolKeys";
import { fetchEthereumV4PoolFees } from "../uniswap/ethereumV4PoolState";
import { getEthereumV3TradedPools } from "../uniswap/getEthereumV3TradedPools";
import { getEthereumV4TradedPools } from "../uniswap/getEthereumV4TradedPools";
import { chainReadingFor } from "../uniswap/v4PoolChainReading";
import { composeAddressHoldings, displayedV4Pools, withV4ChainReadings } from "./addressHoldings";
import { rpcUrlFor } from "../chains/chainEnvironment";
import type { ChainId } from "../chains/chains";
import { getEthereumV3PoolDays } from "../uniswap/getEthereumV3PoolDays";
import { normalizeV3TradedPoolsFromDays } from "../uniswap/v3TradedPoolsAdapter";
import { type Token, ZERO_ADDRESS } from "../../schemas";

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
/** Base's and Arbitrum's own ether, which both call ETH, under the zero address the sweep asks about. */
const nativeEtherOn = (chainId: ChainId): Token => ({
  chainId,
  address: ZERO_ADDRESS,
  symbol: "ETH",
  name: "Ether",
  decimals: 18,
});

/**
 * Off mainnet: the v3 net from the chain's week of busiest pool-days, the
 * chain's own ether asked for by name, and no v4 — none is read there, which
 * the page says rather than calling it unread.
 */
const holdingsOffMainnet = async (address: string, chainId: ChainId): Promise<DataResult<AddressHoldings>> => {
  const days = await getEthereumV3PoolDays(chainId);
  const v3Candidates =
    days.status === "unavailable" ? days : normalizeV3TradedPoolsFromDays({ ...days.data, chainId });
  const tokenAddresses = [
    ZERO_ADDRESS,
    ...(v3Candidates.status === "unavailable" ? [] : v3Candidates.data.pools).flatMap((pool) => [
      pool.token0.address,
      pool.token1.address,
    ]),
  ];

  const balances = await fetchEthereumBalances({
    holder: address,
    tokenAddresses,
    rpcUrl: rpcUrlFor(chainId),
    fetchImpl: fetch,
  });

  return logUnavailable(
    LABEL,
    composeAddressHoldings({
      address,
      v3Candidates,
      v4Candidates: { status: "unavailable", reason: "configuration-error", notice: "market-data-not-configured" },
      balances,
      nativeToken: nativeEtherOn(chainId),
      fetchedAt: new Date().toISOString(),
    }),
  );
};

export const getAddressHoldings = async (
  address: string,
  chainId: ChainId = 1,
): Promise<DataResult<AddressHoldings>> => {
  if (chainId !== 1) return holdingsOffMainnet(address, chainId);

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
     * Not the logging fetch. The sweep is one aggregated call now, but the fee
     * reads after it are a batch per handful of pools, and a line each would
     * bury every other diagnostic the server writes — the composed result is
     * logged once below instead.
     */
    fetchImpl: fetch,
  });

  const composed = composeAddressHoldings({
    address,
    v3Candidates,
    v4Candidates,
    balances,
    fetchedAt: new Date().toISOString(),
  });
  if (composed.status === "unavailable" || v4Candidates.status === "unavailable") {
    return logUnavailable(LABEL, composed);
  }

  /*
   * The chain, for the v4 pools that will be shown and no others. The
   * candidate list carries every fee unread — it is a net of two hundred and
   * fifty pools, more than the endpoint answers for in one go — so the fee is
   * read here, for the handful on the page: the stored fee for all of them,
   * which settles a hookless pool, and the creation log for the hooked ones.
   */
  const shown = displayedV4Pools(composed.data);
  const createdAt = v4Candidates.data.createdAtBlockNumbers;
  const chain = {
    poolManager: v4Candidates.data.poolManager,
    rpcUrl: process.env.ETHEREUM_RPC_URL,
    fetchImpl: fetch,
  };
  const [keys, fees] = await Promise.all([
    fetchEthereumV4PoolKeys({
      pools: shown
        .filter((pool) => pool.hookAddress !== null)
        .map((pool) => ({ id: pool.id, createdAtBlockNumber: createdAt[pool.id] ?? "" })),
      ...chain,
    }),
    fetchEthereumV4PoolFees({ poolIds: shown.map((pool) => pool.id), ...chain }),
  ]);
  const readings = new Map(shown.map((pool) => [pool.id, chainReadingFor(pool.id, keys, fees)]));

  return logUnavailable(LABEL, {
    status: "success",
    data: withV4ChainReadings(composed.data, readings) ?? composed.data,
  });
};
