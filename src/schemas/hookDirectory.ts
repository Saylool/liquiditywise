import { z } from "zod";

import { DataSourceSchema } from "./dataSource";
import { HOOK_PERMISSIONS } from "./hookPermissions";
import { EvmAddressSchema, IsoTimestampSchema } from "./primitives";
import { V4PoolSchema } from "./uniswap";

/*
 * Every hook the v4 net saw this week, and what each of them is permitted to do.
 *
 * The one thing that can be said about a hook without reading its code is also
 * the thing worth saying: v4 mines a hook's permissions into its address. The
 * low fourteen bits are the list of moments the PoolManager will call it at, and
 * the protocol refuses to call it for anything else. That is enforced rather
 * than claimed — no registry, no label, no promise by whoever deployed it.
 *
 * So this is a directory of addresses and permissions, and deliberately not a
 * directory of behaviour. What a hook *does* with a permission is in its code;
 * this application does not read code and does not keep a list of hooks anybody
 * has vouched for. Both of those would be a claim it cannot check, which is the
 * one thing it will not put on a page.
 *
 * It costs no request. The pools come from the same week's busiest pool-days
 * that the v4 search and a holdings lookup already read, through the same
 * ten-minute cache.
 */

/** How many of a hook's pools are listed before the rest are counted instead. */
export const HOOK_DIRECTORY_POOLS_SHOWN = 4;

const HookEntrySchema = z
  .strictObject({
    /** Non-zero: the zero address is how v4 spells "no hook at all". */
    address: EvmAddressSchema,
    /**
     * What its address says it may do, in the protocol's own order.
     *
     * May be empty, and that is not a gap in the reading. `Hooks.isValidHookAddress`
     * allows a hook with no permission bits only where the pool's fee is
     * dynamic — there, setting the fee is the hook's whole job and it needs no
     * callback to do it. Anywhere else the pool schema refuses the pool, so an
     * empty list here is that case and is worth showing as what it is.
     */
    permissions: z.array(z.enum(HOOK_PERMISSIONS)),
    /** How many of the pools considered run it. */
    poolCount: z.int().positive(),
    /** The busiest few of them, in the order the net listed them. */
    pools: z.array(V4PoolSchema).min(1).max(HOOK_DIRECTORY_POOLS_SHOWN),
  })
  .refine((entry) => entry.pools.length <= entry.poolCount, {
    error: "A hook cannot list more pools than it runs.",
    path: ["pools"],
  })
  .refine((entry) => entry.pools.every((pool) => pool.hookAddress === entry.address), {
    /* A pool filed under the wrong hook would be described by another's bits. */
    error: "Every pool listed under a hook must name that hook.",
    path: ["pools"],
  });

export type HookEntry = z.infer<typeof HookEntrySchema>;

export const HookDirectorySchema = z
  .strictObject({
    /** Ordered by how many of the considered pools run each. May be empty. */
    hooks: z.array(HookEntrySchema),
    /** How many pools the net carried, which is what the page reports over. */
    poolsConsidered: z.int().positive(),
    /** How many of those name no hook. The large majority, in practice. */
    hooklessPools: z.int().nonnegative(),
    fetchedAt: IsoTimestampSchema,
    source: DataSourceSchema.extract(["uniswap-v4-subgraph"]),
  })
  .refine(
    (directory) =>
      directory.hooks.reduce((total, entry) => total + entry.poolCount, 0) +
        directory.hooklessPools ===
      directory.poolsConsidered,
    {
      /*
       * Every pool is either under a hook or counted as hookless. The check is
       * cheap and it is the only thing that would catch a pool quietly dropped
       * between the two — which would look like a smaller week rather than a
       * bug.
       */
      error: "Every pool considered must be counted once, under a hook or as hookless.",
      path: ["poolsConsidered"],
    },
  )
  .refine(
    (directory) => new Set(directory.hooks.map((entry) => entry.address)).size ===
      directory.hooks.length,
    { error: "The same hook appears twice in one directory.", path: ["hooks"] },
  );

export type HookDirectory = z.infer<typeof HookDirectorySchema>;
