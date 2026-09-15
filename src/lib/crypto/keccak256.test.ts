import { describe, expect, it } from "vitest";

import { BALANCE_OF_SELECTOR } from "../uniswap/erc20BalanceAdapter";
import { keccak256, keccak256Hex, utf8Bytes } from "./keccak256";

const hex = (bytes: Uint8Array) =>
  `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;

/*
 * Known answers. A hash is the one kind of function a test can pin completely,
 * and these pin it from four directions: the two canonical short vectors, a
 * message that fills exactly one block so the padding lands in a block of its
 * own, and the function selectors this application already relies on.
 */
describe("keccak256", () => {
  it("hashes the empty message to the value every Ethereum client agrees on", () => {
    expect(hex(keccak256(new Uint8Array(0)))).toBe(
      "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
    );
  });

  it('hashes "abc"', () => {
    expect(hex(keccak256(utf8Bytes("abc")))).toBe(
      "0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45",
    );
  });

  it("hashes the fox sentence", () => {
    expect(hex(keccak256(utf8Bytes("The quick brown fox jumps over the lazy dog")))).toBe(
      "0x4d741b6f1eb29cb2a9b9911c82f56fa8d73b04959d3d9d222895df6c0b28aa15",
    );
  });

  /*
   * 136 bytes is exactly one block, so the padding has to open a second one.
   * The first version of every keccak gets this boundary wrong in one of two
   * ways, and a message shorter than a block cannot tell.
   */
  it("absorbs a message that fills a block exactly", () => {
    expect(hex(keccak256(new Uint8Array(136)))).toBe(
      "0x3a5912a7c5faa06ee4fe906253e339467a9ce87d533c65be3c15cb231cdb25f9",
    );
  });

  /*
   * The selector the balance reader declares by hand is the first four bytes of
   * this hash. Two constants in the codebase that must agree, checked here so
   * that they do.
   */
  it("produces the balanceOf selector the balance adapter declares", () => {
    expect(hex(keccak256(utf8Bytes("balanceOf(address)"))).slice(0, 10)).toBe(BALANCE_OF_SELECTOR);
  });

  it("is deterministic", () => {
    const input = utf8Bytes("uniswap");

    expect(keccak256(input)).toEqual(keccak256(input));
  });

  it("does not modify its input", () => {
    const input = utf8Bytes("abc");
    keccak256(input);

    expect(input).toEqual(utf8Bytes("abc"));
  });
});

describe("keccak256Hex", () => {
  it("hashes hex bytes to hex", () => {
    expect(keccak256Hex("0x616263")).toBe(
      "0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45",
    );
  });

  it("hashes the empty byte string", () => {
    expect(keccak256Hex("0x")).toBe(
      "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
    );
  });

  it.each(["", "616263", "0x6", "0xzz", "0x 61"])("refuses %j, which is not hex bytes", (input) => {
    expect(keccak256Hex(input)).toBeNull();
  });
});
