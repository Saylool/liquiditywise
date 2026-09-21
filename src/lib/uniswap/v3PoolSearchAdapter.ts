import {
  countExactSymbolMatches,
  heldInEth,
  type DataFailureNotice,
  type DataResult,
  POOL_SEARCH_RESULT_LIMIT,
  type PoolSearchMatch,
  type PoolSearchResults,
  PoolSearchResultsSchema,
  type PoolSearchTerms,
  type V3PoolMetadata,
} from "../../schemas";
import type { PoolReserves } from "./ethereumV3PoolReserves";
import { isDormant, normalizePoolCard } from "./v3PoolCardAdapter";
import type { RawPoolCard } from "./v3PoolCardRawResponse";
import { V3PoolSearchResponseSchema } from "./v3PoolSearchRawResponse";

const MALFORMED = "market-data-malformed";
const INDEXING_ERRORS = "market-data-indexing-errors";

const unavailable = (notice: DataFailureNotice): DataResult<PoolSearchResults> => ({
  status: "unavailable",
  reason: "invalid-response",
  notice,
});

/** Told which rule dropped a pool, and nothing about the pool. Optional. */
export type PoolSearchDiagnostic = (detail: string) => void;

/**
 * Turns one raw pool into a match, or `null` if it cannot be trusted.
 *
 * Verifying the pool is the shared card's job, and everything a search adds on
 * top is the one field the card knows nothing about: how well this pool answers
 * what was actually typed.
 *
 * Dropping an entry rather than failing the read is what the token-label rules
 * are for. A pool whose symbol carries a newline leaves the list instead of
 * taking the page down with it, and the reader never learns that a token tried
 * to write a line of its own.
 */
const normalizeMatch = (
  raw: RawPoolCard,
  terms: PoolSearchTerms,
  reserves: ReadonlyMap<string, PoolReserves>,
  now: Date,
): PoolSearchMatch | "dormant" | null => {
  const card = normalizePoolCard(raw);
  if (card === null) return null;
  /*
   * Listed pools are links to an analysis, and a pool the analysis would
   * refuse for want of a month of prices is a link to a refusal. Dropped here
   * rather than by the source, which has no filter for "active lately".
   */
  if (isDormant(card, now)) return "dormant";

  return {
    pool: card.pool,
    ethPrice: card.ethPrice,
    reserves: reserves.get(card.pool.id) ?? null,
    exactSymbolMatches: countExactSymbolMatches(terms, [
      card.pool.token0.symbol,
      card.pool.token1.symbol,
    ]),
  };
};

/**
 * The verified pools in a search payload, for asking the chain what they hold.
 *
 * The same card normaliser runs here and again below, so a pool the reserves
 * were read for is exactly a pool that can appear in the results.
 */
export const readSearchPoolsForReserves = (payload: unknown, now: Date): readonly V3PoolMetadata[] => {
  const parsed = V3PoolSearchResponseSchema.safeParse(payload);
  if (!parsed.success || parsed.data.data == null) return [];

  const pools = new Map<string, V3PoolMetadata>();
  for (const raw of [...parsed.data.data.forward, ...parsed.data.data.reverse]) {
    const card = normalizePoolCard(raw);
    /* No reserves are read for a pool that will not be listed. */
    if (card !== null && !isDormant(card, now)) pools.set(card.pool.id, card.pool);
  }

  return [...pools.values()];
};

/**
 * Puts the merged matches in the order the results are published in.
 *
 * Exact symbol matches first, then what each pool actually holds, then the
 * pool's own address. The last of those decides nothing a reader cares about and
 * is there so that two pools the first two cannot separate still come back in
 * the same order every time — a list that reshuffles between two identical
 * searches is a list nobody can point at.
 *
 * The middle key used to be the liquidity the source reports, and that was
 * wrong by up to three orders of magnitude: a WETH/LOOKS pool was published at
 * nine million dollars while its contracts held nine thousand. It is now the
 * pool's own balances, priced in ether, which puts two different pairs on one
 * scale without inventing a dollar figure. A pool whose balances could not be
 * read has no place in a size order and goes last.
 */
const byRelevanceThenHoldings = (left: PoolSearchMatch, right: PoolSearchMatch): number => {
  if (left.exactSymbolMatches !== right.exactSymbolMatches) {
    return right.exactSymbolMatches - left.exactSymbolMatches;
  }

  const leftHeld = heldInEth(left);
  const rightHeld = heldInEth(right);
  if (leftHeld !== rightHeld) {
    if (leftHeld === null) return 1;
    if (rightHeld === null) return -1;
    return rightHeld - leftHeld;
  }

  return left.pool.id.localeCompare(right.pool.id);
};

export type NormalizeV3PoolSearchInput = {
  /** The decoded JSON body, still untrusted. */
  readonly payload: unknown;
  /**
   * What each pool actually holds, read from the chain, keyed by pool address.
   *
   * Passed in rather than patched on afterwards so both sources go through the
   * domain schema together — and this one decides the order, which is the claim
   * the schema exists to check.
   */
  readonly reserves: ReadonlyMap<string, PoolReserves>;
  /** The terms this search was run with, already validated. */
  readonly terms: PoolSearchTerms;
  /** When the request was made, from the reader's injected clock. */
  readonly fetchedAt: string;
  readonly onDiagnostic?: PoolSearchDiagnostic | undefined;
};

/**
 * Turns one raw search payload into the domain type, or into an explicit
 * failure. Pure: no clock, no network, no environment.
 *
 * The two aliased selections are merged here rather than upstream, because
 * merging is where the work is: a pool matching both terms appears in both
 * lists, each list is sorted only within itself, and the order the results are
 * published in is this application's own claim rather than the provider's.
 *
 * There is no `partial` outcome. A search either produces a list — possibly an
 * empty one, which is a real answer — or it produces nothing.
 */
export const normalizeV3PoolSearch = ({
  payload,
  reserves,
  terms,
  fetchedAt,
  onDiagnostic,
}: NormalizeV3PoolSearchInput): DataResult<PoolSearchResults> => {
  const parsed = V3PoolSearchResponseSchema.safeParse(payload);
  if (!parsed.success) return unavailable(MALFORMED);

  const { data, errors } = parsed.data;

  // Fail closed: a GraphQL response may carry data beside errors, and that data
  // is not verified.
  if (errors != null && errors.length > 0) return unavailable(MALFORMED);
  if (data == null) return unavailable(MALFORMED);
  if (data._meta?.hasIndexingErrors === true) return unavailable(INDEXING_ERRORS);

  const byPoolId = new Map<string, PoolSearchMatch>();
  const now = new Date(fetchedAt);
  let dropped = 0;
  let dormant = 0;

  for (const raw of [...data.forward, ...data.reverse]) {
    const match = normalizeMatch(raw, terms, reserves, now);
    if (match === null) {
      dropped += 1;
      continue;
    }
    if (match === "dormant") {
      dormant += 1;
      continue;
    }
    // A pool matching both terms arrives in both selections. The two copies are
    // the same pool read the same way, so the first one stands.
    if (!byPoolId.has(match.pool.id)) byPoolId.set(match.pool.id, match);
  }

  if (dropped > 0) {
    onDiagnostic?.(`${dropped} of ${data.forward.length + data.reverse.length} pools unverifiable`);
  }
  if (dormant > 0) {
    onDiagnostic?.(`${dormant} of ${data.forward.length + data.reverse.length} pools dormant`);
  }

  const candidate = {
    terms,
    fetchedAt,
    source: "uniswap-v3-subgraph",
    matches: [...byPoolId.values()]
      .sort(byRelevanceThenHoldings)
      .slice(0, POOL_SEARCH_RESULT_LIMIT),
  };

  /*
   * The domain schema is the final authority, and for a search it checks this
   * application's work rather than the provider's: that no pool is listed twice,
   * that every relevance score follows from the terms and the pool's own
   * symbols, and that the order is the one claimed. A merge that went wrong
   * produces a plausible-looking list, which is exactly the kind of mistake that
   * survives review.
   */
  const results = PoolSearchResultsSchema.safeParse(candidate);
  if (!results.success) return unavailable(MALFORMED);

  return { status: "success", data: results.data };
};
