import { z } from "zod";

/*
 * One v4 pool as a list entry: which fields are asked for, and what comes back.
 *
 * The fragment and the schema that parses its answer sit in one file for the
 * reason the v3 card's do: they are a single decision written twice, and two
 * files is what lets them drift.
 *
 * A v4 entry carries more than a v3 one, because it can. A v3 list entry stops
 * at metadata — tick spacing lives on chain and costs a call per pool — while
 * everything a v4 pool *is* comes back in one query, so the list carries the
 * whole pool, hook and all. That matters here more than anywhere: a list is the
 * one place a reader meets a hooked pool they did not go looking for.
 *
 * Non-strict objects, as with every subgraph boundary.
 */

export const V4_POOL_CARD_FRAGMENT = `fragment V4PoolCard on Pool {
  id
  feeTier
  tickSpacing
  hooks
  token0 {
    id
    symbol
    name
    decimals
    derivedETH
  }
  token1 {
    id
    symbol
    name
    decimals
    derivedETH
  }
}`;

const RawV4CardTokenSchema = z.object({
  /** May be the zero address: v4's native ether. */
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  decimals: z.string(),
  /** `BigDecimal!`. Trusted for the reason the v3 card trusts it: it comes from `sqrtPrice`. */
  derivedETH: z.string(),
});

export const RawV4PoolCardSchema = z.object({
  /** A `PoolId`: keccak256 of the PoolKey, not a contract address. */
  id: z.string(),
  /** `BigInt!`: a fee in hundredths of a bip, or the dynamic-fee sentinel. */
  feeTier: z.string(),
  /** `BigInt!`: in the PoolKey, so no contract call is needed. */
  tickSpacing: z.string(),
  /** The hook contract, or the zero address for none. */
  hooks: z.string(),
  token0: RawV4CardTokenSchema,
  token1: RawV4CardTokenSchema,
});

export type RawV4PoolCard = z.infer<typeof RawV4PoolCardSchema>;

/** Only the indexing-error flag is read from `_meta`, as with the v3 search. */
const RawMetaSchema = z.object({
  hasIndexingErrors: z.boolean(),
});

/**
 * The two aliased selections, plus the one address the chain read needs.
 *
 * `poolManagers` is the subgraph's record of the contract it indexes. Its
 * address is asked for here, in the same request as the pools, rather than
 * being written into this application: an address asserted from memory is the
 * thing this project refuses everywhere, and a list of pools already trusts the
 * source for which pools exist.
 */
export const V4PoolSearchResponseSchema = z.object({
  data: z
    .object({
      forward: z.array(RawV4PoolCardSchema),
      reverse: z.array(RawV4PoolCardSchema),
      poolManagers: z.array(z.object({ id: z.string() })),
      _meta: RawMetaSchema.nullable(),
    })
    .nullish(),
  /** Read only for presence; provider error text is never inspected or forwarded. */
  errors: z.array(z.unknown()).nullish(),
});

export type V4PoolSearchResponse = z.infer<typeof V4PoolSearchResponseSchema>;

/**
 * The untrusted edge of a query that answers with a plain list of v4 pools —
 * the traded pools a holdings lookup draws its candidates from. One selection
 * is the whole answer, as with the v3 list.
 */
export const V4PoolListResponseSchema = z.object({
  data: z
    .object({
      pools: z.array(RawV4PoolCardSchema),
      _meta: RawMetaSchema.nullable(),
    })
    .nullish(),
  /** Read only for presence; provider error text is never inspected or forwarded. */
  errors: z.array(z.unknown()).nullish(),
});

/**
 * The untrusted edge of the pair query: one list of pools, plus the manager the
 * chain read needs — the list envelope with the search's extra field.
 */
export const V4PairPoolsResponseSchema = z.object({
  data: z
    .object({
      pools: z.array(RawV4PoolCardSchema),
      poolManagers: z.array(z.object({ id: z.string() })),
      _meta: RawMetaSchema.nullable(),
    })
    .nullish(),
  /** Read only for presence; provider error text is never inspected or forwarded. */
  errors: z.array(z.unknown()).nullish(),
});
