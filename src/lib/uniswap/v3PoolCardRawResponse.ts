import { z } from "zod";

/*
 * One pool as a list entry: which fields are asked for, and what comes back.
 *
 * Two queries ask for this now — the symbol search, and the fee tiers of one
 * pair — and both hand their answers to the same verification. The GraphQL
 * fragment and the schema that parses its answer sit in one file because they
 * are a single decision written twice: a field added to the selection and not to
 * the schema is dropped in silence, and a field added to the schema and not to
 * the selection fails every read. Two files is what lets those drift.
 *
 * Non-strict objects, as with the other subgraph boundaries: a provider adding a
 * field must not break the read, so unknown keys are dropped rather than
 * rejected.
 */

/**
 * The fields a pool is listed by, as a fragment so no two documents can select
 * different things and call the result the same shape.
 */
export const POOL_CARD_FRAGMENT = `fragment PoolCard on Pool {
  id
  feeTier
  totalValueLockedUSD
  token0 {
    id
    symbol
    name
    decimals
  }
  token1 {
    id
    symbol
    name
    decimals
  }
}`;

/**
 * A `Token` entity, narrowed to identity.
 *
 * `decimals` is `BigInt!` in the official schema, so it arrives as a *string*
 * rather than a JSON number — the same for `feeTier` below. Declaring them as
 * strings up front is what stops a silent coercion from papering over a provider
 * that changed representation.
 */
const RawTokenSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  decimals: z.string(),
});

export const RawPoolCardSchema = z.object({
  id: z.string(),
  /** `BigInt!`, in hundredths of a basis point. 3000 means 0.30%. */
  feeTier: z.string(),
  /** `BigDecimal!`. The provider's own dollar figure, not a verified one. */
  totalValueLockedUSD: z.string(),
  token0: RawTokenSchema,
  token1: RawTokenSchema,
});

export type RawPoolCard = z.infer<typeof RawPoolCardSchema>;
