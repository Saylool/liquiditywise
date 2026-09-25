import { z } from "zod";

import { RawPoolCardSchema } from "./v3PoolCardRawResponse";

/*
 * The untrusted edge of the v3 day-table read: the week's busiest pool-days,
 * each with what it traded and charged and its pool's card. Read by the
 * most-traded page, and by a name search on a chain whose subgraph cannot
 * filter pools by symbol.
 */
export const V3PoolDaysResponseSchema = z.object({
  data: z
    .object({
      poolDayDatas: z.array(
        z.object({ date: z.number(), volumeUSD: z.string(), feesUSD: z.string(), pool: RawPoolCardSchema }),
      ),
      _meta: z.object({ hasIndexingErrors: z.boolean() }).nullable(),
    })
    .nullish(),
  /** Read only for presence; provider error text is never inspected or forwarded. */
  errors: z.array(z.unknown()).nullish(),
});
