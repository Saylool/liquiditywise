import {
  AddressPositionsSchema,
  type AddressPositions,
  type DataFailureNotice,
  type DataResult,
  type HoldingsSource,
  type Position,
  POSITIONS_SHOWN,
  PositionSchema,
  type ProtocolVersion,
  ZERO_ADDRESS,
} from "../../schemas";
import type { RawV3Positions } from "../uniswap/ethereumV3Positions";
import type { V3PositionHistories } from "../uniswap/ethereumV3PositionSnapshots";
import type { V3PoolWithTick } from "../uniswap/ethereumV3PoolsByIds";
import type { RawV4Positions } from "../uniswap/ethereumV4Positions";
import type { V4PoolTokens } from "../uniswap/ethereumV4PoolsByIds";
import { priceAtTick } from "../uniswap/v3TickMath";
import { v3PoolAddress } from "../uniswap/v3PoolAddress";
import { DYNAMIC_FEE_FLAG } from "../uniswap/v4PoolKey";
import type { PositionFees } from "../uniswap/feeGrowth";
import type { RawV4Position } from "../uniswap/v4PositionManager";
import { composePositionRecord, historyOf, type PositionRecordResult } from "./positionRecord";

/*
 * What the chain said an address holds, turned into something a page can say.
 *
 * Pure — no clock, no network, no environment — like every other composition
 * here. It takes each manager's own record of a position and the source's
 * description of the pool behind it, and produces the one thing neither has on
 * its own: where a position sits in prices, and whether the pool is inside it
 * right now.
 *
 * **Both protocols are proved, by the route each one offers.** A v3 position
 * names a pair and a fee; the pool address follows by CREATE2 and is dropped
 * unless the source comes back describing that same pair and fee. A v4 position
 * carries the pool's whole key, which the manager already proved by hashing, so
 * what is checked here is narrower and different: that the pool the source named
 * is the pool the key names. Dropping rather than failing is the rule either
 * way — eleven verified positions with one left out is a true, shorter answer.
 *
 * **A protocol that could not be read is named rather than skipped.** Two
 * protocols mean two ways to fail, and an answer that quietly covered one would
 * let the page tell an address with positions that it has none.
 *
 * **A shown v3 position can carry its record** — how it has done since it was
 * opened (see positionRecord.ts) — when its history was asked for. The record
 * rides beside the answer rather than inside it: it is built from what the
 * answer was built from, it can only be added, and nothing about it can drop a
 * position or fail the list.
 */

const UNVERIFIABLE = "positions-unverifiable";

export type AddressPositionsResult =
  | {
      readonly status: "success";
      readonly data: AddressPositions;
      /**
       * Each listed v3 position's record, by token id; absent when no history
       * was asked for. A listed v3 position missing from it has none to show.
       */
      readonly records?: ReadonlyMap<string, PositionRecordResult>;
    }
  | { readonly status: "unavailable"; readonly notice: DataFailureNotice };

/** One protocol's answer, or `null` when that protocol could not be read at all. */
export type V3Side = {
  readonly raw: RawV3Positions;
  readonly pools: readonly V3PoolWithTick[];
  /**
   * What each position has earned, by token id. A position missing from it is
   * shown without the figure rather than with a zero — the fee read is an
   * addition to this answer, and losing it must not lose the answer.
   */
  readonly fees: ReadonlyMap<string, PositionFees>;
  /** The pool's price each position's fees were worked out at, by token id, from the same read. */
  readonly sqrtPrices?: ReadonlyMap<string, bigint>;
  /**
   * The positions' histories, when they were asked for: absent when not, and
   * an unavailable result when the read failed — which costs the records and
   * nothing else.
   */
  readonly history?: DataResult<V3PositionHistories>;
};

export type V4Side = {
  readonly raw: RawV4Positions;
  readonly pools: readonly V4PoolTokens[];
  readonly fees: ReadonlyMap<string, PositionFees>;
};

export type AddressPositionsInput = {
  readonly address: string;
  readonly v3: V3Side | null;
  readonly v4: V4Side | null;
  /**
   * Whether v4 was asked at all. Off mainnet it is not — no v4 is read there —
   * and a `null` side then means "not this chain", not "could not be read".
   */
  readonly v4Asked?: boolean;
  /** Likewise for v3, which is not read on a v4-only chain (see chains.ts). */
  readonly v3Asked?: boolean;
  /**
   * Whether the v3 histories were asked for, for the records. A v3 side that
   * was not read has none even when they were, and its positions are not
   * listed either.
   */
  readonly historyAsked?: boolean;
  readonly fetchedAt: string;
};

/** Where a position sits in prices, and whether the pool is inside it. */
const place = (
  pool: { readonly token0: { readonly decimals: number }; readonly token1: { readonly decimals: number } },
  ticks: { readonly tickLower: number; readonly tickUpper: number },
  tick: number | null,
): {
  readonly lowerPrice: number;
  readonly upperPrice: number;
  readonly currentTick: number | null;
  readonly inRange: boolean | null;
} | null => {
  const decimals = {
    token0Decimals: pool.token0.decimals,
    token1Decimals: pool.token1.decimals,
  };
  const lowerPrice = priceAtTick({ tick: ticks.tickLower, ...decimals });
  const upperPrice = priceAtTick({ tick: ticks.tickUpper, ...decimals });
  if (lowerPrice === null || upperPrice === null) return null;

  return {
    lowerPrice,
    upperPrice,
    currentTick: tick,
    /* Uniswap's own rule: at or above the lower bound, strictly below the upper. */
    inRange: tick === null ? null : tick >= ticks.tickLower && tick < ticks.tickUpper,
  };
};

/**
 * Builds one v3 position, or `null` when the pool behind it cannot be confirmed.
 *
 * The confirmation is the whole point: a pool that reports a different pair or a
 * different fee than the position claims is not the pool that position is in,
 * whatever address the arithmetic produced.
 */
const describeV3 = (
  raw: RawV3Positions["open"][number],
  factory: string,
  byAddress: ReadonlyMap<string, V3PoolWithTick>,
  fees: ReadonlyMap<string, PositionFees>,
): Position | null => {
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

  const placed = place(pool, raw, tick);
  if (placed === null) return null;

  const verified = PositionSchema.safeParse({
    tokenId: raw.tokenId,
    pool,
    tickLower: raw.tickLower,
    tickUpper: raw.tickUpper,
    liquidity: raw.liquidity,
    uncollected: fees.get(raw.tokenId) ?? null,
    ...placed,
  });

  return verified.success ? verified.data : null;
};

/**
 * Builds one v4 position, or `null` when the pool the source named is not the
 * pool the key names.
 *
 * Less is checked here than for v3, and deliberately: the manager returned the
 * key and the pool's id in the same answer, and the id is the keccak of the key,
 * so the fee, the spacing and the hook are past argument before they arrive.
 * What the source adds is the pair's names, and that is what is checked —
 * against the two currencies the key carries.
 */
const describeV4 = (
  raw: RawV4Position,
  byId: ReadonlyMap<string, V4PoolTokens>,
  fees: ReadonlyMap<string, PositionFees>,
): Position | null => {
  const found = byId.get(raw.poolId);
  if (found === undefined) return null;
  if (found.token0.address !== raw.key.currency0) return null;
  if (found.token1.address !== raw.key.currency1) return null;

  const placed = place(found, raw, found.tick);
  if (placed === null) return null;

  const verified = PositionSchema.safeParse({
    tokenId: raw.tokenId,
    pool: {
      protocolVersion: "v4",
      chainId: found.token0.chainId,
      id: raw.poolId,
      token0: found.token0,
      token1: found.token1,
      tickSpacing: raw.key.tickSpacing,
      /*
       * From the key, which is the only place that says which kind a pool is.
       * A dynamic pool's current fee is left unread rather than guessed: the
       * hook sets it per swap and this read never asked the pool's state.
       */
      fee:
        raw.key.fee === DYNAMIC_FEE_FLAG
          ? { kind: "dynamic", currentFeePpm: null }
          : { kind: "static", feePpm: raw.key.fee },
      /* Not read here. A zero standing in for it would be a figure nobody read. */
      protocolFee: null,
      hookAddress: raw.key.hooks === ZERO_ADDRESS ? null : raw.key.hooks,
    },
    tickLower: raw.tickLower,
    tickUpper: raw.tickUpper,
    liquidity: raw.liquidity,
    uncollected: fees.get(raw.tokenId) ?? null,
    ...placed,
  });

  return verified.success ? verified.data : null;
};

/**
 * Each listed v3 position's record, when the history was asked for at all —
 * and nothing, not an empty map, when it was not, so the page can tell a
 * record nobody asked for from one there was none of.
 *
 * Built from the manager's own record of the position — the read the list
 * came from — and from the figures the list shows beside it: the pool's
 * decimals as verified, and the fees as read.
 */
const recordsFor = (
  listed: readonly Position[],
  v3: V3Side | null,
  historyAsked: boolean,
): ReadonlyMap<string, PositionRecordResult> | undefined => {
  if (!historyAsked) return undefined;
  const records = new Map<string, PositionRecordResult>();
  if (v3 === null) return records;

  const byTokenId = new Map(v3.raw.open.map((position) => [position.tokenId, position]));
  for (const position of listed) {
    if (position.pool.protocolVersion !== "v3") continue;
    const manager = byTokenId.get(position.tokenId);
    if (manager === undefined) continue;

    records.set(
      position.tokenId,
      composePositionRecord({
        position: manager,
        decimals: { token0: position.pool.token0.decimals, token1: position.pool.token1.decimals },
        history: historyOf(v3.history, position.tokenId),
        uncollected: position.uncollected,
        sqrtPriceX96: v3.sqrtPrices?.get(position.tokenId) ?? null,
      }),
    );
  }

  return records;
};

/**
 * Composes one address's answer from whichever protocols were read.
 *
 * The counts describe everything that was read, of both protocols together; the
 * list is capped for display and the page says how many are not on it. A
 * position dropped for failing its checks is missing from the list and still
 * counted as open, because it is one — the reader holds it whether or not this
 * application could describe it.
 */
export const composeAddressPositions = ({
  address,
  v3,
  v4,
  v4Asked = true,
  v3Asked = true,
  historyAsked = v3?.history !== undefined,
  fetchedAt,
}: AddressPositionsInput): AddressPositionsResult => {
  /* Nothing read is not a partial answer, and the caller reports the failure. */
  if (v3 === null && v4 === null) return { status: "unavailable", notice: UNVERIFIABLE };

  const byAddress = new Map((v3?.pools ?? []).map((entry) => [entry.pool.id, entry]));
  const byId = new Map((v4?.pools ?? []).map((entry) => [entry.poolId, entry]));

  const described = [
    ...(v3 === null
      ? []
      : v3.raw.open.map((position) => describeV3(position, v3.raw.factory, byAddress, v3.fees))),
    ...(v4 === null ? [] : v4.raw.open.map((position) => describeV4(position, byId, v4.fees))),
  ].filter((position): position is Position => position !== null);

  const sources: HoldingsSource[] = [];
  if (v3 !== null) sources.push("uniswap-v3-subgraph");
  if (v4 !== null) sources.push("uniswap-v4-subgraph");
  sources.push("ethereum-rpc");

  const unread: ProtocolVersion[] = [];
  /* Unread is a failure; a side never asked on this chain is not one. */
  if (v3 === null && v3Asked) unread.push("v3");
  if (v4 === null && v4Asked) unread.push("v4");

  /** Both protocols' figures added together, counting a protocol that was not read as nothing. */
  const counted = [v3?.raw, v4?.raw].filter((side) => side !== undefined);
  const total = (of: (side: RawV3Positions | RawV4Positions) => number) =>
    counted.reduce((running, side) => running + of(side), 0);

  const candidate = {
    address,
    positions: described.slice(0, POSITIONS_SHOWN),
    held: total((side) => side.held),
    read: total((side) => side.read),
    open: total((side) => side.open.length),
    closed: total((side) => side.closed),
    unread,
    fetchedAt,
    sources,
  };

  const verified = AddressPositionsSchema.safeParse(candidate);
  if (!verified.success) return { status: "unavailable", notice: UNVERIFIABLE };

  const records = recordsFor(verified.data.positions, v3, historyAsked);

  return { status: "success", data: verified.data, ...(records === undefined ? {} : { records }) };
};

/** The pool addresses one v3 read's positions derive to, for the source lookup. */
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

/** The pool ids one v4 read's positions name, already proved by the manager. */
export const heldPoolIds = (raw: RawV4Positions): readonly string[] => [
  ...new Set(raw.open.map((position) => position.poolId)),
];
