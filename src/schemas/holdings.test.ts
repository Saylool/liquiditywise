import { describe, expect, it } from "vitest";

import { AddressHoldingsSchema, V4PoolCandidateListSchema } from "./holdings";

const ADDRESS = `0x${"a".repeat(40)}`;
const FETCHED_AT = "2026-09-15T12:00:00.000Z";
const NATIVE = `0x${"0".repeat(40)}`;

const token = (address: string, symbol: string, decimals: number) => ({ chainId: 1, address, symbol, decimals });
const USDC = token(`0x${"1".repeat(40)}`, "USDC", 6);
const WETH = token(`0x${"b".repeat(40)}`, "WETH", 18);
const ETH = token(NATIVE, "ETH", 18);

const v3Pool = { protocolVersion: "v3", chainId: 1, id: `0x${"5".repeat(40)}`, token0: USDC, token1: WETH, feePpm: 500 };
const v4Pool = {
  protocolVersion: "v4",
  chainId: 1,
  id: `0x${"e5".repeat(32)}`,
  token0: ETH,
  token1: USDC,
  tickSpacing: 10,
  fee: { kind: "static", feePpm: 625 },
  protocolFee: null,
  hookAddress: null,
};

const holdings = (overrides: Record<string, unknown> = {}) =>
  AddressHoldingsSchema.safeParse({
    address: ADDRESS,
    tokensChecked: 10,
    holdings: [{ token: ETH, amount: "1" }, { token: USDC, amount: "1" }],
    pools: [{ pool: v4Pool, heldSides: "both" }, { pool: v3Pool, heldSides: "token0" }],
    poolsSearched: { v3: 250, v4: 250 },
    fetchedAt: FETCHED_AT,
    sources: ["uniswap-v3-subgraph", "uniswap-v4-subgraph", "ethereum-rpc"],
    ...overrides,
  });

describe("AddressHoldingsSchema", () => {
  it("accepts ether as a holding and a v4 pool it opens on both sides", () => {
    expect(holdings().success).toBe(true);
  });

  it("still derives each pool's held sides from the holdings", () => {
    expect(holdings({ pools: [{ pool: v4Pool, heldSides: "token1" }] }).success).toBe(false);
  });

  it("still puts both-sides pools first", () => {
    expect(
      holdings({ pools: [{ pool: v3Pool, heldSides: "token0" }, { pool: v4Pool, heldSides: "both" }] }).success,
    ).toBe(false);
  });

  /* A net that was not cast cannot have caught anything. */
  it("refuses a v4 pool when the v4 net was not cast", () => {
    expect(
      holdings({
        poolsSearched: { v3: 250, v4: null },
        sources: ["uniswap-v3-subgraph", "ethereum-rpc"],
      }).success,
    ).toBe(false);
  });

  it("accepts a v3-only answer that says the v4 net was not cast", () => {
    expect(
      holdings({
        holdings: [{ token: USDC, amount: "1" }],
        pools: [{ pool: v3Pool, heldSides: "token0" }],
        poolsSearched: { v3: 250, v4: null },
        sources: ["uniswap-v3-subgraph", "ethereum-rpc"],
      }).success,
    ).toBe(true);
  });

  it("requires the sources to be exactly the nets cast, plus the chain", () => {
    expect(holdings({ sources: ["uniswap-v3-subgraph", "ethereum-rpc"] }).success).toBe(false);
    expect(holdings({ sources: ["uniswap-v3-subgraph", "uniswap-v4-subgraph"] }).success).toBe(false);
  });

  it("requires at least one net to have been cast", () => {
    expect(
      holdings({ holdings: [], pools: [], poolsSearched: { v3: null, v4: null }, sources: ["ethereum-rpc"] }).success,
    ).toBe(false);
  });
});

describe("V4PoolCandidateListSchema", () => {
  it("accepts a list of verified v4 pools from the v4 subgraph", () => {
    expect(
      V4PoolCandidateListSchema.safeParse({ pools: [v4Pool], poolManager: null, createdAtBlockNumbers: {}, fetchedAt: FETCHED_AT, source: "uniswap-v4-subgraph" }).success,
    ).toBe(true);
  });

  it("refuses the v3 source and an empty list", () => {
    expect(
      V4PoolCandidateListSchema.safeParse({ pools: [v4Pool], poolManager: null, createdAtBlockNumbers: {}, fetchedAt: FETCHED_AT, source: "uniswap-v3-subgraph" }).success,
    ).toBe(false);
    expect(
      V4PoolCandidateListSchema.safeParse({ pools: [], poolManager: null, createdAtBlockNumbers: {}, fetchedAt: FETCHED_AT, source: "uniswap-v4-subgraph" }).success,
    ).toBe(false);
  });

  it("refuses the same pool twice", () => {
    expect(
      V4PoolCandidateListSchema.safeParse({ pools: [v4Pool, v4Pool], poolManager: null, createdAtBlockNumbers: {}, fetchedAt: FETCHED_AT, source: "uniswap-v4-subgraph" }).success,
    ).toBe(false);
  });
});
