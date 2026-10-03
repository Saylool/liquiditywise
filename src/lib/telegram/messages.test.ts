import { describe, expect, it } from "vitest";

import type { Position } from "../../schemas";
import { formatFeePpm, formatPercent, formatPrice } from "../format/displayFormats";
import { getDictionary } from "../i18n/dictionaries";
import { LOCALES } from "../i18n/locales";
import type { SmartPair } from "../analytics/smartLiquidity";
import { getSmartLiquidityCopy } from "../i18n/smartLiquidityCopy";
import { alertText, smartMoneyUrl, smartShiftText, weeklyDigestText } from "./messages";
import type { WeeklyDigest } from "./weeklyDigest";

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

describe("the Monday digest", () => {
  /* USDC/WETH as token0/token1, so its prices are WETH per USDC and are quoted the other way up, as USDC per WETH. */
  const digest: WeeklyDigest = {
    days: 6.875,
    gaining: [{ pool: "0xb", pair: "WETH / USDT", feePpm: 3000, from: 0.4, to: 0.7 }],
    losing: [{ pool: "0xa", pair: "USDC / WETH", feePpm: 500, from: 0.6, to: 0.3 }],
    ranges: [
      { pool: "0xa", pair: "USDC / WETH", feePpm: 500, then: [0.0003, 0.0005], now: [0.0004, 0.0006], currentPrice: 0.0005 },
      { pool: "0xb", pair: "WETH / USDT", feePpm: 3000, then: [2800, 3200], now: [3300, 3900], currentPrice: 3500 },
    ],
  };
  const en = getDictionary("en");

  it("opens with the chain and the days, and names the movers each way with their share then and now", () => {
    const text = weeklyDigestText(digest, en, "en", 8453);

    expect(text.startsWith(en.telegram.weeklyHeading("Base", "7"))).toBe(true);
    expect(text).toContain(`${en.telegram.weeklyGaining}\n• WETH / USDT · ${formatFeePpm(3000, "en")}: ${formatPercent(0.4, "en")} → ${formatPercent(0.7, "en")}`);
    expect(text).toContain(`${en.telegram.weeklyLosing}\n• USDC / WETH · ${formatFeePpm(500, "en")}: ${formatPercent(0.6, "en")} → ${formatPercent(0.3, "en")}`);
    expect(text.indexOf(en.telegram.weeklyGaining)).toBeLessThan(text.indexOf(en.telegram.weeklyLosing));
  });

  it("gives each moved range as prices then → now, both quoted the way the pair is at its price now", () => {
    const text = weeklyDigestText(digest, en, "en", 1);
    const inverted = `${formatPrice(1 / 0.0005, "en")} – ${formatPrice(1 / 0.0003, "en")} USDC/WETH → ${formatPrice(1 / 0.0006, "en")} – ${formatPrice(1 / 0.0004, "en")} USDC/WETH`;
    const asIs = `${formatPrice(2800, "en")} – ${formatPrice(3200, "en")} USDT/WETH → ${formatPrice(3300, "en")} – ${formatPrice(3900, "en")} USDT/WETH`;

    expect(text).toContain(`${en.telegram.weeklyRanges}\n• USDC / WETH · ${formatFeePpm(500, "en")}: ${inverted}\n• WETH / USDT · ${formatFeePpm(3000, "en")}: ${asIs}`);
  });

  it("writes a range without a unit rather than with a wrong one when the pair's name cannot be split", () => {
    const odd: WeeklyDigest = { ...digest, ranges: [{ ...digest.ranges[1]!, pair: "WETH-USDT" }] };
    const text = weeklyDigestText(odd, en, "en", 1);

    expect(text).toContain(`${formatPrice(2800, "en")} – ${formatPrice(3200, "en")} → ${formatPrice(3300, "en")} – ${formatPrice(3900, "en")}`);
  });

  it("links to the smart-money page in the reader's language and on the digest's chain", () => {
    expect(smartMoneyUrl("tr", 8453)).toBe("https://liquiditywise.com/tr/smart-money?chain=base");
    expect(smartMoneyUrl("en", 1)).toBe("https://liquiditywise.com/en/smart-money?chain=ethereum");
    expect(weeklyDigestText(digest, getDictionary("tr"), "tr", 8453)).toContain(
      getDictionary("tr").telegram.weeklyLink("https://liquiditywise.com/tr/smart-money?chain=base"),
    );
  });

  it("says it is a measurement and not a suggestion, and ends with the footer", () => {
    const text = weeklyDigestText(digest, en, "en", 1);

    expect(text).toContain(en.telegram.weeklyNote);
    expect(text.endsWith(`\n\n${en.telegram.footer}`)).toBe(true);
  });

  it("leaves out a part with nothing in it rather than a heading over nothing", () => {
    const text = weeklyDigestText({ ...digest, gaining: [], ranges: [] }, en, "en", 1);

    expect(text).not.toContain(en.telegram.weeklyGaining);
    expect(text).not.toContain(en.telegram.weeklyRanges);
    expect(text).toContain(en.telegram.weeklyLosing);
  });

  it("speaks the link's language", () => {
    const text = weeklyDigestText(digest, getDictionary("de"), "de", 1);

    expect(text).toContain(getDictionary("de").telegram.weeklyGaining);
    expect(text).toContain(getDictionary("de").telegram.footer);
  });
});

describe("the Monday digest's words", () => {
  it.each(LOCALES)("in %s, say how to turn it on and off, and use the smart-money page's own words", (locale) => {
    const { telegram } = getDictionary(locale);
    const copy = getSmartLiquidityCopy(locale);

    expect(telegram.weeklyOn).toContain("/weekly");
    expect(telegram.help).toContain("/weekly");
    expect(telegram.intro).toContain("/weekly");
    expect(telegram.weeklyOff.trim().length).toBeGreaterThan(10);
    expect(telegram.weeklyHeading("CHAIN", "7")).toBe(`📅 ${copy.heading} · CHAIN\n${copy.trend.heading("7")}`);
    expect(telegram.weeklyGaining).toBe(copy.trend.gaining);
    expect(telegram.weeklyLosing).toBe(copy.trend.losing);
    expect(telegram.weeklyMover("PAIR", "FROM", "TO")).toBe(copy.trend.mover("PAIR", "FROM", "TO"));
    expect(telegram.weeklyRange("PAIR", "THEN", "NOW")).toMatch(/PAIR.*THEN.*NOW/s);
    expect(telegram.weeklyLink("URL")).toContain("URL");
    expect(telegram.weeklyNote.trim().length).toBeGreaterThan(10);
  });

  it("are not left in English", () => {
    const english = getDictionary("en").telegram;

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const { telegram } = getDictionary(locale);
      for (const key of ["weeklyOn", "weeklyOff", "weeklyRanges", "weeklyNote"] as const) {
        expect(telegram[key], `${locale} ${key}`).not.toBe(english[key]);
      }
      expect(telegram.weeklyLink("URL"), locale).not.toBe(english.weeklyLink("URL"));
    }
  });
});
