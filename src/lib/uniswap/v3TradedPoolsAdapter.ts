import {
  type DataFailureNotice,
  type DataResult,
  type PoolCandidateList,
  PoolCandidateListSchema,
  type V3PoolMetadata,
} from "../../schemas";
import { normalizePoolCard } from "./v3PoolCardAdapter";
import { V3PoolListResponseSchema } from "./v3PoolListRawResponse";

const MALFORMED = "market-data-malformed";
const INDEXING_ERRORS = "market-data-indexing-errors";

const unavailable = (notice: DataFailureNotice): DataResult<PoolCandidateList> => ({
  status: "unavailable",
  reason: "invalid-response",
  notice,
});

/**
 * Turns the traded-pool list into verified pool contracts, keeping the source's
 * order.
 *
 * The order is the source's and stays it — this list is a net rather than a
 * ranking, and nothing downstream presents it as one. What *is* this
 * application's own is the verification: every entry goes through the same card
 * normaliser the search and the fee tiers use, so a candidate cannot enter on
 * easier terms than a pool a reader searched for.
 *
 * Pure: no clock, no network, no environment.
 */
export const normalizeV3TradedPools = ({
  payload,
  fetchedAt,
}: {
  readonly payload: unknown;
  readonly fetchedAt: string;
}): DataResult<PoolCandidateList> => {
  const parsed = V3PoolListResponseSchema.safeParse(payload);
  if (!parsed.success) return unavailable(MALFORMED);

  const { data, errors } = parsed.data;
  if (errors != null && errors.length > 0) return unavailable(MALFORMED);
  if (data == null) return unavailable(MALFORMED);
  if (data._meta?.hasIndexingErrors === true) return unavailable(INDEXING_ERRORS);

  const pools: V3PoolMetadata[] = [];
  const seen = new Set<string>();
  for (const raw of data.pools) {
    const card = normalizePoolCard(raw);
    if (card === null || seen.has(card.pool.id)) continue;
    seen.add(card.pool.id);
    pools.push(card.pool);
  }

  const result = PoolCandidateListSchema.safeParse({
    pools,
    fetchedAt,
    source: "uniswap-v3-subgraph",
  });
  if (!result.success) return unavailable(MALFORMED);

  return { status: "success", data: result.data };
};
