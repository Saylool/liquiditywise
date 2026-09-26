import "server-only";

import type { DataFailureNotice, DataResult } from "../../schemas";
import { logUnavailable, loggingFetch } from "../observability/serverDiagnostics";
import { ethereumSubgraphId } from "../uniswap/ethereumSubgraphs";
import { fetchEthereumV3PoolsByIds } from "../uniswap/ethereumV3PoolsByIds";
import { fetchEthereumV3PositionFees } from "../uniswap/ethereumV3PositionFees";
import { fetchEthereumV3Positions } from "../uniswap/ethereumV3Positions";
import { fetchEthereumV4PoolsByIds } from "../uniswap/ethereumV4PoolsByIds";
import { fetchEthereumV4PositionFees } from "../uniswap/ethereumV4PositionFees";
import { fetchEthereumV4PositionIds } from "../uniswap/ethereumV4PositionIds";
import { fetchEthereumV4Positions } from "../uniswap/ethereumV4Positions";
import type { PositionFees } from "../uniswap/feeGrowth";
import {
  composeAddressPositions,
  type AddressPositionsResult,
  derivedPoolAddresses,
  heldPoolIds,
  type V3Side,
  type V4Side,
} from "./addressPositions";
import { rpcUrlFor, v3SubgraphIdFor } from "../chains/chainEnvironment";
import type { ChainId } from "../chains/chains";

/** Identifies this reader in server-side diagnostics. */
const LABEL = "address-positions";

/*
 * The server-only boundary for one address's open positions, of both protocols.
 *
 * `import "server-only"` keeps the RPC endpoint and the Graph key out of a
 * browser bundle, as everywhere else. Deliberately absent from every barrel.
 *
 * **The two protocols are read at once and fail apart.** They share nothing —
 * different managers, different indexers, different number of round trips — so
 * there is no reason for one to wait on the other, and every reason for one that
 * fails not to take the other with it: an address holding v3 positions should
 * still see them when the v4 indexer is down. What is not read is named in the
 * answer, so the page can say which half is missing rather than implying none.
 *
 * The address is public data, it is not stored, and nothing here remembers it.
 */

type SideResult<Side> =
  | { readonly ok: true; readonly side: Side }
  | { readonly ok: false; readonly notice: DataFailureNotice };

/**
 * What each position has earned, or nothing at all.
 *
 * A failed fee read is not a failed answer. The panel's subject is which
 * positions an address holds; what they have earned is an addition to it, and
 * losing the addition must not lose the list. So this reports the empty map
 * rather than an error, and the page shows those positions without the figure.
 */
const orNothing = async (
  label: string,
  read: Promise<DataResult<ReadonlyMap<string, PositionFees>>>,
): Promise<ReadonlyMap<string, PositionFees>> => {
  const fees = await read;
  if (fees.status === "unavailable") {
    await logUnavailable(label, fees);
    return new Map();
  }

  return fees.data;
};

/**
 * Three round trips, and each cannot start before the last: the ids come from
 * the manager by index, and the pools come out of the positions, derived from
 * the pair and the fee each one names. The last two both hang off the
 * positions, so they go out together.
 */
const readV3 = async (address: string, chainId: ChainId): Promise<SideResult<V3Side>> => {
  const positions = await fetchEthereumV3Positions({
    owner: address,
    chainId,
    rpcUrl: rpcUrlFor(chainId),
    /* Not the logging fetch: the composed result is logged once, by the caller. */
    fetchImpl: fetch,
  });
  if (positions.status === "unavailable") {
    await logUnavailable(`${LABEL}-v3`, positions);
    return { ok: false, notice: positions.notice };
  }

  const [pools, fees] = await Promise.all([
    fetchEthereumV3PoolsByIds({
      poolAddresses: derivedPoolAddresses(positions.data),
      chainId,
      apiKey: process.env.THE_GRAPH_API_KEY,
      subgraphId: v3SubgraphIdFor(chainId),
      fetchImpl: loggingFetch(LABEL),
    }),
    orNothing(
      `${LABEL}-v3-fees`,
      fetchEthereumV3PositionFees({
        positions: positions.data.open,
        factory: positions.data.factory,
        rpcUrl: rpcUrlFor(chainId),
        fetchImpl: fetch,
      }),
    ),
  ]);
  if (pools.status === "unavailable") {
    await logUnavailable(`${LABEL}-v3`, pools);
    return { ok: false, notice: pools.notice };
  }

  return { ok: true, side: { raw: positions.data, pools: pools.data, fees } };
};

/**
 * Three round trips as well, but for a different reason: the manager cannot be
 * asked which tokens an address holds, so the ids come from the indexer first
 * and go straight back to the chain to be checked. What each one *is* takes a
 * single call, unlike v3.
 */
const readV4 = async (address: string): Promise<SideResult<V4Side>> => {
  const apiKey = process.env.THE_GRAPH_API_KEY;
  const subgraphId = ethereumSubgraphId("v4");

  const ids = await fetchEthereumV4PositionIds({
    owner: address,
    apiKey,
    subgraphId,
    fetchImpl: loggingFetch(LABEL),
  });
  if (ids.status === "unavailable") {
    await logUnavailable(`${LABEL}-v4`, ids);
    return { ok: false, notice: ids.notice };
  }

  const positions = await fetchEthereumV4Positions({
    owner: address,
    tokenIds: ids.data,
    rpcUrl: process.env.ETHEREUM_RPC_URL,
    fetchImpl: fetch,
  });
  if (positions.status === "unavailable") {
    await logUnavailable(`${LABEL}-v4`, positions);
    return { ok: false, notice: positions.notice };
  }

  const [pools, fees] = await Promise.all([
    fetchEthereumV4PoolsByIds({
      poolIds: heldPoolIds(positions.data),
      apiKey,
      subgraphId,
      fetchImpl: loggingFetch(LABEL),
    }),
    orNothing(
      `${LABEL}-v4-fees`,
      fetchEthereumV4PositionFees({
        positions: positions.data.open,
        poolManager: positions.data.poolManager,
        rpcUrl: process.env.ETHEREUM_RPC_URL,
        fetchImpl: fetch,
      }),
    ),
  ]);
  if (pools.status === "unavailable") {
    await logUnavailable(`${LABEL}-v4`, pools);
    return { ok: false, notice: pools.notice };
  }

  return { ok: true, side: { raw: positions.data, pools: pools.data, fees } };
};

/**
 * One address's positions on one chain — mainnet unless `chainId` says
 * otherwise. v4 is read on mainnet alone; elsewhere its side is left out as
 * not asked, which the page does not report as a failure.
 */
export const getAddressPositions = async (address: string, chainId: ChainId = 1): Promise<AddressPositionsResult> => {
  const v4Asked = chainId === 1;
  const [v3, v4] = await Promise.all([
    readV3(address, chainId),
    v4Asked ? readV4(address) : ({ ok: false, notice: "market-data-not-configured" } as const),
  ]);

  /*
   * Both failing is not a partial answer. The v3 notice is the one reported
   * because it is the read that needs nothing but the chain — if it failed, so
   * did the simpler half, and its reason is the more likely to be the real one.
   */
  if (!v3.ok && !v4.ok) return { status: "unavailable", notice: v3.notice };

  return composeAddressPositions({
    address,
    v3: v3.ok ? v3.side : null,
    v4: v4.ok ? v4.side : null,
    v4Asked,
    fetchedAt: new Date().toISOString(),
  });
};
