import { describe, expect, it } from "vitest";

import { keccak256, utf8Bytes } from "../crypto/keccak256";
import {
  decodeFeeGrowthGlobal,
  decodePoolSqrtPrice,
  decodePoolTick,
  decodeTickFeeGrowth,
  FEE_GROWTH_GLOBAL0_SELECTOR,
  FEE_GROWTH_GLOBAL1_SELECTOR,
  POOL_SLOT0_SELECTOR,
  ticksCalldata,
  TICKS_SELECTOR,
} from "./v3PoolFees";

/*
 * `ticks(190190)` and `ticks(200570)` on USDC/WETH at 0.05%, as mainnet
 * answered at block 26,006,326 on 2026-09-18. Fixtures from the chain rather
 * than written to match the decoder.
 */
const TICK_190190 =
  "0x000000000000000000000000000000000000000000000000003efe5a46eadb2c" +
  "000000000000000000000000000000000000000000000000003efe5a46eadb2c" +
  "000000000000000000000000000000000000252d860c91fc5856a69bdd42f925" +
  "0000000000000000000000000000032d48c4164c8265577742dbae3832129bd2" +
  "0000000000000000000000000000000000000000000000000000029900d3ce2c" +
  "0000000000000000000000000000000000000001e71d22de3075ff80a40d10df" +
  "0000000000000000000000000000000000000000000000000000000061706b07" +
  "0000000000000000000000000000000000000000000000000000000000000001";

describe("the selectors", () => {
  it.each([
    ["slot0()", POOL_SLOT0_SELECTOR],
    ["feeGrowthGlobal0X128()", FEE_GROWTH_GLOBAL0_SELECTOR],
    ["feeGrowthGlobal1X128()", FEE_GROWTH_GLOBAL1_SELECTOR],
    ["ticks(int24)", TICKS_SELECTOR],
  ])("%s is the first four bytes of its own keccak", (signature, selector) => {
    const digest = keccak256(utf8Bytes(signature));
    const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");

    expect(selector).toBe(`0x${hex.slice(0, 8)}`);
  });
});

describe("asking about a tick", () => {
  it("writes a positive tick as the ABI pads one", () => {
    expect(ticksCalldata(190_190)).toBe(`${TICKS_SELECTOR}${"0".repeat(59)}2e6ee`);
  });

  /* An `int24` argument is sign-extended to the whole word, not to three bytes. */
  it("sign-extends a negative tick across the word", () => {
    expect(ticksCalldata(-414_400)).toBe(
      `${TICKS_SELECTOR}fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff9ad40`,
    );
  });

  it("refuses a tick no pool can hold", () => {
    expect(ticksCalldata(887_273)).toBeNull();
    expect(ticksCalldata(-887_273)).toBeNull();
    expect(ticksCalldata(1.5)).toBeNull();
  });
});

describe("reading what a tick records", () => {
  it("takes the two fee totals from the live answer", () => {
    expect(decodeTickFeeGrowth(TICK_190190)).toEqual({
      outside0: BigInt("0x252d860c91fc5856a69bdd42f925"),
      outside1: BigInt("0x32d48c4164c8265577742dbae3832129bd2"),
    });
  });

  /*
   * A tick nobody has initialised answers with eight zero words, and that is a
   * true answer rather than a missing one: nothing has ever been outside it.
   */
  it("reads an untouched tick as zero rather than as a failure", () => {
    expect(decodeTickFeeGrowth(`0x${"0".repeat(64 * 8)}`)).toEqual({ outside0: 0n, outside1: 0n });
  });

  it.each([
    ["one word short", TICK_190190.slice(0, -64)],
    ["one word long", `${TICK_190190}${"0".repeat(64)}`],
    ["not whole words", `${TICK_190190}ff`],
    ["nothing at all", "0x"],
    ["a revert", null],
  ])("refuses an answer %s", (_label, data) => {
    expect(decodeTickFeeGrowth(data)).toBeNull();
  });
});

describe("reading a running total", () => {
  it("takes the whole word", () => {
    expect(decodeFeeGrowthGlobal(`0x${"f".repeat(64)}`)).toBe((1n << 256n) - 1n);
  });

  it.each([["two words", `0x${"0".repeat(128)}`], ["nothing", "0x"], ["a revert", null]])(
    "refuses %s",
    (_label, data) => {
      expect(decodeFeeGrowthGlobal(data)).toBeNull();
    },
  );
});

describe("reading where the price is", () => {
  /* Seven words, as a v3 pool's `slot0` returns: price, tick, three
   * observation fields, the protocol fee and the unlocked flag. */
  const slot0 = (tick: bigint) =>
    `0x${"1".repeat(64)}${BigInt.asUintN(256, tick).toString(16).padStart(64, "0")}${"0".repeat(64 * 5)}`;

  it("takes the tick from the second word", () => {
    expect(decodePoolTick(slot0(197_645n))).toBe(197_645);
    expect(decodePoolTick(slot0(-414_400n))).toBe(-414_400);
  });

  /* Nine words exactly: another width is another function's answer. */
  it.each([
    ["six words", `0x${"0".repeat(64 * 6)}`],
    ["eight words", `0x${"0".repeat(64 * 8)}`],
    ["a revert", null],
  ])("refuses %s", (_label, data) => {
    expect(decodePoolTick(data)).toBeNull();
  });
});

describe("reading the price itself", () => {
  /* The same seven words, with the square-root price in the first. */
  const slot0 = (sqrtPrice: bigint) =>
    `0x${sqrtPrice.toString(16).padStart(64, "0")}${(197_645).toString(16).padStart(64, "0")}${"0".repeat(64 * 5)}`;

  it("takes the price from the first word, exactly", () => {
    /* USDC/WETH at 0.05% near tick 197,645: about 1.0001^(197645/2) * 2^96. */
    const near = 1_550_499_574_899_706_142_130_401_485_783_040n;

    expect(decodePoolSqrtPrice(slot0(near))).toBe(near);
  });

  /* `TickMath`'s own bounds: the lower one is a price a pool can hold, the upper one is not. */
  it("accepts the lowest price a pool can hold and refuses what none can", () => {
    expect(decodePoolSqrtPrice(slot0(4_295_128_739n))).toBe(4_295_128_739n);
    expect(decodePoolSqrtPrice(slot0(4_295_128_738n))).toBeNull();
    expect(decodePoolSqrtPrice(slot0(1_461_446_703_485_210_103_287_273_052_203_988_822_378_723_970_341n))).toBe(
      1_461_446_703_485_210_103_287_273_052_203_988_822_378_723_970_341n,
    );
    expect(decodePoolSqrtPrice(slot0(1_461_446_703_485_210_103_287_273_052_203_988_822_378_723_970_342n))).toBeNull();
  });

  /* A price that would pass in the first word, in an answer of the wrong width: another function's answer. */
  it.each([
    ["an uninitialised pool's zero", slot0(0n)],
    ["eight words", `${slot0(4_295_128_739n)}${"0".repeat(64)}`],
    ["six words", slot0(4_295_128_739n).slice(0, 2 + 64 * 6)],
    ["a revert", null],
  ])("refuses %s", (_label, data) => {
    expect(decodePoolSqrtPrice(data)).toBeNull();
  });
});
