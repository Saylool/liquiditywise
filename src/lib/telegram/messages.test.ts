import { describe, expect, it } from "vitest";

import type { Position } from "../../schemas";
import { formatFeePpm, formatPercent, formatPrice, formatTokenQuantity } from "../format/displayFormats";
import { getDictionary } from "../i18n/dictionaries";
import { LOCALES } from "../i18n/locales";
import type { SmartPair } from "../analytics/smartLiquidity";
import { getSmartLiquidityCopy } from "../i18n/smartLiquidityCopy";
import type { LeftRangeLines } from "./leftRange";
import { alertText, poolRangeMovedText, poolWatchedText, poolWatchesText, smartMoneyUrl, smartShiftText, weeklyDigestText } from "./messages";
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

describe("the alert that a position has left its range", () => {
  /* The position above, now past its upper tick: the pool's prices fell below 0.0003 WETH per USDC... quoted, above 3,333 USDC per WETH. */
  const left = { ...position, currentTick: 6000, inRange: false } as Position;
  const recentre = {
    sold: "token1",
    amountIn: 1.2,
    feePpm: 500,
    fee: 0.0006,
    lowerPrice: 0.00038,
    upperPrice: 0.00042,
    hookMayAlterSwaps: false,
  } as const;
  const lines: LeftRangeLines = { feeYield: 0.2345, recentre };
  const en = getDictionary("en").telegram;

  it("says what happened, what the range is missing, what coming back would cost, and ends with the footer", () => {
    expect(alertText({ kind: "left", position: left }, getDictionary("en"), "en", 1, lines)).toBe(
      [
        "⚠️ USDC/WETH (Uniswap v3) has left its range: 2,000 – 3,333.33 USDC/WETH. It holds a single token and earns nothing until the price comes back.",
        "Over the last seven days, liquidity in range in this pool was paid fees at about 23.45% a year of what is in the pool; out of range, this position earns none of it.",
        "Re-centring it on the current price at the same width, as 2,380.95 – 2,631.58 USDC/WETH, would mean swapping about 1.2 WETH; the pool's 0.05% fee on that is about 0.0006 WETH. Price impact and gas are not counted.",
        "Information only — not financial advice. Read from public on-chain data; nothing here can act for you.",
      ].join("\n\n"),
    );
  });

  it("goes out exactly as it always did when neither line could be made", () => {
    const plain = `${en.left("USDC/WETH", "Uniswap v3", `${formatPrice(1 / 0.0005, "en")} – ${formatPrice(1 / 0.0003, "en")} USDC/WETH`)}\n\n${en.footer}`;

    expect(alertText({ kind: "left", position: left }, getDictionary("en"), "en")).toBe(plain);
    expect(alertText({ kind: "left", position: left }, getDictionary("en"), "en", 1, { feeYield: null, recentre: null })).toBe(plain);
  });

  it("carries whichever line could be made, alone, in its place", () => {
    const yieldOnly = alertText({ kind: "left", position: left }, getDictionary("en"), "en", 1, { feeYield: 0.2345, recentre: null });
    const costOnly = alertText({ kind: "left", position: left }, getDictionary("en"), "en", 1, { feeYield: null, recentre });

    expect(yieldOnly).toContain(en.leftFeeYield(formatPercent(0.2345, "en")));
    expect(yieldOnly).not.toContain("Re-centring");
    expect(yieldOnly.endsWith(`\n\n${en.footer}`)).toBe(true);
    expect(costOnly).not.toContain("seven days");
    expect(costOnly).toContain("about 1.2 WETH");
    expect(costOnly.endsWith(`\n\n${en.footer}`)).toBe(true);
  });

  it("names the token sold, and the fee in it", () => {
    const usdc = alertText({ kind: "left", position: left }, getDictionary("en"), "en", 1, {
      feeYield: null,
      recentre: { ...recentre, sold: "token0", amountIn: 5_000, fee: 3 },
    });

    expect(usdc).toContain(`swapping about ${formatTokenQuantity(5_000, "en")} USDC; the pool's 0.05% fee on that is about 3 USDC.`);
  });

  it("adds the site's qualifier where a hook may change what a swap costs", () => {
    const hooked = alertText({ kind: "left", position: left }, getDictionary("en"), "en", 1, {
      feeYield: null,
      recentre: { ...recentre, hookMayAlterSwaps: true },
    });

    expect(hooked).toContain(`Price impact and gas are not counted. ${en.leftRecentreHook}`);
    expect(alertText({ kind: "left", position: left }, getDictionary("en"), "en", 1, lines)).not.toContain(en.leftRecentreHook);
  });

  it("is in the reader's language", () => {
    expect(alertText({ kind: "left", position: left }, getDictionary("tr"), "tr", 1, lines)).toBe(
      [
        "⚠️ USDC/WETH (Uniswap v3) aralığından çıktı: 2.000 – 3.333,33 USDC/WETH. Fiyat geri gelene kadar tek token tutuyor ve hiçbir şey kazanmıyor.",
        "Son yedi günde bu havuzda aralık içindeki likiditeye, havuzda olana oranla yıllık yaklaşık %23,45 komisyon ödendi; aralık dışındayken bu pozisyon bundan hiçbir şey kazanmaz.",
        "Pozisyonu şimdiki fiyatta, aynı genişlikte yeniden ortalamak (2.380,95 – 2.631,58 USDC/WETH) yaklaşık 1,2 WETH takas etmek demek olurdu; havuzun bunun üzerinden aldığı %0,05 komisyon yaklaşık 0,0006 WETH ederdi. Fiyat etkisi ve gas sayılmadı.",
        getDictionary("tr").telegram.footer,
      ].join("\n\n"),
    );
  });

  /* The lines are a leave's alone: a warning near an edge, or the news that it is back, says what it always said. */
  it.each([
    ["near an edge", { kind: "nearing", position, edge: "upper" }],
    ["back inside", { kind: "entered", position }],
    ["opened", { kind: "opened", position }],
  ] as const)("is not added to an alert that a position is %s", (_label, change) => {
    const text = alertText(change, getDictionary("en"), "en", 1, lines);

    expect(text).toBe(alertText(change, getDictionary("en"), "en"));
    expect(text).not.toContain("seven days");
    expect(text).not.toContain("Re-centring");
  });

  it("fits in one Telegram message in every language, with the longest figures and the qualifier", () => {
    const long = {
      ...left,
      pool: { ...left.pool, token0: { symbol: "X".repeat(40), decimals: 6 }, token1: { symbol: "Y".repeat(40), decimals: 18 } },
    } as Position;
    const widest: LeftRangeLines = {
      feeYield: 123.456,
      recentre: { ...recentre, amountIn: 123_456_789.123, fee: 1_234_567.891, hookMayAlterSwaps: true },
    };

    for (const locale of LOCALES) {
      const text = alertText({ kind: "left", position: long }, getDictionary(locale), locale, 8453, widest);
      expect([...text].length, locale).toBeLessThan(4096);
      expect(text.endsWith(getDictionary(locale).telegram.footer), locale).toBe(true);
    }
  });
});

describe("the left-range lines' words", () => {
  it.each(LOCALES)("in %s, put every figure in its place", (locale) => {
    const { telegram } = getDictionary(locale);

    expect(telegram.leftFeeYield("RATE")).toContain("RATE");
    const line = telegram.leftRecentre("RANGE", "AMOUNT", "FEE", "PAID");
    for (const value of ["RANGE", "AMOUNT", "FEE", "PAID"]) expect(line, value).toContain(value);
    expect(telegram.leftRecentreHook.trim().length).toBeGreaterThan(20);
  });

  it("are not left in English", () => {
    const english = getDictionary("en").telegram;

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const { telegram } = getDictionary(locale);
      expect(telegram.leftFeeYield("R"), locale).not.toBe(english.leftFeeYield("R"));
      expect(telegram.leftRecentre("A", "B", "C", "D"), locale).not.toBe(english.leftRecentre("A", "B", "C", "D"));
      expect(telegram.leftRecentreHook, locale).not.toBe(english.leftRecentreHook);
    }
  });

  /*
   * In the words each language's alerts and pages already use for a range, a
   * fee, a position, a pool, liquidity and a swap — so the new lines read as
   * the rest of the bot does.
   */
  it.each([
    ["tr", ["aralık", "komisyon", "pozisyon", "takas", "havuz", "likidite"]],
    ["ar", ["نطاق", "رسوم", "مركز", "تجمّع", "تبادل", "سيولة"]],
    ["hi", ["दायर", "शुल्क", "पोज़िशन", "तरलता", "स्वैप"]],
    ["zh-Hant", ["區間", "手續費", "倉位", "兌換", "資金池", "流動性"]],
    ["zh", ["区间", "手续费", "仓位", "兑换", "资金池", "流动性"]],
  ] as const)("in %s, use the site's own terms", (locale, terms) => {
    const { telegram } = getDictionary(locale);
    const text = [telegram.leftFeeYield("R"), telegram.leftRecentre("A", "B", "C", "D"), telegram.leftRecentreHook].join(" ").toLowerCase();

    for (const term of terms) expect(text, term).toContain(term);
  });

  it("tell the reader what a leave adds, in the site's panel and in the bot's help, in every language", () => {
    for (const locale of LOCALES) {
      const { telegram } = getDictionary(locale);

      for (const text of [telegram.intro, telegram.help]) {
        expect(text, locale).toMatch(/seven days|yedi gün|sieben Tage|siete días|السبعة|सात दिन|七天|семь дней|sete dias/);
      }
    }
  });
});

describe("the pool watch's messages", () => {
  /* WETH per USDC 0.0003 to 0.0005 at 0.0004: quoted USDC per WETH, 2,000 – 3,333 at 2,500. */
  const reading = {
    protocol: "v3" as const,
    chainId: 1 as const,
    poolId: `0x${"c".repeat(40)}`,
    pair: { token0: "USDC", token1: "WETH" },
    lpFeePpm: 500,
    currentPrice: 0.0004,
    range: [0.0003, 0.0005] as const,
  };
  const en = getDictionary("en");
  const range = (lower: number, upper: number, locale: (typeof LOCALES)[number] = "en") =>
    `${formatPrice(1 / upper, locale)} – ${formatPrice(1 / lower, locale)} USDC/WETH`;

  it("answers /watch with the pool, the range now for the default horizon and width, the price, the rule, what is kept, and the footer", () => {
    const text = poolWatchedText(reading, en, "en");

    expect(text.startsWith(`👁 Watching USDC/WETH (Uniswap v3, ${formatFeePpm(500, "en")}).`)).toBe(true);
    expect(text).toContain(en.telegram.watchRange(range(0.0003, 0.0005), formatPrice(2500, "en"), "30", "1"));
    expect(text).toContain(en.telegram.watchRule);
    expect(text).toContain(en.telegram.watchKept);
    expect(text.endsWith(`\n\n${en.telegram.footer}`)).toBe(true);
  });

  it("names a v4 pool's hook-set fee the way the v4 page does, and the chain beside the protocol off mainnet", () => {
    const onBase = { ...reading, protocol: "v4" as const, chainId: 8453 as const, lpFeePpm: null };
    const text = poolWatchedText(onBase, en, "en");

    expect(text).toContain(`USDC/WETH (Uniswap v4 · Base, ${en.v4.dynamicFee})`);
  });

  it("says a moved range as the range told, then the new one, then the price, and that it is a measurement", () => {
    const text = poolRangeMovedText({ ...reading, range: [0.00033, 0.00055] }, [0.0003, 0.0005], en, "en");
    const then = range(0.0003, 0.0005);
    const now = range(0.00033, 0.00055);

    expect(text.startsWith("📐 The suggested range for USDC/WETH (Uniswap v3, ")).toBe(true);
    expect(text).toContain(`${then} → ${now}`);
    expect(text).toContain(`The price is ${formatPrice(2500, "en")}`);
    expect(text).toContain(en.telegram.watchNote);
    expect(text.endsWith(`\n\n${en.telegram.footer}`)).toBe(true);
  });

  it("writes then → now with the arrow in Arabic too, the figures laid out left to right as the site's rule says", () => {
    const text = poolRangeMovedText({ ...reading, range: [0.00033, 0.00055] }, [0.0003, 0.0005], getDictionary("ar"), "ar");
    const then = range(0.0003, 0.0005, "ar");
    const now = range(0.00033, 0.00055, "ar");

    expect(text).toContain(`${then} → ${now}`);
    expect(text.indexOf(then)).toBeLessThan(text.indexOf(now));
    expect(text).not.toContain("←");
    expect(text).toContain(getDictionary("ar").telegram.watchNote);
  });

  it("speaks the watch's language: Turkish, Hindi and Traditional Chinese in their own terms", () => {
    expect(poolRangeMovedText(reading, [0.0003, 0.0005], getDictionary("tr"), "tr")).toContain("önerilen aralık kaydı");
    expect(poolWatchedText(reading, getDictionary("hi"), "hi")).toContain("सुझाया गया दायरा");
    expect(poolWatchedText(reading, getDictionary("zh-Hant"), "zh-Hant")).toContain("建議區間");
  });

  it("lists the watches with the range each was last told, and a pool that could not be read by its id, each with its /unwatch words", () => {
    const watch = { chainId: 8453 as const, protocol: "v3" as const, poolId: reading.poolId, told: { lower: 0.0003, upper: 0.0005, at: "2026-10-07T09:00:00.000Z" } };
    const text = poolWatchesText(
      [
        { watch, reading: { ...reading, chainId: 8453 } },
        { watch: { ...watch, chainId: 1 }, reading: null },
      ],
      en,
      "en",
    );

    expect(text.startsWith(en.telegram.watchesHeading("2"))).toBe(true);
    expect(text).toContain(`• ${en.telegram.watchesItem("USDC/WETH", "Uniswap v3 · Base", formatFeePpm(500, "en"), range(0.0003, 0.0005))}\n  /unwatch base ${reading.poolId}`);
    expect(text).toContain(`• Uniswap v3 ${reading.poolId}\n  /unwatch ${reading.poolId}`);
    expect(text.endsWith(`\n\n${en.telegram.footer}`)).toBe(true);
    expect(poolWatchesText([], en, "en")).toBe(en.telegram.watchesNone);
  });
});

describe("the pool watch's words", () => {
  it.each(LOCALES)("in %s, put every value in its place, use the arrow, and say how to watch, list and unwatch", (locale) => {
    const { telegram } = getDictionary(locale);

    expect(telegram.watching("PAIR", "PROTOCOL", "FEE")).toMatch(/^👁 .*PAIR.*PROTOCOL.*FEE/s);
    expect(telegram.watchRange("RANGE", "PRICE", "DAYS", "WIDTH")).toMatch(/DAYS.*WIDTH.*RANGE.*PRICE/s);
    const moved = telegram.watchMoved("PAIR", "PROTOCOL", "FEE", "THEN", "NOW", "PRICE");
    expect(moved.startsWith("📐")).toBe(true);
    expect(moved).toContain("THEN → NOW");
    expect(moved).toMatch(/PAIR.*PROTOCOL.*FEE.*THEN → NOW.*PRICE/s);
    expect(telegram.watchUnknownChain("WORD", "CHAINS")).toMatch(/WORD.*CHAINS/s);
    expect(telegram.watchNotOnChain("PROTOCOL", "CHAIN")).toMatch(/PROTOCOL.*CHAIN|CHAIN.*PROTOCOL/s);
    expect(telegram.watchFull("5")).toContain("5");
    expect(telegram.watchesHeading("3")).toContain("3");
    expect(telegram.watchesItem("PAIR", "PROTOCOL", "FEE", "TOLD")).toMatch(/PAIR.*PROTOCOL.*FEE.*TOLD/s);

    for (const text of [telegram.watchHow, telegram.help, telegram.intro]) {
      expect(text, locale).toContain("/watch");
      expect(text, locale).toContain("/unwatch");
    }
    expect(telegram.watchHow, locale).toContain("/watches");
    expect(telegram.watchKept, locale).toContain("/stop");
    expect(telegram.watchKept, locale).toContain("/unwatch");
    expect(telegram.watchesNone, locale).toContain("/watch");
    expect(telegram.watchFull("5"), locale).toContain("/unwatch");
  });

  it("say that /unwatch deletes with the same seven days, and that a chat may watch five, in every language", () => {
    for (const locale of LOCALES) {
      const { telegram } = getDictionary(locale);
      expect(telegram.unwatched, locale).toMatch(/seven days|yedi gün|sieben Tage|siete días|سبعة أيام|सात दिन|七天|семи дней|sete dias/);
      expect(telegram.intro, locale).toMatch(/five|beş|fünf|cinco|خمسة|पाँच|五|пяти/);
    }
  });

  it("are not left in English", () => {
    const english = getDictionary("en").telegram;

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const { telegram } = getDictionary(locale);
      for (const key of ["watchRule", "watchKept", "watchNote", "watchHow", "watchUnreadable", "unwatched", "notWatched", "watchesNone"] as const) {
        expect(telegram[key], `${locale} ${key}`).not.toBe(english[key]);
      }
    }
  });
});
