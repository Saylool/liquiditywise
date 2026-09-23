/*
 * A number written as a word, in any of the languages this interface
 * publishes — the half of "never state a figure" that a digit test cannot see.
 *
 * Observed before it was written, not guessed at. Across ninety-six sections
 * of real output in eight languages, a Portuguese explanation read "em oitenta
 * e cinco dos noventa dias": eighty-five of the ninety days, two figures from
 * the page restated in words, which the digit rule passed because there was
 * no digit in it.
 *
 * The boundary is the thing to understand here. Zero to ten is not listed, in
 * any language, and that is deliberate: "one of the two tokens", "both edges",
 * 一个, "iki kenar" are ordinary grammar, and a rule that rejected them would
 * reject nearly every paragraph and take the explanation away from the reader
 * it exists for. Eleven and above — the teens, the tens, a hundred — have no
 * such use in a paragraph about a price range. In this prose they are figures.
 *
 * One list serves every language, because the schema that holds it does not
 * know which language it is checking. That is safe by construction for the
 * scripts no other language here shares — Arabic, Devanagari, Cyrillic, Han —
 * and for the Latin ones it is made safe by leaving out every word that means
 * something else in another of them. Spanish "once" is eleven, and English
 * "once" is on every page, so eleven goes uncaught in Spanish. That is the
 * trade this list makes throughout: a word it misses is a gap in a backstop,
 * and a word it wrongly catches is an explanation the reader never sees.
 */

/**
 * A word, not a fragment of one. JavaScript's `\b` knows only ASCII, so the
 * boundary is written in Unicode terms: no letter and no combining mark on
 * either side — the marks matter for Devanagari, whose vowels are marks.
 */
const whole = (words: readonly string[]): RegExp =>
  new RegExp(`(?<![\\p{L}\\p{M}])(?:${words.join("|")})(?![\\p{L}\\p{M}])`, "iu");

/**
 * Only the start is anchored. Turkish and Russian add endings to a number
 * ("otuzundan", "тридцати"), German builds them into compounds
 * ("fünfundachtzig"), and an anchor on both sides would miss every one.
 */
const starting = (words: readonly string[]): RegExp =>
  new RegExp(`(?<![\\p{L}\\p{M}])(?:${words.join("|")})`, "iu");

/** Anywhere at all: stems that cannot occur inside any other word here. */
const anywhere = (words: readonly string[]): RegExp => new RegExp(`(?:${words.join("|")})`, "iu");

const PATTERNS: readonly RegExp[] = [
  // English. Compounds hyphenate ("eighty-five"), which a word boundary allows.
  whole([
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
    "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty",
    "seventy", "eighty", "ninety", "hundred",
  ]),

  /*
   * Turkish, anchored at the start for its endings. "on" (ten) is left out
   * with the rest of zero to ten, so the teens are matched as "on" followed by
   * a unit. "yüz" is left out entirely: it is also a face, and "yüzünden" —
   * because of — is ordinary prose.
   */
  starting([
    "on (?:bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz)", "yirmi", "otuz", "kırk",
    "elli", "altmış", "yetmiş", "seksen", "doksan",
  ]),

  /*
   * German. The tens are matched anywhere because German writes 85 as one
   * word, "fünfundachtzig", with the ten at the end. The teens need edges:
   * "elf" sits inside "helfen".
   */
  anywhere([
    "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig",
    "neunzig", "hundert",
  ]),
  whole([
    "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn",
    "achtzehn", "neunzehn",
  ]),

  // Spanish. "once" is eleven and also English, so it is not here.
  whole([
    "doce", "trece", "catorce", "quince", "dieciséis", "dieciseis", "diecisiete",
    "dieciocho", "diecinueve", "veinte", "treinta", "cuarenta", "cincuenta",
    "sesenta", "setenta", "ochenta", "noventa", "cien", "ciento",
  ]),
  starting(["veinti"]),

  // Portuguese; "setenta" and "noventa" are shared with Spanish and listed there.
  whole([
    "onze", "doze", "treze", "catorze", "quatorze", "quinze", "dezesseis",
    "dezessete", "dezoito", "dezenove", "vinte", "trinta", "quarenta",
    "cinquenta", "sessenta", "oitenta", "cem", "cento",
  ]),

  /*
   * Russian, by stem, because every one of these declines. "сто" is a hundred
   * and also sits inside "просто", "место", "часто" and "стоит", so it is
   * matched only as a whole word.
   */
  anywhere([
    "одиннадцат", "двенадцат", "тринадцат", "четырнадцат", "пятнадцат",
    "шестнадцат", "семнадцат", "восемнадцат", "девятнадцат", "двадцат", "тридцат",
    "пятьдесят", "пятидесят", "шестьдесят", "шестидесят", "семьдесят", "семидесят",
    "восемьдесят", "восьмидесят", "девяност",
  ]),
  whole(["сорок", "сорока", "сто"]),

  /*
   * Arabic. Every teen and every twenty carries "عشر", and each ten has a
   * nominative and an oblique form; both are listed.
   */
  anywhere([
    "عشر", "ثلاثون", "ثلاثين", "أربعون", "أربعين", "خمسون", "خمسين", "ستون",
    "ستين", "سبعون", "سبعين", "ثمانون", "ثمانين", "تسعون", "تسعين", "مئة", "مائة",
  ]),

  /*
   * Hindi, whole words, and every one of them: Hindi does not build 85 out of
   * 80 and 5 the way the others do — "पचासी" is its own word — so the tens
   * alone would miss almost everything. Spellings vary, and a variant this
   * list does not have is only a word it misses.
   */
  whole([
    "ग्यारह", "बारह", "तेरह", "चौदह", "पंद्रह", "सोलह", "सत्रह", "अठारह", "उन्नीस",
    "बीस", "इक्कीस", "बाईस", "तेईस", "चौबीस", "पच्चीस", "छब्बीस", "सत्ताईस", "अट्ठाईस", "उनतीस",
    "तीस", "इकतीस", "बत्तीस", "तैंतीस", "चौंतीस", "पैंतीस", "छत्तीस", "सैंतीस", "अड़तीस", "उनतालीस",
    "चालीस", "इकतालीस", "बयालीस", "तैंतालीस", "चवालीस", "पैंतालीस", "छियालीस", "सैंतालीस", "अड़तालीस", "उनचास",
    "पचास", "इक्यावन", "बावन", "तिरपन", "चौवन", "पचपन", "छप्पन", "सत्तावन", "अट्ठावन", "उनसठ",
    "साठ", "इकसठ", "बासठ", "तिरसठ", "चौंसठ", "पैंसठ", "छियासठ", "सड़सठ", "अड़सठ", "उनहत्तर",
    "सत्तर", "इकहत्तर", "बहत्तर", "तिहत्तर", "चौहत्तर", "पचहत्तर", "छिहत्तर", "सतहत्तर", "अठहत्तर", "उनासी",
    "अस्सी", "इक्यासी", "बयासी", "तिरासी", "चौरासी", "पचासी", "छियासी", "सत्तासी", "अट्ठासी", "नवासी",
    "नब्बे", "इक्यानवे", "बानवे", "तिरानवे", "चौरानवे", "पचानवे", "छियानवे", "सत्तानवे", "अट्ठानवे", "निन्यानवे",
    "सौ",
  ]),

  /*
   * Chinese, in both scripts, which write these characters alike. A unit
   * before 十 is a ten; 十 before a unit is a teen. 十 alone is not matched,
   * because 十分 means "very". 百 is a hundred, and in 百分之 a percentage,
   * which is a figure too.
   */
  /[二三四五六七八九]十|十[一二三四五六七八九]|百/u,
];

/** Whether this prose states a number of eleven or more in words, in any published language. */
export const containsNumberWord = (prose: string): boolean =>
  PATTERNS.some((pattern) => pattern.test(prose));
