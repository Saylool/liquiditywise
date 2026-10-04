import { z } from "zod";

import { convertSafeInteger, unixSecondsToIso } from "./v3SubgraphRawResponse";
import { type FetchLike, postV3SubgraphQuery } from "./v3SubgraphTransport";

/*
 * How many v4 pools on one network name a hook, and when the first of them
 * was created — every pool, not the week's busiest the directory is built
 * from.
 *
 * The Graph has no count, so the count is the pools themselves, up to a cap:
 * past it the page says "1,000+" and means "at least that many". A hook on a
 * launchpad names tens of thousands of pools and a number that large is not
 * worth a megabyte; one on a single pool is the case worth seeing exactly.
 *
 * **One field, ordered by creation, does both jobs.** The obvious query —
 * `first: 1` ordered by `createdAtTimestamp` for the date, beside an
 * unordered list for the count — was measured on 2026-10-04 and the first
 * half failed on Base: fifteen seconds, then "bad indexers", for every hook
 * the directory lists there, as Base's other ordered pool queries do. The
 * same order with the cap as the limit answered on every network, Base's
 * busiest launchpad hooks in 0.7 to 5.3 seconds and everything else in under
 * one, at a timestamp per pool — 36 KB at the cap, half of what the ids cost.
 * The earliest of them is the first created whichever way the cap falls,
 * because the order is applied before the limit.
 *
 * Every network's v4 subgraph has `Pool.createdAtTimestamp` (`BigInt!`) and
 * `Pool.hooks` (`String!`, lower-cased), checked against each configured one
 * on the same day. `hooks` is matched exactly, so the address goes in
 * lower-cased, as every address here already is.
 */

/** The most pools counted before the count is said to be at least this. The Graph's own most per field. */
export const HOOK_POOL_COUNT_CAP = 1000;

/**
 * Base's busiest hooks answered in up to 5.3 seconds; the gateway gives up on
 * a query it cannot serve at fifteen. Ten is past the first and short of the
 * second, so a query that is going to fail is let go a little earlier.
 */
export const HOOK_POOLS_TIMEOUT_MS = 10_000;

export const V4_HOOK_POOLS_QUERY = `query V4HookPools($hook: String!, $cap: Int!) {
  pools(where: { hooks: $hook }, first: $cap, orderBy: createdAtTimestamp, orderDirection: asc) {
    createdAtTimestamp
  }
  _meta {
    hasIndexingErrors
  }
}`;

const ResponseSchema = z.object({
  data: z
    .object({
      pools: z.array(z.object({ createdAtTimestamp: z.string() })).max(HOOK_POOL_COUNT_CAP),
      _meta: z.object({ hasIndexingErrors: z.boolean() }).nullable(),
    })
    .nullish(),
  errors: z.array(z.unknown()).nullish(),
});

export type HookUsage =
  | {
      readonly status: "counted";
      /** At most {@link HOOK_POOL_COUNT_CAP}. */
      readonly pools: number;
      /** True when the cap was reached, so `pools` is a floor rather than a count. */
      readonly capped: boolean;
      /** When the earliest of them was created; `null` only where there are none. */
      readonly firstCreatedAt: string | null;
    }
  | { readonly status: "unchecked" };

const UNCHECKED: HookUsage = { status: "unchecked" };

/**
 * Pure: one answer read, or unchecked.
 *
 * A subgraph reporting indexing errors is unchecked rather than counted: its
 * count could be short by whatever it failed to index, and a short count is
 * the one this would print without anything to say it was short.
 */
export const readV4HookPools = (payload: unknown): HookUsage => {
  const parsed = ResponseSchema.safeParse(payload);
  if (!parsed.success) return UNCHECKED;

  const { data, errors } = parsed.data;
  if ((errors ?? []).length > 0 || data === null || data === undefined) return UNCHECKED;
  if (data._meta?.hasIndexingErrors === true) return UNCHECKED;

  /*
   * The earliest is found rather than taken from the top of the list. The
   * query asks for that order, and a source that ignored it would otherwise
   * date the hook by whichever pool came first.
   */
  let earliest: number | null = null;
  for (const { createdAtTimestamp } of data.pools) {
    const seconds = convertSafeInteger(createdAtTimestamp);
    if (!seconds.ok || seconds.value <= 0) return UNCHECKED;
    if (earliest === null || seconds.value < earliest) earliest = seconds.value;
  }

  const firstCreatedAt = earliest === null ? null : unixSecondsToIso(earliest);
  if (earliest !== null && firstCreatedAt === null) return UNCHECKED;

  return {
    status: "counted",
    pools: data.pools.length,
    capped: data.pools.length >= HOOK_POOL_COUNT_CAP,
    firstCreatedAt,
  };
};

export type V4HookPoolsRequest = {
  /** Lower-cased: the subgraph matches it exactly. */
  readonly hook: string;
  readonly apiKey: string | undefined;
  readonly subgraphId: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
};

/** Counts one hook's pools on the subgraph asked. Never throws; anything but an answer is unchecked. */
export const fetchV4HookPools = async ({
  hook,
  apiKey,
  subgraphId,
  fetchImpl,
  timeoutMs = HOOK_POOLS_TIMEOUT_MS,
}: V4HookPoolsRequest): Promise<HookUsage> => {
  const key = apiKey?.trim();
  const subgraph = subgraphId?.trim();
  if (key === undefined || key === "" || subgraph === undefined || subgraph === "") return UNCHECKED;

  const transport = await postV3SubgraphQuery({
    apiKey: key,
    subgraphId: subgraph,
    query: V4_HOOK_POOLS_QUERY,
    variables: { hook, cap: HOOK_POOL_COUNT_CAP },
    fetchImpl,
    timeoutMs,
  });

  return transport.ok ? readV4HookPools(transport.payload) : UNCHECKED;
};
