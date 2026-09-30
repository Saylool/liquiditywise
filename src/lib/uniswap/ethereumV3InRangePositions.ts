import { z } from "zod";

import {
  type DataFailureNotice,
  type DataFailureReason,
  type DataResult,
  type V3PoolMetadata,
  V3PoolMetadataSchema,
} from "../../schemas";
import type { ChainId } from "../chains/chains";
import { convertNonNegativeDecimal, convertSafeInteger } from "./v3SubgraphRawResponse";
import { DEFAULT_SUBGRAPH_TIMEOUT_MS, type FetchLike, postV3SubgraphQuery } from "./v3SubgraphTransport";

/*
 * The positions inside one v3 pool's current price, and when each was last
 * changed — the raw material of the smart-money page.
 *
 * **Only what the subgraph gets right is taken from it.** It lists positions
 * and their ranges, and it records a snapshot each time a position changes,
 * which is what dates a position's fee window. Its fee fields are not read:
 * measured on 2026-09-30, `collectedFeesToken*` reported two billion dollars
 * collected by a position that had deposited thirty-two million. What a
 * position has earned is read from the chain instead (see
 * ethereumV3PositionEarnings.ts), and its liquidity too.
 *
 * **In range now, deepest first.** A position out of range earns nothing at
 * this moment and says nothing about where money is working. The list is
 * ordered by liquidity so that the thousand a query returns are the ones that
 * hold the most of the pool's depth at its price.
 */

const MALFORMED = "market-data-malformed";
const NOT_CONFIGURED = "market-data-not-configured";
const INDEXING_ERRORS = "market-data-indexing-errors";

/** The most a query returns, and so the most positions one pool is read for. */
export const IN_RANGE_POSITION_LIMIT = 1_000;

/** How many positions' snapshots are asked for at once — few enough that one busy position cannot crowd out the rest. */
export const SNAPSHOT_BATCH = 25;

export const V3_POOL_STATE_QUERY = `query V3PoolState($pool: ID!) {
  pool(id: $pool) {
    id
    feeTier
    tick
    token0 { id symbol decimals derivedETH }
    token1 { id symbol decimals derivedETH }
  }
  bundles(first: 1) { ethPriceUSD }
  _meta { hasIndexingErrors }
}`;

export const V3_IN_RANGE_POSITIONS_QUERY = `query V3InRangePositions($pool: String!, $tick: BigInt!, $limit: Int!) {
  positions(
    first: $limit
    orderBy: liquidity
    orderDirection: desc
    where: { pool: $pool, liquidity_gt: 0, tickLower_: { tickIdx_lte: $tick }, tickUpper_: { tickIdx_gt: $tick } }
  ) {
    id
    liquidity
    tickLower { tickIdx }
    tickUpper { tickIdx }
  }
}`;

export const V3_LAST_CHANGES_QUERY = `query V3LastChanges($ids: [String!]!, $limit: Int!) {
  positionSnapshots(first: $limit, orderBy: timestamp, orderDirection: desc, where: { position_in: $ids }) {
    position { id }
    timestamp
  }
}`;

const RawTokenSchema = z.object({ id: z.string(), symbol: z.string(), decimals: z.string(), derivedETH: z.string() });

const PoolStateResponseSchema = z.object({
  data: z
    .object({
      pool: z
        .object({ id: z.string(), feeTier: z.string(), tick: z.string().nullable(), token0: RawTokenSchema, token1: RawTokenSchema })
        .nullable(),
      bundles: z.array(z.object({ ethPriceUSD: z.string() })),
      _meta: z.object({ hasIndexingErrors: z.boolean() }).nullable(),
    })
    .nullish(),
  errors: z.array(z.unknown()).nullish(),
});

const PositionsResponseSchema = z.object({
  data: z
    .object({
      positions: z.array(
        z.object({
          id: z.string(),
          liquidity: z.string(),
          tickLower: z.object({ tickIdx: z.string() }),
          tickUpper: z.object({ tickIdx: z.string() }),
        }),
      ),
    })
    .nullish(),
  errors: z.array(z.unknown()).nullish(),
});

const SnapshotsResponseSchema = z.object({
  data: z
    .object({ positionSnapshots: z.array(z.object({ position: z.object({ id: z.string() }), timestamp: z.string() })) })
    .nullish(),
  errors: z.array(z.unknown()).nullish(),
});

/**
 * One position in range, as listed. The listed liquidity only chooses which
 * positions are worth asking the chain about; every figure shown uses the
 * chain's own.
 */
export type InRangePosition = {
  readonly tokenId: string;
  readonly liquidity: string;
  readonly tickLower: number;
  readonly tickUpper: number;
};

export type InRangePool = {
  readonly pool: V3PoolMetadata;
  readonly tick: number;
  /** Dollars per whole token, from the source's derived prices; `null` where it has none. */
  readonly usdPerToken0: number | null;
  readonly usdPerToken1: number | null;
  readonly positions: readonly InRangePosition[];
};

type Source = {
  readonly chainId: ChainId;
  readonly apiKey: string | undefined;
  readonly subgraphId: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
};

const unavailable = <T>(reason: DataFailureReason, notice: DataFailureNotice): DataResult<T> => ({
  status: "unavailable",
  reason,
  notice,
});

type Asked =
  | { readonly ok: true; readonly payload: unknown }
  | { readonly ok: false; readonly reason: DataFailureReason; readonly notice: DataFailureNotice };

const ask = async (
  source: Source,
  query: string,
  variables: Readonly<Record<string, string | number | readonly string[]>>,
): Promise<Asked> => {
  const key = source.apiKey?.trim();
  const subgraph = source.subgraphId?.trim();
  if (key === undefined || key === "" || subgraph === undefined || subgraph === "") {
    return { ok: false, reason: "configuration-error", notice: NOT_CONFIGURED };
  }
  return postV3SubgraphQuery({
    apiKey: key,
    subgraphId: subgraph,
    query,
    variables,
    fetchImpl: source.fetchImpl,
    timeoutMs: source.timeoutMs ?? DEFAULT_SUBGRAPH_TIMEOUT_MS,
  });
};

const usdPer = (derivedEth: string, ethUsd: number | null): number | null => {
  const converted = convertNonNegativeDecimal(derivedEth, { allowZero: false });
  return converted.ok && ethUsd !== null ? converted.value * ethUsd : null;
};

/**
 * One pool's state and the positions inside its price.
 *
 * Two questions, in order: the positions are filtered by the pool's tick,
 * which only the first answer carries.
 */
export const fetchEthereumV3InRangePositions = async (
  poolAddress: string,
  source: Source,
): Promise<DataResult<InRangePool>> => {
  const id = poolAddress.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(id)) return unavailable("invalid-input", "invalid-pool-address");

  const first = await ask(source, V3_POOL_STATE_QUERY, { pool: id });
  if (!first.ok) return unavailable(first.reason, first.notice);
  const state = PoolStateResponseSchema.safeParse(first.payload);
  if (!state.success || state.data.data == null || (state.data.errors?.length ?? 0) > 0) {
    return unavailable("invalid-response", MALFORMED);
  }
  if (state.data.data._meta?.hasIndexingErrors === true) return unavailable("invalid-response", INDEXING_ERRORS);

  const raw = state.data.data.pool;
  if (raw === null) return unavailable("not-found", "pool-not-found");
  const tick = raw.tick === null ? null : convertSafeInteger(raw.tick);
  const feePpm = convertSafeInteger(raw.feeTier);
  const decimals0 = convertSafeInteger(raw.token0.decimals);
  const decimals1 = convertSafeInteger(raw.token1.decimals);
  if (tick === null || !tick.ok || !feePpm.ok || !decimals0.ok || !decimals1.ok) {
    return unavailable("invalid-response", MALFORMED);
  }
  const pool = V3PoolMetadataSchema.safeParse({
    protocolVersion: "v3",
    chainId: source.chainId,
    id,
    feePpm: feePpm.value,
    token0: { chainId: source.chainId, address: raw.token0.id.toLowerCase(), symbol: raw.token0.symbol, decimals: decimals0.value },
    token1: { chainId: source.chainId, address: raw.token1.id.toLowerCase(), symbol: raw.token1.symbol, decimals: decimals1.value },
  });
  if (!pool.success) return unavailable("invalid-response", MALFORMED);

  const bundle = state.data.data.bundles[0];
  const ethUsd = bundle === undefined ? null : convertNonNegativeDecimal(bundle.ethPriceUSD, { allowZero: false });
  const ethUsdValue = ethUsd !== null && ethUsd.ok ? ethUsd.value : null;

  const second = await ask(source, V3_IN_RANGE_POSITIONS_QUERY, {
    pool: id,
    tick: String(tick.value),
    limit: IN_RANGE_POSITION_LIMIT,
  });
  if (!second.ok) return unavailable(second.reason, second.notice);
  const listed = PositionsResponseSchema.safeParse(second.payload);
  if (!listed.success || listed.data.data == null || (listed.data.errors?.length ?? 0) > 0) {
    return unavailable("invalid-response", MALFORMED);
  }

  const positions: InRangePosition[] = [];
  for (const entry of listed.data.data.positions) {
    const lower = convertSafeInteger(entry.tickLower.tickIdx);
    const upper = convertSafeInteger(entry.tickUpper.tickIdx);
    if (!/^[0-9]+$/.test(entry.id) || !/^[0-9]+$/.test(entry.liquidity)) continue;
    if (!lower.ok || !upper.ok || lower.value >= upper.value) continue;
    /* Asked for in range; kept only if it is, so a stale filter cannot let another through. */
    if (!(lower.value <= tick.value && tick.value < upper.value)) continue;
    positions.push({ tokenId: entry.id, liquidity: entry.liquidity, tickLower: lower.value, tickUpper: upper.value });
  }

  return {
    status: "success",
    data: {
      pool: pool.data,
      tick: tick.value,
      usdPerToken0: usdPer(raw.token0.derivedETH, ethUsdValue),
      usdPerToken1: usdPer(raw.token1.derivedETH, ethUsdValue),
      positions,
    },
  };
};

/**
 * When each position was last changed, in seconds since the epoch: the latest
 * snapshot the source recorded for it. A position with none is left out, never
 * given a guessed date.
 */
export const fetchEthereumV3LastChanges = async (
  tokenIds: readonly string[],
  source: Source,
): Promise<DataResult<ReadonlyMap<string, number>>> => {
  const last = new Map<string, number>();
  for (let start = 0; start < tokenIds.length; start += SNAPSHOT_BATCH) {
    const ids = tokenIds.slice(start, start + SNAPSHOT_BATCH);
    const answer = await ask(source, V3_LAST_CHANGES_QUERY, { ids, limit: IN_RANGE_POSITION_LIMIT });
    if (!answer.ok) return unavailable(answer.reason, answer.notice);
    const parsed = SnapshotsResponseSchema.safeParse(answer.payload);
    if (!parsed.success || parsed.data.data == null || (parsed.data.errors?.length ?? 0) > 0) {
      return unavailable("invalid-response", MALFORMED);
    }
    for (const snapshot of parsed.data.data.positionSnapshots) {
      const at = convertSafeInteger(snapshot.timestamp);
      if (!at.ok) continue;
      /* Newest first, so the first seen for each position is its last change. */
      if (!last.has(snapshot.position.id)) last.set(snapshot.position.id, at.value);
    }
  }
  return { status: "success", data: last };
};
