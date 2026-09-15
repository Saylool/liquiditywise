import {
  type DataFailureNotice,
  type DataResult,
  type V4Pool,
  type V4PoolCandidateList,
  V4PoolCandidateListSchema,
} from "../../schemas";
import { normalizeV4PoolCard } from "./v4PoolCardAdapter";
import { V4PoolListResponseSchema } from "./v4PoolCardRawResponse";

const MALFORMED = "market-data-malformed";
const INDEXING_ERRORS = "market-data-indexing-errors";

const unavailable = (notice: DataFailureNotice): DataResult<V4PoolCandidateList> => ({
  status: "unavailable",
  reason: "invalid-response",
  notice,
});

/**
 * Turns the traded v4 pool list into verified pools, keeping the source's order.
 *
 * A net rather than a ranking, like the v3 list. What this application adds is
 * that every entry went through the same card normaliser the v4 search uses, so
 * a candidate cannot enter on easier terms than a pool a reader searched for —
 * a dynamic fee still needs a hook, a return-delta bit still needs its callback.
 *
 * Pure: no clock, no network, no environment.
 */
export const normalizeV4TradedPools = ({
  payload,
  fetchedAt,
}: {
  readonly payload: unknown;
  readonly fetchedAt: string;
}): DataResult<V4PoolCandidateList> => {
  const parsed = V4PoolListResponseSchema.safeParse(payload);
  if (!parsed.success) return unavailable(MALFORMED);

  const { data, errors } = parsed.data;
  if (errors != null && errors.length > 0) return unavailable(MALFORMED);
  if (data == null) return unavailable(MALFORMED);
  if (data._meta?.hasIndexingErrors === true) return unavailable(INDEXING_ERRORS);

  const pools: V4Pool[] = [];
  const seen = new Set<string>();
  for (const raw of data.pools) {
    const card = normalizeV4PoolCard(raw);
    if (card === null || seen.has(card.pool.id)) continue;
    seen.add(card.pool.id);
    pools.push(card.pool);
  }

  const result = V4PoolCandidateListSchema.safeParse({
    pools,
    fetchedAt,
    source: "uniswap-v4-subgraph",
  });
  if (!result.success) return unavailable(MALFORMED);

  return { status: "success", data: result.data };
};
