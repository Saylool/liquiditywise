import { z } from "zod";

import {
  type DataSource,
  DataSourceSchema,
  SUBGRAPH_SOURCE_BY_PROTOCOL,
  SubgraphSourceSchema,
} from "./dataSource";
import {
  IsoTimestampSchema,
  PositivePriceSchema,
  TokenAmountSchema,
  Uint128StringSchema,
  UnsignedIntegerStringSchema,
  UsdAmountSchema,
} from "./primitives";
import { PoolReferenceSchema, type ProtocolVersion, TickSchema } from "./uniswap";

/**
 * Verified pool metrics, together with when they were retrieved and when they
 * were actually true on-chain.
 *
 * Two clocks, kept apart on purpose. `fetchedAt` says when *we* asked; the
 * `sourceBlock*` fields say what the answer describes. An indexer that has fallen
 * an hour behind still answers instantly, so a single "observed at" field would
 * make stale figures look fresh — and staleness is exactly what decides whether a
 * liquidity range is still sensible.
 *
 * Every metric is required-but-nullable rather than optional. That forces the
 * normalizer building a snapshot to make an explicit decision about each field: a
 * source that does not report a metric yields `null`, and `null` never means
 * zero. A source that genuinely reports zero yields `0`. Collapsing the two would
 * let the advisor reason about a pool as though it were empty or untraded when the
 * truth is simply that nobody told us.
 *
 * Unrefined and private: the cross-field rules are layered on below, and
 * `PoolMarketSnapshotSchema` is the only exported way in.
 */
const PoolMarketSnapshotObject = z.strictObject({
  pool: PoolReferenceSchema,

  /**
   * When this application received the response.
   *
   * A transport fact, never a freshness signal: it must not be copied into the
   * source-block fields when a provider omits them.
   */
  fetchedAt: IsoTimestampSchema,
  /**
   * The block the source had indexed up to, as an exact integer string — block
   * numbers are unbounded on-chain integers, so they are not parsed into
   * `number`. `null` when the provider does not report its indexing position.
   */
  sourceBlockNumber: UnsignedIntegerStringSchema.nullable(),
  /**
   * That block's timestamp: the instant these metrics were true. `null` when the
   * provider reports no block time. Compare against `fetchedAt` to measure lag.
   */
  sourceBlockTimestamp: IsoTimestampSchema.nullable(),

  /** How much token1 one whole token0 buys. Null when the source omits it. */
  token0PriceInToken1: PositivePriceSchema.nullable(),
  /** How much token0 one whole token1 buys — the reciprocal direction. */
  token1PriceInToken0: PositivePriceSchema.nullable(),

  tvlUsd: UsdAmountSchema.nullable(),
  /**
   * What `tvlUsd` is the value *of*: the two token balances the source credits
   * to the pool, in whole tokens.
   *
   * Carried so that one dollar can be converted into one token, which is what
   * sizing a deposit needs and what nothing else on this snapshot can do. The
   * three figures together give it: `tvlUsd / (lockedToken1 + lockedToken0 · P)`
   * is what the source thinks one token1 is worth, on the source's own basis —
   * the same basis its `feesUSD` is denominated in, which is the reason to
   * derive the rate from these rather than to fetch a price from anywhere else.
   * Two figures that disagreed about what a dollar is would divide one pool's
   * fees by another pool's money.
   *
   * Null when the source omits them. Zero is a real answer: an empty pool holds
   * nothing, and a pool of tokens the source does not price reports zero for all
   * three — which is a pool no deposit can be sized against, and is recognised
   * as such rather than divided by.
   */
  lockedToken0: TokenAmountSchema.nullable(),
  lockedToken1: TokenAmountSchema.nullable(),

  /** The pool's current tick, i.e. where the spot price sits on the tick grid. */
  tick: TickSchema.nullable(),
  /**
   * Raw in-range liquidity, kept as an exact decimal string. This is the
   * protocol's L value, not a USD amount and not a token amount, and it is stored
   * on-chain in a uint128 slot — so the schema bounds it to that width rather
   * than accepting any large integer.
   */
  liquidity: Uint128StringSchema.nullable(),

  source: DataSourceSchema,
});

/**
 * How far the product of two reciprocal prices may drift from 1 before the pair
 * is treated as contradictory.
 *
 * Both figures are float64 renderings of high-precision on-chain decimals, so a
 * genuine pair lands within a few ulps — relative error around 1e-15. 1e-6 sits
 * nine orders of magnitude above that, which tolerates a source that publishes
 * prices rounded to a handful of significant digits while still catching a real
 * inversion: reporting 2 and 2 gives a product of 4.
 */
export const RECIPROCAL_PRICE_TOLERANCE = 1e-6;

/**
 * Which sources may legitimately report market metrics for a pool.
 *
 * A v3 subgraph cannot describe a v4 pool or vice versa, and `hook-registry`
 * publishes hook metadata rather than pool metrics. {@link DataSourceSchema}
 * stays permissive because the registry is a valid source for other domain
 * models; the restriction belongs here, where the contradiction is possible.
 */
const SOURCES_BY_PROTOCOL: Record<ProtocolVersion, readonly DataSource[]> = {
  v3: ["uniswap-v3-subgraph", "derived-analytics"],
  v4: ["uniswap-v4-subgraph", "derived-analytics"],
};

/**
 * Verified against multiplication rather than division: both values are already
 * finite and strictly positive, so `p0 * p1` cannot divide by zero, and an
 * overflow to `Infinity` fails the comparison instead of throwing.
 *
 * Only checked when both directions are known — a missing reciprocal stays
 * missing, and is never computed here to fill the gap.
 */
const reciprocalPricesAgree = (snapshot: {
  readonly token0PriceInToken1: number | null;
  readonly token1PriceInToken0: number | null;
}): boolean => {
  const { token0PriceInToken1: forward, token1PriceInToken0: reverse } = snapshot;
  if (forward === null || reverse === null) return true;

  return Math.abs(forward * reverse - 1) <= RECIPROCAL_PRICE_TOLERANCE;
};

const sourceMatchesProtocol = (snapshot: {
  readonly pool: { readonly protocolVersion: ProtocolVersion };
  readonly source: DataSource;
}): boolean => SOURCES_BY_PROTOCOL[snapshot.pool.protocolVersion].includes(snapshot.source);

export const PoolMarketSnapshotSchema = PoolMarketSnapshotObject.refine(reciprocalPricesAgree, {
  error:
    "token0PriceInToken1 and token1PriceInToken0 must be reciprocals: their product must be 1 within tolerance.",
  path: ["token1PriceInToken0"],
}).refine(sourceMatchesProtocol, {
  error: "This data source cannot report market metrics for this pool's protocol version.",
  path: ["source"],
});

export type PoolMarketSnapshot = z.infer<typeof PoolMarketSnapshotSchema>;

/**
 * One point on a price series, later fed into deterministic volatility and range
 * calculations.
 *
 * `timestamp` is source time — when the price held — not when the series was
 * downloaded. Neither field is nullable: an observation missing its price or its
 * time is not an observation, and dropping it is the normalizer's job rather than
 * something downstream maths should have to filter.
 */
export const HistoricalPricePointSchema = z
  .strictObject({
    timestamp: IsoTimestampSchema,
    /** Direction is fixed by whoever assembled the series; state it alongside. */
    price: PositivePriceSchema,
    /**
     * The day's extremes, in the same direction as `price`.
     *
     * Null together, when the source reported extremes its own price for that day
     * did not sit between. The source publishes them the other way up, so an
     * adapter has to invert them — and inverting swaps which is the high and
     * which is the low. A day whose own price falls outside its own range is
     * either that mistake or a source contradicting itself, and neither is worth
     * carrying.
     */
    low: PositivePriceSchema.nullable(),
    high: PositivePriceSchema.nullable(),
    /**
     * What the whole pool traded and charged that day, in US dollars.
     *
     * The pool's, not a position's. Null when the source reported neither.
     */
    volumeUsd: UsdAmountSchema.nullable(),
    feesUsd: UsdAmountSchema.nullable(),
    /**
     * The liquidity active in the pool at the end of that day, as an exact
     * decimal string.
     *
     * The protocol's L, like the snapshot's — not a USD amount and not a token
     * amount — and the denominator under any question of the form "what share of
     * this day's fees would a position have taken". A position's share is its own
     * liquidity over this plus its own, so without it a deposit can be sized and
     * still not be placed against what it was competing with.
     *
     * **End of period, not an average over it.** The source snapshots the figure
     * when the day closes; liquidity moved during the day and this does not say
     * how. Null when the source omits it, which is a day no share can be worked
     * out for rather than a day with nothing in the pool.
     */
    activeLiquidity: Uint128StringSchema.nullable(),
  })
  .refine((point) => (point.low === null) === (point.high === null), {
    error: "A day's extremes are known together or not at all.",
    path: ["high"],
  })
  /*
   * A day's price sitting between its own extremes is the whole check. There was
   * a second refinement below it requiring the low not to sit above the high,
   * and mutation testing found it unreachable: if the low is above the high then
   * no price is between them, so this one has already rejected the point. It was
   * removed rather than given a test that could only have passed for the wrong
   * reason.
   */
  .refine(
    (point) =>
      point.low === null ||
      point.high === null ||
      (point.low <= point.price && point.price <= point.high),
    {
      error: "A day's own price must sit between the extremes reported for that day.",
      path: ["price"],
    },
  );

export type HistoricalPricePoint = z.infer<typeof HistoricalPricePointSchema>;

/**
 * How many completed daily closes a volatility figure is measured over.
 *
 * 31 closes yield 30 daily returns, which is what a 30-day volatility figure
 * needs. Asking for 30 closes would quietly produce 29 returns.
 *
 * This is a property of the *measurement*, not of the fetch. A history may carry
 * many more days than this — see {@link DAILY_PRICE_HISTORY_MAX_POINTS} — and
 * the extra ones are there to be measured *against* rather than measured *from*.
 */
export const VOLATILITY_WINDOW_DAYS = 31;

/**
 * The longest history this schema will accept, and exactly what the reader asks
 * for.
 *
 * It is the volatility window plus the longest horizon the interface offers, so
 * that a band can be fitted at a point in the past and then checked against the
 * whole horizon that followed it. Every extra day is a day the suggested method
 * can be tested on rather than fitted to.
 */
export const DAILY_PRICE_HISTORY_MAX_POINTS = VOLATILITY_WINDOW_DAYS + 90;

/** Ethereum mainnet; this history is not modelled for other chains yet. */
const HISTORY_CHAIN_ID = 1;

const asInstant = (timestamp: string): number => Date.parse(timestamp);

/** Milliseconds in one UTC day. Fixed: Unix time has no leap seconds. */
const MS_PER_DAY = 86_400_000;

/**
 * True when an instant sits exactly on a UTC midnight.
 *
 * Divisibility of epoch milliseconds is the whole test — no locale parsing, no
 * `getHours()`, no timezone lookup — because the Unix epoch is itself UTC
 * midnight and days are a constant length in Unix time.
 */
const isUtcDayAligned = (timestamp: string): boolean => asInstant(timestamp) % MS_PER_DAY === 0;

/** Which UTC calendar day an instant belongs to, as a whole-day epoch index. */
const utcDayIndex = (timestamp: string): number => Math.floor(asInstant(timestamp) / MS_PER_DAY);

const isStrictlyAscending = (points: readonly HistoricalPricePoint[]): boolean => {
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (previous === undefined || current === undefined) return false;
    if (asInstant(current.timestamp) <= asInstant(previous.timestamp)) return false;
  }
  return true;
};

/**
 * A normalized series of daily closing prices for one pool.
 *
 * Built to feed deterministic return and volatility maths later, which is why the
 * shape is stricter than it looks: those calculations are only meaningful over
 * observations that are real, ordered, distinct and inside a stated window.
 *
 * `points` may be shorter than the window implies. A source that never indexed a
 * given day simply has no observation for it, and inventing one — by
 * forward-filling the previous close, or by treating the gap as zero — would put
 * a fabricated number into a volatility figure. Gaps are reported through the
 * result's `missingFields`, never patched here.
 */
export const PoolDailyPriceHistorySchema = z
  .strictObject({
    pool: PoolReferenceSchema,
    /** When the response arrived, not what it describes. */
    fetchedAt: IsoTimestampSchema,
    sourceBlockNumber: UnsignedIntegerStringSchema.nullable(),
    sourceBlockTimestamp: IsoTimestampSchema.nullable(),

    /** Inclusive start of the requested window. */
    rangeStart: IsoTimestampSchema,
    /**
     * Exclusive end of the requested window. Exclusive so the current, still
     * incomplete day can be named as the boundary without being included.
     */
    rangeEndExclusive: IsoTimestampSchema,

    /** Bucket width. Only daily buckets are modelled today. */
    interval: z.literal("1d"),
    /**
     * Which direction every `price` is quoted in, stated once for the series
     * rather than left to the reader. Here: how much token1 one token0 buys.
     */
    priceDirection: z.literal("token0PriceInToken1"),

    points: z.array(HistoricalPricePointSchema).max(DAILY_PRICE_HISTORY_MAX_POINTS),

    /*
     * Narrower than a snapshot's source, which also admits `derived-analytics`:
     * a price history is always read from a source, never computed from one. A
     * series stamped as derived would be a series somebody assembled, and there
     * is no honest way to check the days in it.
     */
    source: SubgraphSourceSchema,
  })
  .refine((history) => asInstant(history.rangeStart) < asInstant(history.rangeEndExclusive), {
    error: "rangeStart must be earlier than rangeEndExclusive.",
    path: ["rangeStart"],
  })
  .refine(
    (history) =>
      history.pool.chainId === HISTORY_CHAIN_ID &&
      history.source === SUBGRAPH_SOURCE_BY_PROTOCOL[history.pool.protocolVersion],
    {
      /*
       * The producers are the two Uniswap mainnet subgraphs, one per protocol,
       * and each can only describe its own pools. A v3 series carrying a v4 pool
       * reference — or either carrying the other's source — means the series was
       * assembled from mismatched reads, which nothing downstream could detect:
       * the days would all be well-formed and would belong to a different pool.
       */
      error:
        "A history must come from its own protocol's Ethereum mainnet subgraph, and describe a pool on it.",
      path: ["pool"],
    },
  )
  .refine(
    (history) =>
      history.points.every((point) => {
        const instant = asInstant(point.timestamp);
        return (
          instant >= asInstant(history.rangeStart) &&
          instant < asInstant(history.rangeEndExclusive)
        );
      }),
    {
      error: "Every point must fall within [rangeStart, rangeEndExclusive).",
      path: ["points"],
    },
  )
  .refine((history) => isStrictlyAscending(history.points), {
    // Strict ordering rejects duplicate timestamps too: two closes for one day is
    // contradictory provider data, not something to silently de-duplicate.
    error: "Points must be strictly ascending by timestamp, with no duplicates.",
    path: ["points"],
  })
  /*
   * The daily invariants below give `interval: "1d"` its meaning here rather than
   * leaving it to whichever adapter happened to build the value. A caller that
   * constructs a history by hand, or a future second source, gets the same rules.
   *
   * They live on this wrapper and not on `HistoricalPricePointSchema`, which stays
   * interval-agnostic so hourly or weekly series can reuse it unchanged.
   */
  .refine((history) => isUtcDayAligned(history.rangeStart), {
    error: "rangeStart must fall exactly on a UTC day boundary.",
    path: ["rangeStart"],
  })
  .refine((history) => isUtcDayAligned(history.rangeEndExclusive), {
    error: "rangeEndExclusive must fall exactly on a UTC day boundary.",
    path: ["rangeEndExclusive"],
  })
  .refine((history) => history.points.every((point) => isUtcDayAligned(point.timestamp)), {
    // A close is the day's settled price, so it is stamped at that day's boundary.
    // A midday timestamp is a different measurement wearing a daily label.
    error: "Every daily point must fall exactly on a UTC day boundary.",
    path: ["points"],
  })
  .refine(
    (history) =>
      new Set(history.points.map((point) => utcDayIndex(point.timestamp))).size ===
      history.points.length,
    {
      // Stated independently of the alignment rule so the constraint survives even
      // if alignment is ever relaxed: one calendar day yields at most one close.
      error: "At most one observation is allowed per UTC calendar day.",
      path: ["points"],
    },
  );

export type PoolDailyPriceHistory = z.infer<typeof PoolDailyPriceHistorySchema>;
