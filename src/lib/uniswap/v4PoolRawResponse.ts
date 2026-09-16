import { z } from "zod";

/*
 * The untrusted edge of the v4 pool query. Provider field names stop here.
 *
 * Non-strict objects, as with the v3 boundaries: a provider adding a field must
 * not break the read.
 */

const RawV4TokenSchema = z.object({
  /** For v4 this may be the zero address, which is the chain's native ether. */
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  decimals: z.string(),
});

const RawV4PoolSchema = z.object({
  /** A v4 pool is a `PoolId` — keccak256 of its PoolKey — not a contract address. */
  id: z.string(),
  /**
   * `BigInt!`. Where the pool's Initialize log is, which is where its key is
   * read from. The indexer's own `feeTier` is deliberately not asked for: it
   * is the total fee of the latest swap, not the key's fee.
   */
  createdAtBlockNumber: z.string(),
  /** `BigInt!`. In the PoolKey; checked against the key the log carries. */
  tickSpacing: z.string(),
  /** The hook contract, or the zero address when the pool runs without one. */
  hooks: z.string(),
  token0: RawV4TokenSchema,
  token1: RawV4TokenSchema,
});

export type RawV4Pool = z.infer<typeof RawV4PoolSchema>;

const RawMetaSchema = z.object({
  hasIndexingErrors: z.boolean(),
});

export const V4PoolResponseSchema = z.object({
  data: z
    .object({
      pool: RawV4PoolSchema.nullable(),
      /** The contract the pool lives in, asked of the source rather than asserted. */
      poolManagers: z.array(z.object({ id: z.string() })),
      _meta: RawMetaSchema.nullable(),
    })
    .nullish(),
  /** Read only for presence; provider error text is never inspected or forwarded. */
  errors: z.array(z.unknown()).nullish(),
});
