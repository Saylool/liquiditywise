import { describe, expect, it } from "vitest";

import { LOCALES } from "./locales";
import { getRecentCopy } from "./recentCopy";

describe("the words around what was last looked at", () => {
  it("are written in every language, not left in English", () => {
    const english = getRecentCopy("en");

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const copy = getRecentCopy(locale);
      for (const key of ["heading", "recently", "forget"] as const) {
        expect(copy[key].trim(), `${locale} ${key}`).not.toBe("");
        expect(copy[key], `${locale} ${key}`).not.toBe(english[key]);
      }
      expect(copy.note("5", "2"), locale).not.toBe(english.note("5", "2"));
    }
  });

  /*
   * The privacy sentence, held to what the site's other such sentences say:
   * the counts it is given, that it is the browser and only the browser, and
   * that clearing the site's data removes it. Checked by the words each
   * language's interface already uses for the browser and for data, so the
   * sentence cannot drift into saying something softer.
   */
  it("state the counts, name the browser as the only place, and say clearing the site's data removes it, in every language", () => {
    const BROWSER: Record<(typeof LOCALES)[number], string> = {
      en: "browser",
      tr: "tarayıcı",
      de: "Browser",
      es: "navegador",
      ar: "المتصفح",
      hi: "ब्राउज़र",
      zh: "浏览器",
      ru: "браузер",
      pt: "navegador",
      "zh-Hant": "瀏覽器",
    };
    const CLEARING: Record<(typeof LOCALES)[number], string> = {
      en: "clearing this site's data",
      tr: "verilerini temizlemek",
      de: "Löschen der Website-Daten",
      es: "borrar los datos",
      ar: "مسح بيانات",
      hi: "डेटा साफ़",
      zh: "清除本站数据",
      ru: "очистка данных сайта",
      pt: "limpar os dados",
      "zh-Hant": "清除本站資料",
    };
    const SERVER: Record<(typeof LOCALES)[number], string> = {
      en: "server",
      tr: "Sunucu",
      de: "Server",
      es: "servidor",
      ar: "الخادم",
      hi: "सर्वर",
      zh: "服务器",
      ru: "сервер",
      pt: "servidor",
      "zh-Hant": "伺服器",
    };

    for (const locale of LOCALES) {
      const note = getRecentCopy(locale).note("5", "2");
      expect(note, locale).toContain("5");
      expect(note, locale).toContain("2");
      expect(note, locale).toContain(BROWSER[locale]);
      expect(note, locale).toContain(CLEARING[locale]);
      expect(note, locale).toContain(SERVER[locale]);
    }
  });

  /* The word for a pool is the interface's own in each language, so the block reads as part of the page. */
  it("call a pool what the rest of the interface calls it", () => {
    const POOL: Record<(typeof LOCALES)[number], string> = {
      en: "pools",
      tr: "havuz",
      de: "Pools",
      es: "pools",
      ar: "تجمّع",
      hi: "पूल",
      zh: "资金池",
      ru: "пул",
      pt: "pools",
      "zh-Hant": "資金池",
    };

    for (const locale of LOCALES) {
      expect(getRecentCopy(locale).note("5", "2"), locale).toContain(POOL[locale]);
    }
  });

  it("keep the controls short enough for one line beside the pool box", () => {
    for (const locale of LOCALES) {
      const copy = getRecentCopy(locale);
      expect(copy.recently.length, locale).toBeLessThanOrEqual(16);
      expect(copy.forget.length, locale).toBeLessThanOrEqual(14);
    }
  });
});
