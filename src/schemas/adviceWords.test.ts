import { describe, expect, it } from "vitest";

import { containsAdvice } from "./adviceWords";

describe("advice and promotion", () => {
  /* At least one phrase from each of the ten languages the explanation is written in. */
  it.each([
    ["English, an address", "You should open the position while the price sits near the middle."],
    ["English, a recommendation", "We recommend this width for most readers."],
    ["English, a promise", "The fees on this range are guaranteed."],
    ["English, a promise denied", "Nothing about this range is guaranteed."],
    ["English, a pitch", "Buy now, before the price leaves the band."],
    ["English, risk-free", "A range this wide is risk-free."],
    ["Turkish, you should buy", "Fiyat bandın ortasındayken almalısınız."],
    ["Turkish, guaranteed, inflected", "Bu aralıkta komisyon garantili."],
    ["Turkish, we recommend", "Bu genişliği tavsiye ederiz."],
    ["German, you should", "Sie sollten die Position jetzt eröffnen."],
    ["German, guaranteed", "Die Gebühren sind garantiert."],
    ["Spanish, you should", "Deberías abrir la posición ahora."],
    ["Spanish, guaranteed, inflected", "Las comisiones están garantizadas."],
    ["Portuguese, you should", "Você deve abrir a posição agora."],
    ["Portuguese, invest", "Invista enquanto o preço está no meio."],
    ["Arabic, we advise you", "ننصحك بفتح المركز الآن."],
    ["Arabic, guaranteed profits", "الأرباح مضمونة في هذا النطاق."],
    ["Hindi, guarantee", "इस दायरे में शुल्क की गारंटी है।"],
    ["Hindi, buy now", "अभी खरीदें, इससे पहले कि कीमत बदल जाए।"],
    ["Russian, you should", "Вам следует открыть позицию сейчас."],
    ["Russian, guaranteed, declined", "Доход гарантирован."],
    ["Chinese, you should", "你应该现在开仓。"],
    ["Chinese, guarantee", "这个区间保证收益。"],
    ["Traditional Chinese, risk-free", "這個區間無風險。"],
    ["Traditional Chinese, we recommend", "我們建議這個寬度。"],
  ])("is caught in %s", (_label, prose) => {
    expect(containsAdvice(prose)).toBe(true);
  });

  /*
   * The words this prose needs. Buying and selling are the mechanism being
   * explained, and a rule that caught them would refuse the paragraph doing
   * its job — see the list's own comment.
   */
  it.each([
    ["English, the mechanism", "As the price rises the position sells WETH, and as it falls it buys it back."],
    ["English, selling as a heading", "Selling the base token between the two edges averages the price shown."],
    ["English, an invested amount", "The amount invested is the deposit shown above."],
    ["English, should not addressed to the reader", "A wider band should hold the price for more of the days."],
    ["English, nothing certain", "Nothing here is certain, and the fees are the pool's, not a position's."],
    ["Turkish, the mechanism", "Fiyat yükseldikçe pozisyon tokenlarını satar ve düştükçe geri alır."],
    ["German, selling", "Steigt der Preis, verkauft die Position nach und nach den Basistoken."],
    ["Spanish, inverted prices", "El precio se muestra al revés, y la posición vende a medida que sube."],
    ["Arabic, content", "مضمون هذا القسم هو ما يعنيه النطاق."],
    ["Russian, simply", "Это просто диапазон цен, измеренный по прошлым дням."],
    ["Chinese, suggested range", "页面建议的价格区间是根据过去的波动画出的。"],
  ])("leaves %s alone", (_label, prose) => {
    expect(containsAdvice(prose)).toBe(false);
  });

  /* Matched as words: a phrase inside a longer word is not the phrase. */
  it("does not match inside a longer word", () => {
    expect(containsAdvice("The guaranteedness of nothing.")).toBe(false);
    expect(containsAdvice("Ausgarantiert ist kein Wort.")).toBe(false);
  });
});
