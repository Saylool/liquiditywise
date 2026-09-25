import {
  type DataFailureNotice,
  type DataResult,
  type DataWarningNotice,
  type PoolMarketSnapshot,
  PoolMarketSnapshotSchema,
  TickSchema,
  Uint128StringSchema,
} from "../../schemas";
import type { SubgraphPoolIdentity } from "./subgraphPoolIdentity";
import {
  evaluateSourceFreshness,
  FRESHNESS_UNVERIFIED_WARNING,
  MAX_SOURCE_CLOCK_SKEW_MS,
  MAX_SOURCE_LAG_MS,
} from "./v3SourceFreshness";
import {
  convertNonNegativeDecimal,
  convertSafeInteger,
  unixSecondsToIso,
  V3PoolQueryResponseSchema,
} from "./v3SubgraphRawResponse";

/*
 * Re-exported so this module stays the entry point callers already import the
 * freshness thresholds from, while the policy itself lives in one place.
 */
export { MAX_SOURCE_CLOCK_SKEW_MS, MAX_SOURCE_LAG_MS };

/** This adapter reads Ethereum mainnet only; multi-chain support is not modelled yet. */
export const ETHEREUM_MAINNET_CHAIN_ID = 1;

const MALFORMED = "market-data-malformed";
const INDEXING_ERRORS = "market-data-indexing-errors";
const NOT_FOUND = "pool-not-found";

const unavailable = (
  reason: "invalid-response" | "not-found" | "stale-data",
  notice: DataFailureNotice,
): DataResult<PoolMarketSnapshot> => ({ status: "unavailable", reason, notice });

/**
 * Fields that may legitimately be null in a snapshot built from this source,
 * listed in the order the domain schema declares them.
 *
 * Iterating a fixed list is what makes `missingFields` deterministic: the same
 * response always produces the same array, in the same order, regardless of key
 * insertion or iteration order elsewhere.
 */
const NULLABLE_SNAPSHOT_FIELDS = [
  "sourceBlockNumber",
  "sourceBlockTimestamp",
  "tick",
] as const satisfies readonly (keyof PoolMarketSnapshot & string)[];

export type NormalizePoolSnapshotInput = {
  /** The decoded JSON body, still untrusted. */
  readonly payload: unknown;
  /** Which pool was asked about, and which protocol's subgraph answered. */
  readonly identity: SubgraphPoolIdentity;
  /** When the response arrived, from an injected clock. */
  readonly fetchedAt: string;
};

/**
 * Turns one raw subgraph payload into a domain snapshot, or into an explicit
 * failure. Pure: no clock, no network, no environment — the same input always
 * produces the same result.
 *
 * Shared by v3 and v4, which publish this entity identically. Everything that
 * differs between them arrives in `identity`; everything below this line — the
 * price-direction mapping, the reciprocal check, the freshness gate — is the
 * same reasoning for both and exists once.
 */
export const normalizePoolSnapshot = ({
  payload,
  identity,
  fetchedAt,
}: NormalizePoolSnapshotInput): DataResult<PoolMarketSnapshot> => {
  const parsed = V3PoolQueryResponseSchema.safeParse(payload);
  if (!parsed.success) return unavailable("invalid-response", MALFORMED);

  const { data, errors } = parsed.data;

  // Fail closed. A GraphQL response may carry partial data alongside errors; that
  // data is not verified, and this application does not present unverified figures.
  if (errors != null && errors.length > 0) {
    return unavailable("invalid-response", MALFORMED);
  }
  if (data == null) {
    return unavailable("invalid-response", MALFORMED);
  }
  if (data._meta?.hasIndexingErrors === true) {
    return unavailable("invalid-response", INDEXING_ERRORS);
  }
  if (data.pool === null) {
    return unavailable("not-found", NOT_FOUND);
  }

  const pool = data.pool;

  // The provider echoes the pool id it matched. A mismatch means the response
  // describes a different pool than the one asked about.
  if (!identity.matches(pool.id)) {
    return unavailable("invalid-response", MALFORMED);
  }

  /*
   * The provider's price field names use the opposite perspective from ours:
   *
   *   subgraph token0Price = how much token0 one token1 buys -> token1PriceInToken0
   *   subgraph token1Price = how much token1 one token0 buys -> token0PriceInToken1
   *
   * Reversing this would invert every price the advisor reports while still
   * satisfying the domain schema's reciprocal check, so the mapping is spelled out
   * here and pinned by its own test.
   */
  const token1PriceInToken0 = convertNonNegativeDecimal(pool.token0Price, { allowZero: false });
  const token0PriceInToken1 = convertNonNegativeDecimal(pool.token1Price, { allowZero: false });
  // TVL of exactly zero is a real state for an empty pool, unlike a zero price.
  const tvlUsd = convertNonNegativeDecimal(pool.totalValueLockedUSD, { allowZero: true });

  if (!token1PriceInToken0.ok || !token0PriceInToken1.ok || !tvlUsd.ok) {
    return unavailable("invalid-response", MALFORMED);
  }

  /*
   * The two balances behind that USD figure. Zero is real here for the same
   * reason it is real above, and a figure that will not convert becomes `null`
   * rather than failing the snapshot: every other field on it is a price, a tick
   * and a liquidity that the range this page exists to draw is computed from,
   * and none of them needs to know what the pool is holding.
   */
  const lockedToken0 = convertNonNegativeDecimal(pool.totalValueLockedToken0 ?? "", {
    allowZero: true,
  });
  const lockedToken1 = convertNonNegativeDecimal(pool.totalValueLockedToken1 ?? "", {
    allowZero: true,
  });

  const liquidity = Uint128StringSchema.safeParse(pool.liquidity);
  if (!liquidity.success) {
    return unavailable("invalid-response", MALFORMED);
  }

  let tick: number | null = null;
  if (pool.tick !== null) {
    const rawTick = convertSafeInteger(pool.tick);
    if (!rawTick.ok) return unavailable("invalid-response", MALFORMED);

    const validTick = TickSchema.safeParse(rawTick.value);
    if (!validTick.success) {
      return unavailable("invalid-response", MALFORMED);
    }
    tick = validTick.data;
  }

  const meta = data._meta;
  let sourceBlockTimestamp: string | null = null;
  if (meta != null && meta.block.timestamp !== null) {
    sourceBlockTimestamp = unixSecondsToIso(meta.block.timestamp);
    if (sourceBlockTimestamp === null) {
      return unavailable("invalid-response", MALFORMED);
    }
  }

  const candidate = {
    pool: {
      protocolVersion: identity.protocolVersion,
      chainId: identity.chainId,
      id: identity.id,
    },
    fetchedAt,
    // Block numbers are exact on-chain integers, so they are carried as canonical
    // decimal strings rather than parsed into a JS number.
    sourceBlockNumber: meta == null ? null : String(meta.block.number),
    sourceBlockTimestamp,
    token0PriceInToken1: token0PriceInToken1.value,
    token1PriceInToken0: token1PriceInToken0.value,
    tvlUsd: tvlUsd.value,
    lockedToken0: lockedToken0.ok ? lockedToken0.value : null,
    lockedToken1: lockedToken1.ok ? lockedToken1.value : null,
    tick,
    liquidity: liquidity.data,
    source: identity.source,
  };

  // The domain schema is the final authority. If normalization produced anything
  // it refuses — a non-canonical timestamp, prices that are not reciprocal — the
  // response is reported as unverifiable rather than published.
  const snapshot = PoolMarketSnapshotSchema.safeParse(candidate);
  if (!snapshot.success) {
    return unavailable("invalid-response", MALFORMED);
  }

  /*
   * Freshness is judged here, at the normalization boundary, because it is the one
   * place holding both clocks: `fetchedAt` from the injected clock and the source
   * block time from the response. Both have already passed the domain schema, so
   * both parse to finite instants.
   *
   * Preserving a timestamp nobody checks is how stale figures reach a caller
   * looking verified, so the check is a gate rather than a warning.
   */
  const blockTime = snapshot.data.sourceBlockTimestamp;
  const freshness = evaluateSourceFreshness({
    fetchedAt: snapshot.data.fetchedAt,
    sourceBlockTimestamp: blockTime,
  });
  if (!freshness.ok) return unavailable(freshness.reason, freshness.notice);

  const missing = NULLABLE_SNAPSHOT_FIELDS.filter((field) => snapshot.data[field] === null);
  const [firstMissing, ...remainingMissing] = missing;
  /*
   * Reached routinely now. It was unreachable while three rolling-volume fields
   * were always null — fields this snapshot no longer carries, because the
   * source does not report them per window and the figures that do exist are
   * summed from day data elsewhere. A snapshot with nothing missing is a plain
   * success, with no caveat attached to every analysis.
   */
  if (firstMissing === undefined) return { status: "success", data: snapshot.data };

  // Built in a fixed order from a fixed set, so the same response always yields
  // the same warnings in the same positions.
  const warnings: DataWarningNotice[] = blockTime === null ? [FRESHNESS_UNVERIFIED_WARNING] : [];

  return {
    status: "partial",
    data: snapshot.data,
    missingFields: [firstMissing, ...remainingMissing],
    warnings,
  };
};
