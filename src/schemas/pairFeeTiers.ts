import { z } from "zod";

import { DataSourceSchema } from "./dataSource";
import {
  IsoTimestampSchema,
  nonZeroEvmAddress,
  UnsignedIntegerStringSchema,
} from "./primitives";
import { V3PoolMetadataSchema } from "./uniswap";

/*
 * The same pair, at every fee tier it trades at.
 *
 * Uniswap v3 deploys one pool per (token0, token1, fee) triple, so a pair is not
 * one market but several — USDC/WETH trades at 0.01%, 0.05%, 0.30% and 1% on
 * mainnet, with most of the liquidity in two of them. Someone who arrived at one
 * of those pools by pasting an address or clicking a search result has no way to
 * know the others exist, and choosing between them is a decision they make
 * before anything else on the page applies.
 *
 * **This does not say which tier is better, and it is not ordered as if it did.**
 * A tier holding more liquidity is a larger crowd sharing the same swap fees, not
 * a better place to be; answering "which one" honestly would need the tick-level
 * liquidity distribution this application does not read. What it offers instead
 * is the same analysis, run again on the sibling pool — which the reader can
 * compare for themselves.
 */

/**
 * How many pools to ask for.
 *
 * Far above any real pair: the factory ships four tiers and governance has to
 * enable each additional one by vote. The window exists so a pair that somehow
 * carried more would still return the ones that matter — the query orders by the
 * source's liquidity figure — rather than failing outright.
 */
export const PAIR_FEE_TIER_FETCH_LIMIT = 20;

/** Which pools exist comes from the indexer; what they hold comes from the chain. */
export const PairFeeTiersSourceSchema = DataSourceSchema.extract([
  "uniswap-v3-subgraph",
  "ethereum-rpc",
]);

export const PairFeeTierSchema = z.strictObject({
  /**
   * The same verified contract every other read produces, token ordering
   * included — which is what makes this safe to link straight into an analysis.
   */
  pool: V3PoolMetadataSchema,
  /**
   * What the pool contract actually holds, in each token's own base units.
   *
   * Read from the chain rather than taken from the indexer, and that is not
   * caution — it is a correction. The subgraph's `totalValueLockedToken0/1`
   * were measured against `balanceOf` on the pool contract for five of the
   * busiest pools, and they overstate what is there by between 1.3 and 13
   * times: 144 million USDC reported against 11 million held, 15,058 WETH
   * against 1,729. The dollar figure derived from them is internally consistent
   * and therefore wrong by the same factor.
   *
   * Two token amounts rather than one dollar figure, because every tier of one
   * pair holds the same two tokens. Nothing has to be priced to compare them,
   * so nothing can be mispriced.
   *
   * Null when the chain could not be read. An unread reserve is not an empty
   * pool, and the interface says which it is.
   */
  reserves: z
    .strictObject({
      token0: UnsignedIntegerStringSchema,
      token1: UnsignedIntegerStringSchema,
    })
    .nullable(),
});

export type PairFeeTier = z.infer<typeof PairFeeTierSchema>;

type TiersShape = {
  readonly analysedPoolId: string;
  readonly tiers: readonly PairFeeTier[];
};

/**
 * True when `predicate` holds for every adjacent pair. Vacuous below two entries.
 *
 * Each property below is transitive, so checking neighbours checks the list.
 */
const everyAdjacent = (
  tiers: readonly PairFeeTier[],
  predicate: (left: PairFeeTier, right: PairFeeTier) => boolean,
): boolean =>
  tiers.every((tier, index) => {
    const previous = tiers[index - 1];

    return previous === undefined || predicate(previous, tier);
  });

/**
 * Every entry must be the *same* pair.
 *
 * The defining property, and the one worth checking hardest: this list is
 * rendered as "the pool you are reading about, and its siblings". A query that
 * matched something else produces a panel that is not wrong-looking, it is
 * simply about other pools — the most convincing way this could mislead.
 *
 * Addresses rather than symbols, because a symbol is whatever a contract says.
 */
const everyTierIsTheSamePair = ({ tiers }: TiersShape): boolean =>
  everyAdjacent(
    tiers,
    (left, right) =>
      left.pool.token0.address === right.pool.token0.address &&
      left.pool.token1.address === right.pool.token1.address,
  );

/**
 * No two entries may share a fee tier.
 *
 * `UniswapV3Factory.createPool` reverts if a pool already exists for a triple,
 * so two pools of one pair at one fee cannot exist on chain. Seeing them means
 * the read returned something that is not what it claims, and a list showing the
 * same tier twice invites a reader to compare two figures for one market.
 */
const feeTiersAreDistinct = ({ tiers }: TiersShape): boolean =>
  new Set(tiers.map((tier) => tier.pool.feePpm)).size === tiers.length;

/**
 * Ascending by fee, which is this application's own claim about the order.
 *
 * Deliberately not the source's liquidity order, and deliberately not a ranking:
 * fee is a fixed property of each pool, so the list reads the same way today and
 * next month, and nothing about its shape suggests the top entry is the one to
 * pick.
 */
const tiersAreOrderedByFee = ({ tiers }: TiersShape): boolean =>
  everyAdjacent(tiers, (left, right) => left.pool.feePpm <= right.pool.feePpm);

/**
 * The pool being analysed has to be in its own list of siblings.
 *
 * It is one of the pair's pools, and the page has just read its metadata from
 * this same source, so its absence is never a fact about Uniswap — it means the
 * two reads disagree about which pair this is. An empty list fails here too,
 * which is the honest outcome: a pair always has at least the pool in front of
 * the reader.
 */
const includesTheAnalysedPool = ({ analysedPoolId, tiers }: TiersShape): boolean =>
  tiers.some((tier) => tier.pool.id === analysedPoolId);

export const PairFeeTiersSchema = z
  .strictObject({
    /**
     * The pool the reader is looking at, so the interface can mark it without
     * being told separately — and so the check below has something to check.
     */
    analysedPoolId: nonZeroEvmAddress(
      "A v3 pool id must be the deployed pool contract address, never the zero address.",
    ),
    tiers: z.array(PairFeeTierSchema).max(PAIR_FEE_TIER_FETCH_LIMIT, {
      error: "A pair returned more pools than this application asked for.",
    }),
    /** When this application asked. A reported liquidity figure is a reading. */
    fetchedAt: IsoTimestampSchema,
    sources: z.array(PairFeeTiersSourceSchema).min(1),
  })
  .refine(everyTierIsTheSamePair, {
    error: "Every fee tier listed must belong to the same token pair.",
    path: ["tiers"],
  })
  .refine(feeTiersAreDistinct, {
    error: "One pair cannot have two pools at the same fee tier.",
    path: ["tiers"],
  })
  .refine(tiersAreOrderedByFee, {
    error: "Fee tiers must be listed in ascending order of fee.",
    path: ["tiers"],
  })
  .refine(includesTheAnalysedPool, {
    error: "The pool being analysed must appear among its own pair's fee tiers.",
    path: ["tiers"],
  });

export type PairFeeTiers = z.infer<typeof PairFeeTiersSchema>;
