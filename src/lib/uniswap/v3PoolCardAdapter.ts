import { type V3PoolMetadata, V3PoolMetadataSchema } from "../../schemas";
import type { RawPoolCard } from "./v3PoolCardRawResponse";
import { convertNonNegativeDecimal, convertSafeInteger } from "./v3SubgraphRawResponse";
import { normalizeV3Token } from "./v3TokenAdapter";

/** This adapter reads Ethereum mainnet only; multi-chain support is not modelled yet. */
export const ETHEREUM_MAINNET_CHAIN_ID = 1;

/** A listed pool, verified. What every list of pools is made of. */
export type PoolCard = {
  readonly pool: V3PoolMetadata;
  /** What the source reports is locked in it. The provider's figure, unverified. */
  readonly tvlUsd: number;
};

/**
 * Turns one raw pool into a verified card, or `null` if it cannot be trusted.
 *
 * Shared by every list, because a list entry is a link to a full analysis and
 * the same pool has to be admitted on the same terms whichever list it was found
 * through. Two copies of this would be two chances for one of them to stop
 * checking the token ordering.
 *
 * The authority is the same one the single-pool read defers to: the fee bound,
 * the uint8 decimals, the non-zero token addresses, the token labels, and that
 * token0 sorts before token1.
 *
 * Returning `null` rather than throwing is what lets a caller drop one entry and
 * publish the rest. A list is the one place in this application where a single
 * bad entry does not have to sink the answer — everywhere else the visitor asked
 * about one pool and the only honest replies were that pool or nothing.
 */
export const normalizePoolCard = (raw: RawPoolCard): PoolCard | null => {
  const feePpm = convertSafeInteger(raw.feeTier);
  if (!feePpm.ok) return null;

  /*
   * Zero is allowed: a pool that has been fully withdrawn from reports exactly
   * that, and it is a fact about the pool rather than a broken reading.
   */
  const tvlUsd = convertNonNegativeDecimal(raw.totalValueLockedUSD, { allowZero: true });
  if (!tvlUsd.ok) return null;

  const token0 = normalizeV3Token(raw.token0, ETHEREUM_MAINNET_CHAIN_ID);
  const token1 = normalizeV3Token(raw.token1, ETHEREUM_MAINNET_CHAIN_ID);
  if (token0 === null || token1 === null) return null;

  const pool = V3PoolMetadataSchema.safeParse({
    protocolVersion: "v3",
    chainId: ETHEREUM_MAINNET_CHAIN_ID,
    id: raw.id,
    token0,
    token1,
    feePpm: feePpm.value,
  });
  if (!pool.success) return null;

  return { pool: pool.data, tvlUsd: tvlUsd.value };
};
