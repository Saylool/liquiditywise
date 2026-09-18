import { describe, expect, it } from "vitest";

import { poolStateSlot } from "./v4PoolStateSlots";
import {
  POSITIONS_OFFSET,
  TICKS_OFFSET,
  tickFeeGrowthSlots,
  v4PositionKey,
  v4PositionSlots,
} from "./v4PositionSlots";

/** The v4 PositionManager on mainnet, which is what owns every position here. */
const MANAGER = "0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e";
const POOL = "0x053f6a47ccba79e7d5d623173ed6dd5a31cf19c28bae0fb8276f4506295f90da";

/*
 * Two live positions, read from mainnet on 2026-09-18. The keys below are not
 * computed here and compared with themselves — they are the slots whose stored
 * liquidity matched what the PositionManager reported for the same token, which
 * is what proves the derivation lands where it means to.
 */
describe("a position's key", () => {
  it.each([
    [
      "#408630, UNI/ETH",
      { tickLower: 49_080, tickUpper: 60_420, salt: 408_630n },
      "0xfb1f91742439ef767f7a0d686d5e90c85ff9b0b83cacc1f65c6cbd5f817e8636",
    ],
    [
      "#408667, LINK/ETH",
      { tickLower: 53_580, tickUpper: 55_440, salt: 408_667n },
      "0x2866b6a02f4696955e3392409601ef66ff4472fa97361d53941f73a48eb1283b",
    ],
    /*
     * Negative lower ticks, which is where the packed encoding earns its
     * keep: three bytes of two's complement, not a sign-extended word.
     */
    [
      "#103582, a full-range position below zero",
      { tickLower: -882_000, tickUpper: 72_000, salt: 103_582n },
      "0x566878d7fc8dc5d8b3b7277a198153726587ffc3a57a0778e2e85b6601cc1eca",
    ],
    [
      "#15383, another below zero",
      { tickLower: -882_000, tickUpper: 112_000, salt: 15_383n },
      "0xabc5e9eeec06f4f23e8bdb77325760004cab361c6b51d8f6f60b4bc1e960f361",
    ],
  ])("is the one the chain stores for %s", (_label, position, expected) => {
    expect(v4PositionKey({ owner: MANAGER, ...position })).toBe(expected);
  });

  /*
   * Packed, not padded: the ticks are three bytes each. Padding them to words
   * would hash to a slot holding somebody else's position, or nothing.
   */
  it("changes when any part of it changes", () => {
    const base = { owner: MANAGER, tickLower: 49_080, tickUpper: 60_420, salt: 408_630n };
    const keys = new Set([
      v4PositionKey(base),
      v4PositionKey({ ...base, tickLower: 49_140 }),
      v4PositionKey({ ...base, tickUpper: 60_480 }),
      v4PositionKey({ ...base, salt: 408_631n }),
      v4PositionKey({ ...base, owner: `0x${"1".repeat(40)}` }),
    ]);

    expect(keys.size).toBe(5);
  });

  it.each([
    ["an owner that is not an address", { owner: "0xnope" }],
    ["an owner in mixed case", { owner: MANAGER.toUpperCase() }],
    ["a tick that is not whole", { tickLower: 0.5 }],
    ["a salt past a uint256", { salt: 1n << 256n }],
    ["a negative salt", { salt: -1n }],
  ])("refuses %s", (_label, overrides) => {
    expect(
      v4PositionKey({ owner: MANAGER, tickLower: 0, tickUpper: 1, salt: 0n, ...overrides }),
    ).toBeNull();
  });
});

describe("the slots a position's fees are read from", () => {
  const key = v4PositionKey({
    owner: MANAGER,
    tickLower: 49_080,
    tickUpper: 60_420,
    salt: 408_630n,
  }) as string;

  it("puts the two snapshots one and two words past the liquidity", () => {
    const slots = v4PositionSlots(POOL, key);

    expect(slots).not.toBeNull();
    if (slots === null) return;
    expect(BigInt(slots.last0) - BigInt(slots.liquidity)).toBe(1n);
    expect(BigInt(slots.last1) - BigInt(slots.liquidity)).toBe(2n);
  });

  it("puts a tick's two totals one and two words past its liquidity word", () => {
    const slots = tickFeeGrowthSlots(POOL, 49_080);

    expect(slots).not.toBeNull();
    if (slots === null) return;
    expect(BigInt(slots.outside1) - BigInt(slots.outside0)).toBe(1n);
  });

  /*
   * Two different ticks, and a tick and a position, must never land on the same
   * word — they are different mappings inside the same pool's state.
   */
  it("keeps every entry apart", () => {
    const addresses = [
      tickFeeGrowthSlots(POOL, 49_080)?.outside0,
      tickFeeGrowthSlots(POOL, 60_420)?.outside0,
      tickFeeGrowthSlots(POOL, -49_080)?.outside0,
      v4PositionSlots(POOL, key)?.liquidity,
    ];

    expect(new Set(addresses).size).toBe(4);
  });

  it("reads the two mappings from different fields of the pool's state", () => {
    expect(poolStateSlot(POOL, TICKS_OFFSET)).not.toBe(poolStateSlot(POOL, POSITIONS_OFFSET));
  });

  it.each([
    ["a pool id that is not one", "0xnope", key],
    ["a key that is not a word", POOL, "0x1234"],
    ["a key one byte short", POOL, `0x${"a".repeat(62)}`],
  ])("refuses %s", (_label, pool, given) => {
    expect(v4PositionSlots(pool, given)).toBeNull();
  });

  it("refuses a tick that is not whole", () => {
    expect(tickFeeGrowthSlots(POOL, 1.5)).toBeNull();
    expect(tickFeeGrowthSlots("0xnope", 1)).toBeNull();
  });
});
