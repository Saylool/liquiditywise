import { z } from "zod";

import { RawPoolCardSchema } from "./v3PoolCardRawResponse";

/*
 * The untrusted edge of the fee-tier query. Provider field names stop here.
 *
 * One plain selection, unlike the search's two aliased ones. A pool stores its
 * pair in address order and this query is built from a pool whose ordering was
 * already verified, so there is no second way round to ask: asked the other way
 * round, the source returns an empty list — which was confirmed against the live
 * subgraph rather than assumed.
 */

/** Only the indexing-error flag is read, as with the other list query. */
const RawMetaSchema = z.object({
  hasIndexingErrors: z.boolean(),
});

export const V3PairFeeTiersResponseSchema = z.object({
  data: z
    .object({
      pools: z.array(RawPoolCardSchema),
      _meta: RawMetaSchema.nullable(),
    })
    .nullish(),
  /** Read only for presence; provider error text is never inspected or forwarded. */
  errors: z.array(z.unknown()).nullish(),
});

export type V3PairFeeTiersResponse = z.infer<typeof V3PairFeeTiersResponseSchema>;
