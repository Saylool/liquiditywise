import { keccak256Hex } from "../crypto/keccak256";

/*
 * Where a v3 pool lives, computed rather than looked up.
 *
 * Pure: no network, no environment. A v3 pool is deployed by the factory with
 * CREATE2, so its address is fixed by the factory, the two token addresses and
 * the fee — and anybody holding those four things can work out where the pool is
 * without asking. That is the only way to get from a position, which names its
 * pair and its fee and nothing else, to the pool the position is in.
 *
 * **Two of the four are not taken on trust.** The factory is read from the
 * position manager's own `factory()` rather than written down here. The init
 * code hash cannot be read from anywhere — it is the hash of the pool's creation
 * bytecode, which no live contract publishes — so it is pinned, and pinning it
 * is safe because it is checked twice over: the derivation is tested against a
 * pool address the indexer published for a real position, and at runtime every
 * derived address is looked up and must come back describing the same two
 * tokens and the same fee. A wrong hash finds nothing, not something else.
 */

/**
 * `keccak256(type(UniswapV3Pool).creationCode)`, from v3-core's
 * `PoolAddress.POOL_INIT_CODE_HASH`.
 *
 * Verified on 2026-09-18 by deriving the pool of a live position — XOR/WETH at
 * the 1% tier, token #1112391 — and landing on
 * `0x7f63306a62c345365881e0fff85cb2c8baaa13d5`, which is the address the indexer
 * publishes for it. Deriving with the position manager in the factory's place
 * produced a different address, which is the control that says the inputs are
 * doing the work.
 */
export const V3_POOL_INIT_CODE_HASH =
  "0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54";

const ADDRESS = /^0x[0-9a-f]{40}$/;

/** A 32-byte word from a hex value, left-padded. Addresses and fees both fit. */
const word = (value: string): string => value.replace(/^0x/, "").toLowerCase().padStart(64, "0");

export type V3PoolAddressInput = {
  /** The factory that deployed it, read from the chain rather than written here. */
  readonly factory: string;
  /** In the pool's own order: `token0 < token1` by address. */
  readonly token0: string;
  readonly token1: string;
  readonly feePpm: number;
};

/**
 * The address of the pool for one `(token0, token1, fee)` triple.
 *
 * `null` when an input is not what it claims to be — an address that is not
 * forty lowercase hex characters, a fee that is not a non-negative safe integer,
 * or a pair the wrong way round. The last one matters: the factory sorts the
 * pair before hashing, so deriving from an unsorted pair produces a real-looking
 * address with no pool at it.
 */
export const v3PoolAddress = ({
  factory,
  token0,
  token1,
  feePpm,
}: V3PoolAddressInput): string | null => {
  if (!ADDRESS.test(factory) || !ADDRESS.test(token0) || !ADDRESS.test(token1)) return null;
  if (!Number.isSafeInteger(feePpm) || feePpm < 0) return null;
  if (token0 >= token1) return null;

  const salt = keccak256Hex(`0x${word(token0)}${word(token1)}${word(feePpm.toString(16))}`);
  if (salt === null) return null;

  const hashed = keccak256Hex(
    `0xff${factory.slice(2)}${salt.slice(2)}${V3_POOL_INIT_CODE_HASH.slice(2)}`,
  );
  if (hashed === null) return null;

  return `0x${hashed.slice(-40)}`;
};
