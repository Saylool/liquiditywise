import type { V4ChainId } from "../chains/chains";
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

/** The `PositionManager` on Ethereum mainnet; every chain's is in {@link V4_POSITION_MANAGERS}. */
export const V4_POSITION_MANAGER_ADDRESS = "0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e";

/**
 * `keccak256` of its deployed runtime, read from mainnet on 2026-09-18: 23,877
 * bytes. It has no upgrade path, so the code at that address is all there is to
 * know about it and it does not change.
 */
export const V4_POSITION_MANAGER_CODE_HASH =
  "0x77e36c08b19959a30dde46dec9abe6208e371ff2f56884a56fe1e1a53615528b";

/**
 * The manager on every chain v4 is read on, each with the hash of its own
 * runtime.
 *
 * Same length everywhere — 23,877 bytes — and a different hash on each chain,
 * because the runtime carries that chain's PoolManager (and its WETH and
 * descriptor) as immutables. Read on 2026-09-27 and hashed with the keccak
 * that reproduces mainnet's; each manager's own `poolManager()` answered the
 * PoolManager Uniswap publishes for its chain — 0x498581ff…2b2b on Base,
 * 0x360e68fa…fb32 on Arbitrum. Base's runtime is a test fixture
 * (testing/base-v4-position-manager.hex).
 */
export const V4_POSITION_MANAGERS: Readonly<Record<V4ChainId, { readonly address: string; readonly codeHash: string }>> = {
  1: { address: V4_POSITION_MANAGER_ADDRESS, codeHash: V4_POSITION_MANAGER_CODE_HASH },
  8453: {
    address: "0x7c5f5a4bbd8fd63184577525326123b519429bdc",
    codeHash: "0x243f9e091ddf11c7c04e28059fdbbf1bab82b72d414fafb8e096c097aaeb622a",
  },
  42161: {
    address: "0xd88f38f930b7952f2db2432cb002e7abbf3dd869",
    codeHash: "0x6156ddaa1c8cd2c26d37455a5dc57b1761dc2848856426c0ac261ae0c7fecd68",
  },
  /* Read the same way on 2026-09-27: 23,877 bytes, the PositionManager Uniswap publishes for Unichain. */
  130: {
    address: "0x4529a01c7a0410167c5740c487a8de60232617bf",
    codeHash: "0x9b8dd0bc00039cced1336c17f2933187219b9812e18b1310b688de7ae961b25f",
  },
  /*
   * And on 2026-09-27 again: poolManager() answered 0x9a13f98c…4ec3 on OP
   * Mainnet and 0x67366782…5cd6 on Polygon. Both runtimes are test
   * fixtures (testing/optimism-… and polygon-v4-position-manager.hex).
   */
  10: {
    address: "0x3c3ea4b57a46241e54610e5f022e5c45859a1017",
    codeHash: "0xe4322627bfc2ef92e06ca70f93e897a78882ec7023c411c498846e87318f37de",
  },
  137: {
    address: "0x1ec2ebf4f37e7363fdfe3551602425af0b3ceef9",
    codeHash: "0x876d8664907d1fa2b3f00e6f49671585abd614c836f110b36c1e76fd407e67ba",
  },
  /*
   * Read on 2026-10-04: 23,877 bytes on both, poolManager() answered
   * 0x28e2ea09…e9df on BNB Chain and 0x06380c0e…bc85 on Avalanche — the
   * PoolManagers Uniswap publishes there, and the ones each chain's v4
   * subgraph indexes — and WETH9() is WBNB and WAVAX. Both runtimes are test
   * fixtures (testing/bnb-… and avalanche-v4-position-manager.hex). Celo is not
   * here: v4 is not read on it (chains.ts).
   */
  56: {
    address: "0x7a4a5c919ae2541aed11041a1aeee68f1287f95b",
    codeHash: "0x07867576e9a6a0fdcead21a487dce04eae6161fb350edc8c56954c09fa015ef0",
  },
  43114: {
    address: "0xb74b1f14d2754acfcbbe1a221023a5cf50ab8acd",
    codeHash: "0xabd80e476783c8cf55c44af17dcc96990359b5999a61075fd2402858f92311ff",
  },
};

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
/*
 * `poolManager()`. Where a v4 pool's state actually lives, asked of the one
 * contract whose code this application has already proved — rather than
 * written down here, which would be a second address to trust.
 */
export const POOL_MANAGER_SELECTOR = "0xdc4c90d3";

const ADDRESS = /^0x[0-9a-f]{40}$/;
const DECIMAL = /^[0-9]+$/;

/** True when a returned `eth_getCode` is the manager this was built against, on the chain it was read from. */
export const isV4PositionManagerCode = (
  code: unknown,
  hashOf: (hex: string) => string | null,
  chainId: V4ChainId = 1,
): boolean => typeof code === "string" && hashOf(code) === V4_POSITION_MANAGERS[chainId].codeHash;

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
