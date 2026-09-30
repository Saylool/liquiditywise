import type { SmartLiquidityRead } from "./readSmartLiquidity";

/*
 * The range the best-earning liquidity of each pool sits in, by pool, for
 * showing beside a position that is in one of them.
 *
 * Pure: it only reshapes what the smart-money page already measured.
 */

export type SmartRange = {
  /** The median smart position's edges, each as its price over the price at the time of measuring. */
  readonly lowerRatio: number;
  readonly upperRatio: number;
  /** How many smart positions the median is of. */
  readonly positions: number;
};

/** How a pool is found in the map: its chain and address, lower-cased. */
export const smartRangeKey = (chainId: number, poolId: string): string => `${chainId}|${poolId.toLowerCase()}`;

export const smartRangesByPool = (read: SmartLiquidityRead | null): ReadonlyMap<string, SmartRange> =>
  new Map(
    read === null || read.status !== "measured"
      ? []
      : read.data.pairs.map(({ pool, medianLowerRatio, medianUpperRatio, positions }) => [
          smartRangeKey(pool.chainId, pool.id),
          { lowerRatio: medianLowerRatio, upperRatio: medianUpperRatio, positions },
        ]),
  );
