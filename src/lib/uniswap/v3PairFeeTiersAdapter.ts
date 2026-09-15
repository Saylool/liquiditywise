import {
  type DataFailureNotice,
  type DataResult,
  type PairFeeTier,
  type PairFeeTiers,
  PairFeeTiersSchema,
  type V3PoolMetadata,
} from "../../schemas";
import { V3PoolListResponseSchema } from "./v3PoolListRawResponse";
import type { PoolReserves } from "./ethereumV3PoolReserves";
import { normalizePoolCard } from "./v3PoolCardAdapter";

const MALFORMED = "market-data-malformed";
const INDEXING_ERRORS = "market-data-indexing-errors";

const unavailable = (notice: DataFailureNotice): DataResult<PairFeeTiers> => ({
  status: "unavailable",
  reason: "invalid-response",
  notice,
});

/** Told which rule dropped a pool, and nothing about the pool. Optional. */
export type PairFeeTiersDiagnostic = (detail: string) => void;

/** Ascending by fee: the order this application publishes, and its own claim. */
const byFee = (left: PairFeeTier, right: PairFeeTier): number =>
  left.pool.feePpm - right.pool.feePpm;

/**
 * The verified pools in a payload, for asking the chain what they hold.
 *
 * A first pass rather than a second parse of a different shape: the same card
 * normaliser runs here and again below, so a pool the reserves were read for is
 * exactly a pool that can appear in the answer. Anything it refuses is skipped
 * in both places.
 */
export const readPoolsForReserves = (payload: unknown): readonly V3PoolMetadata[] => {
  const parsed = V3PoolListResponseSchema.safeParse(payload);
  if (!parsed.success || parsed.data.data == null) return [];

  const pools: V3PoolMetadata[] = [];
  for (const raw of parsed.data.data.pools) {
    const card = normalizePoolCard(raw);
    if (card !== null) pools.push(card.pool);
  }

  return pools;
};

export type NormalizeV3PairFeeTiersInput = {
  /** The decoded JSON body, still untrusted. */
  readonly payload: unknown;
  /**
   * What each pool actually holds, read from the chain, keyed by pool address.
   *
   * Passed in rather than filled afterwards so that both sources go through the
   * domain schema together. A figure patched onto a validated object is a figure
   * nothing validated.
   */
  readonly reserves: ReadonlyMap<string, PoolReserves>;
  /** The pool the reader is looking at, already validated by the caller. */
  readonly analysedPoolId: string;
  /** When the request was made, from the reader's injected clock. */
  readonly fetchedAt: string;
  readonly onDiagnostic?: PairFeeTiersDiagnostic | undefined;
};

/**
 * Turns one raw fee-tier payload into the domain type, or into an explicit
 * failure. Pure: no clock, no network, no environment.
 *
 * A sibling that cannot be verified leaves the list, the way a search result
 * does — three checked tiers and one dropped is still a true answer to "where
 * else does this pair trade". The pool the reader is *on* is the exception, and
 * it is not special-cased here: the domain schema requires it to be present, so
 * dropping it takes the whole panel down rather than quietly showing a reader
 * every tier except their own.
 *
 * There is no `partial` outcome. This either produces a list or produces
 * nothing, and nothing costs the page only a panel.
 */
export const normalizeV3PairFeeTiers = ({
  payload,
  reserves,
  analysedPoolId,
  fetchedAt,
  onDiagnostic,
}: NormalizeV3PairFeeTiersInput): DataResult<PairFeeTiers> => {
  const parsed = V3PoolListResponseSchema.safeParse(payload);
  if (!parsed.success) return unavailable(MALFORMED);

  const { data, errors } = parsed.data;

  // Fail closed: a GraphQL response may carry data beside errors, and that data
  // is not verified.
  if (errors != null && errors.length > 0) return unavailable(MALFORMED);
  if (data == null) return unavailable(MALFORMED);
  if (data._meta?.hasIndexingErrors === true) return unavailable(INDEXING_ERRORS);

  const tiers: PairFeeTier[] = [];
  let dropped = 0;

  for (const raw of data.pools) {
    const card = normalizePoolCard(raw);
    if (card === null) {
      dropped += 1;
      continue;
    }
    tiers.push({ pool: card.pool, reserves: reserves.get(card.pool.id) ?? null });
  }

  if (dropped > 0) {
    onDiagnostic?.(`${dropped} of ${data.pools.length} fee tiers unverifiable`);
  }

  /*
   * The domain schema is the final authority, and here it checks this
   * application's work as much as the provider's: that every entry really is the
   * same pair, that no tier is listed twice, that the order is the one claimed,
   * and that the pool the reader is on is among them. Each of those failures
   * produces a list that looks entirely reasonable on screen.
   */
  const result = PairFeeTiersSchema.safeParse({
    analysedPoolId,
    tiers: [...tiers].sort(byFee),
    fetchedAt,
    sources: ["uniswap-v3-subgraph", "ethereum-rpc"],
  });
  if (!result.success) return unavailable(MALFORMED);

  return { status: "success", data: result.data };
};
