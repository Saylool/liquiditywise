import type { Locale } from "../i18n/locales";

/*
 * Deterministic formatting for the figures this advisor displays.
 *
 * Every formatter names its locale explicitly and defaults to English. `Intl`
 * with no locale follows the *host's*, which would make server-rendered output
 * depend on the machine that rendered it — the same page reading "0.000333" in
 * one deployment and "0,000333" in another. Varying by the reader's chosen
 * language is the opposite: a stated, reproducible choice, and the reason a
 * Turkish reader sees "%0,30" rather than "0.30%".
 *
 * The magnitudes here are extreme by nature: a USDC/WETH price is ~3e-4, a
 * truncated band edge can be 1e31, and both must stay readable. So each
 * formatter switches to scientific notation outside the range where ordinary
 * notation is still legible, rather than rendering forty digits or rounding a
 * real price to "0.00".
 *
 * Nothing here is allowed to invent precision: a value is shown to a fixed
 * number of significant digits and never padded out to look more exact.
 */

/** Shown wherever a figure is absent or not representable. Never "0". */
export const ABSENT = "—";

/**
 * Builds one formatter per published language, once, at module load.
 *
 * `Intl.NumberFormat` is expensive to construct and these are used on every
 * render, so they are made ahead rather than per call. The `Record<Locale, T>`
 * return type is what makes adding a language a compile error here rather than a
 * silently English figure in a translated page.
 */
const byLocale = <T,>(build: (tag: string) => T): Record<Locale, T> => ({
  en: build("en-US"),
  tr: build("tr-TR"),
});

const standardPrice = byLocale(
  (tag) => new Intl.NumberFormat(tag, { maximumSignificantDigits: 6 }),
);
const scientificPrice = byLocale(
  (tag) =>
    new Intl.NumberFormat(tag, { notation: "scientific", maximumSignificantDigits: 5 }),
);

const standardPercent = byLocale(
  (tag) =>
    new Intl.NumberFormat(tag, {
      style: "percent",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
);
const scientificPercent = byLocale(
  (tag) =>
    new Intl.NumberFormat(tag, {
      style: "percent",
      notation: "scientific",
      maximumSignificantDigits: 4,
    }),
);

const wholeNumber = byLocale((tag) => new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }));

/** Enough places for the multipliers anyone would ask for, and no trailing zero. */
const multiplierNumber = byLocale(
  (tag) => new Intl.NumberFormat(tag, { maximumFractionDigits: 2 }),
);

const feePercent = byLocale(
  (tag) =>
    new Intl.NumberFormat(tag, {
      style: "percent",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }),
);

const wholeUsd = byLocale(
  (tag) =>
    new Intl.NumberFormat(tag, { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
);
const preciseUsd = byLocale(
  (tag) =>
    new Intl.NumberFormat(tag, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
);

/** English unless a page states otherwise, so a bare call is never host-dependent. */
const DEFAULT_FORMAT_LOCALE: Locale = "en";

/**
 * Where ordinary notation stops being readable for a price. Below 1e-6 the
 * leading zeros outnumber the digits; at 1e9 the grouping runs off the line.
 */
const PRICE_STANDARD_MIN = 1e-6;
const PRICE_STANDARD_MAX = 1e9;

/** 1000 as a ratio is 100,000% — past that, percent notation stops informing. */
const PERCENT_STANDARD_MAX = 1000;

/**
 * Below this a percentage with two decimal places is written "0.00%".
 *
 * Which is a real figure rounded away, and the one place it happens is the one
 * place it misleads: a deposit's fees against the money put in, on a pool small
 * enough that a large deposit is mostly its own dilution. Two hundredths of a
 * cent on a thousand dollars is a very small number and it is not zero, and a
 * page that prints zero there has answered a different question.
 */
const PERCENT_STANDARD_MIN = 5e-5;

/**
 * A token price. Zero is formatted as-is rather than as absent: a schema-valid
 * price is never zero, so a zero here is a real value worth seeing.
 */
export const formatPrice = (value: number, locale: Locale = DEFAULT_FORMAT_LOCALE): string => {
  if (!Number.isFinite(value)) return ABSENT;

  const magnitude = Math.abs(value);
  if (magnitude !== 0 && (magnitude < PRICE_STANDARD_MIN || magnitude >= PRICE_STANDARD_MAX)) {
    return scientificPrice[locale].format(value);
  }

  return standardPrice[locale].format(value);
};

/**
 * A decimal ratio shown as a percentage: 0.0545 becomes "5.45%".
 *
 * Scientific at both ends, and for the same reason at each: two decimal places
 * stop carrying the figure. Zero is exempt, as it is for a price — a ratio of
 * exactly zero is a real answer and "0.00%" is how to write it.
 */
export const formatPercent = (ratio: number, locale: Locale = DEFAULT_FORMAT_LOCALE): string => {
  if (!Number.isFinite(ratio)) return ABSENT;

  const magnitude = Math.abs(ratio);
  if (magnitude >= PERCENT_STANDARD_MAX) return scientificPercent[locale].format(ratio);
  if (magnitude !== 0 && magnitude < PERCENT_STANDARD_MIN) {
    return scientificPercent[locale].format(ratio);
  }

  return standardPercent[locale].format(ratio);
};

/** A plain count, grouped. Rounds nothing away: every caller passes an integer. */
export const formatWhole = (value: number, locale: Locale = DEFAULT_FORMAT_LOCALE): string =>
  Number.isFinite(value) ? wholeNumber[locale].format(value) : ABSENT;

/**
 * A standard-deviation multiplier, which is not always whole.
 *
 * Its own formatter because {@link formatWhole} rounds to nothing after the
 * point: a band asked for at 1.5σ would have been labelled "2σ" on the page and
 * described as two standard deviations to the model, while the arithmetic behind
 * it used 1.5 the whole time. A figure that disagrees with the number it came
 * from is the failure this project spends most of its effort avoiding.
 */
export const formatMultiplier = (value: number, locale: Locale = DEFAULT_FORMAT_LOCALE): string =>
  Number.isFinite(value) ? multiplierNumber[locale].format(value) : ABSENT;

/**
 * An amount of ether, such as a pool's depth valued in it.
 *
 * The same rendering as a price — six significant figures, scientific outside
 * the legible range — under its own name, because an amount is not a price and
 * a reader scanning the markup should be able to tell which a figure is.
 */
export const formatEtherAmount = (value: number, locale: Locale = DEFAULT_FORMAT_LOCALE): string =>
  formatPrice(value, locale);

/**
 * A tick index. Identical to {@link formatWhole} today, but named separately
 * because a tick is a coordinate rather than a quantity, and a reader scanning
 * the markup should be able to tell which one a figure is.
 */
export const formatTick = (tick: number, locale: Locale = DEFAULT_FORMAT_LOCALE): string =>
  formatWhole(tick, locale);

/**
 * A swap fee held in parts-per-million, shown the way Uniswap labels its tiers:
 * 3000 ppm is the 0.30% tier.
 */
export const formatFeePpm = (feePpm: number, locale: Locale = DEFAULT_FORMAT_LOCALE): string =>
  Number.isFinite(feePpm) ? feePercent[locale].format(feePpm / 1_000_000) : ABSENT;

/** Below this, dropping the cents would round a real figure away. */
const USD_WHOLE_MIN = 1000;

/**
 * A USD figure such as pool TVL. `null` is an unreported figure and is shown as
 * absent — never as `$0`, which would claim the pool holds nothing.
 */
export const formatUsd = (
  value: number | null,
  locale: Locale = DEFAULT_FORMAT_LOCALE,
): string => {
  if (value === null || !Number.isFinite(value)) return ABSENT;

  return Math.abs(value) >= USD_WHOLE_MIN
    ? wholeUsd[locale].format(value)
    : preciseUsd[locale].format(value);
};

/** The exact width {@link IsoTimestampSchema} guarantees, and nothing else. */
const ISO_MILLISECOND_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * An instant as "2026-08-21 09:15 UTC".
 *
 * Sliced from the ISO string rather than parsed and reformatted, so no timezone
 * is applied and the output cannot drift with the renderer's clock settings. The
 * zone is spelled out because a bare time with no zone invites the reader to
 * assume their own.
 */
export const formatUtcMinute = (timestamp: string): string =>
  ISO_MILLISECOND_UTC.test(timestamp)
    ? `${timestamp.slice(0, 10)} ${timestamp.slice(11, 16)} UTC`
    : ABSENT;

/** The date alone, for a window boundary where the time of day is always midnight. */
export const formatUtcDate = (timestamp: string): string =>
  ISO_MILLISECOND_UTC.test(timestamp) ? timestamp.slice(0, 10) : ABSENT;

/**
 * Whole token units, grouped. Built per language like the rest.
 *
 * Takes a `bigint`, which `Intl.NumberFormat` accepts and formats exactly. A
 * balance's whole part can be larger than a double holds, and passing it through
 * a number to get grouping would round it on the way.
 */
const wholeTokenUnits = byLocale((tag) => new Intl.NumberFormat(tag, { useGrouping: true }));

/** The decimal separator this language writes, taken from the language itself. */
const decimalSeparator = byLocale(
  (tag) =>
    new Intl.NumberFormat(tag)
      .formatToParts(1.1)
      .find((part) => part.type === "decimal")?.value ?? ".",
);

/** Fraction digits shown when there is a whole part to anchor the figure. */
const FRACTION_DIGITS_WITH_WHOLE = 4;

/** And when there is not, where the meaning is entirely in the small digits. */
const FRACTION_DIGITS_WITHOUT_WHOLE = 8;

/**
 * A token balance, from base units, without ever becoming a number.
 *
 * The amount arrives as a decimal string of base units — `"11923665594771177257765"`
 * of an eighteen-decimal token — and is split by moving a point through the
 * string rather than dividing. Eighteen decimals put an ordinary balance far
 * past what a double represents exactly, so `Number(amount) / 10 ** decimals`
 * would round somebody's balance before it was ever displayed.
 *
 * How many fraction digits depends on where the value is. With a whole part,
 * four is plenty and more is noise; without one, the entire figure lives in the
 * small digits and cutting at four would render real dust as zero. A balance too
 * small to show at all is reported as being under the smallest shown figure,
 * which is true, rather than as zero, which is not.
 *
 * The digits beyond that are **cut, not rounded**. A rounded balance can read
 * higher than what the address holds, and a figure someone might act on should
 * never be the generous one — 11923.665594… is shown as 11,923.6655.
 */
export const formatTokenAmount = (
  amount: string,
  decimals: number,
  locale: Locale = DEFAULT_FORMAT_LOCALE,
): string => {
  if (!/^\d+$/.test(amount) || !Number.isInteger(decimals) || decimals < 0) return ABSENT;

  const padded = amount.padStart(decimals + 1, "0");
  const whole = BigInt(padded.slice(0, padded.length - decimals));
  const fraction = decimals === 0 ? "" : padded.slice(padded.length - decimals);

  const width = whole === 0n ? FRACTION_DIGITS_WITHOUT_WHOLE : FRACTION_DIGITS_WITH_WHOLE;
  const shown = fraction.slice(0, width).replace(/0+$/, "");

  if (whole === 0n && shown === "") {
    const smallest = `0${decimalSeparator[locale]}${"0".repeat(width - 1)}1`;

    return amount === "0" ? `0` : `< ${smallest}`;
  }

  const formattedWhole = wholeTokenUnits[locale].format(whole);

  return shown === "" ? formattedWhole : `${formattedWhole}${decimalSeparator[locale]}${shown}`;
};

/*
 * A *measured* fee rate, which is not the same kind of number as a declared one.
 *
 * {@link formatFeePpm} takes an on-chain integer and shows it to between two and
 * four decimal places of a percent, which is exactly right for a fee tier: every
 * tier that exists lands on a short decimal, and 3000 ppm reads as "0.30%". A
 * rate divided back out of a day's fees and volume lands anywhere. That fixed
 * width renders a real 0.4 ppm rate as "0.00%", which reads as free; a fixed
 * wide one would render an ordinary rate as "0.01737332%", which reads as
 * noise.
 *
 * So the width is chosen per value: enough decimals to carry three significant
 * figures, and never fewer than the two a fee tier is padded to. That second
 * half is what makes the panel legible. Its whole question is whether the
 * declared rate and the charged rate are the same number, and "0.30%" printed
 * beside "0.3%" reads as two different answers to it.
 */

/** Significant figures a measured rate is shown to. Beyond this is rounding noise. */
const MEASURED_FEE_SIGNIFICANT_DIGITS = 3;

/** The floor a fee tier is padded to, matched so equal figures print equally. */
const MEASURED_FEE_MIN_FRACTION_DIGITS = 2;

/**
 * Decimal places needed to carry {@link MEASURED_FEE_SIGNIFICANT_DIGITS} of a
 * percentage, never fewer than the padded minimum.
 *
 * `Intl` trims trailing zeros down to the minimum, so asking for more places
 * than a short value needs costs nothing: 0.3% asks for three and prints two.
 */
const fractionDigitsFor = (percent: number): number => {
  if (percent === 0) return MEASURED_FEE_MIN_FRACTION_DIGITS;

  const leadingDigitPlace = Math.floor(Math.log10(Math.abs(percent)));

  return Math.max(
    MEASURED_FEE_MIN_FRACTION_DIGITS,
    MEASURED_FEE_SIGNIFICANT_DIGITS - 1 - leadingDigitPlace,
  );
};

/**
 * Formatters keyed by language and width, built once each on first use.
 *
 * Unlike every formatter above, the width here depends on the value, so these
 * cannot all be made at module load. They are cached instead — a page shows a
 * handful of rates and they share two or three widths between them.
 */
const measuredFeeFormatters = new Map<string, Intl.NumberFormat>();

const measuredFeeFormatter = (locale: Locale, fractionDigits: number): Intl.NumberFormat => {
  const key = `${locale}:${fractionDigits}`;
  const existing = measuredFeeFormatters.get(key);
  if (existing !== undefined) return existing;

  const built = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    style: "percent",
    minimumFractionDigits: MEASURED_FEE_MIN_FRACTION_DIGITS,
    maximumFractionDigits: fractionDigits,
  });
  measuredFeeFormatters.set(key, built);

  return built;
};

const scientificFeePercent = byLocale(
  (tag) =>
    new Intl.NumberFormat(tag, {
      style: "percent",
      notation: "scientific",
      maximumSignificantDigits: MEASURED_FEE_SIGNIFICANT_DIGITS,
    }),
);

/**
 * Below this a percentage is more leading zeros than figure, and `Intl` caps
 * fraction digits at 100 anyway. A hundredth of a part-per-million, as a ratio.
 */
const MEASURED_FEE_STANDARD_MIN = 1e-8;

/**
 * A fee rate measured in parts-per-million, shown as a percentage.
 *
 * Zero is formatted as zero rather than as absent: a pool that charged nothing
 * on a day it traded is a real, measured answer, unlike a rate nobody could
 * divide out — which never reaches this function.
 */
export const formatMeasuredFeePpm = (
  feePpm: number,
  locale: Locale = DEFAULT_FORMAT_LOCALE,
): string => {
  if (!Number.isFinite(feePpm)) return ABSENT;

  const ratio = feePpm / 1_000_000;
  if (ratio !== 0 && Math.abs(ratio) < MEASURED_FEE_STANDARD_MIN) {
    return scientificFeePercent[locale].format(ratio);
  }

  return measuredFeeFormatter(locale, fractionDigitsFor(ratio * 100)).format(ratio);
};
