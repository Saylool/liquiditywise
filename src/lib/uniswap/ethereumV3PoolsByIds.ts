import { z } from "zod";

import {
  type DataFailureReason,
  type DataResult,
  type DataFailureNotice,
  type V3PoolMetadata,
  V3PoolMetadataSchema,
} from "../../schemas";
import { convertSafeInteger } from "./v3SubgraphRawResponse";
import {
  DEFAULT_SUBGRAPH_TIMEOUT_MS,
  type FetchLike,
  postV3SubgraphQuery,
} from "./v3SubgraphTransport";

/*
 * Several v3 pools at once, by address.
 *
 * Written for the one caller that already knows where its pools are and needs to
 * be told what they hold: a position names a pair and a fee and nothing else, so
 * the pool is *derived* rather than looked up — and this is what turns a derived
 * address back into two symbols, two decimals and a current tick.
 *
 * **It is also the check on that derivation.** A pool the source does not know
 * is dropped, and a pool whose pair or fee does not match what the position said
 * is dropped by the caller. A wrong address finds nothing; it cannot find
 * something else.
 */

const MALFORMED = "market-data-malformed";
const NOT_CONFIGURED = "market-data-not-configured";
const INDEXING_ERRORS = "market-data-indexing-errors";

/** Ethereum mainnet only, like every other reader here. */
const CHAIN_ID = 1;

export const V3_POOLS_BY_IDS_QUERY = `query V3PoolsByIds($ids: [ID!]!, $limit: Int!) {
  pools(where: { id_in: $ids }, first: $limit) {
    id
    feeTier
    tick
    token0 { id symbol decimals }
    token1 { id symbol decimals }
  }
  _meta {
    hasIndexingErrors
  }
}`;

const RawTokenSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  /** `BigInt!` in the official schema, so it arrives as a string. */
  decimals: z.string(),
});

const RawPoolSchema = z.object({
  id: z.string(),
  feeTier: z.string(),
  /** `Int` and nullable: a pool nobody has swapped in has no tick. */
  tick: z.string().nullable(),
  token0: RawTokenSchema,
  token1: RawTokenSchema,
});

export const V3PoolsByIdsResponseSchema = z.object({
  data: z
    .object({
      pools: z.array(RawPoolSchema),
      _meta: z.object({ hasIndexingErrors: z.boolean() }).nullable(),
    })
    .nullish(),
  errors: z.array(z.unknown()).nullish(),
});

/** One pool, with the tick it was at. `null` where the source reported none. */
export type V3PoolWithTick = {
  readonly pool: V3PoolMetadata;
  readonly tick: number | null;
};

export type EthereumV3PoolsByIdsRequest = {
  /** Pool addresses, lower-cased. Deduplicated here; order is not significant. */
  readonly poolAddresses: readonly string[];
  readonly apiKey: string | undefined;
  readonly subgraphId: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
};

const unavailable = (
  reason: DataFailureReason,
  notice: DataFailureNotice,
): DataResult<readonly V3PoolWithTick[]> => ({ status: "unavailable", reason, notice });

/**
 * Reads what the source knows about each of the given pools.
 *
 * A pool that does not verify is left out rather than failing the read: this
 * answers about a list, and eleven verified pools with one dropped is a true,
 * shorter answer — the same rule every other list here follows.
 */
export const fetchEthereumV3PoolsByIds = async ({
  poolAddresses,
  apiKey,
  subgraphId,
  fetchImpl,
  timeoutMs = DEFAULT_SUBGRAPH_TIMEOUT_MS,
}: EthereumV3PoolsByIdsRequest): Promise<DataResult<readonly V3PoolWithTick[]>> => {
  const ids = [...new Set(poolAddresses.map((address) => address.toLowerCase()))];
  if (ids.length === 0) return { status: "success", data: [] };

  const key = apiKey?.trim();
  const subgraph = subgraphId?.trim();
  if (key === undefined || key === "" || subgraph === undefined || subgraph === "") {
    return unavailable("configuration-error", NOT_CONFIGURED);
  }

  const transport = await postV3SubgraphQuery({
    apiKey: key,
    subgraphId: subgraph,
    query: V3_POOLS_BY_IDS_QUERY,
    variables: { ids, limit: ids.length },
    fetchImpl,
    timeoutMs,
  });
  if (!transport.ok) return unavailable(transport.reason, transport.notice);

  const parsed = V3PoolsByIdsResponseSchema.safeParse(transport.payload);
  if (!parsed.success) return unavailable("invalid-response", MALFORMED);

  const { data, errors } = parsed.data;
  if (errors != null && errors.length > 0) return unavailable("invalid-response", MALFORMED);
  if (data == null) return unavailable("invalid-response", MALFORMED);
  if (data._meta?.hasIndexingErrors === true) {
    return unavailable("invalid-response", INDEXING_ERRORS);
  }

  const found: V3PoolWithTick[] = [];
  for (const raw of data.pools) {
    const feePpm = convertSafeInteger(raw.feeTier);
    const decimals0 = convertSafeInteger(raw.token0.decimals);
    const decimals1 = convertSafeInteger(raw.token1.decimals);
    if (!feePpm.ok || !decimals0.ok || !decimals1.ok) continue;

    const pool = V3PoolMetadataSchema.safeParse({
      protocolVersion: "v3",
      chainId: CHAIN_ID,
      id: raw.id.toLowerCase(),
      feePpm: feePpm.value,
      token0: {
        chainId: CHAIN_ID,
        address: raw.token0.id.toLowerCase(),
        symbol: raw.token0.symbol,
        decimals: decimals0.value,
      },
      token1: {
        chainId: CHAIN_ID,
        address: raw.token1.id.toLowerCase(),
        symbol: raw.token1.symbol,
        decimals: decimals1.value,
      },
    });
    if (!pool.success) continue;

    /* A pool nobody has swapped in reports no tick; that is unread, not zero. */
    const tick = raw.tick === null ? null : convertSafeInteger(raw.tick);
    found.push({
      pool: pool.data,
      tick: tick === null || !tick.ok ? null : tick.value,
    });
  }

  return { status: "success", data: found };
};
