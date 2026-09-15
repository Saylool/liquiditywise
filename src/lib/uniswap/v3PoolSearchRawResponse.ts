import { z } from "zod";

import { RawPoolCardSchema } from "./v3PoolCardRawResponse";

/*
 * The untrusted edge of the pool-search queries. Provider field names stop here.
 *
 * Non-strict objects, as with the other subgraph boundaries: a provider adding a
 * field must not break the read, so unknown keys are dropped rather than
 * rejected.
 *
 * One schema covers both search documents. The pair query and the single-term
 * query differ only in what they filter on, and both answer with the same two
 * aliased selections, so a second shape here would be the same shape written
 * twice. What a pool itself looks like is not decided here either — that is the
 * shared pool card, selected by the same fragment both documents use.
 */

/**
 * Only the indexing-error flag is read from `_meta`, as with the metadata query.
 *
 * A search returns pool identities and a liquidity figure used for ordering.
 * Identities are fixed at deployment, and an indexer a few blocks behind reports
 * the same ordering as one that is caught up, so a block position would be a
 * field nothing here could act on.
 */
const RawMetaSchema = z.object({
  hasIndexingErrors: z.boolean(),
});

/**
 * The two aliased selections.
 *
 * A pool stores its pair in address order, which has nothing to do with the
 * order someone types it, so each search asks the same question both ways round
 * and the adapter merges the answers. Neither list can be trusted to be the
 * whole answer on its own.
 */
export const V3PoolSearchResponseSchema = z.object({
  data: z
    .object({
      forward: z.array(RawPoolCardSchema),
      reverse: z.array(RawPoolCardSchema),
      _meta: RawMetaSchema.nullable(),
    })
    .nullish(),
  /** Read only for presence; provider error text is never inspected or forwarded. */
  errors: z.array(z.unknown()).nullish(),
});

export type V3PoolSearchResponse = z.infer<typeof V3PoolSearchResponseSchema>;
