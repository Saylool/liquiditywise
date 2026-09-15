import { describe, expect, it } from "vitest";

import { MAX_SEARCH_TERM_LENGTH, MIN_SEARCH_TERM_LENGTH } from "../../schemas/searchTerms";
import { readPoolSearchInput } from "./poolSearchInput";

const POOL_ADDRESS = `0x${"a".repeat(40)}`;

/**
 * Built from code points rather than written out, because several of these are
 * invisible and one of them reverses the direction of everything after it — in
 * a source file as much as on a page.
 */
const codePoint = (value: number): string => String.fromCodePoint(value);

const ZERO_WIDTH_JOINER = codePoint(0x200d);
const RIGHT_TO_LEFT_OVERRIDE = codePoint(0x202e);
const NEXT_LINE = codePoint(0x0085);

describe("readPoolSearchInput", () => {
  it("recognises a pool address, which needs no search at all", () => {
    expect(readPoolSearchInput(POOL_ADDRESS)).toEqual({ kind: "address", address: POOL_ADDRESS });
  });

  it("lower-cases an address the way the rest of the application stores one", () => {
    expect(readPoolSearchInput(`0x${"A".repeat(40)}`)).toEqual({
      kind: "address",
      address: POOL_ADDRESS,
    });
  });

  it("takes surrounding whitespace off an address", () => {
    expect(readPoolSearchInput(`  ${POOL_ADDRESS}\n`)).toEqual({
      kind: "address",
      address: POOL_ADDRESS,
    });
  });

  it.each([
    ["a space", "WETH USDC"],
    ["a slash", "WETH/USDC"],
    ["a hyphen", "WETH-USDC"],
    ["a comma", "WETH, USDC"],
    ["a pipe", "WETH|USDC"],
    ["an ampersand", "WETH & USDC"],
    ["repeated separators", "WETH //  USDC"],
  ])("splits a pair written with %s", (_label, raw) => {
    expect(readPoolSearchInput(raw)).toEqual({ kind: "terms", terms: ["WETH", "USDC"] });
  });

  it("keeps one term as one term", () => {
    expect(readPoolSearchInput("WETH")).toEqual({ kind: "terms", terms: ["WETH"] });
  });

  it("keeps the case that was typed, because the interface shows it back", () => {
    expect(readPoolSearchInput("wstEth")).toEqual({ kind: "terms", terms: ["wstEth"] });
  });

  /*
   * A pool has two sides, so a third term has nowhere to go. The page names the
   * terms it used, which is what keeps the drop visible.
   */
  it("uses the first two terms and drops the rest", () => {
    expect(readPoolSearchInput("weth usdc 0.05 v3")).toEqual({
      kind: "terms",
      terms: ["weth", "usdc"],
    });
  });

  it.each([
    ["nothing", ""],
    ["only spaces", "   "],
    ["only separators", " / - , "],
  ])("refuses %s", (_label, raw) => {
    expect(readPoolSearchInput(raw)).toEqual({ kind: "unusable", reason: "empty" });
  });

  it("refuses a term too short to narrow anything down", () => {
    expect(readPoolSearchInput("a")).toEqual({ kind: "unusable", reason: "length" });
  });

  it("refuses a term longer than any ticker", () => {
    expect(readPoolSearchInput("U".repeat(MAX_SEARCH_TERM_LENGTH + 1))).toEqual({
      kind: "unusable",
      reason: "length",
    });
  });

  it("accepts terms at both ends of the permitted length", () => {
    expect(readPoolSearchInput("U".repeat(MIN_SEARCH_TERM_LENGTH)).kind).toBe("terms");
    expect(readPoolSearchInput("U".repeat(MAX_SEARCH_TERM_LENGTH)).kind).toBe("terms");
  });

  /*
   * Refused rather than dropped: a reader who typed one thing and was shown
   * results for another has been told something untrue about what was searched.
   */
  it("refuses the whole search when the second term breaks a rule", () => {
    expect(readPoolSearchInput("WETH x")).toEqual({ kind: "unusable", reason: "length" });
  });

  it.each([
    ["a quote", 'WETH "USDC"'],
    ["a bracket", "WETH (USDC)"],
    ["a dollar sign", "$WETH"],
    ["a zero-width joiner", `US${ZERO_WIDTH_JOINER}DC`],
    ["a bidirectional override", `${RIGHT_TO_LEFT_OVERRIDE}USDC`],
    ["a next-line control character", `US${NEXT_LINE}DC`],
  ])("refuses a term carrying %s", (_label, raw) => {
    expect(readPoolSearchInput(raw)).toEqual({
      kind: "unusable",
      reason: "unsupported-characters",
    });
  });

  it("accepts the punctuation that appears inside real tickers", () => {
    for (const raw of ["USD+", "1INCH", "sUSDe", "A.B", "token_x"]) {
      expect(readPoolSearchInput(raw).kind).toBe("terms");
    }
  });

  it("accepts tickers outside the Latin alphabet", () => {
    const han = codePoint(0x5e01) + codePoint(0x5b89);

    expect(readPoolSearchInput(han).kind).toBe("terms");
  });

  /*
   * A string of hex that is not 40 characters is not an address. It must not be
   * treated as one, and it is a perfectly ordinary thing to type by mistake.
   */
  it("treats a truncated address as a search term, not an address", () => {
    expect(readPoolSearchInput(`0x${"a".repeat(39)}`)).toEqual({
      kind: "unusable",
      reason: "length",
    });
  });
});

/*
 * A v4 pool id is 32 bytes, and a visitor who has one should be able to paste
 * it into the same box as an address. Before this it was refused as a term too
 * long to be a ticker — true, and no help at all.
 */
describe("readPoolSearchInput with a v4 pool id", () => {
  const POOL_ID = `0x${"e5".repeat(32)}`;

  it("recognises a v4 pool id, which needs no search at all", () => {
    expect(readPoolSearchInput(POOL_ID)).toEqual({ kind: "v4-pool-id", poolId: POOL_ID });
  });

  it("lower-cases it the way the v4 page stores one", () => {
    expect(readPoolSearchInput(`0x${"E5".repeat(32)}`)).toEqual({
      kind: "v4-pool-id",
      poolId: POOL_ID,
    });
  });

  it("takes surrounding whitespace off", () => {
    expect(readPoolSearchInput(`  ${POOL_ID}\n`)).toEqual({ kind: "v4-pool-id", poolId: POOL_ID });
  });

  it("still reads an address as an address", () => {
    expect(readPoolSearchInput(`0x${"a".repeat(40)}`).kind).toBe("address");
  });

  /* One character short is not an id, and it is not a ticker either. */
  it("treats a truncated id as a search term, and refuses it for its length", () => {
    expect(readPoolSearchInput(POOL_ID.slice(0, -1))).toEqual({ kind: "unusable", reason: "length" });
  });
});
