import { z } from "zod";

import { RawPoolCardSchema } from "./v3PoolCardRawResponse";

/*
 * The untrusted edge of every query that answers with a plain list of pools.
 *
 * Three ask that way now — the fee tiers of one pair, and the traded pools a
 * holdings lookup draws its candidates from, and whatever asks next. They differ
 * only in what they filter on, so a second copy of this shape would be the same
 * shape written twice.
 *
 * The search is the exception and keeps its own: it answers with two aliased
 * selections, because a pool stores its pair in address order and a typed query
 * has to be asked both ways round. The queries here are built from addresses
 * that are already in that order, so one selection is the whole answer — which
 * was confirmed against the live subgraph rather than assumed.
 */

/** Only the indexing-error flag is read, as with the other list query. */
const RawMetaSchema = z.object({
  hasIndexingErrors: z.boolean(),
});

export const V3PoolListResponseSchema = z.object({
  data: z
    .object({
      pools: z.array(RawPoolCardSchema),
      _meta: RawMetaSchema.nullable(),
    })
    .nullish(),
  /** Read only for presence; provider error text is never inspected or forwarded. */
  errors: z.array(z.unknown()).nullish(),
});

export type V3PoolListResponse = z.infer<typeof V3PoolListResponseSchema>;
