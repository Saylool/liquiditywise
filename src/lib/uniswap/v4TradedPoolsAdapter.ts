import {
  type DataFailureNotice,
  type DataResult,
  type V4Pool,
  type V4PoolCandidateList,
  V4PoolCandidateListSchema,
} from "../../schemas";
import { TRADED_POOL_LIMIT } from "./ethereumV3TradedPools";
import { normalizeV4PoolCard } from "./v4PoolCardAdapter";
import { UNREAD_CHAIN } from "./v4PoolChainReading";
import { V4PoolDaysResponseSchema } from "./v4PoolCardRawResponse";
import { distinctCards, readPoolManager } from "./v4PoolSearchAdapter";

const MALFORMED = "market-data-malformed";
const INDEXING_ERRORS = "market-data-indexing-errors";

const unavailable = (notice: DataFailureNotice): DataResult<V4PoolCandidateList> => ({
  status: "unavailable",
  reason: "invalid-response",
  notice,
});

/**
 * Folds the week's busiest pool-days into verified pools, busiest day first,
 * and no more of them than the v3 net holds.
 *
 * A net rather than a ranking, like the v3 list. What this application adds is
 * that every entry went through the same card normaliser the v4 search uses, so
 * a candidate cannot enter on easier terms than a pool a reader searched for —
 * a return-delta bit still needs its callback. The fee is unread on every
 * entry: the chain is asked for it later, for the pools a lookup shows.
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
  const parsed = V4PoolDaysResponseSchema.safeParse(payload);
  if (!parsed.success) return unavailable(MALFORMED);

  const { data, errors } = parsed.data;
  if (errors != null && errors.length > 0) return unavailable(MALFORMED);
  if (data == null) return unavailable(MALFORMED);
  if (data._meta?.hasIndexingErrors === true) return unavailable(INDEXING_ERRORS);

  const pools: V4Pool[] = [];
  const createdAtBlockNumbers: Record<string, string> = {};
  /* The same width as the v3 net, by construction: its limit, applied to distinct pools. */
  for (const raw of distinctCards(data.poolDayDatas)) {
    if (pools.length === TRADED_POOL_LIMIT) break;
    /* Every fee unread: the chain is asked later, for the pools that are shown. */
    const card = normalizeV4PoolCard(raw, UNREAD_CHAIN);
    if (card === null) continue;
    pools.push(card.pool);
    createdAtBlockNumbers[card.pool.id] = raw.createdAtBlockNumber;
  }

  const result = V4PoolCandidateListSchema.safeParse({
    pools,
    poolManager: readPoolManager(data.poolManagers),
    createdAtBlockNumbers,
    fetchedAt,
    source: "uniswap-v4-subgraph",
  });
  if (!result.success) return unavailable(MALFORMED);

  return { status: "success", data: result.data };
};
