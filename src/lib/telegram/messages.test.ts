import { describe, expect, it } from "vitest";

import type { Position } from "../../schemas";
import { formatPrice } from "../format/displayFormats";
import { getDictionary } from "../i18n/dictionaries";
import { LOCALES } from "../i18n/locales";
import { alertText } from "./messages";

/*
 * USDC/WETH with USDC as token0, so the pool's own prices are WETH per USDC —
 * 0.0003 to 0.0005 — and the page quotes them the other way up, as USDC per
 * WETH: 2,000 to 3,333. The pool is at tick 5000, near the upper tick, which
 * on the page is the *lower* price.
 */
const position = {
  tokenId: "7",
  pool: {
    protocolVersion: "v3",
    chainId: 1,
    id: "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
    token0: { symbol: "USDC", decimals: 6 },
    token1: { symbol: "WETH", decimals: 18 },
  },
  tickLower: 0,
  tickUpper: 5108,
  lowerPrice: 0.0003,
  upperPrice: 0.0005,
  currentTick: 5000,
  inRange: true,
} as unknown as Position;

describe("the warning that a position is close to an edge", () => {
  it("gives the price now and the edge it is near, both the way the page quotes them", () => {
    const text = alertText({ kind: "nearing", position, edge: "upper" }, getDictionary("tr"), "tr");
    const now = formatPrice(1 / (0.0003 * 1.0001 ** 5000), "tr");
    const edge = formatPrice(1 / 0.0005, "tr");

    expect(text.startsWith("⏳ USDC/WETH (Uniswap v3) aralığının sınırına yaklaştı:")).toBe(true);
    expect(text).toContain(`Fiyat ${now}; ${edge} aşılırsa`);
    expect(text).toContain(getDictionary("tr").telegram.footer);
  });

  it("names the other edge's price when the lower tick is the near one", () => {
    const low = { ...position, currentTick: 100 } as Position;
    const text = alertText({ kind: "nearing", position: low, edge: "lower" }, getDictionary("en"), "en");

    expect(text).toContain(`past ${formatPrice(1 / 0.0003, "en")} it holds a single token`);
  });

  it.each(LOCALES)("is written in %s, with every value in its place", (locale) => {
    const text = getDictionary(locale).telegram.nearing("PAIR", "PROTOCOL", "RANGE", "PRICE", "EDGE");

    for (const value of ["PAIR", "PROTOCOL", "RANGE", "PRICE", "EDGE"]) expect(text).toContain(value);
    expect(text.startsWith("⏳")).toBe(true);
  });
});

describe("an alert about a position off mainnet", () => {
  const onBase = { ...position, pool: { ...position.pool, chainId: 8453 } } as Position;

  it("names the chain beside the protocol, so it cannot be read as a mainnet pool of the same pair", () => {
    const text = alertText({ kind: "left", position: onBase }, getDictionary("en"), "en", 8453);

    expect(text).toContain("Uniswap v3 · Base");
  });

  it("names the chain of the link for a position that is gone, which has no pool left to ask", () => {
    const text = alertText({ kind: "closed", key: "v3:7" }, getDictionary("en"), "en", 42161);

    expect(text).toContain("Uniswap v3 · Arbitrum One");
    expect(alertText({ kind: "closed", key: "v3:7" }, getDictionary("en"), "en")).not.toContain("·");
  });

  it("says nothing extra on mainnet", () => {
    expect(alertText({ kind: "left", position }, getDictionary("en"), "en")).toContain("(Uniswap v3)");
  });
});
