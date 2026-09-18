import {
  AddressPositionsSchema,
  type AddressPositions,
  type DataFailureNotice,
  POSITIONS_SHOWN,
  type V3Position,
  V3PositionSchema,
} from "../../schemas";
import type { RawV3Positions } from "../uniswap/ethereumV3Positions";
import type { V3PoolWithTick } from "../uniswap/ethereumV3PoolsByIds";
import { priceAtTick } from "../uniswap/v3TickMath";
import { v3PoolAddress } from "../uniswap/v3PoolAddress";

/*
 * What the chain said an address holds, turned into something a page can say.
 *
 * Pure — no clock, no network, no environment — like every other composition
 * here. It takes the manager's own record of each position and the source's
 * description of the pools those positions derive to, and produces the one thing
 * neither has on its own: where a position sits in prices, and whether the pool
 * is inside it right now.
 *
 * **The derivation is checked, not trusted.** A position names a pair and a fee;
 * the pool address follows by CREATE2. A derived address that the source does
 * not know is dropped, and so is one that comes back describing a different pair
 * or a different fee. Dropping rather than failing is the rule every list here
 * follows: eleven verified positions with one left out is a true, shorter answer.
 */

const UNVERIFIABLE = "positions-unverifiable";

export type AddressPositionsResult =
  | { readonly status: "success"; readonly data: AddressPositions }
  | { readonly status: "unavailable"; readonly notice: DataFailureNotice };

export type AddressPositionsInput = {
  readonly address: string;
  readonly raw: RawV3Positions;
  /** What the source knows about the derived addresses. */
  readonly pools: readonly V3PoolWithTick[];
  readonly fetchedAt: string;
};

/**
 * Builds one position, or `null` when the pool behind it cannot be confirmed.
 *
 * The confirmation is the whole point: a pool that reports a different pair or a
 * different fee than the position claims is not the pool that position is in,
 * whatever address the arithmetic produced.
 */
const describe = (
  raw: RawV3Positions["open"][number],
  factory: string,
  byAddress: ReadonlyMap<string, V3PoolWithTick>,
): V3Position | null => {
  const derived = v3PoolAddress({
    factory,
    token0: raw.token0,
    token1: raw.token1,
    feePpm: raw.feePpm,
  });
  if (derived === null) return null;

  const found = byAddress.get(derived);
  if (found === undefined) return null;

  const { pool, tick } = found;
  if (pool.feePpm !== raw.feePpm) return null;
  if (pool.token0.address !== raw.token0 || pool.token1.address !== raw.token1) return null;

  const decimals = {
    token0Decimals: pool.token0.decimals,
    token1Decimals: pool.token1.decimals,
  };
  const lowerPrice = priceAtTick({ tick: raw.tickLower, ...decimals });
  const upperPrice = priceAtTick({ tick: raw.tickUpper, ...decimals });
  if (lowerPrice === null || upperPrice === null) return null;

  const candidate = {
    tokenId: raw.tokenId,
    pool,
    tickLower: raw.tickLower,
    tickUpper: raw.tickUpper,
    lowerPrice,
    upperPrice,
    liquidity: raw.liquidity,
    currentTick: tick,
    /* Uniswap's own rule: at or above the lower bound, strictly below the upper. */
    inRange: tick === null ? null : tick >= raw.tickLower && tick < raw.tickUpper,
  };

  const verified = V3PositionSchema.safeParse(candidate);

  return verified.success ? verified.data : null;
};

/**
 * Composes one address's answer.
 *
 * The counts describe everything that was read; the list is capped for display
 * and the page says how many are not on it. A position dropped for failing its
 * checks is missing from the list and still counted as open, because it is one —
 * the reader holds it whether or not this application could describe it.
 */
export const composeAddressPositions = ({
  address,
  raw,
  pools,
  fetchedAt,
}: AddressPositionsInput): AddressPositionsResult => {
  const byAddress = new Map(pools.map((entry) => [entry.pool.id, entry]));
  const described = raw.open
    .map((position) => describe(position, raw.factory, byAddress))
    .filter((position): position is V3Position => position !== null);

  const candidate = {
    address,
    positions: described.slice(0, POSITIONS_SHOWN),
    held: raw.held,
    read: raw.read,
    open: raw.open.length,
    closed: raw.closed,
    fetchedAt,
    sources: ["uniswap-v3-subgraph", "ethereum-rpc"],
  };

  const verified = AddressPositionsSchema.safeParse(candidate);
  if (!verified.success) return { status: "unavailable", notice: UNVERIFIABLE };

  return { status: "success", data: verified.data };
};

/** The pool addresses one read's positions derive to, for the source lookup. */
export const derivedPoolAddresses = (raw: RawV3Positions): readonly string[] => [
  ...new Set(
    raw.open
      .map((position) =>
        v3PoolAddress({
          factory: raw.factory,
          token0: position.token0,
          token1: position.token1,
          feePpm: position.feePpm,
        }),
      )
      .filter((address): address is string => address !== null),
  ),
];
