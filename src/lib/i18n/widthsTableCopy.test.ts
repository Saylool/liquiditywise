import { describe, expect, it } from "vitest";

import { LOCALES } from "./locales";
import { getWidthsTableCopy, type WidthsTableCopy } from "./widthsTableCopy";

/*
 * The "narrow or wide?" table's words, in every language. A column left in
 * English, a figure dropped from a sentence, or a language that forgot to say
 * the table is the past replayed would each leave its reader with less than
 * the English one — and a table of what every width earned is exactly where a
 * missing caveat reads as a promise.
 */

type Locale = (typeof LOCALES)[number];

const STRINGS = [
  "heading",
  "intro",
  "noHistory",
  "tableCaption",
  "columnWidth",
  "columnRange",
  "columnDays",
  "columnWorth",
  "columnRecentres",
  "columnEndValue",
  "columnEndValueBeforeFees",
  "columnDifference",
  "share",
  "columnsNote",
  "gasNotCounted",
  "noImpact",
  "caveat",
] as const satisfies readonly (keyof WidthsTableCopy)[];

/** Every sentence a template writes, filled with stand-ins the assertions can find. */
const templated = (copy: WidthsTableCopy) => ({
  openedOn: copy.openedOn("2026-08-28"),
  columnFees: copy.columnFees("$1,000"),
  gasCounted: copy.gasCounted("$5.00"),
});

describe("the widths table's words", () => {
  it("are written in every language, not left in English", () => {
    const english = getWidthsTableCopy("en");

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const copy = getWidthsTableCopy(locale);
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
   * Two exceptions, on purpose: three day counts with slashes, and two end
   * values with an arrow, are arithmetic written the same way in every one of
   * these languages. Both are held to keep their order — inside first, never
   * re-centred first.
   */
  it("put every figure they are given into their sentences, in every language", () => {
    for (const locale of LOCALES) {
      const copy = getWidthsTableCopy(locale);
      const sentences = templated(copy);

      expect(sentences.openedOn, locale).toContain("2026-08-28");
      expect(sentences.columnFees, locale).toContain("$1,000");
      expect(sentences.gasCounted, locale).toContain("$5.00");
      expect(copy.daysValue("20", "4", "6"), locale).toBe("20 / 4 / 6");
      expect(copy.endValues("$1,031", "$1,019"), locale).toBe("$1,031 → $1,019");
    }
  });

  /* What it leaves out is said under it every time it is shown, not only on the method page. */
  it("say it is the past replayed and not a forecast or advice, that gas and price impact are left out, in every language", () => {
    const LEAVES_OUT: Record<Locale, readonly string[]> = {
      en: ["not a forecast", "recommendation", "Gas is not counted", "Price impact is not modelled"],
      tr: ["bir tahmin değil", "tavsiye değildir", "Gas sayılmadı", "Fiyat etkisi modellenmedi"],
      de: ["keine Vorhersage", "Empfehlung", "Gas wird nicht gezählt", "Preiseinfluss ist nicht modelliert"],
      es: ["no una previsión", "recomendación", "El gas no se cuenta", "No se modela el impacto"],
      ar: ["لا توقّع", "نصيحة", "لا يُحتسب الغاز", "أثر السعر غير منمذج"],
      hi: ["पूर्वानुमान नहीं", "सलाह नहीं", "गैस नहीं गिनी जाती", "कीमत पर असर का मॉडल नहीं"],
      zh: ["不是预测", "建议", "不计 gas", "没有模拟价格冲击"],
      ru: ["не прогноз", "не рекомендация", "Gas не учитывается", "Влияние на цену не моделируется"],
      pt: ["não uma previsão", "recomendação", "O gas não é contado", "O impacto no preço não é modelado"],
      "zh-Hant": ["不是預測", "建議", "不計 gas", "沒有模擬價格衝擊"],
    };

    for (const locale of LOCALES) {
      const { caveat, gasNotCounted, noImpact } = getWidthsTableCopy(locale);
      const said = [caveat, gasNotCounted, noImpact].join(" ");
      for (const words of LEAVES_OUT[locale]) expect(said, `${locale}: ${words}`).toContain(words);
    }
  });

  /*
   * The site's own words in each language, the ones its other panels use for
   * the same things — so this table does not call a range, a width or a fee
   * something the widths panel above it does not.
   */
  it("use the terms the rest of the site uses in each language", () => {
    const TERMS: Partial<Record<Locale, readonly string[]>> = {
      tr: ["aralık", "komisyon", "genişlik", "pozisyon", "yeniden ortala"],
      de: ["bereich", "gebühren", "breite"],
      es: ["rango", "comisiones", "amplitud"],
      ar: ["نطاق", "رسوم", "الاتساع", "مركز", "تجمّع"],
      hi: ["दायरा", "शुल्क", "चौड़ाई", "पोज़िशन", "पुनःकेंद्रण"],
      zh: ["区间", "手续费", "宽度", "仓位", "重新居中"],
      ru: ["диапазон", "комиссии", "ширин", "перецентрирован"],
      pt: ["faixa", "taxas", "largura", "recentraliza"],
      "zh-Hant": ["區間", "手續費", "寬度", "倉位", "重新置中"],
    };

    for (const [locale, terms] of Object.entries(TERMS) as [Locale, readonly string[]][]) {
      const copy = getWidthsTableCopy(locale);
      const all = [...STRINGS.map((key) => copy[key]), ...Object.values(templated(copy))]
        .join(" ")
        .toLocaleLowerCase(locale);
      for (const term of terms) expect(all, `${locale}: ${term}`).toContain(term.toLocaleLowerCase(locale));
    }
  });

  /*
   * The figures are laid out left to right even on the right-to-left page,
   * so the arrow between them points right in Arabic too; between the Arabic
   * words of the label it follows the reading direction and points left.
   */
  it("points the Arabic arrow from never re-centred to re-centred, both between figures and between words", () => {
    const copy = getWidthsTableCopy("ar");

    expect(copy.endValues("$1,031", "$1,019")).toBe("$1,031 → $1,019");
    expect(copy.columnEndValue).toContain("←");
    expect(copy.columnEndValue).not.toContain("→");
    expect(copy.columnEndValueBeforeFees).toContain("←");
    const prose = [copy.intro, copy.columnsNote, copy.caveat, copy.noImpact].join(" ");
    expect(prose).not.toMatch(/[←→]/);
  });

  /* Taiwan's words, not the mainland's: the page it sits on says 重新置中 and 區間. */
  it("writes Traditional Chinese in Taiwan's usage, not as the Simplified copy transliterated", () => {
    const copy = getWidthsTableCopy("zh-Hant");
    const all = STRINGS.map((key) => copy[key]).join(" ");

    expect(all).toContain("重新置中");
    expect(all).not.toContain("重新居中");
    expect(all).toContain("重演");
    expect(all).not.toContain("重放");
  });
});
