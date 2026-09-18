import { z } from "zod";

import {
  type DataFailureNotice,
  type DataFailureReason,
  type DataResult,
  type Token,
  TokenSchema,
} from "../../schemas";
import { convertSafeInteger } from "./v3SubgraphRawResponse";
import {
  DEFAULT_SUBGRAPH_TIMEOUT_MS,
  type FetchLike,
  postV3SubgraphQuery,
} from "./v3SubgraphTransport";

/*
 * Several v4 pools at once, by id — and deliberately only what a key cannot say.
 *
 * A v4 position carries the pool's whole key, and the key hashes to the pool's
 * id, so the pool's fee, its tick spacing and its hook all arrive from the chain
 * already proved. What a key does not carry is what a human reads: two symbols,
 * two decimals, and where the price is now. That is all this asks for.
 *
 * **`feeTier` is not asked for, and must not be.** Measured on 2026-09-15, the
 * indexer's field is the total fee of the pool's latest swap — LP and protocol
 * fee combined — not the key's fee. The key is right here, from the chain; there
 * is nothing to gain and a wrong number to lose.
 *
 * Measured on 2026-09-18: fifteen pools by id in 260ms. An id lookup is an
 * indexed one, unlike the ordered and symbol-filtered pool queries that time out
 * at this gateway.
 */

const MALFORMED = "market-data-malformed";
const NOT_CONFIGURED = "market-data-not-configured";
const INDEXING_ERRORS = "market-data-indexing-errors";

/** Ethereum mainnet only, like every other reader here. */
const CHAIN_ID = 1;

export const V4_POOLS_BY_IDS_QUERY = `query V4PoolsByIds($ids: [ID!]!, $limit: Int!) {
  pools(where: { id_in: $ids }, first: $limit) {
    id
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

export const V4PoolsByIdsResponseSchema = z.object({
  data: z
    .object({
      pools: z.array(
        z.object({
          id: z.string(),
          /** `Int` and nullable: a pool nobody has swapped in has no tick. */
          tick: z.string().nullable(),
          token0: RawTokenSchema,
          token1: RawTokenSchema,
        }),
      ),
      _meta: z.object({ hasIndexingErrors: z.boolean() }).nullable(),
    })
    .nullish(),
  errors: z.array(z.unknown()).nullish(),
});

/** What one pool is called, and where it is. The rest of it came from the chain. */
export type V4PoolTokens = {
  readonly poolId: string;
  readonly token0: Token;
  readonly token1: Token;
  /** `null` where the source reported no tick, which is unread rather than zero. */
  readonly tick: number | null;
};

export type EthereumV4PoolsByIdsRequest = {
  /** Pool ids, 32 bytes each and lower-cased. Deduplicated here; order is not significant. */
  readonly poolIds: readonly string[];
  readonly apiKey: string | undefined;
  readonly subgraphId: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
};

const unavailable = (
  reason: DataFailureReason,
  notice: DataFailureNotice,
): DataResult<readonly V4PoolTokens[]> => ({ status: "unavailable", reason, notice });

/**
 * Reads what the source calls each of the given pools.
 *
 * A pool that does not verify is left out rather than failing the read: this
 * answers about a list, and eleven named pools with one dropped is a true,
 * shorter answer — the same rule every other list here follows.
 */
export const fetchEthereumV4PoolsByIds = async ({
  poolIds,
  apiKey,
  subgraphId,
  fetchImpl,
  timeoutMs = DEFAULT_SUBGRAPH_TIMEOUT_MS,
}: EthereumV4PoolsByIdsRequest): Promise<DataResult<readonly V4PoolTokens[]>> => {
  const ids = [...new Set(poolIds.map((id) => id.toLowerCase()))];
  if (ids.length === 0) return { status: "success", data: [] };

  const key = apiKey?.trim();
  const subgraph = subgraphId?.trim();
  if (key === undefined || key === "" || subgraph === undefined || subgraph === "") {
    return unavailable("configuration-error", NOT_CONFIGURED);
  }

  const transport = await postV3SubgraphQuery({
    apiKey: key,
    subgraphId: subgraph,
    query: V4_POOLS_BY_IDS_QUERY,
    variables: { ids, limit: ids.length },
    fetchImpl,
    timeoutMs,
  });
  if (!transport.ok) return unavailable(transport.reason, transport.notice);

  const parsed = V4PoolsByIdsResponseSchema.safeParse(transport.payload);
  if (!parsed.success) return unavailable("invalid-response", MALFORMED);

  const { data, errors } = parsed.data;
  if (errors != null && errors.length > 0) return unavailable("invalid-response", MALFORMED);
  if (data == null) return unavailable("invalid-response", MALFORMED);
  if (data._meta?.hasIndexingErrors === true) {
    return unavailable("invalid-response", INDEXING_ERRORS);
  }

  const found: V4PoolTokens[] = [];
  for (const raw of data.pools) {
    const decimals0 = convertSafeInteger(raw.token0.decimals);
    const decimals1 = convertSafeInteger(raw.token1.decimals);
    if (!decimals0.ok || !decimals1.ok) continue;

    const token0 = TokenSchema.safeParse({
      chainId: CHAIN_ID,
      address: raw.token0.id.toLowerCase(),
      symbol: raw.token0.symbol,
      decimals: decimals0.value,
    });
    const token1 = TokenSchema.safeParse({
      chainId: CHAIN_ID,
      address: raw.token1.id.toLowerCase(),
      symbol: raw.token1.symbol,
      decimals: decimals1.value,
    });
    if (!token0.success || !token1.success) continue;

    /* A pool nobody has swapped in reports no tick; that is unread, not zero. */
    const tick = raw.tick === null ? null : convertSafeInteger(raw.tick);
    found.push({
      poolId: raw.id.toLowerCase(),
      token0: token0.data,
      token1: token1.data,
      tick: tick === null || !tick.ok ? null : tick.value,
    });
  }

  return { status: "success", data: found };
};
