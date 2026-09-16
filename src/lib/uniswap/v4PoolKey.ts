import { z } from "zod";

import { keccak256Hex } from "../crypto/keccak256";

/*
 * A v4 pool's key, read from the one place it is written: the `Initialize`
 * event the PoolManager emitted when the pool was created.
 *
 * The key is what a pool *is* — two currencies, a fee, a tick spacing and a
 * hook — and the pool's id is the keccak256 of it, so a key that hashes to the
 * id is the pool's key beyond argument. That is the check made here on every
 * log, and it is why nothing decoded below has to be taken on trust: a wrong
 * word, a wrong offset, a log for another pool, and the hash comes out
 * different.
 *
 * This exists because the indexer's `feeTier` turned out not to be the key's
 * fee at all. Measured on 2026-09-15, it was the total fee of the pool's latest
 * swap — LP fee and protocol fee combined — so it ran a quarter above the LP fee
 * on every hookless pool and moved from hour to hour on a hooked one, whose key
 * carries no fee at all but the dynamic-fee flag. The chain is the only source
 * that says which of those a pool is.
 */

/** `keccak256("Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)")`. Pinned by its own test. */
export const INITIALIZE_TOPIC =
  "0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438";

/** The event's signature, as the topic above is derived from it. */
export const INITIALIZE_SIGNATURE =
  "Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)";

/**
 * `LPFeeLibrary.DYNAMIC_FEE_FLAG`, the sentinel a PoolKey carries instead of a
 * fee when the hook sets one per swap.
 *
 * Far above `MAX_LP_FEE`, which is what makes it unambiguous: no real fee can
 * collide with it. It is a wire-format detail and stops at the adapter —
 * nothing above it ever sees the number, only `{ kind: "dynamic" }`.
 */
export const DYNAMIC_FEE_FLAG = 0x800000;

/** The five fields the id is the hash of, exactly as the log carries them. */
export type V4PoolKey = {
  readonly currency0: string;
  readonly currency1: string;
  /** The fee field as stored: parts-per-million, or {@link DYNAMIC_FEE_FLAG}. */
  readonly fee: number;
  readonly tickSpacing: number;
  /** Lower-cased. The zero address when the pool runs without a hook. */
  readonly hooks: string;
};

const ADDRESS = /^0x[0-9a-f]{40}$/;
const WORD = /^0x[0-9a-fA-F]{64}$/;
/** The five non-indexed parameters: fee, tickSpacing, hooks, sqrtPriceX96, tick. */
const DATA = /^0x[0-9a-fA-F]{320}$/;
const UINT24_MAX = 0xffffff;
/** The largest int24, which is also the largest tick spacing a key can hold. */
const INT24_MAX = 0x7fffff;

const wordOf = (value: bigint): string => value.toString(16).padStart(64, "0");
const addressWord = (address: string): string => address.slice(2).padStart(64, "0");

/** An address from a word, or `null` when the word's upper twelve bytes are not zero. */
const addressFromWord = (word: string): string | null => {
  const hex = word.slice(2).toLowerCase();

  return hex.slice(0, 24) === "0".repeat(24) ? `0x${hex.slice(24)}` : null;
};

/**
 * `keccak256(abi.encode(key))`: what the PoolManager names a pool by.
 *
 * `abi.encode` of a struct of five static fields is five words: each address
 * right-aligned, the fee as a uint24, the spacing as an int24. Written out
 * here rather than imported so that the check it serves does not depend on a
 * library agreeing with itself.
 *
 * A negative spacing is refused rather than encoded: the protocol admits none
 * (`MIN_TICK_SPACING` is one), so no pool's id was ever hashed from one, and
 * a key claiming one is not a key.
 */
export const poolIdOf = (key: V4PoolKey): string | null => {
  if (![key.currency0, key.currency1, key.hooks].every((address) => ADDRESS.test(address))) {
    return null;
  }
  if (!Number.isInteger(key.fee) || key.fee < 0 || key.fee > UINT24_MAX) return null;
  if (!Number.isInteger(key.tickSpacing) || key.tickSpacing < 0 || key.tickSpacing > INT24_MAX) {
    return null;
  }

  return keccak256Hex(
    `0x${addressWord(key.currency0)}${addressWord(key.currency1)}${wordOf(BigInt(key.fee))}${wordOf(BigInt(key.tickSpacing))}${addressWord(key.hooks)}`,
  );
};

/** The untrusted edge: what a JSON-RPC log looks like, and nothing more is read. */
const RawLogSchema = z.object({
  address: z.string(),
  topics: z.array(z.string()),
  data: z.string(),
});

/**
 * Reads one pool's key out of its `Initialize` log, or `null` when the log is
 * not that pool's, not the PoolManager's, or does not decode to a key that
 * hashes to the pool's id.
 *
 * Every field is checked rather than sliced and believed: the emitting
 * address, the event topic, the id topic, the two currency topics, the width
 * of the data — and then the whole key is hashed and compared with the id,
 * which catches anything the checks above did not, a fee or a spacing the
 * words cannot hold included.
 */
export const decodeInitializeLog = (
  log: unknown,
  expected: { readonly poolManager: string; readonly poolId: string },
): V4PoolKey | null => {
  const parsed = RawLogSchema.safeParse(log);
  if (!parsed.success) return null;
  const { address, topics, data } = parsed.data;

  if (address.toLowerCase() !== expected.poolManager.toLowerCase()) return null;
  if (topics.length !== 4 || !topics.every((topic) => WORD.test(topic))) return null;
  const [eventTopic, idTopic, currency0Topic, currency1Topic] = topics as [
    string,
    string,
    string,
    string,
  ];
  if (eventTopic.toLowerCase() !== INITIALIZE_TOPIC) return null;
  if (idTopic.toLowerCase() !== expected.poolId.toLowerCase()) return null;
  if (!DATA.test(data)) return null;

  const currency0 = addressFromWord(currency0Topic);
  const currency1 = addressFromWord(currency1Topic);
  const words = Array.from({ length: 5 }, (_, index) =>
    BigInt(`0x${data.slice(2 + index * 64, 2 + index * 64 + 64)}`),
  ) as [bigint, bigint, bigint, bigint, bigint];
  const hooks = addressFromWord(`0x${wordOf(words[2])}`);
  if (currency0 === null || currency1 === null || hooks === null) return null;

  /*
   * Whole words, not their low bits. A uint24 or an int24 the ABI encoded has
   * nothing above its own bits, so a word that does is not one — and the id
   * check below refuses the key it would make, because a fee or a spacing
   * outside the key's own range hashes to nothing.
   */
  const key: V4PoolKey = {
    currency0,
    currency1,
    fee: Number(words[0]),
    tickSpacing: Number(words[1]),
    hooks,
  };

  return poolIdOf(key) === expected.poolId.toLowerCase() ? key : null;
};
