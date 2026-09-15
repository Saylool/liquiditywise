import { describe, expect, it } from "vitest";

import { PairFeeTiersSchema } from "./index";

/*
 * Fed directly, because every shape below is one the adapter cannot produce —
 * which is exactly why the guards against them need tests of their own. A
 * refinement nothing ever exercises is a comment with a runtime cost.
 */

/*
 * Real mainnet addresses, because the pool schema requires token0 to sort
 * strictly before token1 and picking them by hand is how a fixture ends up
 * rejected for the ordering rather than for the thing it meant to test.
 *
 *   DAI  0x6b17… < USDC 0xa0b8… < WETH 0xc02a… < USDT 0xdac1…
 *
 * So USDC/USDT and DAI/WETH are both well-ordered pairs, and each differs from
 * USDC/WETH on exactly one side.
 */
const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";

const POOL_100 = "0xe0554a476a092703abdb3ef35c80e0d76d32939f";
const POOL_500 = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";
const POOL_3000 = "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8";

const token = (address: string, symbol: string, decimals: number) => ({
  chainId: 1,
  address,
  symbol,
  decimals,
});

const tier = ({
  id,
  feePpm,
  tvlUsd = 1_000_000,
  pair = [USDC, WETH],
}: {
  id: string;
  feePpm: number;
  tvlUsd?: number;
  pair?: readonly [string, string];
}) => ({
  pool: {
    protocolVersion: "v3",
    chainId: 1,
    id,
    token0: token(pair[0], "TKA", 6),
    token1: token(pair[1], "TKB", 18),
    feePpm,
  },
  tvlUsd,
});

const tiers = (overrides: Record<string, unknown> = {}) => ({
  analysedPoolId: POOL_500,
  tiers: [
    tier({ id: POOL_100, feePpm: 100, tvlUsd: 8_701_671 }),
    tier({ id: POOL_500, feePpm: 500, tvlUsd: 413_951_941 }),
    tier({ id: POOL_3000, feePpm: 3_000, tvlUsd: 304_691_772 }),
  ],
  fetchedAt: "2026-09-15T08:21:00.000Z",
  source: "uniswap-v3-subgraph",
  ...overrides,
});

describe("PairFeeTiersSchema", () => {
  it("accepts a pair's real tiers", () => {
    expect(PairFeeTiersSchema.safeParse(tiers()).success).toBe(true);
  });

  it("accepts a pair that trades at only one tier", () => {
    const alone = tiers({
      analysedPoolId: POOL_3000,
      tiers: [tier({ id: POOL_3000, feePpm: 3_000 })],
    });

    expect(PairFeeTiersSchema.safeParse(alone).success).toBe(true);
  });

  /*
   * The one that would mislead rather than look broken: a panel headed "where
   * else this pair trades", listing pools of a different pair.
   *
   * Both sides are tested, because a pair that matches on one side and not the
   * other is the shape a half-written check accepts. Each entry below is a
   * well-ordered pool on its own, so the only thing that can reject the list is
   * the rule under test.
   */
  it.each([
    ["the second token differs", [USDC, USDT] as const],
    ["the first token differs", [DAI, WETH] as const],
  ])("refuses a tier belonging to another pair, when %s", (_label, pair) => {
    const mixed = tiers({
      tiers: [tier({ id: POOL_500, feePpm: 500 }), tier({ id: POOL_3000, feePpm: 3_000, pair })],
    });

    expect(PairFeeTiersSchema.safeParse(mixed).success).toBe(false);
  });

  /*
   * `UniswapV3Factory.createPool` reverts on a triple that already exists, so
   * one pair cannot hold two pools at one fee.
   */
  it("refuses the same fee tier twice", () => {
    const duplicated = tiers({
      tiers: [
        tier({ id: POOL_500, feePpm: 500 }),
        tier({ id: POOL_3000, feePpm: 500, tvlUsd: 2 }),
      ],
    });

    expect(PairFeeTiersSchema.safeParse(duplicated).success).toBe(false);
  });

  it("refuses tiers that are not in ascending fee order", () => {
    const backwards = tiers({
      tiers: [
        tier({ id: POOL_3000, feePpm: 3_000 }),
        tier({ id: POOL_500, feePpm: 500 }),
      ],
    });

    expect(PairFeeTiersSchema.safeParse(backwards).success).toBe(false);
  });

  /*
   * The pool the reader is on has just been read from this same source, so its
   * absence means the two reads disagree about which pair this is.
   */
  it("refuses a list that leaves out the pool being analysed", () => {
    const orphaned = tiers({
      tiers: [
        tier({ id: POOL_100, feePpm: 100 }),
        tier({ id: POOL_3000, feePpm: 3_000 }),
      ],
    });

    expect(PairFeeTiersSchema.safeParse(orphaned).success).toBe(false);
  });

  it("refuses an empty list, since a pair always has the pool in front of the reader", () => {
    expect(PairFeeTiersSchema.safeParse(tiers({ tiers: [] })).success).toBe(false);
  });

  it.each([
    ["the zero address as the analysed pool", { analysedPoolId: `0x${"0".repeat(40)}` }],
    ["a negative reported liquidity", { tiers: [{ ...tier({ id: POOL_500, feePpm: 500 }), tvlUsd: -1 }] }],
    ["a timestamp that is not a canonical instant", { fetchedAt: "2026-09-15T08:21:00Z" }],
    ["a source that cannot answer this", { source: "ethereum-rpc" }],
    ["a field nobody put there", { tierToPick: 500 }],
  ])("refuses %s", (_label, overrides) => {
    expect(PairFeeTiersSchema.safeParse(tiers(overrides)).success).toBe(false);
  });
});
