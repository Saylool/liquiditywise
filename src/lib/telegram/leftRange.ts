import {
  alterSwapEconomics,
  depthInEth,
  heldInEth,
  type PoolSearchMatch,
  type Position,
  type V4PoolSearchMatch,
} from "../../schemas";
import { composePairRow, type PoolWeeks } from "../advisor/pairPools";
import { amountsHeldAtTick } from "../advisor/positionRecord";
import { rebalanceInto, statedRecentreSwapFee } from "../analytics/recentringReplay";
import type { Chain } from "../chains/chains";
import { priceAtTick } from "../uniswap/v3TickMath";

/*
 * What an alert that a position has left its range adds to it: two lines,
 * each a measurement already made or arithmetic exact from what was read, and
 * neither a forecast.
 *
 * **What the range is missing.** The pool's fees over the last seven days
 * against what is in it, scaled to a year — the pair page's fee yield, by the
 * pair page's own composition (see advisor/pairPools.ts), so the alert and the
 * page cannot give one pool two figures. Every rule that page keeps is kept
 * here because it is that page's code that keeps it: nothing below its floor,
 * nothing where a v4 hook may take part of a swap for itself, a v3 pool set
 * against what its token contracts hold and a v4 pool against its depth at the
 * current price, and nothing at all where a figure the yield needs was not
 * read. It is what liquidity inside the pool's ranges was paid, and the line
 * says so: not what this position would have earned, and not what anything
 * will earn next.
 *
 * **What coming back would cost in swap fees.** Out of its range a position
 * holds one token: all token0 below it, all token1 above it, an amount its
 * liquidity and its two ticks fix exactly, wherever on that side the price
 * sits. Re-centring it — the re-centring replay's own move, at the current
 * price instead of a day's close — means swapping part of that token into the
 * mix a range of the same width, centred on the price, holds. The swap is
 * {@link rebalanceInto}'s, to the unit, and its fee is the pool's stated rate
 * in the swap's direction: a v3 tier, or a v4 key's fee with the protocol's
 * cut, as the replay charges it.
 *
 * One consequence of that arithmetic is worth writing down, because it looks
 * like a mistake and is not: the amount does not depend on the width. A range
 * centred on the price in logarithms — which a re-centred one is, since the
 * width is kept as multiples of the centre — holds the two tokens in equal
 * value at that price, so the swap is the share of the one token that leaves
 * equal value after the fee, `x / (2 − f)`, whatever the width. The width
 * decides where the new range lies, and the line names that range.
 *
 * What it leaves out it says: price impact, since the swap is priced at the
 * pool's price as if the pool could take it whole, and gas. A v4 pool whose
 * hook may change what a swap costs gets the cost with the site's qualifier;
 * a pool whose terms state no rate — a hook setting the fee swap by swap, or a
 * state that was not read — gets no cost line at all. The replay falls back to
 * a month's measured rate there, and an alert has no month to measure.
 *
 * Pure: no clock, no network, no environment. Either line is `null` whenever
 * anything it needs is missing, and the alert goes out without it.
 */

/** The re-centre's swap, in the position's own tokens. */
export type RecentreCost = {
  /** The token the position holds out of range, and so the one the swap sells. */
  readonly sold: "token0" | "token1";
  /** How much of it the swap takes, in whole units of that token. */
  readonly amountIn: number;
  /** The pool's stated rate in the swap's direction, in parts per million. */
  readonly feePpm: number;
  /** What the pool takes from it, in whole units of the token sold. */
  readonly fee: number;
  /** The range it would sit in: the old width, centred on the price, in the pool's own direction. */
  readonly lowerPrice: number;
  readonly upperPrice: number;
  /** A v4 hook that may change what a swap costs; the line then says the cost may differ. */
  readonly hookMayAlterSwaps: boolean;
};

export type LeftRangeLines = {
  /** The pair page's fee yield for the position's pool, or `null` where that page would show none. */
  readonly feeYield: number | null;
  readonly recentre: RecentreCost | null;
};

/** What an alert carries when neither line could be made, and what every other alert carries. */
export const NO_LINES: LeftRangeLines = { feeYield: null, recentre: null };

/** One protocol's pair search on the position's chain, as the pair page reads it. */
export type PairSearchFound =
  | { readonly protocol: "v3"; readonly matches: readonly PoolSearchMatch[] }
  | { readonly protocol: "v4"; readonly matches: readonly V4PoolSearchMatch[] };

/**
 * The pair page's fee yield for the pool a position is in, or `null` where the
 * page would rank it without one — or not list it at all.
 *
 * The pool is found in the search by its id on its chain and protocol, never
 * by its symbols: a lookalike token's pool of the same name is somebody
 * else's pool. Its row is composed exactly as the pair page composes it, and
 * only a ranked row has a yield to give.
 */
export const missedFeeYield = ({
  position,
  chain,
  found,
  nativeUsd,
  weeks,
}: {
  readonly position: Position;
  readonly chain: Chain;
  /** `null` when the search was not read. */
  readonly found: PairSearchFound | null;
  readonly nativeUsd: number | null;
  readonly weeks: PoolWeeks | null;
}): number | null => {
  const { pool } = position;
  if (found === null || found.protocol !== pool.protocolVersion || pool.chainId !== chain.id) return null;

  const id = pool.id.toLowerCase();
  const same = (candidate: { readonly chainId: number; readonly id: string }) =>
    candidate.chainId === chain.id && candidate.id.toLowerCase() === id;

  /* What is in it: on v3 what its token contracts hold, on v4 its depth at the current price — as the page ranks them. */
  const row = (() => {
    if (found.protocol === "v3") {
      const match = found.matches.find((candidate) => same(candidate.pool));
      return match === undefined
        ? null
        : composePairRow({ chain, pool: match.pool, liquidityInNative: heldInEth(match), nativeUsd, weeks });
    }
    const match = found.matches.find((candidate) => same(candidate.pool));
    return match === undefined
      ? null
      : composePairRow({ chain, pool: match.pool, liquidityInNative: depthInEth(match), nativeUsd, weeks });
  })();

  return row?.standing === "ranked" ? row.feeYield : null;
};

/**
 * What re-centring a position that has left its range would swap, and the fee
 * the pool would take on it, or `null` when it cannot be said.
 *
 * Only for a position whose range the price has left: inside, it holds both
 * tokens and nothing has been missed, and with the pool's tick unread nothing
 * says which side it is on. The holding is the protocol's position formulas at
 * the pool's tick, by the holdings report card's own arithmetic; the price is
 * that tick's, in whole tokens, as the position's own edges are.
 */
export const recentreCost = (position: Position): RecentreCost | null => {
  const { pool, currentTick, tickLower, tickUpper } = position;
  if (position.inRange !== false || currentTick === null) return null;

  const swapFee = statedRecentreSwapFee(pool);
  if (swapFee === null) return null;

  const decimals = { token0: pool.token0.decimals, token1: pool.token1.decimals };
  const held = amountsHeldAtTick({ liquidity: BigInt(position.liquidity), tickLower, tickUpper, tick: currentTick, decimals });
  const price = priceAtTick({ tick: currentTick, token0Decimals: decimals.token0, token1Decimals: decimals.token1 });
  if (held === null || price === null) return null;

  /*
   * The width as multiples of the centre, as the replay keeps it: the old
   * range's upper edge over its lower one, split evenly either side of the
   * price in logarithms.
   */
  const halfWidth = Math.sqrt(position.upperPrice / position.lowerPrice);
  const range = { lowerPrice: price / halfWidth, upperPrice: price * halfWidth };
  const swap = rebalanceInto({ amount0: held.token0, amount1: held.token1 }, price, range, swapFee);
  if (swap.sold === null) return null;

  /* `rebalanceInto` prices the fee in token1; selling token0, it is that over the price, in token0. */
  const fee = swap.sold === "token0" ? swap.fee / price : swap.fee;
  const figures = [swap.amountIn, fee, range.lowerPrice, range.upperPrice];
  if (!figures.every(Number.isFinite) || !(swap.amountIn > 0) || !(fee >= 0) || !(range.lowerPrice < range.upperPrice)) {
    return null;
  }

  return {
    sold: swap.sold,
    amountIn: swap.amountIn,
    feePpm: swap.sold === "token0" ? swapFee.zeroForOnePpm : swapFee.oneForZeroPpm,
    fee,
    ...range,
    /* Read from the hook's address, as feeDisclosure.ts reads it for a pool's own page. */
    hookMayAlterSwaps: pool.protocolVersion === "v4" && alterSwapEconomics(pool.hookAddress),
  };
};
