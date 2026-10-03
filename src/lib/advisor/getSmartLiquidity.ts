import "server-only";

import { processShared } from "../cache/processShared";
import { rpcUrlFor, v3PositionsSubgraphIdFor, v3PositionTicksFor } from "../chains/chainEnvironment";
import { type ChainId, chainOf, readsV3, readsV3Positions } from "../chains/chains";
import { loggingFetch } from "../observability/serverDiagnostics";
import { openConfiguredStore } from "../store/openStore";
import { fetchAddressKinds } from "../uniswap/ethereumAddressKinds";
import { fetchEthereumV3InRangePositions, fetchEthereumV3LastChanges } from "../uniswap/ethereumV3InRangePositions";
import { fetchEthereumV3PositionEarnings } from "../uniswap/ethereumV3PositionEarnings";
import { getMostTraded } from "./getMostTraded";
import { readSmartLiquidity, type SmartLiquidityRead } from "./readSmartLiquidity";
import { readLatest, recordMeasurement } from "./smartStore";

const LABEL = "smart-liquidity";

/** Kept seven hours, and read anew every six by the warmer, so no reader waits on the read. */
export const SMART_LIQUIDITY_TTL_MS = 7 * 60 * 60 * 1000;
export const SMART_LIQUIDITY_WARM_EVERY_MS = 6 * 60 * 60 * 1000;
/** After the most-traded warmer's first round, whose list this reads its pools from. */
export const SMART_LIQUIDITY_FIRST_WARM_AFTER_MS = 3 * 60 * 1000;

/*
 * One chain's smart-money figures, shared with the warmer (see
 * processShared.ts). A read takes tens of seconds — a dozen pools, each
 * several subgraph questions and a chain read — so it is kept for hours, and
 * readers who arrive while one is running wait on that one rather than
 * starting their own.
 */
const cached = processShared(
  "smart-liquidity",
  () => new Map<ChainId, { readonly value: SmartLiquidityRead; readonly writtenAt: number }>(),
);
const running = processShared("smart-liquidity.running", () => new Map<ChainId, Promise<SmartLiquidityRead>>());

/** For tests. */
export const forgetSmartLiquidity = (): void => {
  cached.clear();
  running.clear();
};

const readNow = (chainId: ChainId): Promise<SmartLiquidityRead> => {
  const fetchImpl = loggingFetch(LABEL);
  const source = {
    chainId,
    apiKey: process.env.THE_GRAPH_API_KEY,
    subgraphId: v3PositionsSubgraphIdFor(chainId),
    ticks: v3PositionTicksFor(chainId) ?? "entity",
    fetchImpl,
    /* OP Mainnet's answers the largest pool's positions in twenty-four seconds. */
    timeoutMs: 45_000,
  };
  return readSmartLiquidity({
    listPools: () => getMostTraded(chainId),
    readPool: (poolId) => fetchEthereumV3InRangePositions(poolId, source),
    readLastChanges: (tokenIds) => fetchEthereumV3LastChanges(tokenIds, source),
    readEarnings: (pool, positions) =>
      readsV3(chainId)
        ? fetchEthereumV3PositionEarnings({ chainId, pool, positions, rpcUrl: rpcUrlFor(chainId), fetchImpl })
        : Promise.resolve({ status: "unavailable", reason: "configuration-error", notice: "chain-data-not-configured" }),
    now: () => new Date(),
  });
};

/**
 * Keeps a measurement past this process, and dates its holders' kinds. Never
 * waited for and never throws: a store that is down costs a chart a point.
 */
const persist = async (chainId: ChainId, read: Extract<SmartLiquidityRead, { status: "measured" }>): Promise<void> => {
  const store = openConfiguredStore();
  if (store === null) return;

  try {
    const kinds = await fetchAddressKinds({
      addresses: read.data.smart.map(({ owner }) => owner),
      rpcUrl: rpcUrlFor(chainId),
      fetchImpl: loggingFetch(LABEL),
    });
    const kept = await recordMeasurement({
      store,
      chain: chainOf(chainId).slug,
      read,
      kinds: kinds.status === "success" ? kinds.data : null,
    });
    console.info(
      `[${LABEL}] kept chain=${chainId} latest=${kept.latest} series=${kept.series} holders=${kept.owners}${kinds.status === "success" ? "" : " (kinds unread)"}`,
    );
  } catch {
    console.warn(`[${LABEL}] kept chain=${chainId} failed`);
  }
};

/**
 * Puts the measurement kept in the store back in the cache, when there is one
 * that is still good and nothing newer: what makes a restart cost readers
 * nothing. `true` when it did.
 */
export const hydrateSmartLiquidity = async (chainId: ChainId): Promise<boolean> => {
  if (!readsV3Positions(chainId) || cached.has(chainId)) return false;
  const store = openConfiguredStore();
  if (store === null) return false;

  try {
    const kept = await readLatest(store, chainOf(chainId).slug);
    if (kept === null) return false;
    const measuredAt = Date.parse(kept.measuredAt);
    if (!(Date.now() - measuredAt < SMART_LIQUIDITY_TTL_MS && measuredAt <= Date.now())) return false;
    if (cached.has(chainId)) return false;

    cached.set(chainId, { value: kept, writtenAt: measuredAt });
    return true;
  } catch {
    return false;
  }
};

/**
 * What is kept for a chain, and never a read: for the pages that show the
 * smart-money range beside something else and must not wait tens of seconds
 * for it. `null` until the warmer's first round has run, or where positions
 * cannot be listed.
 */
export const peekSmartLiquidity = (chainId: ChainId): SmartLiquidityRead | null => {
  const hit = cached.get(chainId);
  return hit !== undefined && Date.now() - hit.writtenAt < SMART_LIQUIDITY_TTL_MS ? hit.value : null;
};

/**
 * `null` on a chain whose positions cannot be listed (see chains.ts); the page
 * says so. `refresh` reads anew, for the warmer; a read that fails then leaves
 * the kept one to serve until it runs out.
 */
export const getSmartLiquidity = async (
  chainId: ChainId,
  { refresh = false }: { readonly refresh?: boolean } = {},
): Promise<SmartLiquidityRead | null> => {
  if (!readsV3Positions(chainId)) return null;

  const hit = cached.get(chainId);
  if (!refresh && hit !== undefined && Date.now() - hit.writtenAt < SMART_LIQUIDITY_TTL_MS) return hit.value;

  const inFlight = running.get(chainId);
  if (inFlight !== undefined) return inFlight;

  const started = Date.now();
  const reading = readNow(chainId)
    .then((value) => {
      if (value.status === "measured") {
        cached.set(chainId, { value, writtenAt: Date.now() });
        void persist(chainId, value);
      }
      console.info(
        value.status === "measured"
          ? `[${LABEL}] chain=${chainId} pools=${value.poolsRead}/${value.poolsAsked} measured=${value.data.measured} smart=${value.data.smart.length} ${Date.now() - started}ms`
          : `[${LABEL}] chain=${chainId} unavailable (${value.notice}) ${Date.now() - started}ms`,
      );
      /* A failed read gives way to the one kept, while it lasts. */
      return value.status === "measured" || hit === undefined || Date.now() - hit.writtenAt >= SMART_LIQUIDITY_TTL_MS
        ? value
        : hit.value;
    })
    .finally(() => running.delete(chainId));
  running.set(chainId, reading);
  return reading;
};
