import {
  type DataFailureNotice,
  type Pool,
  type PoolMarketSnapshot,
  type SwapDepth,
  SwapDepthSchema,
  type SwapLeg,
  SwapLegSchema,
  type TickRange,
} from "../../schemas";
import { alignTickDown, alignTickUp, priceAtTick } from "../uniswap/v3TickMath";

/*
 * The largest swap this page can price exactly, in each direction.
 *
 * Pure: no clock, no network, no environment, and no source of its own. The
 * liquidity was read for the pool's depth, the price for the band, the tick grid
 * is the pool's — this is arithmetic over figures already on the screen.
 *
 * See {@link SwapDepthSchema} for why there is a largest, and why what it costs
 * is the geometric mean of the two prices. The one thing worth repeating here is
 * what the boundary is: liquidity changes only at initialized ticks, a tick can
 * only be initialized at a multiple of the pool's spacing, so between the two
 * boundaries the price sits between there is nothing to know that has not been
 * read. Past them there is, and this application has not read it.
 */

const NO_LIQUIDITY = "swap-depth-no-liquidity";
const TICK_DISAGREEMENT = "swap-depth-tick-disagreement";
const UNVERIFIABLE = "swap-depth-unverifiable";

export type SwapDepthResult =
  | { readonly status: "success"; readonly data: SwapDepth }
  | { readonly status: "unavailable"; readonly notice: DataFailureNotice };

export type SwapDepthInput = {
  /** For the tick grid and the decimals the amounts are scaled by. */
  readonly pool: Pool;
  /** For the liquidity active at the current price, and the tick the source saw. */
  readonly snapshot: PoolMarketSnapshot;
  /** For the price the page shows and the tick this application put it in. */
  readonly range: TickRange;
};

/**
 * One direction, or `null` when there is nothing there worth publishing.
 *
 * The amounts are the protocol's own two brackets, divided by the same power of
 * ten that turns a deposit into liquidity in `depositFeeShare.ts` — the scale
 * between `L` and whole tokens is the same either way round, and writing it out
 * twice would be two places for it to drift.
 *
 * **Each leg is checked on its own, and a leg that fails is dropped rather than
 * taking the other one down with it.** The check that fails is the schema's:
 * that the amounts divide into the average price. Measured against sUSDe/USDT
 * on 2026-09-17 — a pool whose price steps are one tick wide — the price was
 * sitting 3.6 billionths above its lower boundary, which left two billionths of
 * a token of room upward. Both brackets are then differences of nearly equal
 * numbers, the quotient came out 4.6e-9 away from the price it should be, and a
 * leg that cannot be verified to a part in a billion is a leg whose amounts are
 * noise. The other direction had forty-six tokens of room and agreed to 1.2e-12.
 * So the tolerance stays where it is and the dust is dropped by it.
 */
const leg = (
  tokenIn: SwapLeg["tokenIn"],
  liquidityInTokens: number,
  spotPrice: number,
  edgePrice: number,
): SwapLeg | null => {
  const rootSpot = Math.sqrt(spotPrice);
  const rootEdge = Math.sqrt(edgePrice);
  const averagePrice = rootSpot * rootEdge;

  const amounts =
    tokenIn === "token0"
      ? {
          amountIn: liquidityInTokens * (1 / rootEdge - 1 / rootSpot),
          amountOut: liquidityInTokens * (rootSpot - rootEdge),
          costRatio: 1 - averagePrice / spotPrice,
        }
      : {
          amountIn: liquidityInTokens * (rootEdge - rootSpot),
          amountOut: liquidityInTokens * (1 / rootSpot - 1 / rootEdge),
          costRatio: averagePrice / spotPrice - 1,
        };

  if (!(amounts.amountIn > 0) || !(amounts.amountOut > 0)) return null;

  const verified = SwapLegSchema.safeParse({ tokenIn, edgePrice, averagePrice, ...amounts });

  return verified.success ? verified.data : null;
};

/**
 * Prices both directions to the edges of the step the pool is in.
 *
 * Refuses rather than answers when the source's own tick puts the pool in a
 * different step than the price this page drew its range from. The liquidity
 * figure belongs to whichever step the pool is actually in, and pricing a swap
 * across a step it may not be in would be the one mistake here that produces a
 * perfectly reasonable-looking number.
 *
 * The window that check covers is narrow, and it is the window that matters.
 * `calculateTickRange` has already refused anything further apart than
 * `MAX_TICK_DISAGREEMENT`, which is one tick — so by the time this runs the two
 * can differ by at most that. One tick is enough to land on the other side of a
 * spacing boundary, and it only does when the price is sitting on one, which is
 * exactly when attributing the liquidity to the wrong step is most likely to be
 * wrong.
 */
export const calculateSwapDepth = ({ pool, snapshot, range }: SwapDepthInput): SwapDepthResult => {
  const tickSpacing = pool.tickSpacing;
  const bucketLow = alignTickDown({ tick: range.currentTick, tickSpacing });
  if (bucketLow === null) return { status: "unavailable", notice: UNVERIFIABLE };

  if (snapshot.tick !== null) {
    const sourceBucket = alignTickDown({ tick: snapshot.tick, tickSpacing });
    if (sourceBucket !== bucketLow) {
      return { status: "unavailable", notice: TICK_DISAGREEMENT };
    }
  }

  /* The next boundary up. `+ 1` cannot already be on the grid, so this moves. */
  const bucketHigh = alignTickUp({ tick: bucketLow + 1, tickSpacing });
  if (bucketHigh === null) return { status: "unavailable", notice: UNVERIFIABLE };

  const decimals = {
    token0Decimals: pool.token0.decimals,
    token1Decimals: pool.token1.decimals,
  };
  const lowerPrice = priceAtTick({ tick: bucketLow, ...decimals });
  const upperPrice = priceAtTick({ tick: bucketHigh, ...decimals });
  if (lowerPrice === null || upperPrice === null) {
    return { status: "unavailable", notice: UNVERIFIABLE };
  }

  /*
   * `null` and `"0"` mean different things and cost the reader the same: there
   * is no liquidity here to price a swap against. The first is unreachable
   * through this application's own readers — a snapshot whose liquidity will not
   * parse is refused whole — so it is folded in rather than given a branch of
   * its own that nothing could enter.
   */
  const liquidity = snapshot.liquidity === null ? 0 : Number(snapshot.liquidity);
  const liquidityInTokens =
    liquidity / 10 ** ((pool.token0.decimals + pool.token1.decimals) / 2);
  if (!(liquidityInTokens > 0)) return { status: "unavailable", notice: NO_LIQUIDITY };

  const spotPrice = range.band.currentPrice;
  const candidate = {
    sellingToken0: leg("token0", liquidityInTokens, spotPrice, lowerPrice),
    sellingToken1: leg("token1", liquidityInTokens, spotPrice, upperPrice),
    spotPrice,
  };

  const verified = SwapDepthSchema.safeParse(candidate);
  if (!verified.success) return { status: "unavailable", notice: UNVERIFIABLE };

  return { status: "success", data: verified.data };
};
