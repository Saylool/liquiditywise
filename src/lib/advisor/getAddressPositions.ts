import "server-only";

import { type DataFailureNotice, type DataResult, POSITIONS_SHOWN } from "../../schemas";
import { logUnavailable, loggingFetch } from "../observability/serverDiagnostics";
import { fetchEthereumV3PoolsByIds } from "../uniswap/ethereumV3PoolsByIds";
import { fetchEthereumV3PositionFees, type V3PositionFeesRead } from "../uniswap/ethereumV3PositionFees";
import { fetchEthereumV3Positions } from "../uniswap/ethereumV3Positions";
import { fetchEthereumV3PositionHistories, type V3PositionHistories } from "../uniswap/ethereumV3PositionSnapshots";
import { fetchEthereumV4PoolsByIds } from "../uniswap/ethereumV4PoolsByIds";
import { fetchEthereumV4PositionFees, type V4PositionFeesRead } from "../uniswap/ethereumV4PositionFees";
import { fetchEthereumV4PositionIds } from "../uniswap/ethereumV4PositionIds";
import { fetchEthereumV4Positions } from "../uniswap/ethereumV4Positions";
import {
  composeAddressPositions,
  type AddressPositionsResult,
  derivedPoolAddresses,
  heldPoolIds,
  type V3Side,
  type V4Side,
} from "./addressPositions";
import { rpcUrlFor, v3PositionsSubgraphIdFor, v3SubgraphIdFor, v4SubgraphIdFor } from "../chains/chainEnvironment";
import type { RawV3Position } from "../uniswap/v3PositionManager";
import { type ChainId, readsV3, readsV4, type V3ChainId, type V4ChainId } from "../chains/chains";

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
 * **The v3 positions' histories are asked for only by the page that shows
 * them.** They are what the record under each position is made of (see
 * positionRecord.ts), they cost a subgraph question the alert check has no use
 * for, and they are an addition in the same way the fees are: a history that
 * cannot be read costs the records and nothing else.
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
 * losing the addition must not lose the list. So this reports nothing rather
 * than an error, and the page shows those positions without the figure.
 */
const orNothing = async <Read>(label: string, read: Promise<DataResult<Read>>, nothing: Read): Promise<Read> => {
  const fees = await read;
  if (fees.status === "unavailable") {
    await logUnavailable(label, fees);
    return nothing;
  }

  return fees.data;
};

const NO_V3_FEES: V3PositionFeesRead = { fees: new Map(), sqrtPrices: new Map() };
const NO_V4_FEES: V4PositionFeesRead = { fees: new Map(), protocolFees: new Map() };

/**
 * The histories of the v3 positions a page can show.
 *
 * Those are the first of them: v3 positions come first in the list, and the
 * list stops at `POSITIONS_SHOWN`. One whose pool fails its check lets a later
 * one onto the page, and that one is shown with its record unread rather than
 * made to wait for a second question.
 *
 * Never throws and never fails the answer. What it returns when the read
 * fails is the failure, which the composition turns into unread records.
 */
const readHistories = async (
  open: readonly RawV3Position[],
  chainId: V3ChainId,
): Promise<DataResult<V3PositionHistories>> => {
  try {
    const histories = await fetchEthereumV3PositionHistories(
      open.slice(0, POSITIONS_SHOWN).map((position) => position.tokenId),
      {
        chainId,
        apiKey: process.env.THE_GRAPH_API_KEY,
        subgraphId: v3PositionsSubgraphIdFor(chainId),
        fetchImpl: loggingFetch(LABEL),
      },
    );
    if (histories.status === "unavailable") await logUnavailable(`${LABEL}-v3-history`, histories);
    return histories;
  } catch {
    return { status: "unavailable", reason: "unknown", notice: "market-data-unreachable" };
  }
};

/**
 * Three round trips, and each cannot start before the last: the ids come from
 * the manager by index, and the pools come out of the positions, derived from
 * the pair and the fee each one names. The last two both hang off the
 * positions, so they go out together.
 */
const readV3 = async (address: string, chainId: V3ChainId, history: boolean): Promise<SideResult<V3Side>> => {
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

  const [pools, read, histories] = await Promise.all([
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
      NO_V3_FEES,
    ),
    history ? readHistories(positions.data.open, chainId) : undefined,
  ]);
  if (pools.status === "unavailable") {
    await logUnavailable(`${LABEL}-v3`, pools);
    return { ok: false, notice: pools.notice };
  }

  return {
    ok: true,
    side: {
      raw: positions.data,
      pools: pools.data,
      fees: read.fees,
      sqrtPrices: read.sqrtPrices,
      ...(histories === undefined ? {} : { history: histories }),
    },
  };
};

/**
 * Three round trips as well, but for a different reason: the manager cannot be
 * asked which tokens an address holds, so the ids come from the indexer first
 * and go straight back to the chain to be checked. What each one *is* takes a
 * single call, unlike v3.
 */
const readV4 = async (address: string, chainId: V4ChainId): Promise<SideResult<V4Side>> => {
  const apiKey = process.env.THE_GRAPH_API_KEY;
  const subgraphId = v4SubgraphIdFor(chainId);

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
    rpcUrl: rpcUrlFor(chainId),
    fetchImpl: fetch,
    chainId,
  });
  if (positions.status === "unavailable") {
    await logUnavailable(`${LABEL}-v4`, positions);
    return { ok: false, notice: positions.notice };
  }

  const [pools, read] = await Promise.all([
    fetchEthereumV4PoolsByIds({
      poolIds: heldPoolIds(positions.data),
      apiKey,
      subgraphId,
      chainId,
      fetchImpl: loggingFetch(LABEL),
    }),
    orNothing(
      `${LABEL}-v4-fees`,
      fetchEthereumV4PositionFees({
        positions: positions.data.open,
        poolManager: positions.data.poolManager,
        rpcUrl: rpcUrlFor(chainId),
        fetchImpl: fetch,
        chainId,
      }),
      NO_V4_FEES,
    ),
  ]);
  if (pools.status === "unavailable") {
    await logUnavailable(`${LABEL}-v4`, pools);
    return { ok: false, notice: pools.notice };
  }

  return { ok: true, side: { raw: positions.data, pools: pools.data, fees: read.fees, protocolFees: read.protocolFees } };
};

/**
 * One address's positions on one chain — mainnet unless `chainId` says
 * otherwise. On a chain v4 is not read on, its side is left out as not asked,
 * which the page does not report as a failure.
 *
 * `history` asks for the v3 positions' histories as well, for their records;
 * only the page that shows them asks.
 */
export const getAddressPositions = async (
  address: string,
  chainId: ChainId = 1,
  { history = false }: { readonly history?: boolean } = {},
): Promise<AddressPositionsResult> => {
  const v4Asked = readsV4(chainId);
  const v3Asked = readsV3(chainId);
  const [v3, v4] = await Promise.all([
    readsV3(chainId) ? readV3(address, chainId, history) : ({ ok: false, notice: "market-data-not-configured" } as const),
    readsV4(chainId) ? readV4(address, chainId) : ({ ok: false, notice: "market-data-not-configured" } as const),
  ]);

  /*
   * Both failing is not a partial answer. The v3 notice is the one reported
   * because it is the read that needs nothing but the chain — if it failed, so
   * did the simpler half, and its reason is the more likely to be the real one.
   * On a chain v3 is not read on, v4's is the only reason there is.
   */
  if (!v3.ok && !v4.ok) return { status: "unavailable", notice: v3Asked ? v3.notice : v4.notice };

  return composeAddressPositions({
    address,
    v3: v3.ok ? v3.side : null,
    v4: v4.ok ? v4.side : null,
    v4Asked,
    v3Asked,
    historyAsked: history,
    fetchedAt: new Date().toISOString(),
  });
};
