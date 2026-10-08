/*
 * Advice and promotion, in any of the languages this interface publishes —
 * the half of "describe, do not advise" that a schema can recognise.
 *
 * The standing instruction forbids telling the reader what to do, and that
 * used to be the whole defence. It is a request, and a request is what a model
 * weighs against everything else it has read. The placeholders now keep a
 * token's author out of the brief, but the model can still drift on its own,
 * and the cost of drift here is specific: a financial tool's own paragraph,
 * under its own heading, saying "buy now" or "guaranteed". So the few phrases
 * that are never anything but advice or a sales pitch are refused outright,
 * the way a numeral is — the answer is dropped and the page shows none.
 *
 * **The list is short on purpose, and what it leaves out is the point.**
 *
 * Bare "buy" and "sell" are not here, in any language. The mechanism this
 * prose explains *is* buying and selling: a position sells one token as the
 * price rises through its range, and the brief itself hands the model a block
 * headed "Selling" and "Buying". A rule that caught those words would refuse
 * the paragraph doing exactly its job. What is caught is the imperative and
 * the address — "buy now", "you should", "we recommend" — which no
 * description of a mechanism needs.
 *
 * "Guaranteed" and "risk-free" are caught even when denied. "Nothing here is
 * guaranteed" is an honest sentence, and a model told the word is refused will
 * write "nothing here is certain" instead and lose nothing; a rule that tried
 * to read negation in ten languages would be a parser, and wrong. The
 * instruction says so in as many words, so a cooperative model is not caught
 * by surprise.
 *
 * One list for every language, as `numberWords.ts` does it, because the schema
 * that holds it does not know which language it is checking. A phrase missed
 * is a gap in a backstop; a phrase wrongly caught is an explanation a reader
 * never sees. Every entry below is weighed that way, and where a word has an
 * innocent meaning in this prose it is left out and the reason given.
 */

/**
 * A word or phrase, not a fragment of one — the same Unicode boundary as
 * `numberWords.ts`, because `\b` knows only ASCII and Devanagari's vowels are
 * marks.
 */
const whole = (phrases: readonly string[]): RegExp =>
  new RegExp(`(?<![\\p{L}\\p{M}])(?:${phrases.join("|")})(?![\\p{L}\\p{M}])`, "iu");

/** Anchored at the start only, for languages that add endings. */
const starting = (stems: readonly string[]): RegExp =>
  new RegExp(`(?<![\\p{L}\\p{M}])(?:${stems.join("|")})`, "iu");

/** Anywhere: Chinese has no spaces between words to anchor on. */
const anywhere = (phrases: readonly string[]): RegExp => new RegExp(`(?:${phrases.join("|")})`, "u");

const PATTERNS: readonly RegExp[] = [
  /*
   * English. "invest" is not here alone — "the amount invested" is a fair way
   * to say a deposit — only as an instruction.
   */
  whole([
    "you should", "we recommend", "i recommend", "guaranteed", "guarantee",
    "risk-free", "risk free", "buy now", "sell now", "invest now",
  ]),

  /*
   * Turkish, by stem where it inflects: "garanti" covers "garantili" and
   * "garanti edilir"; "almalısınız" and "satmalısınız" are "you should buy"
   * and "you should sell", which no description needs.
   */
  starting(["garanti", "risksiz"]),
  whole([
    "öneririz", "tavsiye ederiz", "tavsiye edilir", "almalısınız", "satmalısınız",
    "yatırım yapın", "hemen alın", "hemen satın",
  ]),

  // German. "garantiert" also in "nicht garantiert", on purpose; see above.
  whole([
    "sie sollten", "du solltest", "wir empfehlen", "garantiert", "risikolos",
    "risikofrei", "jetzt kaufen", "jetzt verkaufen",
  ]),

  /*
   * Spanish. "invierta" is not here: "invertir" also means to invert, and the
   * brief talks about prices read the other way round.
   */
  starting(["garantizad"]),
  whole([
    "deberías", "usted debería", "le recomendamos", "te recomendamos", "recomendamos",
    "sin riesgo", "compre ahora", "compra ahora", "venda ahora", "vende ahora",
  ]),

  // Portuguese; "recomendamos" and "venda agora" are shared shapes with Spanish.
  starting(["garantid"]),
  whole(["você deve", "você deveria", "sem risco", "compre agora", "venda agora", "invista"]),

  /*
   * Arabic. "مضمون" alone is not here: it is also "content", as in what a
   * text says. The feminine form, which agrees with "profits" and "returns",
   * is not.
   */
  whole(["يجب عليك", "ننصحك", "ننصح", "نوصي", "مضمونة", "بدون مخاطر", "اشتر الآن", "بع الآن"]),

  // Hindi.
  whole([
    "गारंटी", "गारंटीड", "जोखिम-मुक्त", "जोखिम मुक्त", "हम सलाह देते हैं",
    "आपको खरीदना चाहिए", "आपको बेचना चाहिए", "अभी खरीदें", "अभी बेचें", "निवेश करें",
  ]),

  /*
   * Russian, by stem where it declines: "гарантир" is guaranteed in every
   * case and gender, "безрисков" risk-free.
   */
  starting(["гарантир", "безрисков"]),
  whole(["вам следует", "вы должны", "рекомендуем", "без риска", "покупайте", "продавайте", "инвестируйте"]),

  /*
   * Chinese, in both scripts. 保证 / 保證 is guarantee; 保证金, margin, is a
   * word this prose has no reason to use. 建议 alone is not here — "the page
   * suggests a range" is how the interface itself talks — only addressed to
   * the reader.
   */
  anywhere([
    "你应该", "您应该", "我们建议", "建议您", "保证", "稳赚", "无风险", "立即购买", "立即买入", "立即卖出",
    "你應該", "您應該", "我們建議", "建議您", "保證", "穩賺", "無風險", "立即購買", "立即買入", "立即賣出",
  ]),
];

/** Whether this prose advises or promotes, by the short list above, in any published language. */
export const containsAdvice = (prose: string): boolean =>
  PATTERNS.some((pattern) => pattern.test(prose));
