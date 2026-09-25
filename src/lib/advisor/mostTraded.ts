import { z } from "zod";

import {
  alterSwapEconomics,
  Bytes32HexSchema,
  type DataFailureNotice,
  type V3PoolMetadata,
  type V4Pool,
} from "../../schemas";
import { normalizePoolCard } from "../uniswap/v3PoolCardAdapter";
import type { RawPoolCard } from "../uniswap/v3PoolCardRawResponse";
import { V3PoolDaysResponseSchema } from "../uniswap/v3PoolDaysRawResponse";
import { convertNonNegativeDecimal } from "../uniswap/v3SubgraphRawResponse";
import { normalizeV4PoolCard } from "../uniswap/v4PoolCardAdapter";
import { RawV4PoolCardSchema, type RawV4PoolCard } from "../uniswap/v4PoolCardRawResponse";
import { chainReadingFor, type V4PoolChainFees } from "../uniswap/v4PoolChainReading";
import type { V4PoolKey } from "../uniswap/v4PoolKey";
import { readPoolManager } from "../uniswap/v4PoolSearchAdapter";
import type { ChainId } from "../chains/chains";

/*
 * The pools that traded most this week, with what they traded and charged.
 *
 * **A count of trading, not a ranking of anything else.** The order is the
 * week's dollar volume, which says where swaps happened. It says nothing about
 * what a position would have earned — that depends on a range, a deposit and
 * the liquidity beside it, which is what a pool's own page is for — and the
 * page says so above the list.
 *
 * **The week the source can answer for.** Both subgraphs are asked for the
 * busiest thousand pool-days since midnight UTC six days ago, today's
 * unfinished day included, and the days are added up per pool here. A pool
 * that was among the busiest on some days and not others is counted for the
 * days it was: its total is a floor. For the few pools at the top of the
 * list — which a thousand days cover several times over — that floor is the
 * whole week, and the page shows how many days each total is made of.
 *
 * Pure: no clock, no network, no environment.
 */

/** How many pools each half of the page shows. */
export const MOST_TRADED_SHOWN = 12;

export type MostTradedPool = {
  readonly pool: V3PoolMetadata | V4Pool;
  readonly volumeUsd: number;
  /** The fees the source says the pool charged, or `null` where that figure cannot be right. */
  readonly feesUsd: number | null;
  /** How many of the window's days the totals are made of. */
  readonly daysCounted: number;
  /** A v4 hook that may change what a swap costs — the page then says so beside it. */
  readonly hookAltersSwaps: boolean;
};

export type MostTradedList =
  | { readonly status: "listed"; readonly pools: readonly MostTradedPool[]; readonly fetchedAt: string }
  | { readonly status: "unavailable"; readonly notice: DataFailureNotice };

const MALFORMED: MostTradedList = { status: "unavailable", notice: "market-data-malformed" };
const INDEXING_ERRORS: MostTradedList = { status: "unavailable", notice: "market-data-indexing-errors" };

const DayFigures = { date: z.number(), volumeUSD: z.string(), feesUSD: z.string() };
const RawMetaSchema = z.object({ hasIndexingErrors: z.boolean() });

export const V3WeekResponseSchema = V3PoolDaysResponseSchema;

export const V4WeekResponseSchema = z.object({
  data: z
    .object({
      poolDayDatas: z.array(z.object({ ...DayFigures, pool: RawV4PoolCardSchema })),
      poolManagers: z.array(z.object({ id: z.string() })),
      _meta: RawMetaSchema.nullable(),
    })
    .nullish(),
  errors: z.array(z.unknown()).nullish(),
});

type Totals = { volumeUsd: number; feesUsd: number | null; days: Set<number> };

export type WeekOfPool<Card> = {
  readonly card: Card;
  readonly volumeUsd: number;
  readonly feesUsd: number | null;
  readonly daysCounted: number;
};

/**
 * Adds the days up per pool, busiest week first; a tie keeps the order the
 * pools first appeared in, which is the source's busiest-day order.
 *
 * A day whose volume is not a usable figure is left out of its pool's total
 * rather than guessed. A day whose fees are not is kept for its volume, and
 * the pool's fees become unknown: a total missing a day is a wrong total, and
 * the page prints a dash rather than it. The same day listed twice is counted
 * once.
 */
export const foldWeek = <Card extends { readonly id: string }>(
  days: readonly { readonly date: number; readonly volumeUSD: string; readonly feesUSD: string; readonly pool: Card }[],
): readonly WeekOfPool<Card>[] => {
  const pools = new Map<string, { card: Card; totals: Totals }>();

  for (const day of days) {
    const volume = convertNonNegativeDecimal(day.volumeUSD, { allowZero: true });
    if (!volume.ok) continue;
    const fees = convertNonNegativeDecimal(day.feesUSD, { allowZero: true });

    const id = day.pool.id.toLowerCase();
    const entry = pools.get(id) ?? { card: day.pool, totals: { volumeUsd: 0, feesUsd: 0, days: new Set<number>() } };
    if (entry.totals.days.has(day.date)) continue;
    entry.totals.days.add(day.date);
    entry.totals.volumeUsd += volume.value;
    entry.totals.feesUsd = fees.ok && entry.totals.feesUsd !== null ? entry.totals.feesUsd + fees.value : null;
    pools.set(id, entry);
  }

  return [...pools.values()]
    .map(({ card, totals }) => ({
      card,
      volumeUsd: totals.volumeUsd,
      /*
       * More charged than traded is not a fee: it is what a dynamic-fee flag
       * read as a rate produces. Printed as unknown rather than as a figure
       * nobody could have paid.
       */
      feesUsd: totals.feesUsd !== null && totals.feesUsd <= totals.volumeUsd ? totals.feesUsd : null,
      daysCounted: totals.days.size,
    }))
    .sort((left, right) => right.volumeUsd - left.volumeUsd);
};

const listed = (pools: readonly MostTradedPool[], fetchedAt: string): MostTradedList => ({
  status: "listed",
  pools,
  fetchedAt,
});

/** The v3 half: the week's busiest pools, each verified by the card normaliser the search uses. */
export const composeMostTradedV3 = ({
  payload,
  fetchedAt,
  chainId = 1,
}: {
  readonly payload: unknown;
  readonly fetchedAt: string;
  /** The chain the day table was read on; mainnet when not said. */
  readonly chainId?: ChainId;
}): MostTradedList => {
  const parsed = V3WeekResponseSchema.safeParse(payload);
  if (!parsed.success) return MALFORMED;
  const { data, errors } = parsed.data;
  if ((errors != null && errors.length > 0) || data == null) return MALFORMED;
  if (data._meta?.hasIndexingErrors === true) return INDEXING_ERRORS;

  const pools: MostTradedPool[] = [];
  for (const week of foldWeek<RawPoolCard>(data.poolDayDatas)) {
    if (pools.length === MOST_TRADED_SHOWN) break;
    const card = normalizePoolCard(week.card, chainId);
    if (card === null) continue;
    pools.push(entry(card.pool, week));
  }

  return listed(pools, fetchedAt);
};

/**
 * The v4 pools to ask the chain about: the busiest weeks, as many as are shown.
 *
 * Their fees are not in the indexer's record; they come from each pool's state
 * and, for a hooked one, the log that created it. So the page reads those for
 * the pools it will show and no others.
 */
export const v4WeekCandidates = (
  payload: unknown,
): { readonly weeks: readonly WeekOfPool<RawV4PoolCard>[]; readonly poolManager: string | null } | MostTradedList => {
  const parsed = V4WeekResponseSchema.safeParse(payload);
  if (!parsed.success) return MALFORMED;
  const { data, errors } = parsed.data;
  if ((errors != null && errors.length > 0) || data == null) return MALFORMED;
  if (data._meta?.hasIndexingErrors === true) return INDEXING_ERRORS;

  return {
    weeks: foldWeek<RawV4PoolCard>(data.poolDayDatas).slice(0, MOST_TRADED_SHOWN),
    poolManager: readPoolManager(data.poolManagers),
  };
};

/** The v4 half, once the chain has been asked about the candidates. */
export const composeMostTradedV4 = ({
  weeks,
  keys,
  fees,
  fetchedAt,
}: {
  readonly weeks: readonly WeekOfPool<RawV4PoolCard>[];
  readonly keys: ReadonlyMap<string, V4PoolKey>;
  readonly fees: ReadonlyMap<string, V4PoolChainFees>;
  readonly fetchedAt: string;
}): MostTradedList => {
  const pools: MostTradedPool[] = [];
  for (const week of weeks) {
    const id = Bytes32HexSchema.safeParse(week.card.id);
    if (!id.success) continue;
    const card = normalizeV4PoolCard(week.card, chainReadingFor(id.data, keys, fees));
    if (card === null) continue;
    pools.push(entry(card.pool, week));
  }

  return listed(pools, fetchedAt);
};

const entry = (pool: V3PoolMetadata | V4Pool, week: WeekOfPool<unknown>): MostTradedPool => ({
  pool,
  volumeUsd: week.volumeUsd,
  feesUsd: week.feesUsd,
  daysCounted: week.daysCounted,
  /* Read from the hook's address, as feeDisclosure.ts reads it for a pool's own page. */
  hookAltersSwaps: pool.protocolVersion === "v4" && alterSwapEconomics(pool.hookAddress),
});
