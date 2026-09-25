import { type V3PoolMetadata, V3PoolMetadataSchema, VOLATILITY_WINDOW_DAYS } from "../../schemas";
import type { RawPoolCard } from "./v3PoolCardRawResponse";
import { convertNonNegativeDecimal, convertSafeInteger } from "./v3SubgraphRawResponse";
import { normalizeV3Token } from "./v3TokenAdapter";
import type { ChainId } from "../chains/chains";

/** This adapter reads Ethereum mainnet only; multi-chain support is not modelled yet. */
export const ETHEREUM_MAINNET_CHAIN_ID = 1;

/** A listed pool, verified. What every list of pools is made of. */
export type PoolCard = {
  readonly pool: V3PoolMetadata;
  /** What the source reports is locked in it. The provider's figure, unverified. */
  readonly tvlUsd: number;
  /**
   * What one of each token is worth in ether, as the source derives it.
   *
   * Carried so a list can be ordered by what its pools actually hold: the
   * balances come from the token contracts, and these are what makes two
   * different pairs comparable. `null` when the source did not give a usable
   * price, which is not the same as a price of zero.
   */
  readonly ethPrice: { readonly token0: number; readonly token1: number } | null;
  /**
   * The start of the last UTC day anything happened in this pool, in Unix
   * seconds, or `null` when nothing ever has.
   */
  readonly lastActiveDay: number | null;
};

const SECONDS_PER_DAY = 86_400;

/**
 * Whether a pool has gone quiet for longer than the analysis can see.
 *
 * The range is drawn from the last thirty-one completed days of prices, and
 * a pool with no day in that window has no volatility to measure: opening it
 * answers "not enough history", whatever the pool once was. A SYRUP/USDC
 * pool with two hundred swaps in its life and none for six months was the
 * first result for "syrup", and every reader who opened it met that answer.
 *
 * Measured against the start of the current UTC day, so a pool active on any
 * of the last thirty-one completed days is kept — the same days the
 * volatility is measured from.
 */
export const isDormant = (card: PoolCard, now: Date): boolean => {
  if (card.lastActiveDay === null) return true;

  const today = Math.floor(now.getTime() / 1_000 / SECONDS_PER_DAY) * SECONDS_PER_DAY;
  return card.lastActiveDay < today - VOLATILITY_WINDOW_DAYS * SECONDS_PER_DAY;
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
export const normalizePoolCard = (raw: RawPoolCard, chainId: ChainId = ETHEREUM_MAINNET_CHAIN_ID): PoolCard | null => {
  const feePpm = convertSafeInteger(raw.feeTier);
  if (!feePpm.ok) return null;

  /*
   * Zero is allowed: a pool that has been fully withdrawn from reports exactly
   * that, and it is a fact about the pool rather than a broken reading.
   */
  const tvlUsd = convertNonNegativeDecimal(raw.totalValueLockedUSD, { allowZero: true });
  if (!tvlUsd.ok) return null;

  const token0 = normalizeV3Token(raw.token0, chainId);
  const token1 = normalizeV3Token(raw.token1, chainId);
  if (token0 === null || token1 === null) return null;

  const pool = V3PoolMetadataSchema.safeParse({
    protocolVersion: "v3",
    chainId,
    id: raw.id,
    token0,
    token1,
    feePpm: feePpm.value,
  });
  if (!pool.success) return null;

  /*
   * A missing or unusable price is not a zero price. It means this pool cannot
   * be placed beside another by what it holds, and the list says so rather than
   * sorting it as empty.
   */
  const price0 = convertNonNegativeDecimal(raw.token0.derivedETH, { allowZero: true });
  const price1 = convertNonNegativeDecimal(raw.token1.derivedETH, { allowZero: true });
  const ethPrice =
    price0.ok && price1.ok ? { token0: price0.value, token1: price1.value } : null;

  const lastDay = raw.poolDayData[0]?.date;
  const lastActiveDay = lastDay === undefined || lastDay < 0 ? null : lastDay;

  return { pool: pool.data, tvlUsd: tvlUsd.value, ethPrice, lastActiveDay };
};
