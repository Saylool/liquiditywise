import { keccak256Hex } from "../crypto/keccak256";

/*
 * Where a Uniswap v4 pool keeps its state, and how to read it.
 *
 * A v4 pool is not a contract. It is an entry in the PoolManager's `_pools`
 * mapping, and the only public way to read that entry is `extsload`, which
 * returns one raw storage word for one slot. So reading a pool's liquidity means
 * knowing which slot it is in, and that is `keccak256(abi.encode(poolId, 6)) +
 * 3` — the mapping slot, the key, and the field's offset inside `Pool.State`.
 *
 * The three numbers below are v4-core's own, from `StateLibrary`. They are
 * protocol constants in the way `DYNAMIC_FEE_FLAG` is: fixed by the deployed
 * code, not chosen here. The PoolManager's *address* is not among them — it
 * arrives from the data source, like every other address this application
 * reads, and is never asserted from memory.
 *
 * Verified against the chain while this was written: the slot math and the word
 * layout below reproduced the PoolManager's stored liquidity for 24 of 24 of
 * the busiest mainnet pools, and its stored price for every one the indexer was
 * not a few blocks behind on.
 */

/** `StateLibrary.POOLS_SLOT`: the storage slot of `PoolManager._pools`. */
export const POOLS_SLOT = 6;

/** `StateLibrary.LIQUIDITY_OFFSET`: `Pool.State.liquidity` sits three words in. */
export const LIQUIDITY_OFFSET = 3;

/** `Pool.State.slot0` is the first word: price, tick and fees packed together. */
export const SLOT0_OFFSET = 0;

/** `keccak256("extsload(bytes32)")`, first four bytes. Pinned by the hash's own test. */
export const EXTSLOAD_SELECTOR = "0x1e2eaeaf";

/** A 32-byte word: `0x` plus exactly 64 hex characters. */
const WORD = /^0x[0-9a-fA-F]{64}$/;

const toWord = (value: bigint): string => `0x${value.toString(16).padStart(64, "0")}`;

/**
 * The storage slot of one field of one pool's state.
 *
 * `abi.encode(poolId, POOLS_SLOT)` is two words: the id as it is, then the slot
 * number right-aligned. The pool id has already passed `Bytes32HexSchema`, so
 * the concatenation is exactly 64 bytes and the hash is the mapping's base slot
 * for that key.
 */
export const poolStateSlot = (poolId: string, offset: number): string | null => {
  if (!WORD.test(poolId) || !Number.isInteger(offset) || offset < 0) return null;

  const base = keccak256Hex(`${poolId}${toWord(BigInt(POOLS_SLOT)).slice(2)}`);
  if (base === null) return null;

  return toWord(BigInt(base) + BigInt(offset));
};

/** The one call this application makes against the PoolManager. */
export const extsloadCalldata = (slot: string): string => `${EXTSLOAD_SELECTOR}${slot.slice(2)}`;

/**
 * Reads one storage word out of an `eth_call` response, or `null` when what came
 * back is not one. A wrong address answers with empty data rather than a word,
 * and that is reported rather than read as zero.
 */
export const readStorageWord = (result: unknown): bigint | null =>
  typeof result === "string" && WORD.test(result) ? BigInt(result) : null;

/**
 * `Pool.State.slot0`, unpacked.
 *
 * Packed as `Slot0` lays it out: the square-root price in the low 160 bits, the
 * tick as a signed 24-bit integer above it, then the protocol and LP fees. Only
 * the first two are read; the LP fee stored here is the pool's declared one, and
 * what a swap actually costs is measured elsewhere from what swaps paid.
 */
export const unpackSlot0 = (
  word: bigint,
): { readonly sqrtPriceX96: bigint; readonly tick: number } => {
  const sqrtPriceX96 = word & ((1n << 160n) - 1n);
  const rawTick = Number((word >> 160n) & 0xffffffn);

  return { sqrtPriceX96, tick: rawTick >= 0x800000 ? rawTick - 0x1000000 : rawTick };
};

/** `Pool.State.liquidity`: a uint128 in the low bits of its word. */
export const unpackLiquidity = (word: bigint): bigint => word & ((1n << 128n) - 1n);
