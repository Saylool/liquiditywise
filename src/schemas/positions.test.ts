import { describe, expect, it } from "vitest";

import { AddressPositionsSchema, POSITIONS_SHOWN, PositionSchema } from "./positions";

const V4_POOL = {
  protocolVersion: "v4",
  chainId: 1,
  id: `0x${"a".repeat(64)}`,
  token0: { chainId: 1, address: `0x${"0".repeat(40)}`, symbol: "ETH", decimals: 18 },
  token1: { chainId: 1, address: `0x${"f".repeat(40)}`, symbol: "HEI", decimals: 18 },
  tickSpacing: 7_000,
  fee: { kind: "static", feePpm: 700_000 },
  protocolFee: null,
  hookAddress: null,
};

const POOL = {
  protocolVersion: "v3",
  chainId: 1,
  id: `0x${"7".repeat(40)}`,
  feePpm: 10_000,
  token0: { chainId: 1, address: `0x${"4".repeat(40)}`, symbol: "XOR", decimals: 18 },
  token1: { chainId: 1, address: `0x${"c".repeat(40)}`, symbol: "WETH", decimals: 18 },
};

const position = (overrides: Record<string, unknown> = {}) => ({
  tokenId: "1112391",
  pool: POOL,
  tickLower: -414_400,
  tickUpper: 0,
  lowerPrice: 1e-18,
  upperPrice: 1,
  liquidity: "38349616863029655014582929927279522",
  currentTick: -200_000,
  inRange: true,
  ...overrides,
});

const answer = (overrides: Record<string, unknown> = {}) => ({
  address: `0x${"b".repeat(40)}`,
  positions: [position()],
  held: 1,
  read: 1,
  open: 1,
  closed: 0,
  unread: [],
  fetchedAt: "2026-09-18T07:00:00.000Z",
  sources: ["uniswap-v3-subgraph", "ethereum-rpc"],
  ...overrides,
});

describe("PositionSchema", () => {
  it("accepts a position of the shape the composition produces", () => {
    expect(PositionSchema.safeParse(position()).success).toBe(true);
  });

  /*
   * The same position shape holds a pool of either protocol, which is what lets
   * one list carry both. A v4 pool is whole — it carries its spacing, its fee
   * mode and its hook, all from the key the manager proved.
   */
  it("accepts a position in a v4 pool", () => {
    expect(PositionSchema.safeParse(position({ pool: V4_POOL })).success).toBe(true);
  });

  it("refuses a v4 pool whose hook and fee mode contradict each other", () => {
    expect(
      PositionSchema.safeParse(
        position({ pool: { ...V4_POOL, fee: { kind: "dynamic", currentFeePpm: null } } }),
      ).success,
    ).toBe(false);
  });

  it("accepts a pool nobody has swapped in, where neither is known", () => {
    expect(
      PositionSchema.safeParse(position({ currentTick: null, inRange: null })).success,
    ).toBe(true);
  });

  /*
   * The figure a holder would act on, and the one that must not be derivable in
   * two places: earning at or above the lower bound, strictly below the upper.
   */
  it.each([
    ["claims to earn below its range", { currentTick: -500_000, inRange: true }],
    ["claims to earn at its upper bound", { currentTick: 0, inRange: true }],
    ["denies earning at its lower bound", { currentTick: -414_400, inRange: false }],
    ["denies earning inside it", { currentTick: -200_000, inRange: false }],
    ["claims to know with no tick", { currentTick: null, inRange: false }],
    ["claims not to know with a tick", { inRange: null }],
  ])("refuses a position that %s", (_label, overrides) => {
    expect(PositionSchema.safeParse(position(overrides)).success).toBe(false);
  });

  it.each([
    ["ticks the wrong way round", { tickLower: 0, tickUpper: -414_400 }],
    ["prices the wrong way round", { lowerPrice: 1, upperPrice: 1e-18 }],
    ["no liquidity left in it", { liquidity: "0" }],
    ["a token id that is not a number", { tokenId: "0x10f947" }],
    ["a field nobody declared", { owner: `0x${"b".repeat(40)}` }],
  ])("refuses a position with %s", (_label, overrides) => {
    expect(PositionSchema.safeParse(position(overrides)).success).toBe(false);
  });
});

describe("AddressPositionsSchema", () => {
  it("accepts an answer of the shape the composition produces", () => {
    expect(AddressPositionsSchema.safeParse(answer()).success).toBe(true);
  });

  it("accepts an address holding nothing", () => {
    expect(
      AddressPositionsSchema.safeParse(
        answer({ positions: [], held: 0, read: 0, open: 0, closed: 0 }),
      ).success,
    ).toBe(true);
  });

  it.each([
    ["more read than held", { held: 1, read: 2 }],
    ["more listed than open", { positions: [position(), position()], open: 1, held: 2, read: 2 }],
    ["more open and closed than read", { held: 3, read: 1, open: 1, closed: 1 }],
    ["no source at all", { sources: [] }],
    ["both protocols unread, which is not an answer", { unread: ["v3", "v4"] }],
    ["the same protocol unread twice", { unread: ["v3", "v3"] }],
  ])("refuses an answer with %s", (_label, overrides) => {
    expect(AddressPositionsSchema.safeParse(answer(overrides)).success).toBe(false);
  });

  it("refuses a list longer than the page shows", () => {
    const many = Array.from({ length: POSITIONS_SHOWN + 1 }, (_unused, index) =>
      position({ tokenId: String(index + 1) }),
    );

    expect(
      AddressPositionsSchema.safeParse(
        answer({ positions: many, held: many.length, read: many.length, open: many.length }),
      ).success,
    ).toBe(false);
  });
});
