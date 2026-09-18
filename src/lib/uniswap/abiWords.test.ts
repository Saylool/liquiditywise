import { describe, expect, it } from "vitest";

import {
  argumentWord,
  decodeAddress,
  decodeInt24,
  decodePackedInt24,
  decodeUint,
  words,
} from "./abiWords";

/*
 * The fifth word of `positions(1112391)` as mainnet answered it on 2026-09-18:
 * a tick of -414400. Kept here verbatim because it is the case that was wrong
 * before a live read caught it, and a word invented to match the decoder cannot
 * disagree with it.
 */
const NEGATIVE_TICK = "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffff9ad40";

describe("splitting an answer into words", () => {
  it("refuses anything that is not whole words", () => {
    expect(words(`${NEGATIVE_TICK}ff`)).toBeNull();
    expect(words("not hex")).toBeNull();
    expect(words(null)).toBeNull();
  });

  it("reads an empty answer as no words rather than as a failure", () => {
    expect(words("0x")).toEqual([]);
  });
});

describe("an int24 the ABI encoded on its own", () => {
  it("reads a negative tick as the whole word says", () => {
    expect(decodeInt24(NEGATIVE_TICK, 0)).toBe(-414_400);
  });

  it("reads a positive tick", () => {
    expect(decodeInt24(`0x${"0".repeat(59)}18876`, 0)).toBe(100_470);
  });

  /*
   * The two edges of int24 and the first word outside each. A word one past an
   * edge is a number the ABI cannot have produced for a tick, and reading it as
   * one would put a position at a price no pool can express.
   */
  it.each([
    ["the largest tick", `0x${"0".repeat(58)}7fffff`, 8_388_607],
    ["the smallest tick", `0x${"f".repeat(58)}800000`, -8_388_608],
  ])("reads %s", (_label, word, expected) => {
    expect(decodeInt24(word, 0)).toBe(expected);
  });

  it.each([
    ["one past the largest", `0x${"0".repeat(58)}800000`],
    ["one past the smallest", `0x${"f".repeat(58)}7fffff`],
    ["a word with bits above the sign extension", `0x${"0".repeat(56)}${"f".repeat(8)}`],
    ["a word sign-extended only halfway", `0x${"f".repeat(56)}${"0".repeat(8)}`],
  ])("refuses %s", (_label, word) => {
    expect(decodeInt24(word, 0)).toBeNull();
  });
});

/*
 * The other convention, and the reason both functions exist: a field sharing a
 * word carries its sign in bit 23, so the same -414400 is six digits rather
 * than sixty-four. Reading one with the other returns a large positive number
 * for every negative tick, which is a wrong answer that looks like a right one.
 */
describe("an int24 packed beside other fields", () => {
  it("reads a negative tick from its own twenty-four bits", () => {
    expect(decodePackedInt24("f9ad40")).toBe(-414_400);
  });

  it("reads the two edges of the range", () => {
    expect(decodePackedInt24("7fffff")).toBe(8_388_607);
    expect(decodePackedInt24("800000")).toBe(-8_388_608);
    expect(decodePackedInt24("000000")).toBe(0);
  });

  it("refuses anything that is not six hex digits", () => {
    expect(decodePackedInt24("f9ad4")).toBeNull();
    expect(decodePackedInt24("f9ad400")).toBeNull();
    expect(decodePackedInt24("0xf9ad")).toBeNull();
    expect(decodePackedInt24("F9AD40")).toBeNull();
  });
});

describe("addresses and whole numbers", () => {
  it("reads an address only when its padding is padding", () => {
    expect(decodeAddress(`0x${"0".repeat(24)}${"a".repeat(40)}`, 0)).toBe(`0x${"a".repeat(40)}`);
    expect(decodeAddress(`0x${"1".repeat(64)}`, 0)).toBeNull();
  });

  it("reads a whole number as an exact string, past what a double holds", () => {
    expect(decodeUint(`0x${"0".repeat(62)}54`)).toBe("84");
    expect(decodeUint(`0x${"0".repeat(34)}0762c8372fef4e5ff537a1b61593a2`)).toBe(
      "38349616863029655014582929927279522",
    );
  });

  it("reads nothing at an index the answer does not reach", () => {
    expect(decodeUint(`0x${"0".repeat(64)}`, 1)).toBeNull();
    expect(decodeAddress(`0x${"0".repeat(64)}`, 1)).toBeNull();
    expect(decodeInt24(`0x${"0".repeat(64)}`, 1)).toBeNull();
  });
});

describe("an argument word", () => {
  it("left-pads as the ABI pads, with or without the prefix", () => {
    expect(argumentWord("0xFF")).toBe(`${"0".repeat(62)}ff`);
    expect(argumentWord("ff")).toBe(`${"0".repeat(62)}ff`);
  });
});
