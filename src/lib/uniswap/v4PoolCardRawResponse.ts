import { z } from "zod";

/*
 * One v4 pool as a list entry: which fields are asked for, and what comes back.
 *
 * The fragment and the schema that parses its answer sit in one file for the
 * reason the v3 card's do: they are a single decision written twice, and two
 * files is what lets them drift.
 *
 * A v4 entry carries the pool's identity, hook and all, and the block its key
 * can be read at. The fee is not asked for: the indexer's `feeTier` is the
 * total fee of the latest swap rather than the key's fee, so the key is read
 * from the chain for every listed pool. That matters here more than anywhere:
 * a list is the one place a reader meets a hooked pool they did not go looking
 * for, and the row is where they should learn what its fee is — or is not.
 *
 * Non-strict objects, as with every subgraph boundary.
 */

export const V4_POOL_CARD_FRAGMENT = `fragment V4PoolCard on Pool {
  id
  createdAtBlockNumber
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
  /** `BigInt!`: where the pool's Initialize log — and so its key — is read from. */
  createdAtBlockNumber: z.string(),
  /** `BigInt!`: in the PoolKey; checked against the key the log carries. */
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
 * The untrusted edge of the one query both v4 lists are read from: the busiest
 * pool-days of the window, each naming its pool, plus the one address the
 * chain read needs.
 *
 * Days rather than pools, because days are what the source can answer for.
 * Every query that ordered `pools` by volume — the v3 documents against the
 * v4 subgraph — was refused by the gateway after fifteen seconds on
 * 2026-09-16, whichever indexer served it; the day table, filtered by date,
 * came back in under a second. The pools are folded out of the days by the
 * adapters.
 *
 * `poolManagers` is the subgraph's record of the contract it indexes. Its
 * address is asked for here, in the same request as the pools, rather than
 * being written into this application: an address asserted from memory is the
 * thing this project refuses everywhere, and a list of pools already trusts the
 * source for which pools exist.
 */
export const V4PoolDaysResponseSchema = z.object({
  data: z
    .object({
      poolDayDatas: z.array(z.object({ pool: RawV4PoolCardSchema })),
      poolManagers: z.array(z.object({ id: z.string() })),
      _meta: RawMetaSchema.nullable(),
    })
    .nullish(),
  /** Read only for presence; provider error text is never inspected or forwarded. */
  errors: z.array(z.unknown()).nullish(),
});

export type V4PoolDaysResponse = z.infer<typeof V4PoolDaysResponseSchema>;

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
