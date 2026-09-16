import {
  Bytes32HexSchema,
  countExactSymbolMatches,
  type DataFailureNotice,
  type DataResult,
  depthInEth,
  EvmAddressSchema,
  type PoolSearchTerms,
  V4_POOL_SEARCH_RESULT_LIMIT,
  type V4PoolSearchMatch,
  type V4PoolSearchResults,
  V4PoolSearchResultsSchema,
} from "../../schemas";
import type { V4PoolKeyRequest } from "./ethereumV4PoolKeys";
import { ZERO_ADDRESS } from "../../schemas";
import type { V4PoolState } from "./ethereumV4PoolState";
import { normalizeV4PoolCard } from "./v4PoolCardAdapter";
import { chainReadingFor } from "./v4PoolChainReading";
import type { V4PoolKey } from "./v4PoolKey";
import { type RawV4PoolCard, V4PoolDaysResponseSchema } from "./v4PoolCardRawResponse";
import type { PoolSearchDiagnostic } from "./v3PoolSearchAdapter";

const MALFORMED = "market-data-malformed";
const INDEXING_ERRORS = "market-data-indexing-errors";

const unavailable = (notice: DataFailureNotice): DataResult<V4PoolSearchResults> => ({
  status: "unavailable",
  reason: "invalid-response",
  notice,
});

/**
 * Turns one raw pool into a match, or `null` if it cannot be trusted.
 *
 * Verifying the pool is the card's job; a search adds the one field the card
 * knows nothing about, which is how well this pool answers what was typed, and
 * attaches what the chain said about it — the key and fees into the pool, the
 * liquidity and price beside it, where the order is decided.
 */
const normalizeMatch = (
  raw: RawV4PoolCard,
  terms: PoolSearchTerms,
  states: ReadonlyMap<string, V4PoolState>,
  keys: ReadonlyMap<string, V4PoolKey>,
): V4PoolSearchMatch | null => {
  const id = Bytes32HexSchema.safeParse(raw.id);
  if (!id.success) return null;

  const card = normalizeV4PoolCard(raw, chainReadingFor(id.data, keys, states));
  if (card === null) return null;

  const state = states.get(card.pool.id);

  return {
    pool: card.pool,
    ethPrice: card.ethPrice,
    state: state === undefined ? null : { liquidity: state.liquidity, sqrtPriceX96: state.sqrtPriceX96 },
    exactSymbolMatches: countExactSymbolMatches(terms, [
      card.pool.token0.symbol,
      card.pool.token1.symbol,
    ]),
  };
};

/**
 * A pool as a list names it before the chain is asked: its id, where it was
 * created, and whether a hook is attached — which decides whether its
 * creation log has to be read at all.
 */
export type V4PoolRef = V4PoolKeyRequest & { readonly hooked: boolean };

/**
 * How many matching pools a search takes from the window before the chain is
 * asked about them: twice what is published, for the reason the v3 window is
 * — a pool the chain cannot be read for is ordered last, and the list should
 * still be full.
 */
export const V4_POOL_SEARCH_FETCH_LIMIT = V4_POOL_SEARCH_RESULT_LIMIT * 2;

/**
 * The pools a list of pool-days names, each once, in the order the days came.
 *
 * A pool that traded on several days of the window arrives once per day, and
 * the place of its busiest day is the one it keeps. Ids are folded to lower
 * case first, so the same pool spelt two ways by the source is still one pool.
 */
export const distinctCards = (
  days: readonly { readonly pool: RawV4PoolCard }[],
): readonly RawV4PoolCard[] => {
  const cards = new Map<string, RawV4PoolCard>();
  for (const { pool } of days) {
    const id = pool.id.toLowerCase();
    if (!cards.has(id)) cards.set(id, pool);
  }

  return [...cards.values()];
};

/** `toLowerCase` rather than the locale-aware form: a ticker is not Turkish text. */
const contains = (symbol: string, term: string): boolean =>
  symbol.toLowerCase().includes(term.toLowerCase());

/**
 * Whether a pool's currencies answer the terms, as the source's own
 * `symbol_contains_nocase` filter would have said: a case-insensitive
 * substring of the symbol, one term per side for a pair — either way round —
 * and either side for a single term.
 *
 * Decided here rather than asked of the source because the source cannot
 * answer it in time: on the v4 subgraph, every query that filtered `pools` by
 * a token's symbol and ordered by volume was refused by the gateway after
 * fifteen seconds, whichever indexer served it. The busiest pool-days of the
 * week it answers in under a second, so those are read and searched here.
 */
export const cardMatchesTerms = (card: RawV4PoolCard, terms: PoolSearchTerms): boolean => {
  const [first, second] = terms;
  const { token0, token1 } = card;
  if (second === undefined) {
    return contains(token0.symbol, first) || contains(token1.symbol, first);
  }

  return (
    (contains(token0.symbol, first) && contains(token1.symbol, second)) ||
    (contains(token0.symbol, second) && contains(token1.symbol, first))
  );
};

/** The busiest pools of the window whose currencies match, up to the fetch limit. */
export const searchWindow = (
  cards: readonly RawV4PoolCard[],
  terms: PoolSearchTerms,
): readonly RawV4PoolCard[] =>
  cards.filter((card) => cardMatchesTerms(card, terms)).slice(0, V4_POOL_SEARCH_FETCH_LIMIT);

/**
 * The pools of the window that answer the terms, and the PoolManager to ask
 * about them.
 *
 * Only the id, the block and the hook are read here, because the chain has to
 * be asked before a pool can be verified at all: its fee comes from the chain.
 * The manager's address is validated rather than trusted, because it decides
 * which contract's storage and logs the next request reads.
 */
export const readV4SearchPools = (
  payload: unknown,
  terms: PoolSearchTerms,
): { readonly pools: readonly V4PoolRef[]; readonly poolManager: string | null } => {
  const parsed = V4PoolDaysResponseSchema.safeParse(payload);
  if (!parsed.success || parsed.data.data == null) return { pools: [], poolManager: null };

  return {
    pools: poolRefs(searchWindow(distinctCards(parsed.data.data.poolDayDatas), terms)),
    poolManager: readPoolManager(parsed.data.data.poolManagers),
  };
};

/** The ids that are ids, each once, with where the indexer says it was created and whether it is hooked. */
export const poolRefs = (raws: readonly RawV4PoolCard[]): readonly V4PoolRef[] => {
  const refs = new Map<string, V4PoolRef>();
  for (const raw of raws) {
    const id = Bytes32HexSchema.safeParse(raw.id);
    if (id.success && !refs.has(id.data)) {
      refs.set(id.data, {
        id: id.data,
        createdAtBlockNumber: raw.createdAtBlockNumber,
        hooked: raw.hooks.toLowerCase() !== ZERO_ADDRESS,
      });
    }
  }

  return [...refs.values()];
};

/** The pools whose creation log must be read: the ones a hook is attached to. */
export const hookedRefs = (refs: readonly V4PoolRef[]): readonly V4PoolKeyRequest[] =>
  refs.filter((ref) => ref.hooked).map(({ id, createdAtBlockNumber }) => ({ id, createdAtBlockNumber }));

/** The manager the source named, validated rather than trusted. */
export const readPoolManager = (managers: readonly { readonly id: string }[]): string | null => {
  const manager = EvmAddressSchema.safeParse(managers[0]?.id);

  return manager.success ? manager.data : null;
};

/**
 * Exact symbol matches first, then depth at the current price, then the pool's
 * own id so that ties come back in one order every time. A pool the chain could
 * not be read for has no place in a size order and goes last.
 */
const byRelevanceThenDepth = (left: V4PoolSearchMatch, right: V4PoolSearchMatch): number => {
  if (left.exactSymbolMatches !== right.exactSymbolMatches) {
    return right.exactSymbolMatches - left.exactSymbolMatches;
  }

  const leftDepth = depthInEth(left);
  const rightDepth = depthInEth(right);
  if (leftDepth !== rightDepth) {
    if (leftDepth === null) return 1;
    if (rightDepth === null) return -1;
    return rightDepth - leftDepth;
  }

  return left.pool.id.localeCompare(right.pool.id);
};

export type NormalizeV4PoolSearchInput = {
  /** The decoded JSON body, still untrusted. */
  readonly payload: unknown;
  /**
   * Each pool's liquidity and price, read from the PoolManager, keyed by pool id.
   *
   * Passed in rather than patched on afterwards so both sources go through the
   * domain schema together — and this one decides the order, which is the claim
   * the schema exists to check.
   */
  readonly states: ReadonlyMap<string, V4PoolState>;
  /** Each pool's key from its Initialize log, keyed by pool id. Decides the fee. */
  readonly keys: ReadonlyMap<string, V4PoolKey>;
  /** The terms this search was run with, already validated. */
  readonly terms: PoolSearchTerms;
  /** When the request was made, from the reader's injected clock. */
  readonly fetchedAt: string;
  readonly onDiagnostic?: PoolSearchDiagnostic | undefined;
};

/**
 * Turns one raw payload of the week's busiest pool-days into the pools that
 * answer the terms, or into an explicit failure. Pure: no clock, no network,
 * no environment.
 *
 * The match, the window and the order are this application's own claims, made
 * here and checked by the schema rather than taken from the provider. There is
 * no `partial` outcome: a search produces a list — possibly empty, which is a
 * real answer — or nothing.
 */
export const normalizeV4PoolSearch = ({
  payload,
  states,
  keys,
  terms,
  fetchedAt,
  onDiagnostic,
}: NormalizeV4PoolSearchInput): DataResult<V4PoolSearchResults> => {
  const parsed = V4PoolDaysResponseSchema.safeParse(payload);
  if (!parsed.success) return unavailable(MALFORMED);

  const { data, errors } = parsed.data;
  if (errors != null && errors.length > 0) return unavailable(MALFORMED);
  if (data == null) return unavailable(MALFORMED);
  if (data._meta?.hasIndexingErrors === true) return unavailable(INDEXING_ERRORS);

  const window = searchWindow(distinctCards(data.poolDayDatas), terms);
  const byPoolId = new Map<string, V4PoolSearchMatch>();
  let dropped = 0;

  for (const raw of window) {
    const match = normalizeMatch(raw, terms, states, keys);
    if (match === null) {
      dropped += 1;
      continue;
    }
    if (!byPoolId.has(match.pool.id)) byPoolId.set(match.pool.id, match);
  }

  if (dropped > 0) {
    onDiagnostic?.(`${dropped} of ${window.length} v4 pools unverifiable`);
  }

  const candidate = {
    terms,
    fetchedAt,
    source: "uniswap-v4-subgraph",
    matches: [...byPoolId.values()]
      .sort(byRelevanceThenDepth)
      .slice(0, V4_POOL_SEARCH_RESULT_LIMIT),
  };

  const results = V4PoolSearchResultsSchema.safeParse(candidate);
  if (!results.success) return unavailable(MALFORMED);

  return { status: "success", data: results.data };
};
