import { argumentWord, decodeAddress, decodePackedInt24, decodeUint, words } from "./abiWords";
import { poolIdOf, type V4PoolKey } from "./v4PoolKey";

/*
 * The contract that holds Uniswap v4 positions, and how to ask it what one is.
 *
 * Pure: no network, no environment. Every function turns arguments into
 * calldata or an answer into a value, and the answer is checked rather than
 * sliced and believed.
 *
 * **A v4 position cannot be enumerated from the chain.** The v3 manager
 * implements ERC-721's optional `Enumerable` extension, so an owner's tokens can
 * be walked by index; this one does not — measured on 2026-09-18,
 * `tokenOfOwnerByIndex` reverts. So the ids have to come from an indexer, and
 * this module's job is to make that safe: every id the indexer offers is put
 * back to the manager, and a token the manager does not say this address owns is
 * not this address's position whatever the indexer said.
 *
 * **What a position is, it is in one answer.** `getPoolAndPositionInfo` returns
 * the pool's whole key beside a word with the ticks packed into it, so unlike v3
 * there is nothing to derive and nothing sequential: one aggregated call carries
 * an owner's entire list. Measured on 2026-09-18, 312 calls for 104 positions
 * came back in 401ms.
 *
 * **The address is a claim; the code at it is the check.** The runtime hash
 * below covers the PoolManager address compiled into it as an immutable, so a
 * manager that hashes right is this deployment's manager and not another
 * chain's or another version's.
 */

/** The `PositionManager` on Ethereum mainnet. */
export const V4_POSITION_MANAGER_ADDRESS = "0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e";

/**
 * `keccak256` of its deployed runtime, read from mainnet on 2026-09-18: 23,877
 * bytes. It has no upgrade path, so the code at that address is all there is to
 * know about it and it does not change.
 */
export const V4_POSITION_MANAGER_CODE_HASH =
  "0x77e36c08b19959a30dde46dec9abe6208e371ff2f56884a56fe1e1a53615528b";

/**
 * The four-byte selectors, each the first four bytes of the keccak of its own
 * signature. Written out rather than hashed at load, and a test derives every
 * one of them from its signature so a wrong digit cannot survive.
 *
 * The first two are ERC-721's and so are byte-for-byte the v3 manager's. Stated
 * again here rather than imported from it: they are this contract's interface
 * as much as that one's, and the test that derives them proves it.
 */
export const V4_BALANCE_OF_SELECTOR = "0x70a08231";
export const OWNER_OF_SELECTOR = "0x6352211e";
export const POOL_AND_POSITION_INFO_SELECTOR = "0x7ba03aad";
export const POSITION_LIQUIDITY_SELECTOR = "0x1efeed33";

const ADDRESS = /^0x[0-9a-f]{40}$/;
const DECIMAL = /^[0-9]+$/;

/** True when a returned `eth_getCode` is the manager this was built against. */
export const isV4PositionManagerCode = (
  code: unknown,
  hashOf: (hex: string) => string | null,
): boolean => typeof code === "string" && hashOf(code) === V4_POSITION_MANAGER_CODE_HASH;

/** `balanceOf(owner)`: how many position tokens an address holds. */
export const v4BalanceOfCalldata = (owner: string): string | null =>
  ADDRESS.test(owner) ? `${V4_BALANCE_OF_SELECTOR}${argumentWord(owner)}` : null;

/** `ownerOf(tokenId)`: who holds one, which is the check on every id offered. */
export const ownerOfCalldata = (tokenId: string): string | null =>
  DECIMAL.test(tokenId) ? `${OWNER_OF_SELECTOR}${argumentWord(BigInt(tokenId).toString(16))}` : null;

/** `getPoolAndPositionInfo(tokenId)`: the pool's key and the position's ticks. */
export const poolAndPositionInfoCalldata = (tokenId: string): string | null =>
  DECIMAL.test(tokenId)
    ? `${POOL_AND_POSITION_INFO_SELECTOR}${argumentWord(BigInt(tokenId).toString(16))}`
    : null;

/** `getPositionLiquidity(tokenId)`: the protocol's L, zero once it is closed. */
export const positionLiquidityCalldata = (tokenId: string): string | null =>
  DECIMAL.test(tokenId)
    ? `${POSITION_LIQUIDITY_SELECTOR}${argumentWord(BigInt(tokenId).toString(16))}`
    : null;

/** What one position is, as the manager describes it and before anything is made of it. */
export type RawV4Position = {
  readonly tokenId: string;
  /** The pool's key, and the pool's id is the keccak of it. */
  readonly key: V4PoolKey;
  /** Proved here: the key hashes to it, and the packed word carries its first 25 bytes. */
  readonly poolId: string;
  readonly tickLower: number;
  readonly tickUpper: number;
  /** Zero for a position that has been closed. Kept as an exact decimal string. */
  readonly liquidity: string;
};

/** Everything one `getPoolAndPositionInfo` answer says. The liquidity is another call's. */
export type V4PositionDescription = Omit<RawV4Position, "tokenId" | "liquidity">;

/**
 * Reads one `getPoolAndPositionInfo(tokenId)` answer.
 *
 * Six words: the key's five fields, then one word with everything else about
 * the position packed into it — 200 bits of the pool's id, then the two ticks
 * at 24 bits each, then a flag byte for whether the position has a subscriber.
 *
 * **The two halves check each other.** The key is hashed and the result must
 * begin with the 25 bytes the packed word carries, which is the same proof the
 * `Initialize` log reader makes and it costs nothing here: a misread offset, a
 * word that is not a key's, a fee or a spacing outside its own range, and the
 * hash comes out somewhere else. What the manager returns for a token nobody
 * minted is six zero words, and zeros do not hash to zeros — so the answer for
 * a position that does not exist is refused by the same check.
 *
 * The ticks are packed, so they are read from their own 24 bits rather than
 * from a sign-extended word. Getting that backwards turns every position whose
 * range dips below a price of one into a range at the top of the tick space.
 */
export const decodePoolAndPositionInfo = (data: unknown): V4PositionDescription | null => {
  const parts = words(data);
  if (parts === null || parts.length !== 6) return null;

  const currency0 = decodeAddress(data, 0);
  const currency1 = decodeAddress(data, 1);
  const fee = decodeUint(data, 2);
  const tickSpacing = decodeUint(data, 3);
  const hooks = decodeAddress(data, 4);
  const packed = parts[5];
  if (currency0 === null || currency1 === null || hooks === null) return null;
  if (fee === null || tickSpacing === null || packed === undefined) return null;

  /*
   * Whole words, not their low bits. A uint24 or an int24 the ABI encoded has
   * nothing above its own bits, so a word that does is not one — and `poolIdOf`
   * refuses the key it would make, both by its own range checks and because the
   * hash of a key with a field it cannot hold matches nothing.
   */
  const key: V4PoolKey = {
    currency0,
    currency1,
    fee: Number(fee),
    tickSpacing: Number(tickSpacing),
    hooks,
  };

  const poolId = poolIdOf(key);
  if (poolId === null || poolId.slice(2, 52) !== packed.slice(0, 50)) return null;

  const tickUpper = decodePackedInt24(packed.slice(50, 56));
  const tickLower = decodePackedInt24(packed.slice(56, 62));
  if (tickUpper === null || tickLower === null || tickLower >= tickUpper) return null;

  return { key, poolId, tickLower, tickUpper };
};
