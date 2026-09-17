import {
  type DataFailureNotice,
  type HookDirectory,
  type HookEntry,
  HOOK_DIRECTORY_POOLS_SHOWN,
  HookDirectorySchema,
  hookPermissionsOf,
  type V4Pool,
  type V4PoolCandidateList,
} from "../../schemas";

/*
 * The hooks of the week's busiest v4 pools, gathered from a list already read.
 *
 * Pure — no clock, no network, no environment — and it costs no request: the
 * candidate list behind it is the same one the v4 search and a holdings lookup
 * are built from, through the same ten-minute cache.
 *
 * Nothing here asks a hook anything. A hook's permissions come out of its own
 * address, which is where v4 puts them, so the whole directory is a regrouping
 * of what the net already carried. See {@link HookDirectorySchema} for why that
 * is the only honest thing to publish about a hook.
 */

const UNVERIFIABLE = "hook-directory-unverifiable";

export type HookDirectoryResult =
  | { readonly status: "success"; readonly data: HookDirectory }
  | { readonly status: "unavailable"; readonly notice: DataFailureNotice };

/**
 * Groups one candidate list by hook.
 *
 * Ordered by how many of the listed pools run each hook, and ties broken by
 * where the busiest of them sat in the list — so the order is total and the
 * same list always produces the same page. It is a count and the page says so:
 * a hook on forty pools is a hook somebody deployed forty pools with, which is
 * not a statement about any of them.
 */
export const composeHookDirectory = (list: V4PoolCandidateList): HookDirectoryResult => {
  /* Insertion-ordered, so the first pool seen for a hook is its busiest. */
  const byHook = new Map<string, V4Pool[]>();
  let hooklessPools = 0;

  for (const pool of list.pools) {
    if (pool.hookAddress === null) {
      hooklessPools += 1;
      continue;
    }

    const pools = byHook.get(pool.hookAddress);
    if (pools === undefined) byHook.set(pool.hookAddress, [pool]);
    else pools.push(pool);
  }

  const entries: HookEntry[] = [...byHook.entries()].map(([address, pools]) => ({
    address,
    /* Copied, because the schema's inferred type is a mutable array. */
    permissions: [...hookPermissionsOf(address)],
    poolCount: pools.length,
    pools: pools.slice(0, HOOK_DIRECTORY_POOLS_SHOWN),
  }));

  /*
   * A stable sort by count alone would keep insertion order within a count,
   * which is already the tie-break wanted — but saying it outright costs
   * nothing and does not depend on the sort being stable.
   */
  const ordered = entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => right.entry.poolCount - left.entry.poolCount || left.index - right.index)
    .map(({ entry }) => entry);

  const candidate = {
    hooks: ordered,
    poolsConsidered: list.pools.length,
    hooklessPools,
    fetchedAt: list.fetchedAt,
    source: list.source,
  };

  const verified = HookDirectorySchema.safeParse(candidate);
  if (!verified.success) return { status: "unavailable", notice: UNVERIFIABLE };

  return { status: "success", data: verified.data };
};
