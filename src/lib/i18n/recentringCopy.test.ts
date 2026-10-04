import { describe, expect, it } from "vitest";

import { LOCALES } from "./locales";
import { getRecentringCopy, type RecentringCopy } from "./recentringCopy";

/*
 * The re-centring panel's words, in every language. A label left in English,
 * a figure dropped from a sentence, or a language that forgot to say what the
 * replay cannot see would each leave its reader with less than the English
 * one — and a strategy replayed over the past is exactly where a missing
 * caveat reads as a promise.
 */

type Locale = (typeof LOCALES)[number];

const STRINGS = [
  "heading",
  "intro",
  "noHistory",
  "unreplayed",
  "never",
  "hookMayAlter",
  "tableCaption",
  "columnFigure",
  "columnRecentred",
  "columnNever",
  "recentres",
  "swapFees",
  "gas",
  "gasNotCounted",
  "endValue",
  "endValueBeforeFees",
  "vsHeld",
  "endValueNote",
  "gasLabel",
  "apply",
  "gasNote",
  "gasUnusable",
  "showRecentres",
  "recentresCaption",
  "columnDay",
  "columnClose",
  "columnRange",
  "columnSwapped",
  "columnSwapFee",
  "closesOnly",
  "noImpact",
  "caveat",
] as const satisfies readonly (keyof RecentringCopy)[];

/** Every sentence a template writes, filled with stand-ins the assertions can find. */
const templated = (copy: RecentringCopy) => ({
  recentredOn: copy.recentredOn("2026-09-02, 2026-09-09"),
  feeStated: copy.feeStated("0.30%"),
  feeMeasured: copy.feeMeasured("0.042%"),
  held: copy.held("$1,032"),
  difference: copy.difference("-$12.50"),
  differenceBeforeFees: copy.differenceBeforeFees("+$3.25"),
  swapped: copy.swapped("$490.00", "WETH", "USDC"),
});

describe("the re-centring panel's words", () => {
  it("are written in every language, not left in English", () => {
    const english = getRecentringCopy("en");

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const copy = getRecentringCopy(locale);
      for (const key of STRINGS) {
        expect(copy[key].trim(), `${locale} ${key}`).not.toBe("");
        expect(copy[key], `${locale} ${key}`).not.toBe(english[key]);
      }
      const ours = templated(english);
      for (const [key, sentence] of Object.entries(templated(copy))) {
        expect(sentence, `${locale} ${key}`).not.toBe(ours[key as keyof typeof ours]);
      }
    }
  });

  /*
   * One exception, on purpose: count × cost = total is arithmetic, written the
   * same way in every one of these languages. It is held to keep its order.
   */
  it("put every figure they are given into their sentences, in every language", () => {
    for (const locale of LOCALES) {
      const copy = getRecentringCopy(locale);
      const sentences = templated(copy);

      expect(sentences.recentredOn, locale).toContain("2026-09-02, 2026-09-09");
      expect(sentences.feeStated, locale).toContain("0.30%");
      expect(sentences.feeMeasured, locale).toContain("0.042%");
      expect(sentences.held, locale).toContain("$1,032");
      expect(sentences.difference, locale).toContain("-$12.50");
      expect(sentences.differenceBeforeFees, locale).toContain("+$3.25");
      /* What was sold is named before what it was sold for, so the two never trade places. */
      expect(sentences.swapped, locale).toContain("$490.00");
      expect(sentences.swapped.indexOf("WETH"), locale).toBeGreaterThanOrEqual(0);
      expect(sentences.swapped.indexOf("USDC"), locale).toBeGreaterThan(sentences.swapped.indexOf("WETH"));
      expect(copy.gasValue("2", "$5.00", "$10.00"), locale).toBe("2 × $5.00 = $10.00");
    }
  });

  /* What it leaves out is said beside it every time it is shown, not only on the method page. */
  it("say what daily closes cannot see, that price impact and gas are left out, and that it is no advice, in every language", () => {
    const LEAVES_OUT: Record<Locale, readonly string[]> = {
      en: ["not at the edge", "came back before its close", "Price impact is not modelled", "Gas is not counted", "today's dollar rate", "not advice"],
      tr: ["kenarda değil kapanışta", "kapanıştan önce geri dönen", "Fiyat etkisi modellenmedi", "Gas, burada", "bugünkü dolar kuru", "tavsiyesi değildir"],
      de: ["nicht an der Grenze", "vor seinem Schluss zurückkam", "Preiseinfluss ist nicht modelliert", "Gas wird nicht gezählt", "heutigen Dollarkurs", "keine Finanzberatung"],
      es: ["no en el borde", "volvió antes de su cierre", "No se modela el impacto", "El gas no se cuenta", "tasa en dólares de hoy", "no asesoramiento"],
      ar: ["لا عند الحافة", "وعاد قبل إغلاقه", "أثر السعر غير منمذج", "لا يُحتسب الغاز", "بسعر الدولار اليوم", "ليس نصيحة"],
      hi: ["किनारे पर नहीं", "बंद होने से पहले लौट आया", "कीमत पर असर का मॉडल नहीं", "गैस नहीं गिनी जाती", "आज की डॉलर दर", "सलाह नहीं"],
      zh: ["而不是在边界上", "又在收盘前回来", "没有模拟价格冲击", "不计 gas", "今天的美元汇率", "不构成财务建议"],
      ru: ["а не на границе", "вернулась до закрытия", "Влияние на цену не моделируется", "Gas не учитывается", "сегодняшнему курсу", "не финансовый совет"],
      pt: ["não na borda", "voltou antes do fechamento", "O impacto no preço não é modelado", "O gas não é contado", "taxa em dólar de hoje", "não uma recomendação"],
      "zh-Hant": ["而不是在邊界上", "又在收盤前回來", "沒有模擬價格衝擊", "不計 gas", "今天的美元匯率", "不構成財務建議"],
    };

    for (const locale of LOCALES) {
      const { closesOnly, noImpact, gasNote, caveat } = getRecentringCopy(locale);
      const said = [closesOnly, noImpact, gasNote, caveat].join(" ");
      for (const words of LEAVES_OUT[locale]) expect(said, `${locale}: ${words}`).toContain(words);
    }
  });

  /*
   * The site's own words in each language, the ones its other panels use for
   * the same things — so this panel does not call a range, a position or a
   * swap something the panel above it does not.
   */
  it("use the terms the rest of the site uses in each language", () => {
    const TERMS: Partial<Record<Locale, readonly string[]>> = {
      tr: ["aralık", "komisyon", "pozisyon", "likidite", "takas"],
      ar: ["نطاق", "رسوم", "مركز", "تجمّع", "تبادل"],
      hi: ["दायरा", "शुल्क", "पोज़िशन", "तरलता", "पृष्ठ", "स्वैप"],
      zh: ["区间", "手续费", "仓位", "流动性", "兑换"],
      "zh-Hant": ["區間", "手續費", "倉位", "期間", "兌換", "流動性"],
    };

    for (const [locale, terms] of Object.entries(TERMS) as [Locale, readonly string[]][]) {
      const copy = getRecentringCopy(locale);
      const all = [...STRINGS.map((key) => copy[key]), ...Object.values(templated(copy))]
        .join(" ")
        .toLocaleLowerCase(locale);
      for (const term of terms) expect(all, `${locale}: ${term}`).toContain(term.toLocaleLowerCase(locale));
    }
  });

  /* Latin figures lay out left to right even on a right-to-left page, so no arrow here may point back. */
  it("never points an Arabic arrow backwards between figures", () => {
    const copy = getRecentringCopy("ar");
    const all = [...STRINGS.map((key) => copy[key]), ...Object.values(templated(copy))].join(" ");

    expect(all).not.toContain("←");
  });

  it("say why there are no figures in a sentence of its own, distinct for each reason", () => {
    for (const locale of LOCALES) {
      const { noHistory, unreplayed, never } = getRecentringCopy(locale);
      expect(new Set([noHistory, unreplayed, never]).size, locale).toBe(3);
    }
  });
});
