import {
  type DataFailureNotice,
  type DataResult,
  type DataWarningNotice,
  type EvmAddress,
  EvmAddressSchema,
  type HistoricalPricePoint,
  type PoolDailyPriceHistory,
  PoolDailyPriceHistorySchema,
} from "../../schemas";
import { DAILY_HISTORY_DAYS, type DailyHistoryWindow } from "./v3DailyHistoryWindow";
import { V3DailyPriceHistoryResponseSchema } from "./v3DailyPriceHistoryRawResponse";
import {
  evaluateSourceFreshness,
  FRESHNESS_UNVERIFIED_WARNING,
} from "./v3SourceFreshness";
import { convertNonNegativeDecimal, unixSecondsToIso } from "./v3SubgraphRawResponse";

/** This adapter reads Ethereum mainnet only; multi-chain support is not modelled yet. */
export const ETHEREUM_MAINNET_CHAIN_ID = 1;

const MALFORMED = "market-data-malformed";
const INDEXING_ERRORS = "market-data-indexing-errors";
const NOT_FOUND = "pool-not-found";
const INSUFFICIENT = "pool-history-insufficient";

/**
 * Raised when the source indexed fewer days than the window covers.
 *
 * The gap is reported rather than filled. Carrying the previous close forward, or
 * treating a missing day as zero, would put an invented number into a return
 * series and make a volatility figure look better-supported than it is.
 */
const INCOMPLETE_COVERAGE_WARNING = "history-window-incomplete";

const unavailable = (
  reason: "invalid-response" | "not-found" | "stale-data" | "insufficient-data",
  notice: DataFailureNotice,
): DataResult<PoolDailyPriceHistory> => ({ status: "unavailable", reason, notice });

/**
 * Fields that may legitimately be incomplete, in the order the domain schema
 * declares them. Filtering a fixed list is what makes `missingFields`
 * deterministic rather than dependent on evaluation order.
 */
const REPORTABLE_MISSING_FIELDS = [
  "sourceBlockNumber",
  "sourceBlockTimestamp",
  "points",
] as const satisfies readonly (keyof PoolDailyPriceHistory & string)[];

export type NormalizeV3DailyPriceHistoryInput = {
  /** The decoded JSON body, still untrusted. */
  readonly payload: unknown;
  /** The caller's pool address, already validated and lower-cased. */
  readonly poolAddress: EvmAddress;
  /** When the response arrived, from an injected clock. */
  readonly fetchedAt: string;
  /** The window the query asked for, from the same clock. */
  readonly window: DailyHistoryWindow;
};

/**
 * Turns one raw `poolDayDatas` payload into a domain price series, or into an
 * explicit failure. Pure: no clock, no network, no environment.
 */
export const normalizeV3DailyPriceHistory = ({
  payload,
  poolAddress,
  fetchedAt,
  window,
}: NormalizeV3DailyPriceHistoryInput): DataResult<PoolDailyPriceHistory> => {
  const parsed = V3DailyPriceHistoryResponseSchema.safeParse(payload);
  if (!parsed.success) return unavailable("invalid-response", MALFORMED);

  const { data, errors } = parsed.data;

  // Fail closed: a GraphQL response may carry partial data beside errors, and that
  // data is not verified.
  if (errors != null && errors.length > 0) return unavailable("invalid-response", MALFORMED);
  if (data == null) return unavailable("invalid-response", MALFORMED);
  if (data._meta?.hasIndexingErrors === true) {
    return unavailable("invalid-response", INDEXING_ERRORS);
  }
  // A null pool means the address is not a pool at all — distinct from a known
  // pool whose history is too short, which is reported as insufficient-data below.
  if (data.pool === null) return unavailable("not-found", NOT_FOUND);

  const returnedId = EvmAddressSchema.safeParse(data.pool.id);
  if (!returnedId.success || returnedId.data !== poolAddress) {
    return unavailable("invalid-response", MALFORMED);
  }

  const meta = data._meta;
  let sourceBlockTimestamp: string | null = null;
  if (meta != null && meta.block.timestamp !== null) {
    sourceBlockTimestamp = unixSecondsToIso(meta.block.timestamp);
    if (sourceBlockTimestamp === null) return unavailable("invalid-response", MALFORMED);
  }

  const freshness = evaluateSourceFreshness({ fetchedAt, sourceBlockTimestamp });
  if (!freshness.ok) return unavailable(freshness.reason, freshness.notice);

  /*
   * Each row is checked against the window's own day-starts rather than against a
   * range test. That rejects a timestamp outside the window and a timestamp that
   * is not a UTC day boundary in one step, and it means a repeated day is caught
   * as a duplicate rather than quietly overwriting its twin.
   */
  const expectedTimestamps = new Set(window.expectedTimestamps);
  const seenTimestamps = new Set<string>();
  const points: HistoricalPricePoint[] = [];

  for (const day of data.poolDayDatas) {
    /*
     * Ownership is proved per row, not assumed.
     *
     * The `where` clause asks for one pool's rows, and the top-level `pool` field
     * confirms the pool exists — neither shows that *this* row belongs to it. A
     * response that mixed in another pool's day would otherwise be republished
     * under the requested pool's identity, which is a wrong price attributed to
     * the right-looking pool: exactly the kind of error nothing downstream could
     * detect. Array position and the row's opaque `id` are not evidence either.
     */
    const rowPoolId = EvmAddressSchema.safeParse(day.pool.id);
    if (!rowPoolId.success || rowPoolId.data !== poolAddress) {
      return unavailable("invalid-response", MALFORMED);
    }

    const timestamp = unixSecondsToIso(day.date);
    if (timestamp === null || !expectedTimestamps.has(timestamp)) {
      return unavailable("invalid-response", MALFORMED);
    }
    if (seenTimestamps.has(timestamp)) return unavailable("invalid-response", MALFORMED);
    seenTimestamps.add(timestamp);

    /*
     * The subgraph's `token1Price` is token1 per token0, which is the price of
     * token0 expressed in token1 — our `token0PriceInToken1` direction. A zero or
     * negative close is not a cheap day, it is malformed input.
     */
    const price = convertNonNegativeDecimal(day.token1Price, { allowZero: false });
    if (!price.ok) return unavailable("invalid-response", MALFORMED);

    /*
     * The extremes arrive in the opposite direction, so inverting them swaps
     * which is which: the highest price of token0 in token1 is the lowest price
     * of token1 in token0. Getting that backwards produces a range that still
     * looks like a range, which is why the day's own price is then required to
     * sit inside it — a check the schema repeats.
     */
    const providerHigh = convertNonNegativeDecimal(day.high, { allowZero: false });
    const providerLow = convertNonNegativeDecimal(day.low, { allowZero: false });
    const extremes =
      providerHigh.ok && providerLow.ok
        ? { low: 1 / providerHigh.value, high: 1 / providerLow.value }
        : null;
    const usableExtremes =
      extremes !== null && extremes.low <= price.value && price.value <= extremes.high
        ? extremes
        : null;

    /*
     * Zero is a real answer here, unlike a price: a pool can go a day without a
     * single swap, and reporting that as unknown would lose the fact.
     */
    const volumeUsd = convertNonNegativeDecimal(day.volumeUSD, { allowZero: true });
    const feesUsd = convertNonNegativeDecimal(day.feesUSD, { allowZero: true });

    points.push({
      timestamp,
      price: price.value,
      low: usableExtremes?.low ?? null,
      high: usableExtremes?.high ?? null,
      volumeUsd: volumeUsd.ok ? volumeUsd.value : null,
      feesUsd: feesUsd.ok ? feesUsd.value : null,
    });
  }

  // A single close yields no return at all, and none yields nothing to measure.
  // The pool exists, so this is a shortage of history, not a missing pool.
  if (points.length <= 1) return unavailable("insufficient-data", INSUFFICIENT);

  const candidate = {
    pool: {
      protocolVersion: "v3",
      chainId: ETHEREUM_MAINNET_CHAIN_ID,
      id: poolAddress,
    },
    fetchedAt,
    sourceBlockNumber: meta == null ? null : String(meta.block.number),
    sourceBlockTimestamp,
    rangeStart: window.rangeStart,
    rangeEndExclusive: window.rangeEndExclusive,
    interval: "1d",
    priceDirection: "token0PriceInToken1",
    points,
    source: "uniswap-v3-subgraph",
  };

  // The domain schema is the final authority: ordering, uniqueness, range and
  // count are all re-checked there, so a normalization slip cannot be published.
  const history = PoolDailyPriceHistorySchema.safeParse(candidate);
  if (!history.success) return unavailable("invalid-response", MALFORMED);

  const isIncomplete = history.data.points.length < DAILY_HISTORY_DAYS;
  const missing = REPORTABLE_MISSING_FIELDS.filter((field) =>
    field === "points" ? isIncomplete : history.data[field] === null,
  );

  const [firstMissing, ...remainingMissing] = missing;
  if (firstMissing === undefined) return { status: "success", data: history.data };

  // Fixed order from a fixed set, so identical responses warn identically.
  const warnings: DataWarningNotice[] = [];
  if (isIncomplete) warnings.push(INCOMPLETE_COVERAGE_WARNING);
  if (sourceBlockTimestamp === null) warnings.push(FRESHNESS_UNVERIFIED_WARNING);

  return {
    status: "partial",
    data: history.data,
    missingFields: [firstMissing, ...remainingMissing],
    warnings,
  };
};
