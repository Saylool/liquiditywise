import { keccak256Hex } from "../crypto/keccak256";
import { poolStateSlot } from "./v4PoolStateSlots";

/*
 * Where a v4 pool keeps a tick's fee totals and a position's own record.
 *
 * A v4 pool is an entry in the PoolManager's storage rather than a contract, so
 * these are not calls but slots, read one word at a time through `extsload`.
 * The two offsets below are v4-core's own, from `StateLibrary`, and sit beside
 * `POOLS_SLOT` and `LIQUIDITY_OFFSET` in the same struct.
 *
 * **The position key is what makes this safe to compute.** A position is keyed
 * by who holds it, its two ticks and a salt, hashed together — and the
 * PositionManager uses the token id as the salt. So a derivation that is wrong
 * in any of those four lands on a slot that holds something else entirely. That
 * is checked rather than assumed: the liquidity at the derived slot must equal
 * what the manager reports for the same token, and a position where the two
 * disagree is dropped. Measured on 2026-09-18 against 26 live positions, all 26
 * agreed.
 */

/** `StateLibrary.TICKS_OFFSET`: `Pool.State.ticks` is the fifth field. */
export const TICKS_OFFSET = 4;

/** `StateLibrary.POSITIONS_OFFSET`: `Pool.State.positions` is the seventh. */
export const POSITIONS_OFFSET = 6;

/** Inside `Pool.TickInfo`: the two liquidity figures share the first word. */
const TICK_FEE_GROWTH_0_OFFSET = 1n;
const TICK_FEE_GROWTH_1_OFFSET = 2n;

/** Inside `Position.State`: liquidity first, then the two snapshots. */
const POSITION_FEE_GROWTH_0_OFFSET = 1n;
const POSITION_FEE_GROWTH_1_OFFSET = 2n;

const WORD = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-f]{40}$/;

const toWord = (value: bigint): string => `0x${value.toString(16).padStart(64, "0")}`;
const offsetFrom = (slot: string, offset: bigint): string => toWord(BigInt(slot) + offset);

/** An `int24` as three bytes, which is how `abi.encodePacked` writes one. */
const packedTick = (tick: number): string =>
  BigInt.asUintN(24, BigInt(tick)).toString(16).padStart(6, "0");

/** Where a mapping keyed by a full word keeps one entry. */
const entrySlot = (key: string, base: string): string | null =>
  keccak256Hex(`0x${key.slice(2)}${base.slice(2)}`);

/** The two fee totals one tick records, by slot. */
export const tickFeeGrowthSlots = (
  poolId: string,
  tick: number,
): { readonly outside0: string; readonly outside1: string } | null => {
  if (!Number.isInteger(tick)) return null;
  const base = poolStateSlot(poolId, TICKS_OFFSET);
  if (base === null) return null;

  const entry = entrySlot(toWord(BigInt.asUintN(256, BigInt(tick))), base);
  if (entry === null) return null;

  return {
    outside0: offsetFrom(entry, TICK_FEE_GROWTH_0_OFFSET),
    outside1: offsetFrom(entry, TICK_FEE_GROWTH_1_OFFSET),
  };
};

/**
 * `Position.calculatePositionKey`: `keccak256(abi.encodePacked(owner,
 * tickLower, tickUpper, salt))`.
 *
 * Packed, not padded — 20 bytes, then three, then three, then 32 — which is why
 * the ticks are written as their own three bytes here rather than as words.
 */
export const v4PositionKey = ({
  owner,
  tickLower,
  tickUpper,
  salt,
}: {
  readonly owner: string;
  readonly tickLower: number;
  readonly tickUpper: number;
  /** The token id, which is what the PositionManager salts a position with. */
  readonly salt: bigint;
}): string | null => {
  if (!ADDRESS.test(owner)) return null;
  if (!Number.isInteger(tickLower) || !Number.isInteger(tickUpper)) return null;
  if (salt < 0n || salt >= 1n << 256n) return null;

  return keccak256Hex(
    `0x${owner.slice(2)}${packedTick(tickLower)}${packedTick(tickUpper)}${toWord(salt).slice(2)}`,
  );
};

/** Where one position's own record sits: its liquidity and its two snapshots. */
export const v4PositionSlots = (
  poolId: string,
  positionKey: string,
): { readonly liquidity: string; readonly last0: string; readonly last1: string } | null => {
  if (!WORD.test(positionKey)) return null;
  const base = poolStateSlot(poolId, POSITIONS_OFFSET);
  if (base === null) return null;

  const entry = entrySlot(positionKey, base);
  if (entry === null) return null;

  return {
    liquidity: entry,
    last0: offsetFrom(entry, POSITION_FEE_GROWTH_0_OFFSET),
    last1: offsetFrom(entry, POSITION_FEE_GROWTH_1_OFFSET),
  };
};
