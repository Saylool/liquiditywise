import {
  compareV4PairPools,
  type DataFailureNotice,
  type DataResult,
  EvmAddressSchema,
  type V4PairPool,
  type V4PairPools,
  V4PairPoolsSchema,
  type V4Pool,
} from "../../schemas";
import type { V4PoolState } from "./ethereumV4PoolState";
import { normalizeV4PoolCard } from "./v4PoolCardAdapter";
import { V4PairPoolsResponseSchema } from "./v4PoolCardRawResponse";
import type { PairFeeTiersDiagnostic } from "./v3PairFeeTiersAdapter";

const MALFORMED = "market-data-malformed";
const INDEXING_ERRORS = "market-data-indexing-errors";

const unavailable = (notice: DataFailureNotice): DataResult<V4PairPools> => ({
  status: "unavailable",
  reason: "invalid-response",
  notice,
});

/**
 * The verified pools in a pair payload, and the PoolManager to ask about them.
 *
 * The same card normaliser runs here and again below, so a pool the chain was
 * asked about is exactly a pool that can appear in the answer.
 */
export const readV4PairPools = (
  payload: unknown,
): { readonly pools: readonly V4Pool[]; readonly poolManager: string | null } => {
  const parsed = V4PairPoolsResponseSchema.safeParse(payload);
  if (!parsed.success || parsed.data.data == null) return { pools: [], poolManager: null };

  const pools: V4Pool[] = [];
  const seen = new Set<string>();
  for (const raw of parsed.data.data.pools) {
    const card = normalizeV4PoolCard(raw);
    if (card !== null && !seen.has(card.pool.id)) {
      seen.add(card.pool.id);
      pools.push(card.pool);
    }
  }
  /* Validated rather than trusted: it decides whose storage the next request reads. */
  const manager = EvmAddressSchema.safeParse(parsed.data.data.poolManagers[0]?.id);

  return { pools, poolManager: manager.success ? manager.data : null };
};

export type NormalizeV4PairPoolsInput = {
  readonly payload: unknown;
  /** Each pool's liquidity and price from the PoolManager, keyed by pool id. */
  readonly states: ReadonlyMap<string, V4PoolState>;
  /** The v4 pool being read, or `null` when this list sits beside a v3 pool's page. */
  readonly analysedPoolId: string | null;
  readonly fetchedAt: string;
  readonly onDiagnostic?: PairFeeTiersDiagnostic | undefined;
};

/**
 * Turns one raw pair payload into the domain type, or into an explicit failure.
 * Pure: no clock, no network, no environment.
 *
 * A sibling that cannot be verified leaves the list, as a search result does.
 * The pool the reader is on is not special-cased: the schema requires it, so
 * dropping it takes the panel down rather than showing every sibling but theirs.
 */
export const normalizeV4PairPools = ({
  payload,
  states,
  analysedPoolId,
  fetchedAt,
  onDiagnostic,
}: NormalizeV4PairPoolsInput): DataResult<V4PairPools> => {
  const parsed = V4PairPoolsResponseSchema.safeParse(payload);
  if (!parsed.success) return unavailable(MALFORMED);

  const { data, errors } = parsed.data;
  if (errors != null && errors.length > 0) return unavailable(MALFORMED);
  if (data == null) return unavailable(MALFORMED);
  if (data._meta?.hasIndexingErrors === true) return unavailable(INDEXING_ERRORS);

  const byId = new Map<string, V4PairPool>();
  let dropped = 0;
  for (const raw of data.pools) {
    const card = normalizeV4PoolCard(raw);
    if (card === null) {
      dropped += 1;
      continue;
    }
    if (!byId.has(card.pool.id)) {
      byId.set(card.pool.id, {
        pool: card.pool,
        state: states.get(card.pool.id) ?? null,
        ethPrice: card.ethPrice,
      });
    }
  }

  if (dropped > 0) onDiagnostic?.(`${dropped} of ${data.pools.length} v4 pair pools unverifiable`);

  const result = V4PairPoolsSchema.safeParse({
    analysedPoolId,
    pools: [...byId.values()].sort(compareV4PairPools),
    fetchedAt,
    sources: ["uniswap-v4-subgraph", "ethereum-rpc"],
  });
  if (!result.success) return unavailable(MALFORMED);

  return { status: "success", data: result.data };
};
