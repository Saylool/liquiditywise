import {
  alterSwapEconomics,
  type DataFailureNotice,
  type V3PoolMetadata,
  type V4Pool,
} from "../../schemas";
import { type Chain, ETHEREUM } from "../chains/chains";
import type { Locale } from "../i18n/locales";
import { getPairPoolsCopy } from "../i18n/pairPoolsCopy";
import { type PoolSearchRejection, readPoolSearchInput } from "../search/poolSearchInput";
import { poolDaysWindowStart, type V4PoolDays } from "../uniswap/ethereumV4PoolDays";
import { foldWeek, V3WeekResponseSchema, V4WeekResponseSchema } from "./mostTraded";
import { CHAIN_PARAMETER } from "./requestedParameters";

/*
 * One pair, every pool: where a pair a reader typed is offered, on every
 * chain this application reads, on v3 and on v4 — and what each pool's last
 * week of fees comes to against what is in it.
 *
 * **Past fees over present liquidity, and nothing more.** The figure ranked
 * here is the fees a pool charged over the window the day table covers,
 * divided by what the pool is worth now and scaled to a year. It is not a
 * forecast, and it is not what a position would earn: a position earns only
 * while the price is inside its range, shares the fees with whatever else is
 * there, and gives up something against holding the two tokens that no fee
 * figure shows. The page says each of those where the number is.
 *
 * **Two rankings, not one.** "What is in a pool" is a different measurement
 * on each protocol. A v3 pool is a contract, so what its token contracts hold
 * for it is read from them. A v4 pool's tokens sit in one PoolManager with
 * every other pool's, so nothing on chain says what one pool holds; what can
 * be read is its depth at the current price, from its liquidity and price.
 * The search pages keep the two apart for this reason, and so does this:
 * fees over holdings and fees over depth are not one scale, and one order
 * across both would compare them as if they were. Each ranking does run
 * across every chain — that is the question the page answers.
 *
 * **A floor under the ranking.** A pool holding a few hundred dollars that
 * caught one large swap shows a yield in the thousands of percent, and a list
 * sorted by yield would put it first — the least useful pool on the page in
 * the place a reader looks first. So only pools worth at least
 * {@link PAIR_RANKING_FLOOR_USD} are ranked; the rest are listed below the
 * ranking, by size, with their week's figures and without a yield. A floor
 * rather than a weighting, because a floor can be stated in one sentence and
 * checked by anyone against the figures beside it.
 *
 * Pure: no clock, no network, no environment.
 */

/**
 * The least a pool must be worth, in dollars, to be ranked.
 *
 * One hundred thousand: below that a single afternoon's trading moves the
 * yield by more than the differences the ranking is there to show, and the
 * typed symbol is more often a lookalike token's than the real one's — a
 * contract calling itself USDC costs nothing to deploy, and nobody puts
 * six figures beside it. Stated on the page, beside the pools it leaves out.
 */
export const PAIR_RANKING_FLOOR_USD = 100_000;

const SECONDS_PER_DAY = 86_400;
const DAYS_PER_YEAR = 365;

/* ------------------------------------------------------------------ input */

/** The two symbols a reader typed, as they typed them. */
export type PairTerms = readonly [string, string];

export type PairInput =
  | { readonly kind: "pair"; readonly terms: PairTerms }
  /** A term the search box would refuse, for the reason it would give. */
  | { readonly kind: "unusable"; readonly reason: PoolSearchRejection }
  /** Something the search box takes that is not a pair: one symbol, the same one twice, or a pool's own id. */
  | { readonly kind: "not-a-pair" };

/** `toLowerCase` rather than the locale-aware form, as the search folds: a ticker is not Turkish text. */
const fold = (value: string): string => value.toLowerCase();

/**
 * Reads what was typed with the search box's own rules — the same separators,
 * the same terms, the same refusals — and then asks for exactly two.
 *
 * No wrapped-or-native equivalence: the search has none, and to a pool ether
 * and wrapped ether are two different tokens. A reader after both types each.
 */
export const readPairInput = (raw: string): PairInput => {
  const input = readPoolSearchInput(raw);
  if (input.kind === "unusable") return { kind: "unusable", reason: input.reason };
  if (input.kind !== "terms") return { kind: "not-a-pair" };

  const [first, second] = input.terms;
  if (second === undefined || fold(first) === fold(second)) return { kind: "not-a-pair" };

  return { kind: "pair", terms: [first, second] };
};

/**
 * Whether a pool's two symbols are exactly the two terms, either way round.
 *
 * Exact, where the search itself matches a substring: a search for "weth"
 * finds WPOWETH and MeWETH too, and a list that claims to be every pool of a
 * pair must not hold another pair. A lookalike token that calls itself
 * exactly USDC does pass — a symbol is whatever a contract says — and the
 * floor and each pool's own page, which shows the contracts, are what answer
 * that.
 */
export const isThePair = (terms: PairTerms, symbols: readonly [string, string]): boolean => {
  const [a, b] = terms.map(fold);
  const [x, y] = symbols.map(fold);

  return (a === x && b === y) || (a === y && b === x);
};

/* ------------------------------------------------------------------- week */

export type WeekFigures = {
  readonly volumeUsd: number;
  /** `null` where the source's figure cannot be right (see `foldWeek`). */
  readonly feesUsd: number | null;
  /** How many of the window's days the totals are made of. */
  readonly daysCounted: number;
};

/** One chain's day table, folded per pool, with how long the window it covers had run when it was read. */
export type PoolWeeks = {
  readonly byPool: ReadonlyMap<string, WeekFigures>;
  /** Days from the window's first midnight to the read: six and a fraction, today being unfinished. */
  readonly windowDays: number;
};

/**
 * How many days the window had covered at `fetchedAt`: its six whole days and
 * the part of today that had passed. What a week's fees are annualised over,
 * so a read at five past midnight is not scaled as though it held seven days.
 */
export const windowDaysAt = (fetchedAt: string): number | null => {
  const at = Date.parse(fetchedAt);
  if (!Number.isFinite(at)) return null;
  const days = (at / 1000 - poolDaysWindowStart(new Date(at))) / SECONDS_PER_DAY;

  return days > 0 ? days : null;
};

/**
 * The day table folded into a total per pool, by the most-traded page's own
 * rule — or `null` when the answer is not one: malformed, sent with errors, or
 * flagged by the indexer. A day table that could not be read is not a week in
 * which nothing traded.
 */
export const poolWeeksFrom = (protocol: "v3" | "v4", days: V4PoolDays): PoolWeeks | null => {
  const windowDays = windowDaysAt(days.fetchedAt);
  if (windowDays === null) return null;

  const parsed = (protocol === "v3" ? V3WeekResponseSchema : V4WeekResponseSchema).safeParse(days.payload);
  if (!parsed.success) return null;
  const { data, errors } = parsed.data;
  if ((errors != null && errors.length > 0) || data == null || data._meta?.hasIndexingErrors === true) return null;

  const byPool = new Map<string, WeekFigures>();
  for (const week of foldWeek<{ readonly id: string }>(data.poolDayDatas)) {
    byPool.set(week.card.id.toLowerCase(), {
      volumeUsd: week.volumeUsd,
      feesUsd: week.feesUsd,
      daysCounted: week.daysCounted,
    });
  }

  return { byPool, windowDays };
};

/**
 * Fees over liquidity, scaled from the window to a year: `fees / liquidity ×
 * 365 / windowDays`. Simple, not compounded — nothing was reinvested, and a
 * compounded figure would be a claim about what a position did with its fees.
 *
 * `null` for anything that is not a figure: no liquidity, an empty window, a
 * total that is not finite.
 */
export const annualisedFeeYield = (feesUsd: number, liquidityUsd: number, windowDays: number): number | null => {
  if (!(liquidityUsd > 0) || !(windowDays > 0) || !(feesUsd >= 0)) return null;
  const value = (feesUsd / liquidityUsd) * (DAYS_PER_YEAR / windowDays);

  return Number.isFinite(value) ? value : null;
};

/* -------------------------------------------------------------------- row */

/** What the day table says about one pool's week. */
export type PairWeek =
  | ({ readonly status: "counted" } & WeekFigures)
  /** The day table was read, and the pool is not among the chain's busiest pool-days of the window. */
  | { readonly status: "quiet" }
  /** The day table could not be read. */
  | { readonly status: "unread" };

/**
 * Where a row stands:
 *
 *   - `ranked`: worth at least the floor, with a week's fees and a liquidity
 *     to set them against.
 *   - `thin`: everything a ranked pool has, worth less than the floor.
 *   - `hook`: a v4 hook that may change what a swap costs. Its fees are shown
 *     and qualified, and no yield is worked out from them: such a hook can take
 *     part of a swap for itself, nothing in the source separates its share from
 *     the liquidity providers', and a yield is exactly the figure a reader turns
 *     into an expectation — the rule `feeDisclosure.ts` applies on a pool's own
 *     page.
 *   - `unmeasured`: a figure the yield needs could not be had.
 */
export type PairStanding = "ranked" | "thin" | "hook" | "unmeasured";

export type PairPoolRow = {
  readonly chain: Chain;
  readonly pool: V3PoolMetadata | V4Pool;
  /**
   * In dollars: on v3 what the pool's token contracts hold for it, on v4 its
   * depth at the current price. `null` where the chain or the price could not
   * be read.
   */
  readonly liquidityUsd: number | null;
  readonly week: PairWeek;
  /** A v4 hook that may change what a swap costs. Always false on v3. */
  readonly hookAltersSwaps: boolean;
  /** Annualised, past fees over current liquidity — only on a ranked row. */
  readonly feeYield: number | null;
  readonly standing: PairStanding;
};

/**
 * One pool's row, from what the readers brought back for its chain.
 *
 * `liquidityInNative` is the list's own figure in the chain's currency — what
 * `heldInEth` or `depthInEth` gives — and `nativeUsd` the price that makes it
 * dollars. The fees beside it are the source's dollars already.
 */
export const composePairRow = ({
  chain,
  pool,
  liquidityInNative,
  nativeUsd,
  weeks,
}: {
  readonly chain: Chain;
  readonly pool: V3PoolMetadata | V4Pool;
  readonly liquidityInNative: number | null;
  readonly nativeUsd: number | null;
  readonly weeks: PoolWeeks | null;
}): PairPoolRow => {
  const product = liquidityInNative !== null && nativeUsd !== null ? liquidityInNative * nativeUsd : null;
  const liquidityUsd = product !== null && Number.isFinite(product) && product >= 0 ? product : null;
  const counted = weeks?.byPool.get(pool.id.toLowerCase());
  const week: PairWeek =
    weeks === null ? { status: "unread" } : counted === undefined ? { status: "quiet" } : { status: "counted", ...counted };
  /* Read from the hook's address, as feeDisclosure.ts reads it for a pool's own page. */
  const hookAltersSwaps = pool.protocolVersion === "v4" && alterSwapEconomics(pool.hookAddress);

  const row = { chain, pool, liquidityUsd, week, hookAltersSwaps };
  if (hookAltersSwaps) return { ...row, feeYield: null, standing: "hook" };
  if (liquidityUsd === null || week.status !== "counted" || week.feesUsd === null || weeks === null) {
    return { ...row, feeYield: null, standing: "unmeasured" };
  }
  const feeYield = annualisedFeeYield(week.feesUsd, liquidityUsd, weeks.windowDays);
  if (feeYield === null) return { ...row, feeYield: null, standing: "unmeasured" };
  if (liquidityUsd < PAIR_RANKING_FLOOR_USD) return { ...row, feeYield: null, standing: "thin" };

  return { ...row, feeYield, standing: "ranked" };
};

/* ---------------------------------------------------------------- ranking */

/** Deeper first, unread last; then chain and id, so two reads of one pair come back in one order. */
const bySize = (left: PairPoolRow, right: PairPoolRow): number => {
  if (left.liquidityUsd !== right.liquidityUsd) {
    if (left.liquidityUsd === null) return 1;
    if (right.liquidityUsd === null) return -1;
    return right.liquidityUsd - left.liquidityUsd;
  }
  if (left.chain.id !== right.chain.id) return left.chain.id - right.chain.id;

  return left.pool.id.localeCompare(right.pool.id);
};

/**
 * The ranked rows by yield, highest first, and every other row below them by
 * size. A tie in yield goes to the larger pool.
 */
export const rankPairPools = (
  rows: readonly PairPoolRow[],
): { readonly ranked: readonly PairPoolRow[]; readonly unranked: readonly PairPoolRow[] } => ({
  ranked: rows
    .filter((row) => row.standing === "ranked")
    .sort((left, right) => (right.feeYield ?? 0) - (left.feeYield ?? 0) || bySize(left, right)),
  unranked: rows.filter((row) => row.standing !== "ranked").sort(bySize),
});

/* ------------------------------------------------------------------ pages */

/** What became of one chain's read for one protocol. */
export type PairChainOutcome =
  | { readonly chain: Chain; readonly status: "read"; readonly pools: number }
  | { readonly chain: Chain; readonly status: "unavailable"; readonly notice: DataFailureNotice };

/** One protocol's pools of the pair across every chain it is read on. */
export type PairPoolsHalf = {
  readonly ranked: readonly PairPoolRow[];
  readonly unranked: readonly PairPoolRow[];
  /** One entry per chain this protocol is read on, in chains.ts's order. */
  readonly chains: readonly PairChainOutcome[];
};

export type PairPools = {
  readonly terms: PairTerms;
  readonly v3: PairPoolsHalf;
  readonly v4: PairPoolsHalf;
};

/** One chain's answer for one protocol: its outcome, and its rows when it was read. */
export type PairChainRead = { readonly outcome: PairChainOutcome; readonly rows: readonly PairPoolRow[] };

export const composePairPoolsHalf = (reads: readonly PairChainRead[]): PairPoolsHalf => ({
  ...rankPairPools(reads.flatMap(({ rows }) => rows)),
  chains: reads.map(({ outcome }) => outcome),
});

/** A pool's own page: `/pool?…&address=` for v3, `/v4?…&id=` for v4, the chain unsaid on mainnet. */
export const pairPoolHref = ({ chain, pool }: { readonly chain: Chain; readonly pool: V3PoolMetadata | V4Pool }): string => {
  const query = new URLSearchParams({
    ...(chain.id === ETHEREUM.id ? {} : { [CHAIN_PARAMETER]: chain.slug }),
    [pool.protocolVersion === "v3" ? "address" : "id"]: pool.id,
  });

  return `${pool.protocolVersion === "v3" ? "/pool" : "/v4"}?${query.toString()}`;
};

/** The parameter this page reads the pair from: the search box's own. */
export const PAIR_PARAMETER = "q";

/**
 * This page for a pool's two symbols, or `null` when the search box could not
 * take them back as exactly that pair — a symbol with a space or a hyphen in
 * it, one too long, or two the same. A link that searched for something else
 * would be worse than none.
 */
export const pairPoolsHref = (symbol0: string, symbol1: string): string | null => {
  const written = `${symbol0}/${symbol1}`;
  const input = readPairInput(written);
  if (input.kind !== "pair" || input.terms[0] !== symbol0 || input.terms[1] !== symbol1) return null;

  return `/pair?${new URLSearchParams({ [PAIR_PARAMETER]: written }).toString()}`;
};

/**
 * The link to this page from a pool's own — its pair, on every network — in
 * the reader's language, or `null` where the pool's symbols cannot be searched
 * for as they stand.
 */
export const everyNetworkLink = (
  pool: { readonly token0: { readonly symbol: string }; readonly token1: { readonly symbol: string } },
  locale: Locale,
): { readonly href: string; readonly label: string } | null => {
  const href = pairPoolsHref(pool.token0.symbol, pool.token1.symbol);

  return href === null ? null : { href, label: getPairPoolsCopy(locale).link };
};
