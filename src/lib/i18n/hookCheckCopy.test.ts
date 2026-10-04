import { describe, expect, it } from "vitest";

import { getHookCheckCopy, type HookCheckCopy } from "./hookCheckCopy";
import { LOCALES } from "./locales";

/*
 * The words beside a hook for what can be checked about it, in every
 * language. A line left in English, a name dropped from its sentence, or a
 * language that says "verified" without saying it is not an audit would each
 * leave its reader with less than the English one — and "verified" read as
 * "vetted" is the one misreading this whole block exists to prevent.
 */

type Locale = (typeof LOCALES)[number];

const STRINGS = [
  "heading",
  "directoryIntro",
  "meaning",
  "unverified",
  "unchecked",
  "readOn",
  "poolsLabel",
  "firstLabel",
  "poolsUnchecked",
  "pending",
] as const satisfies readonly (keyof HookCheckCopy)[];

/** Every sentence a template writes, filled with stand-ins the assertions can find. */
const templated = (copy: HookCheckCopy) => ({
  verified: copy.verified("Sourcify · Blockscout"),
  named: copy.named("LaunchHook"),
  proxy: copy.proxy(null),
  proxyNamed: copy.proxy("StablePairHook"),
  poolsNote: copy.poolsNote("1,000"),
});

describe("the words beside a hook's permissions", () => {
  it("are written in every language, not left in English", () => {
    const english = getHookCheckCopy("en");
    const ours = templated(english);

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const copy = getHookCheckCopy(locale);
      for (const key of STRINGS) {
        expect(copy[key].trim(), `${locale} ${key}`).not.toBe("");
        expect(copy[key], `${locale} ${key}`).not.toBe(english[key]);
      }
      for (const [key, sentence] of Object.entries(templated(copy))) {
        expect(sentence, `${locale} ${key}`).not.toBe(ours[key as keyof typeof ours]);
      }
    }
  });

  it("put every name and figure they are given into their sentences, in every language", () => {
    for (const locale of LOCALES) {
      const sentences = templated(getHookCheckCopy(locale));

      expect(sentences.verified, locale).toContain("Sourcify · Blockscout");
      expect(sentences.named, locale).toContain("LaunchHook");
      expect(sentences.proxyNamed, locale).toContain("StablePairHook");
      expect(sentences.poolsNote, locale).toContain("1,000");
    }
  });

  /*
   * The sentence the block may not be shown without: what verified means,
   * and that it is neither an audit nor safety — in each language's own
   * words for both.
   */
  it("say that verified source is the deployed code made readable, not an audit and not safety, in every language", () => {
    const SAYS: Record<Locale, readonly string[]> = {
      en: ["compiles to exactly what is deployed", "not an audit", "not a statement that the hook is safe"],
      tr: ["birebir aynı koda derlendiği", "bir denetim değildir", "güvenli olduğu anlamına da gelmez"],
      de: ["kompiliert genau zu dem, was dort deployt ist", "kein Audit", "keine Aussage, dass der Hook sicher ist"],
      es: ["compila exactamente a lo que está desplegado", "No es una auditoría", "que el hook sea seguro"],
      ar: ["تُترجَم بالضبط إلى العقد المنشور", "ليس تدقيقًا", "بأن الخطّاف آمن"],
      hi: ["ठीक वही बनता है जो उस पते पर तैनात है", "यह ऑडिट नहीं है", "hook सुरक्षित है"],
      zh: ["与部署在该地址上的内容完全一致", "这不是审计", "不代表这个 hook 是安全的"],
      ru: ["компилируется ровно в то, что развёрнуто", "Это не аудит", "что hook безопасен"],
      pt: ["compila exatamente para o que está implantado", "Não é uma auditoria", "de que o hook é seguro"],
      "zh-Hant": ["與部署在該地址上的內容完全一致", "這不是審計", "不代表這個 hook 是安全的"],
    };

    for (const locale of LOCALES) {
      const { meaning } = getHookCheckCopy(locale);
      for (const words of SAYS[locale]) expect(meaning, `${locale}: ${words}`).toContain(words);
    }
  });

  /* "Not found" and "not known" are different claims, and a verifier that did not answer has made neither. */
  it("say not found, not known and could not be counted in sentences of their own, in every language", () => {
    for (const locale of LOCALES) {
      const { unverified, unchecked, poolsUnchecked } = getHookCheckCopy(locale);
      expect(new Set([unverified, unchecked, poolsUnchecked]).size, locale).toBe(3);
      expect(unverified, locale).toContain("Sourcify");
      expect(unverified, locale).toContain("Blockscout");
    }
  });

  it("say a proxy's code is elsewhere whether or not its name is known, and the same way both times", () => {
    for (const locale of LOCALES) {
      const { proxy } = getHookCheckCopy(locale);
      expect(proxy(null), locale).not.toBe(proxy("StablePairHook"));
      expect(proxy(null), locale).not.toContain("null");
      expect(proxy(null), locale).toContain("Blockscout");
    }
  });

  /*
   * The site's own words in each language, the ones its other pages use for
   * the same things — so this block does not call a hook, a pool or a page
   * something the permissions above it do not.
   */
  it("use the terms the rest of the site uses in each language", () => {
    const TERMS: Partial<Record<Locale, readonly string[]>> = {
      tr: ["hook", "havuz", "ağ"],
      ar: ["خطّاف", "تجمّع", "الشبكة"],
      hi: ["hook", "पूल", "नेटवर्क"],
      zh: ["hook", "资金池", "网络"],
      ru: ["hook’а", "пул", "сети"],
      "zh-Hant": ["hook", "資金池", "網路", "原始碼"],
    };

    for (const [locale, terms] of Object.entries(TERMS) as [Locale, readonly string[]][]) {
      const copy = getHookCheckCopy(locale);
      const all = [...STRINGS.map((key) => copy[key]), ...Object.values(templated(copy))].join(" ").toLocaleLowerCase(locale);
      for (const term of terms) expect(all, `${locale}: ${term}`).toContain(term.toLocaleLowerCase(locale));
    }
  });

  /* Arabic writes خطّاف for a hook in prose and labels alike (2026-10-04), never the Latin word on its own. */
  it("never leave Arabic or its sentences with a bare Latin hook", () => {
    const copy = getHookCheckCopy("ar");
    const all = [...STRINGS.map((key) => copy[key]), ...Object.values(templated(copy))].join(" ");

    expect(all).not.toMatch(/\bhook\b/i);
  });
});
