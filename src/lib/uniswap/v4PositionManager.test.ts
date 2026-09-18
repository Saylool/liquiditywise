import { describe, expect, it } from "vitest";

import { keccak256, keccak256Hex, utf8Bytes } from "../crypto/keccak256";
import {
  decodePoolAndPositionInfo,
  isV4PositionManagerCode,
  OWNER_OF_SELECTOR,
  ownerOfCalldata,
  POOL_AND_POSITION_INFO_SELECTOR,
  poolAndPositionInfoCalldata,
  POSITION_LIQUIDITY_SELECTOR,
  positionLiquidityCalldata,
  V4_BALANCE_OF_SELECTOR,
  V4_POSITION_MANAGER_CODE_HASH,
  v4BalanceOfCalldata,
} from "./v4PositionManager";

const OWNER = "0xee67b29f25a44a1cf65d3500afcf29af25033a67";

/*
 * `getPoolAndPositionInfo(408162)` as mainnet answered it on 2026-09-18: a
 * full-range position in the ETH/HEI pool at a 70% fee and a spacing of 7000,
 * with the pool's native currency0. A fixture from the chain rather than one
 * written to match the decoder, which is the only kind that can disagree with
 * it — and the position is full-range, so its lower tick is negative and the
 * packed reading has something to get wrong.
 */
const INFO_ANSWER =
  "0x0000000000000000000000000000000000000000000000000000000000000000" +
  "000000000000000000000000f8f173e20e15f3b6cb686fb64724d370689de083" +
  "00000000000000000000000000000000000000000000000000000000000aae60" +
  "0000000000000000000000000000000000000000000000000000000000001b58" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "a86fb6fbddb6d2e85e39b9894ff33c799cddbc4051ede12bc80d7550f28ab000";

const POOL_ID = "0xa86fb6fbddb6d2e85e39b9894ff33c799cddbc4051ede12bc8399b8c3d51670a";

/** The word the answer's six are replaced one at a time from, for the checks below. */
const wordAt = (index: number): string => INFO_ANSWER.slice(2 + index * 64, 2 + index * 64 + 64);
const replacingWord = (index: number, replacement: string): string =>
  INFO_ANSWER.slice(0, 2 + index * 64) + replacement + INFO_ANSWER.slice(2 + (index + 1) * 64);

describe("the selectors", () => {
  it.each([
    ["balanceOf(address)", V4_BALANCE_OF_SELECTOR],
    ["ownerOf(uint256)", OWNER_OF_SELECTOR],
    ["getPoolAndPositionInfo(uint256)", POOL_AND_POSITION_INFO_SELECTOR],
    ["getPositionLiquidity(uint256)", POSITION_LIQUIDITY_SELECTOR],
  ])("%s is the first four bytes of its own keccak", (signature, selector) => {
    const digest = keccak256(utf8Bytes(signature));
    const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");

    expect(selector).toBe(`0x${hex.slice(0, 8)}`);
  });
});

describe("calldata", () => {
  it("asks for one address's balance", () => {
    expect(v4BalanceOfCalldata(OWNER)).toBe(`${V4_BALANCE_OF_SELECTOR}${"0".repeat(24)}${OWNER.slice(2)}`);
  });

  it("asks about one token id, whatever its decimal length", () => {
    expect(ownerOfCalldata("408162")).toBe(`${OWNER_OF_SELECTOR}${"0".repeat(59)}63a62`);
    expect(poolAndPositionInfoCalldata("408162")).toBe(
      `${POOL_AND_POSITION_INFO_SELECTOR}${"0".repeat(59)}63a62`,
    );
    expect(positionLiquidityCalldata("408162")).toBe(
      `${POSITION_LIQUIDITY_SELECTOR}${"0".repeat(59)}63a62`,
    );
  });

  it("refuses an owner or an id that is not one", () => {
    expect(v4BalanceOfCalldata("0xnothex")).toBeNull();
    expect(v4BalanceOfCalldata(OWNER.toUpperCase())).toBeNull();
    expect(ownerOfCalldata("0x63a62")).toBeNull();
    expect(poolAndPositionInfoCalldata("")).toBeNull();
    expect(positionLiquidityCalldata("-1")).toBeNull();
  });
});

describe("decoding what a position is", () => {
  it("reads the key, the id it hashes to, and both ticks", () => {
    expect(decodePoolAndPositionInfo(INFO_ANSWER)).toEqual({
      key: {
        currency0: "0x0000000000000000000000000000000000000000",
        currency1: "0xf8f173e20e15f3b6cb686fb64724d370689de083",
        fee: 700_000,
        tickSpacing: 7_000,
        hooks: "0x0000000000000000000000000000000000000000",
      },
      poolId: POOL_ID,
      tickLower: -882_000,
      tickUpper: 882_000,
    });
  });

  /*
   * The check that makes the rest safe. Each of the key's five words is moved
   * on its own, and the packed id no longer matches what the key hashes to —
   * so a misread offset cannot come back as a pool that exists.
   */
  it.each([0, 1, 2, 3, 4])("refuses a key whose word %i was changed", (index) => {
    const changed = wordAt(index).slice(0, 63) + (wordAt(index).endsWith("0") ? "1" : "0");

    expect(decodePoolAndPositionInfo(replacingWord(index, changed))).toBeNull();
  });

  it("refuses an answer whose packed pool id is another pool's", () => {
    const packed = wordAt(5);

    expect(decodePoolAndPositionInfo(replacingWord(5, `0${packed.slice(1)}`))).toBeNull();
  });

  /*
   * Six words exactly, and nothing for a token nobody minted: the manager
   * answers six zero words for an unknown id, and zeros hash to something that
   * is not zero, so the same check refuses it.
   */
  it.each([
    ["an answer one word short", INFO_ANSWER.slice(0, -64)],
    ["an answer one word long", `${INFO_ANSWER}${"0".repeat(64)}`],
    ["an answer that is not whole words", `${INFO_ANSWER}ff`],
    ["a token nobody minted", `0x${"0".repeat(64 * 6)}`],
    ["nothing at all", "0x"],
    ["a revert", null],
  ])("refuses %s", (_label, data) => {
    expect(decodePoolAndPositionInfo(data)).toBeNull();
  });

  /*
   * The ticks come out of the packed word, so a range where the upper is not
   * above the lower is a misreading rather than a position — and the id still
   * has to match, so this word is built from the real one.
   */
  it("refuses a range that is not one", () => {
    const flat = `${wordAt(5).slice(0, 50)}0d75500d755000`;

    expect(decodePoolAndPositionInfo(replacingWord(5, flat))).toBeNull();
  });

  it("reads a range that is one narrow step wide", () => {
    const narrow = `${wordAt(5).slice(0, 50)}0d75500d754900`;
    const read = decodePoolAndPositionInfo(replacingWord(5, narrow));

    expect(read?.tickLower).toBe(882_000 - 7);
    expect(read?.tickUpper).toBe(882_000);
  });
});

describe("the manager's own code", () => {
  it("accepts only the runtime this was built against", () => {
    expect(isV4PositionManagerCode("0xfeed", () => V4_POSITION_MANAGER_CODE_HASH)).toBe(true);
    expect(isV4PositionManagerCode("0xfeed", keccak256Hex)).toBe(false);
    expect(isV4PositionManagerCode(null, () => V4_POSITION_MANAGER_CODE_HASH)).toBe(false);
  });
});
