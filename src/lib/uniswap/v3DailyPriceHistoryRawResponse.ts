import { z } from "zod";

import { RawMetaSchema } from "./v3SubgraphRawResponse";

/*
 * The untrusted edge of the daily-history query. Provider field names stop here;
 * nothing below is re-exported into the domain.
 *
 * Non-strict objects, as with the snapshot boundary: a provider adding a field
 * must not break the read, so unknown keys are dropped rather than rejected.
 */

/**
 * One `PoolDayData` row, narrowed to the fields this series needs.
 *
 * `date` is `Int!` in the official schema — a Unix second count already rounded
 * to the start of its UTC day — so it arrives as a JSON number. `token1Price` is
 * `BigDecimal!` and arrives as a string. Declaring the expected JSON types up
 * front is what keeps a boolean or a number from being coerced into a price.
 */
const RawPoolDayDataSchema = z.object({
  id: z.string(),
  date: z.int().min(0),
  /** Provider perspective: token1 per token0. Becomes `token0PriceInToken1`. */
  token1Price: z.string(),
  /**
   * The day's extremes, published the *other* way up — in `token0Price`, token0
   * per token1 — while `token1Price` above is our direction. An adapter has to
   * invert them, and inverting swaps which one is the high.
   *
   * `open` and `close` are deliberately not selected. In the deployment this
   * queries they come back equal to each other and one day stale, which is not a
   * price this application is willing to publish; the extremes bracket the day's
   * own `token1Price` on every row inspected, so those are used instead.
   */
  high: z.string(),
  low: z.string(),
  /** `BigDecimal!`. What the whole pool traded and charged that day. */
  volumeUSD: z.string(),
  feesUSD: z.string(),
  /**
   * `BigInt!`, so a string: the in-range liquidity the day closed on. It is the
   * denominator a position's share of that day's fees is taken over, and it is
   * the protocol's L — an integer far too wide for a JSON number, which is why
   * the official schema sends it as text and why it stays text through here.
   *
   * Optional here, unlike every field above it, and the difference is what each
   * one costs when a provider stops sending it. Without a price or a volume this
   * series is not a series and the read has to fail. Without this, one panel on
   * one page cannot be drawn and every other figure is untouched — so it
   * degrades to `null` in the adapter rather than failing a whole month of
   * history.
   */
  liquidity: z.string().nullish(),
  /**
   * Required, not optional. Each row states which pool it belongs to so ownership
   * can be proved per row rather than inferred from the query's filter, from the
   * row's opaque `id`, or from the separate top-level `pool` field. `Pool!` is
   * non-null in the schema, so a row without it is a malformed response.
   */
  pool: z.object({ id: z.string() }),
});

/**
 * The pool's identity, and the one fact about it a series cannot supply: when
 * it last traded at all.
 *
 * `lastDay` is capped at one row by the query and carries only `date`, an
 * `Int!` and so a JSON number. An empty array is a pool that has never had a
 * day indexed, which is a real answer rather than a missing one.
 */
const RawPoolIdentitySchema = z.object({
  id: z.string(),
  lastDay: z.array(z.object({ date: z.number().int() })).max(1),
});

export const V3DailyPriceHistoryResponseSchema = z.object({
  data: z
    .object({
      /**
       * Present even though only `id` is read: it is what separates "this pool
       * does not exist" from "this pool exists but has no indexed days".
       */
      pool: RawPoolIdentitySchema.nullable(),
      poolDayDatas: z.array(RawPoolDayDataSchema),
      _meta: RawMetaSchema.nullable(),
    })
    .nullish(),
  /** Read only for presence; provider error text is never inspected or forwarded. */
  errors: z.array(z.unknown()).nullish(),
});

export type V3DailyPriceHistoryResponse = z.infer<typeof V3DailyPriceHistoryResponseSchema>;
