import { z } from "zod";

import { DataSourceSchema } from "./dataSource";
import { Bytes32HexSchema, IsoTimestampSchema, Uint128StringSchema, UnsignedIntegerStringSchema } from "./primitives";
import { V4PoolSchema } from "./uniswap";
import { depthInEth } from "./v4PoolSearch";

/*
 * The same two currencies, at every v4 pool that trades them.
 *
 * A v3 pair is a handful of pools, one per fee tier. A v4 pair can be dozens:
 * the fee is any number, the tick spacing is free, and every hook makes a new
 * pool of the same two currencies. USDC/WETH alone has more than twenty on
 * mainnet, most of them empty. So this list is wider than the v3 one, is
 * ordered by something a reader can use to find the live ones, and says so.
 *
 * It is also read for a *v3* pool's page, to show where that pair trades on v4
 * — and then no entry is the pool being read, which is what a `null` analysed
 * id means.
 *
 * **This does not say which pool is better, and neither does its order.** The
 * order is depth at the current price, read from the PoolManager's storage: how
 * much a swap can draw on there, which separates a pool people use from one
 * somebody initialised and left. A deeper pool is a larger crowd sharing the
 * same fees. What the list offers is the same analysis, run on the sibling.
 */

/**
 * How many pools to ask for. Hooks multiply pools per pair, so this is well
 * above the v3 window, and the page cuts what it shows rather than the read.
 */
export const V4_PAIR_POOL_FETCH_LIMIT = 50;

export const V4PairPoolsSourceSchema = DataSourceSchema.extract([
  "uniswap-v4-subgraph",
  "ethereum-rpc",
]);

const SqrtPriceX96Schema = UnsignedIntegerStringSchema.refine(
  (value) => BigInt(value) > 0n && BigInt(value) < 1n << 160n,
  { error: "A square-root price is a positive 160-bit integer." },
);

export const V4PairPoolSchema = z.strictObject({
  /** The whole pool, hook and fee mode included. */
  pool: V4PoolSchema,
  /** Active liquidity and price from the PoolManager's storage, or `null` when unread. */
  state: z
    .strictObject({
      liquidity: Uint128StringSchema,
      sqrtPriceX96: SqrtPriceX96Schema,
    })
    .nullable(),
  /** What one of each currency is worth in ether, as the source derives it. */
  ethPrice: z
    .strictObject({
      token0: z.number().min(0),
      token1: z.number().min(0),
    })
    .nullable(),
});

export type V4PairPool = z.infer<typeof V4PairPoolSchema>;

type PairShape = {
  readonly analysedPoolId: string | null;
  readonly pools: readonly V4PairPool[];
};

/**
 * Deeper first, unread last, ties broken by id so two reads of one pair come
 * back in one order. Exported so the adapter that sorts and the schema that
 * checks the sort share one rule.
 */
export const compareV4PairPools = (left: V4PairPool, right: V4PairPool): number => {
  const leftDepth = depthInEth(left);
  const rightDepth = depthInEth(right);
  if (leftDepth !== rightDepth) {
    if (leftDepth === null) return 1;
    if (rightDepth === null) return -1;
    return rightDepth - leftDepth;
  }

  return left.pool.id.localeCompare(right.pool.id);
};

/** Every entry is the same two currencies, by address. A symbol is whatever a contract says. */
const everyPoolIsTheSamePair = ({ pools }: PairShape): boolean =>
  pools.every((entry, index) => {
    const previous = pools[index - 1];

    return (
      previous === undefined ||
      (previous.pool.token0.address === entry.pool.token0.address &&
        previous.pool.token1.address === entry.pool.token1.address)
    );
  });

const poolsAreDistinct = ({ pools }: PairShape): boolean =>
  new Set(pools.map((entry) => entry.pool.id)).size === pools.length;

const poolsAreOrdered = ({ pools }: PairShape): boolean =>
  pools.every((entry, index) => {
    const previous = pools[index - 1];

    return previous === undefined || compareV4PairPools(previous, entry) <= 0;
  });

/** The pool being read must be among its own siblings, when there is one. */
const includesTheAnalysedPool = ({ analysedPoolId, pools }: PairShape): boolean =>
  analysedPoolId === null || pools.some((entry) => entry.pool.id === analysedPoolId);

export const V4PairPoolsSchema = z
  .strictObject({
    /** The v4 pool being read, or `null` when this list is beside a v3 pool's page. */
    analysedPoolId: Bytes32HexSchema.nullable(),
    pools: z.array(V4PairPoolSchema).max(V4_PAIR_POOL_FETCH_LIMIT, {
      error: "A pair returned more pools than this application asked for.",
    }),
    fetchedAt: IsoTimestampSchema,
    sources: z.array(V4PairPoolsSourceSchema).min(1),
  })
  .refine(everyPoolIsTheSamePair, {
    error: "Every pool listed must trade the same two currencies.",
    path: ["pools"],
  })
  .refine(poolsAreDistinct, {
    error: "The same pool appears twice in one pair's list.",
    path: ["pools"],
  })
  .refine(poolsAreOrdered, {
    error: "A pair's pools must be ordered by depth at the current price, unread last.",
    path: ["pools"],
  })
  .refine(includesTheAnalysedPool, {
    error: "The pool being read must appear among its own pair's pools.",
    path: ["pools"],
  });

export type V4PairPools = z.infer<typeof V4PairPoolsSchema>;
