import { describe, expect, it } from "vitest";

import type { Position } from "../../schemas";
import { formatPrice } from "../format/displayFormats";
import { getDictionary } from "../i18n/dictionaries";
import { LOCALES } from "../i18n/locales";
import type { SmartPair } from "../analytics/smartLiquidity";
import { alertText, smartShiftText } from "./messages";

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

describe("the alert that the best-earning liquidity has moved", () => {
  /* WETH per USDC 0.0003 to 0.0005 then, 0.0004 to 0.0006 now: quoted USDC per WETH, they invert and swap ends. */
  const shift = {
    pair: {
      pool: { ...position.pool, feePpm: 500, token0: { chainId: 1, address: "0xa", symbol: "USDC", decimals: 6 }, token1: { chainId: 1, address: "0xb", symbol: "WETH", decimals: 18 } },
      positions: 6,
      valueUsd: 1,
      medianLowerRatio: 1,
      medianUpperRatio: 1,
      medianLowerPrice: 0.0004,
      medianUpperPrice: 0.0006,
      medianYearlyYield: 0.3,
      currentPrice: 0.0005,
    } as unknown as SmartPair,
    then: [0.0003, 0.0005] as const,
    now: [0.0004, 0.0006] as const,
  };

  it("gives where it sat and where it sits as prices in the pair's quote, and the pair and the protocol", () => {
    const text = smartShiftText(shift, getDictionary("en"), "en");

    expect(text.startsWith("🔀 The best-earning liquidity in USDC/WETH (Uniswap v3) has moved.")).toBe(true);
    expect(text).toContain(`${formatPrice(1 / 0.0005, "en")} – ${formatPrice(1 / 0.0003, "en")} USDC/WETH`);
    expect(text).toContain(`${formatPrice(1 / 0.0006, "en")} – ${formatPrice(1 / 0.0004, "en")} USDC/WETH`);
    expect(text).toContain(getDictionary("en").telegram.footer);
  });

  it("says where it sat before where it sits, not the other way round", () => {
    const text = smartShiftText(shift, getDictionary("en"), "en");
    const then = `${formatPrice(1 / 0.0005, "en")} – ${formatPrice(1 / 0.0003, "en")}`;
    const now = `${formatPrice(1 / 0.0006, "en")} – ${formatPrice(1 / 0.0004, "en")}`;

    expect(text.indexOf(then)).toBeGreaterThan(-1);
    expect(text.indexOf(then)).toBeLessThan(text.indexOf(now));
  });

  it("names the chain beside the protocol off mainnet, and speaks the link's language", () => {
    expect(smartShiftText(shift, getDictionary("en"), "en", 137)).toContain("(Uniswap v3 · Polygon)");
    expect(smartShiftText(shift, getDictionary("tr"), "tr")).toContain("havuzunda en çok kazanan likidite");
  });
});

describe("the smart-money alert's words", () => {
  it("say, in every language, how to turn it on and off, that it is a chain measurement and not a suggestion, and where the button is", () => {
    for (const locale of LOCALES) {
      const { telegram } = getDictionary(locale);

      expect(telegram.smartOn, locale).toContain("/smart");
      expect(telegram.help, locale).toContain("/smart");
      expect(telegram.intro, locale).toContain("/smart");
      expect(telegram.smartNoLink, locale).toContain(telegram.connect);
      expect(telegram.smartShift("A/B", "Uniswap v3", "1 – 2 X/Y", "3 – 4 X/Y"), locale).toMatch(/A\/B.*Uniswap v3.*1 – 2 X\/Y.*3 – 4 X\/Y/s);
      expect(telegram.smartOff.trim().length, locale).toBeGreaterThan(10);
    }
  });

  it("are not left in English", () => {
    const english = getDictionary("en").telegram;

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const { telegram } = getDictionary(locale);
      expect(telegram.smartOn, locale).not.toBe(english.smartOn);
      expect(telegram.smartOff, locale).not.toBe(english.smartOff);
      expect(telegram.smartNoLink, locale).not.toBe(english.smartNoLink);
    }
  });
});
