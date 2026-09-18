import { describe, expect, it } from "vitest";

import { keccak256, keccak256Hex, utf8Bytes } from "../crypto/keccak256";
import {
  BALANCE_OF_SELECTOR,
  balanceOfCalldata,
  decodePosition,
  FACTORY_SELECTOR,
  isPositionManagerCode,
  POSITIONS_SELECTOR,
  positionsCalldata,
  SLOT0_SELECTOR,
  TOKEN_OF_OWNER_BY_INDEX_SELECTOR,
  tokenOfOwnerByIndexCalldata,
} from "./v3PositionManager";

const OWNER = "0xb6f1f0c31689f4c06df33c88da2a8b9c7c0fedbd";

/*
 * `positions(1112391)` as mainnet answered it on 2026-09-18 — XOR/WETH at the 1%
 * tier, ticks -414400 to 0. A fixture from the chain rather than one written to
 * match the decoder, which is the only kind that can disagree with it.
 */
const POSITION_ANSWER =
  "0x0000000000000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "00000000000000000000000040fd72257597aa14c7231a7b1aaa29fce868f677" +
  "000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" +
  "0000000000000000000000000000000000000000000000000000000000002710" +
  "fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff9ad40" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "00000000000000000000000000000000000762c8372fef4e5ff537a1b61593a2" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000000";

describe("the selectors", () => {
  /* Each is the first four bytes of the keccak of its own signature. */
  it.each([
    ["factory()", FACTORY_SELECTOR],
    ["balanceOf(address)", BALANCE_OF_SELECTOR],
    ["tokenOfOwnerByIndex(address,uint256)", TOKEN_OF_OWNER_BY_INDEX_SELECTOR],
    ["positions(uint256)", POSITIONS_SELECTOR],
    ["slot0()", SLOT0_SELECTOR],
  ])("%s", (signature, selector) => {
    const digest = Array.from(keccak256(utf8Bytes(signature)).slice(0, 4), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");

    expect(selector).toBe(`0x${digest}`);
  });
});

describe("calldata", () => {
  it("asks how many tokens an address holds", () => {
    expect(balanceOfCalldata(OWNER)).toBe(`${BALANCE_OF_SELECTOR}${"0".repeat(24)}${OWNER.slice(2)}`);
  });

  it("asks for one id by its place in the owner's list", () => {
    const data = tokenOfOwnerByIndexCalldata(OWNER, 3);

    expect(data).toContain(OWNER.slice(2));
    expect(data?.endsWith(`${"0".repeat(63)}3`)).toBe(true);
  });

  it("asks about one token id, however large", () => {
    expect(positionsCalldata("1112391")?.endsWith("10f947")).toBe(true);
  });

  it.each([
    ["an owner that is not an address", () => balanceOfCalldata("0xnope")],
    ["an index that is not whole", () => tokenOfOwnerByIndexCalldata(OWNER, 1.5)],
    ["a negative index", () => tokenOfOwnerByIndexCalldata(OWNER, -1)],
    ["a token id that is not a number", () => positionsCalldata("0x10fb87")],
  ])("refuses %s", (_label, build) => {
    expect(build()).toBeNull();
  });
});

describe("decoding", () => {
  it("reads the whole position the chain returned", () => {
    expect(decodePosition("1112391", POSITION_ANSWER)).toEqual({
      tokenId: "1112391",
      token0: "0x40fd72257597aa14c7231a7b1aaa29fce868f677",
      token1: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      feePpm: 10_000,
      tickLower: -414_400,
      tickUpper: 0,
      liquidity: "38349616863029655014582929927279522",
      /* The four fee-accounting words, which this position had never touched. */
      feeGrowthInside0Last: 0n,
      feeGrowthInside1Last: 0n,
      tokensOwed0: 0n,
      tokensOwed1: 0n,
    });
  });

  /*
   * Twelve words exactly. An answer of another width is another function's, and
   * reading the pair out of the wrong offsets would name two real tokens that
   * are not this position's.
   */
  it.each([
    ["an answer one word short", POSITION_ANSWER.slice(0, -64)],
    ["an answer one word long", `${POSITION_ANSWER}${"0".repeat(64)}`],
    ["an answer that is not whole words", `${POSITION_ANSWER}ff`],
    ["nothing at all", "0x"],
    ["a revert", null],
  ])("refuses %s", (_label, data) => {
    expect(decodePosition("1112391", data)).toBeNull();
  });

  it("refuses a position whose ticks are the wrong way round", () => {
    const flipped =
      POSITION_ANSWER.slice(0, 2 + 5 * 64) +
      `${"0".repeat(64)}fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff9ad40` +
      POSITION_ANSWER.slice(2 + 7 * 64);

    expect(decodePosition("1112391", flipped)).toBeNull();
  });
});

describe("the manager's own code", () => {
  it("is believed only when it hashes to the runtime this was built against", () => {
    const real = "0xdeadbeef";

    expect(
      isPositionManagerCode(real, () =>
        "0x692e658b31cbe3407682854806658d315d61a58c7e4933a2f91d383dc00736c6",
      ),
    ).toBe(true);
    expect(isPositionManagerCode(real, keccak256Hex)).toBe(false);
    expect(isPositionManagerCode(null, () => null)).toBe(false);
  });
});
