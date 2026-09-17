import { describe, expect, it } from "vitest";

import type { V4Pool, V4PoolCandidateList } from "../../schemas";
import { composeHookDirectory } from "./hookDirectory";

const FETCHED_AT = "2026-09-17T12:00:00.000Z";
const token = (address: string, symbol: string, decimals: number) => ({
  chainId: 1,
  address,
  symbol,
  decimals,
});
const USDC = token(`0x${"1".repeat(40)}`, "USDC", 6);
const WETH = token(`0x${"b".repeat(40)}`, "WETH", 18);

/*
 * Real hook shapes, because a hook's address *is* its permission list. The last
 * fourteen bits decide what the page says about it, so a fixture with made-up
 * trailing digits would be a fixture about a different hook.
 */
const SWAP_HOOK = `0x${"1".repeat(36)}00c4`; // beforeSwap, afterSwap, afterSwapReturnsDelta
const LIQUIDITY_HOOK = `0x${"2".repeat(36)}0800`; // beforeAddLiquidity alone
/*
 * No permission bits at all. `Hooks.isValidHookAddress` allows that only where
 * the pool's fee is dynamic — rewriting the fee is then the hook's whole job —
 * so its pool below is a dynamic-fee one, and the schema would refuse any other.
 */
const FEE_ONLY_HOOK = `0x${"3".repeat(36)}0000`;

const pool = (index: number, hookAddress: string | null, dynamic = false): V4Pool =>
  ({
    protocolVersion: "v4",
    chainId: 1,
    id: `0x${String(index).padStart(2, "0").repeat(32)}`,
    token0: USDC,
    token1: WETH,
    tickSpacing: 60,
    fee: dynamic ? { kind: "dynamic", currentFeePpm: null } : { kind: "static", feePpm: 3000 },
    protocolFee: null,
    hookAddress,
  }) as unknown as V4Pool;

const list = (pools: readonly V4Pool[]): V4PoolCandidateList =>
  ({
    pools,
    poolManager: `0x${"9".repeat(40)}`,
    createdAtBlockNumbers: {},
    fetchedAt: FETCHED_AT,
    source: "uniswap-v4-subgraph",
  }) as unknown as V4PoolCandidateList;

const succeed = (pools: readonly V4Pool[]) => {
  const result = composeHookDirectory(list(pools));
  if (result.status === "unavailable") throw new Error(`expected a directory: ${result.notice}`);
  return result.data;
};

describe("composeHookDirectory", () => {
  it("gathers each hook once, with the pools that name it", () => {
    const directory = succeed([
      pool(1, SWAP_HOOK),
      pool(2, null),
      pool(3, SWAP_HOOK),
      pool(4, LIQUIDITY_HOOK),
    ]);

    expect(directory.hooks).toHaveLength(2);
    expect(directory.hooks[0]?.address).toBe(SWAP_HOOK);
    expect(directory.hooks[0]?.poolCount).toBe(2);
    expect(directory.hooks[1]?.address).toBe(LIQUIDITY_HOOK);
    expect(directory.hooks[1]?.poolCount).toBe(1);
  });

  it("counts every pool exactly once, under a hook or as hookless", () => {
    const directory = succeed([pool(1, SWAP_HOOK), pool(2, null), pool(3, null)]);

    expect(directory.poolsConsidered).toBe(3);
    expect(directory.hooklessPools).toBe(2);
  });

  /*
   * A count, not a ranking of anything else. It has to be total, or the same
   * week's pools would produce a different page on each render.
   */
  it("orders by how many pools run each hook", () => {
    const directory = succeed([
      pool(1, LIQUIDITY_HOOK),
      pool(2, SWAP_HOOK),
      pool(3, SWAP_HOOK),
    ]);

    expect(directory.hooks.map((entry) => entry.address)).toEqual([SWAP_HOOK, LIQUIDITY_HOOK]);
  });

  it("breaks a tie by which hook's busiest pool came first", () => {
    const directory = succeed([pool(1, LIQUIDITY_HOOK), pool(2, SWAP_HOOK)]);

    expect(directory.hooks.map((entry) => entry.address)).toEqual([LIQUIDITY_HOOK, SWAP_HOOK]);
  });

  it("reads each hook's permissions out of its own address", () => {
    const directory = succeed([
      pool(1, SWAP_HOOK),
      pool(2, LIQUIDITY_HOOK),
      pool(3, FEE_ONLY_HOOK, true),
    ]);
    const permissionsOf = (address: string) =>
      directory.hooks.find((entry) => entry.address === address)?.permissions;

    expect(permissionsOf(SWAP_HOOK)).toEqual([
      "beforeSwap",
      "afterSwap",
      "afterSwapReturnsDelta",
    ]);
    expect(permissionsOf(LIQUIDITY_HOOK)).toEqual(["beforeAddLiquidity"]);
    /* Legal on a dynamic-fee pool, and worth showing as what it is. */
    expect(permissionsOf(FEE_ONLY_HOOK)).toEqual([]);
  });

  it("lists only the busiest few of a hook's pools, and counts the rest", () => {
    const many = Array.from({ length: 9 }, (_unused, index) => pool(index + 1, SWAP_HOOK));
    const entry = succeed(many).hooks[0];

    expect(entry?.poolCount).toBe(9);
    expect(entry?.pools).toHaveLength(4);
    expect(entry?.pools[0]?.id).toBe(many[0]?.id);
  });

  it("answers a week in which nothing named a hook", () => {
    const directory = succeed([pool(1, null), pool(2, null)]);

    expect(directory.hooks).toEqual([]);
    expect(directory.hooklessPools).toBe(2);
  });

  it("carries the read's own moment and source rather than a new one", () => {
    const directory = succeed([pool(1, SWAP_HOOK)]);

    expect(directory.fetchedAt).toBe(FETCHED_AT);
    expect(directory.source).toBe("uniswap-v4-subgraph");
  });

  it("publishes nothing when the list does not survive its own schema", () => {
    const result = composeHookDirectory(list([]));

    expect(result).toEqual({ status: "unavailable", notice: "hook-directory-unverifiable" });
  });
});
