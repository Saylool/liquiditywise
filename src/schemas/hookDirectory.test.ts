import { describe, expect, it } from "vitest";

import { HOOK_DIRECTORY_POOLS_SHOWN, HookDirectorySchema } from "./hookDirectory";

const HOOK = `0x${"1".repeat(36)}00c4`;
const OTHER = `0x${"2".repeat(36)}0800`;
const token = (address: string, symbol: string, decimals: number) => ({
  chainId: 1,
  address,
  symbol,
  decimals,
});

const pool = (index: number, hookAddress: string) => ({
  protocolVersion: "v4",
  chainId: 1,
  id: `0x${String(index).padStart(2, "0").repeat(32)}`,
  token0: token(`0x${"1".repeat(40)}`, "USDC", 6),
  token1: token(`0x${"b".repeat(40)}`, "WETH", 18),
  tickSpacing: 60,
  fee: { kind: "static", feePpm: 3000 },
  protocolFee: null,
  hookAddress,
});

const directory = (overrides: Record<string, unknown> = {}) => ({
  hooks: [
    {
      address: HOOK,
      permissions: ["beforeSwap", "afterSwap", "afterSwapReturnsDelta"],
      poolCount: 3,
      pools: [pool(1, HOOK), pool(2, HOOK)],
    },
  ],
  poolsConsidered: 10,
  hooklessPools: 7,
  fetchedAt: "2026-09-17T12:00:00.000Z",
  source: "uniswap-v4-subgraph",
  ...overrides,
});

describe("HookDirectorySchema", () => {
  it("accepts a directory of the shape the composition produces", () => {
    expect(HookDirectorySchema.safeParse(directory()).success).toBe(true);
  });

  it("accepts a week in which nothing named a hook", () => {
    expect(
      HookDirectorySchema.safeParse(directory({ hooks: [], hooklessPools: 10 })).success,
    ).toBe(true);
  });

  /*
   * The one check that would catch a pool dropped between the two buckets,
   * which would look like a quieter week rather than a bug.
   */
  it("refuses a directory whose pools do not add up", () => {
    const result = HookDirectorySchema.safeParse(directory({ hooklessPools: 6 }));

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === "poolsConsidered")).toBe(true);
  });

  it("refuses the same hook twice", () => {
    const twice = directory();
    const result = HookDirectorySchema.safeParse({
      ...twice,
      hooks: [twice.hooks[0], { ...twice.hooks[0], poolCount: 0 }],
    });

    expect(result.success).toBe(false);
  });

  it("refuses a pool filed under a hook it does not name", () => {
    const wrong = directory({
      hooks: [
        {
          address: HOOK,
          permissions: [],
          poolCount: 1,
          pools: [pool(1, OTHER)],
        },
      ],
      poolsConsidered: 8,
      hooklessPools: 7,
    });

    expect(HookDirectorySchema.safeParse(wrong).success).toBe(false);
  });

  it("refuses an entry listing more pools than it runs", () => {
    const wrong = directory({
      hooks: [{ address: HOOK, permissions: [], poolCount: 1, pools: [pool(1, HOOK), pool(2, HOOK)] }],
      poolsConsidered: 8,
      hooklessPools: 7,
    });

    expect(HookDirectorySchema.safeParse(wrong).success).toBe(false);
  });

  it("refuses an entry listing more pools than the page shows", () => {
    const pools = Array.from({ length: HOOK_DIRECTORY_POOLS_SHOWN + 1 }, (_unused, index) =>
      pool(index + 1, HOOK),
    );
    const wrong = directory({
      hooks: [{ address: HOOK, permissions: [], poolCount: pools.length, pools }],
      poolsConsidered: pools.length + 7,
    });

    expect(HookDirectorySchema.safeParse(wrong).success).toBe(false);
  });

  it.each([
    ["a hook at the zero address, which means no hook", { address: `0x${"0".repeat(40)}` }],
    ["a permission the protocol does not define", { permissions: ["beforeLunch"] }],
    ["a hook running no pools", { poolCount: 0 }],
    ["an entry with no pool to show", { pools: [] }],
  ])("refuses %s", (_label, overrides) => {
    const base = directory().hooks[0];
    const result = HookDirectorySchema.safeParse(
      directory({ hooks: [{ ...base, ...overrides }] }),
    );

    expect(result.success).toBe(false);
  });
});
