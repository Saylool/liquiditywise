import { describe, expect, it } from "vitest";

import { containsNumberWord } from "./numberWords";

describe("a figure written as a word", () => {
  /*
   * The case this file was written for, from real output: two figures from
   * the page restated in Portuguese words, which the digit rule passed.
   */
  it("catches the Portuguese sentence that was actually written", () => {
    expect(
      containsNumberWord(
        "o preço ficou inteiramente dentro dela em oitenta e cinco dos noventa dias",
      ),
    ).toBe(true);
  });

  /*
   * Each half of that sentence on its own. The whole sentence holds two
   * figures, and "noventa" is on the Spanish list, so it passed with
   * "oitenta" removed entirely — a test that was right for the wrong reason
   * until mutation testing said so.
   */
  it.each([
    ["the eighty-five", "em oitenta e cinco dias"],
    ["the ninety", "dos noventa dias"],
  ])("catches %s of it on its own", (_label, prose) => {
    expect(containsNumberWord(prose)).toBe(true);
  });

  it.each([
    ["English", "the price stayed inside on eighty-five of the ninety days"],
    ["English, a teen", "over the last fourteen days"],
    ["Turkish, with an ending", "doksan günün seksen beşinde içeride kaldı"],
    ["Turkish, a teen", "son on dört gün boyunca"],
    ["German, as one compound", "an fünfundachtzig von neunzig Tagen"],
    ["German, a teen", "in den letzten vierzehn Tagen"],
    ["Spanish", "en ochenta y cinco de los noventa días"],
    ["Spanish, a twenty-something", "durante veinticinco días"],
    ["Portuguese", "nos últimos trinta dias"],
    ["Russian, declined", "в течение тридцати дней"],
    ["Russian, a forty", "за сорок дней"],
    ["Arabic, a ninety", "خلال تسعين يومًا"],
    ["Arabic, a teen", "خلال أربعة عشر يومًا"],
    ["Hindi, an eighty-five", "नब्बे में से पचासी दिनों में"],
    ["Hindi, a thirty", "पिछले तीस दिनों में"],
    ["Chinese, a thirty", "在过去三十天里"],
    ["Chinese, a teen", "在十四天内"],
    ["Traditional Chinese, a percentage", "百分之八十五的日子"],
  ])("catches %s", (_label, prose) => {
    expect(containsNumberWord(prose)).toBe(true);
  });
});

describe("what it deliberately leaves alone", () => {
  /*
   * Zero to ten is ordinary grammar in every one of these languages. A rule
   * that caught it would reject almost every paragraph, and the reader would
   * be shown nothing — the opposite of what the rule is for.
   */
  it.each([
    ["English", "one of the two tokens, and both edges of the range"],
    ["Turkish", "iki tokendan biri ve aralığın iki kenarı"],
    ["German", "einer der beiden Token und zwei Kanten"],
    ["Spanish", "uno de los dos tokens y ambos bordes"],
    ["Portuguese", "um dos dois tokens e as duas bordas"],
    ["Russian", "один из двух токенов и обе границы"],
    ["Arabic", "أحد الرمزين وكلا الحدّين"],
    ["Hindi", "दो टोकन में से एक और दोनों किनारे"],
    ["Chinese", "两个代币中的一个，以及区间的两条边"],
  ])("leaves zero to ten alone in %s", (_label, prose) => {
    expect(containsNumberWord(prose)).toBe(false);
  });

  /*
   * Each of these contains a number word's letters inside another word. Every
   * one was a real risk while the list was being written, and each is the
   * reason one of its patterns is anchored the way it is.
   */
  it.each([
    ["Turkish 'usually' holds 'elli'", "yöntemin genellikle çalıştığını gösteriyor"],
    ["Turkish 'especially' holds 'elli'", "özellikle geniş aralıklarda"],
    ["German 'help' holds 'elf'", "das kann helfen, die Spanne zu verstehen"],
    ["Russian 'simply' holds 'сто'", "это просто описание прошлого"],
    ["Russian 'place' and 'costs' hold 'сто'", "в этом месте своп стоит дороже"],
    ["English 'once', which is Spanish eleven", "once the price leaves the range"],
    ["Spanish 'science' holds 'cien'", "no es una ciencia exacta"],
    ["Chinese 'very' is 十 alone", "这一点十分重要"],
  ])("does not fire on %s", (_label, prose) => {
    expect(containsNumberWord(prose)).toBe(false);
  });
});
