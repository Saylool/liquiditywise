import { describe, expect, it } from "vitest";

import { keccak256Hex } from "../crypto/keccak256";
import {
  AGGREGATE3_SELECTOR,
  decodeAggregate3,
  encodeAggregate3,
  GET_ETH_BALANCE_SELECTOR,
  getEthBalanceCalldata,
  isMulticall3Code,
  MULTICALL3_ADDRESS,
  MULTICALL3_CODE_HASH,
} from "./multicall3";
import { MULTICALL3_RUNTIME_CODE } from "./multicall3RuntimeCode";

const utf8Hex = (text: string) => `0x${Buffer.from(text, "utf8").toString("hex")}`;
const w = (value: bigint | string) =>
  (typeof value === "bigint" ? value.toString(16) : value.replace(/^0x/, "")).padStart(64, "0");

const TOKEN = `0x${"ab".repeat(20)}`;
const HOLDER = `0x${"C".repeat(40)}`;
/** `balanceOf(holder)`: four bytes of selector and one word, 36 bytes. */
const DATA = `0x70a08231${"c".repeat(64)}`;

/**
 * `Result[]` as Multicall3 returns it, built here by hand rather than with the
 * encoder under test, so the decoder is checked against the ABI and not
 * against itself.
 */
const encodeResults = (results: readonly { success: boolean; data: string }[]) => {
  const elements = results.map(({ success, data }) => {
    const hex = data.replace(/^0x/, "");
    const length = hex.length / 2;
    return `${w(success ? 1n : 0n)}${w(64n)}${w(BigInt(length))}${hex.padEnd(Math.ceil(length / 32) * 64, "0")}`;
  });
  let offsets = "";
  let next = BigInt(results.length * 32);
  for (const element of elements) {
    offsets += w(next);
    next += BigInt(element.length / 2);
  }
  return `0x${w(32n)}${w(BigInt(results.length))}${offsets}${elements.join("")}`;
};

describe("Multicall3's constants", () => {
  it("pins the selectors to their signatures", () => {
    expect(keccak256Hex(utf8Hex("aggregate3((address,bool,bytes)[])"))?.slice(0, 10)).toBe(AGGREGATE3_SELECTOR);
    expect(keccak256Hex(utf8Hex("getEthBalance(address)"))?.slice(0, 10)).toBe(GET_ETH_BALANCE_SELECTOR);
  });

  /* The code was read from mainnet; its hash is what anyone can check it against. */
  it("pins the runtime code to its hash", () => {
    expect(keccak256Hex(MULTICALL3_RUNTIME_CODE)).toBe(MULTICALL3_CODE_HASH);
    expect((MULTICALL3_RUNTIME_CODE.length - 2) / 2).toBe(3808);
    expect(MULTICALL3_RUNTIME_CODE.startsWith("0x6080604052")).toBe(true);
    expect(MULTICALL3_RUNTIME_CODE).toBe(MULTICALL3_RUNTIME_CODE.toLowerCase());
  });

  it("names the canonical deployment, lower-cased", () => {
    expect(MULTICALL3_ADDRESS).toBe("0xca11bde05977b3631167028862be2a173976ca11");
  });
});

describe("isMulticall3Code", () => {
  it("accepts the runtime code, however the node spells its hex", () => {
    expect(isMulticall3Code(MULTICALL3_RUNTIME_CODE)).toBe(true);
    expect(isMulticall3Code(`0x${MULTICALL3_RUNTIME_CODE.slice(2).toUpperCase()}`)).toBe(true);
  });

  it.each([
    ["no code at the address", "0x"],
    ["the last byte changed", `${MULTICALL3_RUNTIME_CODE.slice(0, -2)}00`],
    ["one byte more", `${MULTICALL3_RUNTIME_CODE}00`],
    ["one byte less", MULTICALL3_RUNTIME_CODE.slice(0, -2)],
    ["not a string", null],
  ])("refuses %s", (_label, code) => {
    expect(isMulticall3Code(code)).toBe(false);
  });
});

describe("getEthBalanceCalldata", () => {
  it("is the selector and the holder as one word, lower-cased", () => {
    expect(getEthBalanceCalldata(HOLDER)).toBe(`${GET_ETH_BALANCE_SELECTOR}${"c".repeat(64 - 40).replace(/c/g, "0")}${"c".repeat(40)}`);
  });
});

describe("encodeAggregate3", () => {
  it("encodes one call as the ABI lays it out", () => {
    expect(encodeAggregate3([{ to: TOKEN, data: DATA }])).toBe(
      `${AGGREGATE3_SELECTOR}${w(32n)}${w(1n)}${w(32n)}${w(TOKEN)}${w(1n)}${w(96n)}${w(36n)}${DATA.slice(2).padEnd(128, "0")}`,
    );
  });

  /* Each element is 192 bytes for a 36-byte call, so the second starts 192 past the first. */
  it("offsets each element past the ones before it", () => {
    const encoded = encodeAggregate3([{ to: TOKEN, data: DATA }, { to: HOLDER, data: DATA }]);
    const wordAt = (byte: number) => encoded.slice(10 + byte * 2, 10 + byte * 2 + 64);

    expect(wordAt(32)).toBe(w(2n));
    expect(wordAt(64)).toBe(w(64n));
    expect(wordAt(96)).toBe(w(256n));
    expect(wordAt(128)).toBe(w(TOKEN));
    expect(wordAt(128 + 192)).toBe(w(HOLDER.toLowerCase()));
    expect(encoded).toHaveLength(10 + (32 + 32 + 64 + 192 * 2) * 2);
  });

  /* A token that reverts is one unreadable balance, not a failed sweep: every call may fail. */
  it("lets every call fail on its own", () => {
    const encoded = encodeAggregate3([{ to: TOKEN, data: DATA }, { to: HOLDER, data: DATA }]);
    const wordAt = (byte: number) => encoded.slice(10 + byte * 2, 10 + byte * 2 + 64);

    expect(wordAt(128 + 32)).toBe(w(1n));
    expect(wordAt(128 + 192 + 32)).toBe(w(1n));
  });

  it("pads short calldata to a word and keeps its true length", () => {
    const encoded = encodeAggregate3([{ to: TOKEN, data: "0x3408e470" }]);

    expect(encoded.endsWith(`${w(4n)}${"3408e470".padEnd(64, "0")}`)).toBe(true);
  });

  it("encodes no calls as an empty array", () => {
    expect(encodeAggregate3([])).toBe(`${AGGREGATE3_SELECTOR}${w(32n)}${w(0n)}`);
  });
});

describe("decodeAggregate3", () => {
  const five = w(5n);

  it("reads each call's answer in order, failures included", () => {
    const returned = encodeResults([
      { success: true, data: `0x${five}` },
      { success: false, data: "0x" },
      { success: true, data: `0x${w(7n)}` },
    ]);

    expect(decodeAggregate3(returned, 3)).toEqual([
      { success: true, data: `0x${five}` },
      { success: false, data: "0x" },
      { success: true, data: `0x${w(7n)}` },
    ]);
  });

  it("reads an empty array for no calls", () => {
    expect(decodeAggregate3(encodeResults([]), 0)).toEqual([]);
  });

  /* An answer for a different number of calls cannot be paired with the calls made. */
  it("refuses a count other than the calls made", () => {
    const returned = encodeResults([{ success: true, data: `0x${five}` }]);

    expect(decodeAggregate3(returned, 2)).toBeNull();
    expect(decodeAggregate3(returned, 0)).toBeNull();
  });

  it.each([
    ["not a string", 5],
    ["not hex", "0xzz"],
    ["an odd number of digits", "0x123"],
    ["shorter than a word", "0x1234"],
  ])("refuses %s", (_label, returned) => {
    expect(decodeAggregate3(returned, 1)).toBeNull();
  });

  it("refuses an element offset past the end", () => {
    const returned = encodeResults([{ success: true, data: `0x${five}` }]);
    const broken = `${returned.slice(0, 2 + 128)}${w(4096n)}${returned.slice(2 + 192)}`;

    expect(decodeAggregate3(broken, 1)).toBeNull();
  });

  it("refuses an answer cut short", () => {
    const returned = encodeResults([{ success: true, data: `0x${five}` }]);

    expect(decodeAggregate3(returned.slice(0, -8), 1)).toBeNull();
  });

  it("refuses a flag that is neither true nor false", () => {
    const returned = encodeResults([{ success: true, data: `0x${five}` }]);
    const flagAt = 2 + (32 + 32 + 32) * 2;
    const broken = `${returned.slice(0, flagAt)}${w(2n)}${returned.slice(flagAt + 64)}`;

    expect(decodeAggregate3(broken, 1)).toBeNull();
  });

  it("refuses an offset too large to be a size", () => {
    const returned = encodeResults([{ success: true, data: `0x${five}` }]);
    const broken = `0x${"f".repeat(64)}${returned.slice(2 + 64)}`;

    expect(decodeAggregate3(broken, 1)).toBeNull();
  });

  /* A word the answer ends in the middle of is not a word, even where its digits would read as zero. */
  it("refuses a count word cut short", () => {
    expect(decodeAggregate3(`0x${w(32n)}00`, 0)).toBeNull();
  });
});
