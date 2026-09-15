import { describe, expect, it } from "vitest";

import { ABSENT, formatTokenAmount } from "./displayFormats";

describe("formatTokenAmount", () => {
  /*
   * The balance this application actually read from the chain, for the
   * USDC/WETH pool's own WETH. Past what a double holds exactly, which is why
   * the amount never becomes a number.
   */
  it("keeps a balance no double could hold", () => {
    // 11923.665594… — cut rather than rounded, so the figure never reads higher
    // than what the address holds.
    expect(formatTokenAmount("11923665594771177257765", 18, "en")).toBe("11,923.6655");
    expect(formatTokenAmount("11923665594771177257765", 18, "tr")).toBe("11.923,6655");
  });

  it("formats a six-decimal balance", () => {
    expect(formatTokenAmount("75860641025703", 6, "en")).toBe("75,860,641.0257");
  });

  it("writes whole amounts without a pretend fraction", () => {
    expect(formatTokenAmount("5000000000000000000", 18, "en")).toBe("5");
  });

  /*
   * With no whole part the entire figure is in the small digits, so cutting at
   * four would render real dust as zero.
   */
  it("shows more digits when there is no whole part", () => {
    expect(formatTokenAmount("123456789012345", 18, "en")).toBe("0.00012345");
    expect(formatTokenAmount("10000000000", 18, "en")).toBe("0.00000001");
  });

  /*
   * A balance too small to show is under the smallest shown figure, which is
   * true. Rendering it as zero would say the address holds nothing of a token it
   * holds something of.
   */
  it("says a dust balance is small rather than absent", () => {
    expect(formatTokenAmount("1", 18, "en")).toBe("< 0.00000001");
    expect(formatTokenAmount("1", 18, "tr")).toBe("< 0,00000001");
  });

  it("writes an exact zero as zero", () => {
    expect(formatTokenAmount("0", 18, "en")).toBe("0");
  });

  it("handles a token with no decimals at all", () => {
    expect(formatTokenAmount("4200", 0, "en")).toBe("4,200");
  });

  it.each([
    ["a negative amount", "-5", 18],
    ["a decimal point in the base units", "1.5", 18],
    ["something that is not a number", "0xdead", 18],
    ["fractional decimals", "1000", 1.5],
    ["negative decimals", "1000", -2],
  ])("refuses %s", (_label, amount, decimals) => {
    expect(formatTokenAmount(amount, decimals)).toBe(ABSENT);
  });
});
