import { describe, expect, it } from "vitest";

import { compareV4PairPools, V4_PAIR_POOL_FETCH_LIMIT, type V4PairPool, V4PairPoolsSchema } from "./v4PairPools";

const FETCHED_AT = "2026-09-15T12:00:00.000Z";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const poolId = (index: number) => `0x${index.toString(16).padStart(64, "0")}`;
/** USDC per WETH ≈ 2500, as Q64.96. */
const SQRT_PRICE = "1584563250285286751870879006";

const entry = ({
  id,
  liquidity,
  read = true,
  token1 = WETH,
}: {
  id: number;
  liquidity: string;
  read?: boolean;
  token1?: string;
}): V4PairPool => ({
  pool: {
    protocolVersion: "v4",
    chainId: 1,
    id: poolId(id),
    token0: { chainId: 1, address: USDC, symbol: "USDC", decimals: 6 },
    token1: { chainId: 1, address: token1, symbol: "WETH", decimals: 18 },
    tickSpacing: 10,
    fee: { kind: "static", feePpm: 250 },
    protocolFee: null,
    hookAddress: null,
  },
  state: read ? { liquidity, sqrtPriceX96: SQRT_PRICE } : null,
  ethPrice: { token0: 0.0004, token1: 1 },
});

const list = (pools: readonly V4PairPool[], analysedPoolId: string | null = poolId(1)) =>
  V4PairPoolsSchema.safeParse({
    analysedPoolId,
    pools,
    fetchedAt: FETCHED_AT,
    sources: ["uniswap-v4-subgraph", "ethereum-rpc"],
  });

describe("compareV4PairPools", () => {
  it("puts the deeper pool first", () => {
    expect(compareV4PairPools(entry({ id: 1, liquidity: "10" }), entry({ id: 2, liquidity: "20" }))).toBeGreaterThan(0);
  });

  it("puts an unread pool last, behind an empty one", () => {
    expect(compareV4PairPools(entry({ id: 1, liquidity: "1", read: false }), entry({ id: 2, liquidity: "0" }))).toBeGreaterThan(0);
    expect(compareV4PairPools(entry({ id: 2, liquidity: "0" }), entry({ id: 1, liquidity: "1", read: false }))).toBeLessThan(0);
  });

  it("breaks a tie by id", () => {
    expect(compareV4PairPools(entry({ id: 2, liquidity: "5" }), entry({ id: 1, liquidity: "5" }))).toBeGreaterThan(0);
  });
});

describe("V4PairPoolsSchema", () => {
  it("accepts a pair's pools, deepest first, with the analysed pool among them", () => {
    expect(list([entry({ id: 2, liquidity: "20" }), entry({ id: 1, liquidity: "10" })]).success).toBe(true);
  });

  it("accepts an empty list when no pool is being read, which is a real answer", () => {
    expect(list([], null).success).toBe(true);
  });

  it("refuses an empty list when a pool is being read", () => {
    expect(list([], poolId(1)).success).toBe(false);
  });

  it("refuses a list that leaves out the pool being read", () => {
    expect(list([entry({ id: 2, liquidity: "20" })], poolId(1)).success).toBe(false);
  });

  it("refuses a shallower pool above a deeper one", () => {
    expect(list([entry({ id: 1, liquidity: "10" }), entry({ id: 2, liquidity: "20" })]).success).toBe(false);
  });

  it("refuses an unread pool above a read one", () => {
    expect(list([entry({ id: 1, liquidity: "1", read: false }), entry({ id: 2, liquidity: "0" })]).success).toBe(false);
  });

  /* The defining property: every entry is the same two currencies, by address. */
  it("refuses a pool of another pair", () => {
    expect(list([entry({ id: 1, liquidity: "20" }), entry({ id: 2, liquidity: "10", token1: `0x${"d".repeat(40)}` })]).success).toBe(false);
  });

  it("refuses the same pool twice", () => {
    expect(list([entry({ id: 1, liquidity: "20" }), entry({ id: 1, liquidity: "20" })]).success).toBe(false);
  });

  it("refuses more pools than were asked for", () => {
    const many = Array.from({ length: V4_PAIR_POOL_FETCH_LIMIT + 1 }, (_u, index) =>
      entry({ id: index + 1, liquidity: String(1000 - index) }),
    );

    expect(list(many).success).toBe(false);
  });
});
