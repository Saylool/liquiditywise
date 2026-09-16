import type { V4Pool } from "../../schemas";
import { convertNonNegativeDecimal } from "./v3SubgraphRawResponse";
import { normalizeV4PoolEntity } from "./v4PoolAdapter";
import type { V4PoolChainReading } from "./v4PoolChainReading";
import type { RawV4PoolCard } from "./v4PoolCardRawResponse";

/** A listed v4 pool, verified. What every list of v4 pools is made of. */
export type V4PoolCard = {
  readonly pool: V4Pool;
  /**
   * What one of each token is worth in ether, as the source derives it.
   *
   * What makes two different pairs comparable when the list is ordered. `null`
   * when the source did not give a usable price, which is not a price of zero.
   */
  readonly ethPrice: { readonly token0: number; readonly token1: number } | null;
};

/**
 * Turns one raw v4 pool into a verified card, or `null` if it cannot be trusted.
 *
 * The pool itself goes through the same normaliser the single-pool read uses,
 * so a pool is admitted to a list on exactly the terms it is admitted to its own
 * page: the key checked against the indexer, the fee bound, the
 * dynamic-fee-needs-a-hook rule, the return-delta rule, the token labels, and
 * that token0 sorts before token1. What differs is that a list may carry a
 * pool whose key the chain did not answer for, with its fee marked unread.
 *
 * Returning `null` rather than throwing is what lets a caller drop one entry
 * and publish the rest.
 */
export const normalizeV4PoolCard = (
  raw: RawV4PoolCard,
  chain: V4PoolChainReading,
): V4PoolCard | null => {
  const pool = normalizeV4PoolEntity(raw, chain);
  if (pool === null) return null;

  const price0 = convertNonNegativeDecimal(raw.token0.derivedETH, { allowZero: true });
  const price1 = convertNonNegativeDecimal(raw.token1.derivedETH, { allowZero: true });
  const ethPrice =
    price0.ok && price1.ok ? { token0: price0.value, token1: price1.value } : null;

  return { pool, ethPrice };
};
