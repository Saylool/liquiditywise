import type { ChainId } from "../chains/chains";
import {
  Bytes32HexSchema,
  compareV4PairPools,
  type DataFailureNotice,
  type DataResult,
  type V4PairPool,
  type V4PairPools,
  V4PairPoolsSchema,
} from "../../schemas";

import type { V4PoolState } from "./ethereumV4PoolState";
import { normalizeV4PoolCard } from "./v4PoolCardAdapter";
import { chainReadingFor } from "./v4PoolChainReading";
import type { V4PoolKey } from "./v4PoolKey";
import { V4PairPoolsResponseSchema } from "./v4PoolCardRawResponse";
import { poolRefs, readPoolManager, type V4PoolRef } from "./v4PoolSearchAdapter";
import type { PairFeeTiersDiagnostic } from "./v3PairFeeTiersAdapter";

const MALFORMED = "market-data-malformed";
const INDEXING_ERRORS = "market-data-indexing-errors";

const unavailable = (notice: DataFailureNotice): DataResult<V4PairPools> => ({
  status: "unavailable",
  reason: "invalid-response",
  notice,
});

/**
 * The pools a pair payload names — id and creation block — and the PoolManager
 * to ask about them. Only that much is read here, because a pool cannot be
 * verified until the chain has answered for its key.
 */
export const readV4PairPools = (
  payload: unknown,
): { readonly pools: readonly V4PoolRef[]; readonly poolManager: string | null } => {
  const parsed = V4PairPoolsResponseSchema.safeParse(payload);
  if (!parsed.success || parsed.data.data == null) return { pools: [], poolManager: null };

  return {
    pools: poolRefs(parsed.data.data.pools),
    poolManager: readPoolManager(parsed.data.data.poolManagers),
  };
};

export type NormalizeV4PairPoolsInput = {
  readonly payload: unknown;
  /** Each pool's liquidity, price and fees from the PoolManager, keyed by pool id. */
  readonly states: ReadonlyMap<string, V4PoolState>;
  /** Each pool's key from its Initialize log, keyed by pool id. Decides the fee. */
  readonly keys: ReadonlyMap<string, V4PoolKey>;
  /** The v4 pool being read, or `null` when this list sits beside a v3 pool's page. */
  readonly analysedPoolId: string | null;
  readonly fetchedAt: string;
  /** The chain the subgraph that answered reads; mainnet when not said. */
  readonly chainId?: ChainId;
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
  keys,
  analysedPoolId,
  fetchedAt,
  chainId = 1,
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
    const id = Bytes32HexSchema.safeParse(raw.id);
    const card = id.success
      ? normalizeV4PoolCard(raw, chainReadingFor(id.data, keys, states), chainId)
      : null;
    if (card === null) {
      dropped += 1;
      continue;
    }
    if (!byId.has(card.pool.id)) {
      const state = states.get(card.pool.id);
      byId.set(card.pool.id, {
        pool: card.pool,
        state:
          state === undefined
            ? null
            : { liquidity: state.liquidity, sqrtPriceX96: state.sqrtPriceX96 },
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
