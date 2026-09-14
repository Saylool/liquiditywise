import {
  formatFeePpm,
  formatPercent,
  formatPrice,
  formatTick,
  formatUsd,
  formatUtcDate,
  formatWhole,
} from "../../format/displayFormats";
import type { Locale } from "../../i18n/locales";
import type { PoolRangeAnalysis } from "../../advisor/poolRangeAnalysis";
import { BASE_INSTRUCTION } from "./base";

/*
 * Builds the request that turns one verified analysis into plain language.
 *
 * Pure and deterministic: the same analysis and language always produce the
 * same two strings, so the prompt can be tested, diffed and cached without
 * running a model.
 *
 * **No text a stranger wrote ever reaches this prompt.** The only thing a
 * visitor supplies is a pool address, and it has already passed a strict hex
 * pattern before any read happens; everything else here was produced by this
 * application's own code. There is no free-text field, no fetched description,
 * no token name from an arbitrary contract — and therefore no opening for
 * prompt injection to arrive through the data.
 *
 * The figures are rendered with the *interface's own formatters*, in the
 * reader's language. The model is told not to repeat them, but it will refer to
 * them, and a model reasoning over "%70,50" while the page shows "70.50%" is
 * reasoning about a different-looking page than the one being read.
 *
 * Anything directional is stated here as a finished sentence rather than left
 * for the model to work out. See {@link describeRange}.
 */

const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  tr: "Turkish",
};

/**
 * Words the interface itself uses, for languages where the model would
 * otherwise reach for a different one each time.
 *
 * Read across four pools in Turkish, one deployment wrote both "gas" and "gaz",
 * both "geçici kayıp" and "impermanent loss", and both "yıllıklandırılmış" and
 * "yıllıklaştırılmış" — the last of them in prose sitting directly below a label
 * that read "Yıllıklandırılmış". Each choice is defensible alone; together they
 * make one site look like several, and leave a reader comparing two pools to
 * work out for themselves that two words mean one thing.
 *
 * English needs no list: the interface already uses the terms the model does.
 */
const TERMINOLOGY: Record<Locale, readonly string[]> = {
  en: [],
  tr: [
    'the pool: "havuz"',
    'token, plural: "tokenlar"',
    'volatility: "volatilite"',
    'annualised: "yıllıklandırılmış"',
    'a fee, and fees a position earns: "komisyon"',
    'swap: "takas"',
    'gas: "gas", never "gaz"',
    'impermanent loss: "geçici kayıp"',
    'tick spacing: "tick adımı" — the step between usable ticks',
    'the suggested tick range: "tick aralığı", or just "aralık"',
    'the price band it was derived from: "bant"',
  ],
};

/** One labelled figure. A list of these is easier for a model to hold than JSON. */
const line = (label: string, value: string): string => `- ${label}: ${value}`;

const describePool = (analysis: PoolRangeAnalysis, locale: Locale): readonly string[] => {
  const { pool } = analysis;

  return [
    line("Pair", `${pool.token0.symbol} / ${pool.token1.symbol}`),
    line("Fee tier", formatFeePpm(pool.feePpm, locale)),
    line("Tick spacing", formatWhole(pool.tickSpacing, locale)),
    /*
     * Spelled out rather than given as "token1 per token0". The short form is
     * the one that inverts: a model handed "WETH per USDC" wrote "WETH başına
     * USDC" — which is Turkish for USDC per WETH — and every price on that page
     * then read backwards. A sentence with a subject and a verb survives the
     * translation the two-word form does not.
     */
    line(
      "What every price figure on the page means",
      `how much ${pool.token1.symbol} one ${pool.token0.symbol} is worth`,
    ),
  ];
};

const describeMarket = (analysis: PoolRangeAnalysis, locale: Locale): readonly string[] => {
  const { snapshot, band, range } = analysis;

  return [
    line("Current price", formatPrice(band.currentPrice, locale)),
    line("Current tick", formatTick(range.currentTick, locale)),
    line("Total value locked", formatUsd(snapshot.tvlUsd, locale)),
  ];
};

const describeVolatility = (analysis: PoolRangeAnalysis, locale: Locale): readonly string[] => {
  const { volatility } = analysis;

  return [
    line("Annualised volatility", formatPercent(volatility.annualizedVolatility, locale)),
    line("Daily volatility", formatPercent(volatility.dailyVolatility, locale)),
    line(
      "Measured over",
      `${formatUtcDate(volatility.rangeStart)} to ${formatUtcDate(volatility.rangeEndExclusive)}`,
    ),
    line("Usable daily returns", formatWhole(volatility.usableReturnCount, locale)),
    line("Window coverage", formatPercent(volatility.returnCoverageRatio, locale)),
  ];
};

const describeBand = (analysis: PoolRangeAnalysis, locale: Locale): readonly string[] => {
  const { band, parameters } = analysis;

  return [
    line("Horizon", `${formatWhole(parameters.horizonDays, locale)} days`),
    line(
      "Standard deviation multiplier",
      formatWhole(parameters.standardDeviationMultiplier, locale),
    ),
    line("Band lower bound", formatPrice(band.lowerPrice, locale)),
    line("Band upper bound", formatPrice(band.upperPrice, locale)),
    line("Distance down to the lower bound", formatPercent(band.downsideDistanceRatio, locale)),
    line("Distance up to the upper bound", formatPercent(band.upsideDistanceRatio, locale)),
  ];
};

const describeRange = (analysis: PoolRangeAnalysis, locale: Locale): readonly string[] => {
  const { range, pool } = analysis;
  const spacings = (range.upperTick - range.lowerTick) / pool.tickSpacing;

  return [
    line("Lower tick", formatTick(range.lowerTick, locale)),
    line("Price at the lower tick", formatPrice(range.lowerPrice, locale)),
    line("Upper tick", formatTick(range.upperTick, locale)),
    line("Price at the upper tick", formatPrice(range.upperPrice, locale)),
    line("Width in tick spacings", formatWhole(spacings, locale)),
    line("Current price inside the range", range.containsCurrentPrice ? "yes" : "no"),
    /*
     * Which token a position is left holding at each edge is fixed by the
     * protocol — below the range it is all token0, above it all token1 — so it
     * is stated here rather than re-derived per request. Asked to work it out,
     * a model got it right for one pool and backwards for the next, in the one
     * paragraph whose whole subject is what happens at the edges. Something
     * this deterministic has no business being inferred.
     */
    line("If price falls below the range, a position holds only", pool.token0.symbol),
    line("If price rises above the range, a position holds only", pool.token1.symbol),
    line(
      "Lower edge",
      range.lowerBoundTruncated
        ? "truncated at the lowest tick this pool accepts"
        : "placed where the band asked",
    ),
    line(
      "Upper edge",
      range.upperBoundTruncated
        ? "truncated at the highest tick this pool accepts"
        : "placed where the band asked",
    ),
  ];
};

const section = (title: string, lines: readonly string[]): string =>
  `${title}\n${lines.join("\n")}`;

export type RangeInterpretationPrompt = {
  /** Byte-identical on every call, so it can front the prompt cache. */
  readonly system: string;
  readonly user: string;
};

export type RangeInterpretationPromptInput = {
  readonly analysis: PoolRangeAnalysis;
  readonly locale: Locale;
  /**
   * The caveats the pipeline attached to this analysis, in its own order.
   *
   * Passed in rather than read off the analysis because they belong to the
   * *result*, not the data. The model is given them so its explanation can
   * account for a figure that rests on an incomplete window — the interface
   * still shows each caveat verbatim on its own.
   */
  readonly warnings: readonly string[];
};

export const buildRangeInterpretationPrompt = (
  input: RangeInterpretationPromptInput,
): RangeInterpretationPrompt => {
  const { analysis, locale, warnings } = input;
  const terminology = TERMINOLOGY[locale];

  const blocks: readonly (string | null)[] = [
    `Write in ${LANGUAGE_NAMES[locale]}.`,
    terminology.length === 0
      ? null
      : section(
          "WORDS TO USE, SO THE TEXT AND THE INTERFACE AGREE",
          terminology.map((term) => `- ${term}`),
        ),
    section("POOL", describePool(analysis, locale)),
    section("CURRENT STATE", describeMarket(analysis, locale)),
    section("HISTORICAL VOLATILITY", describeVolatility(analysis, locale)),
    section("PRICE BAND", describeBand(analysis, locale)),
    section("SUGGESTED TICK RANGE", describeRange(analysis, locale)),
    warnings.length === 0
      ? "CAVEATS\n- none"
      : section(
          "CAVEATS",
          warnings.map((warning) => `- ${warning}`),
        ),
    `Explain these figures in four parts: what the suggested range means, what happens if price leaves it, what the volatility figure is saying, and what this analysis does not cover. Remember that you may not write any number.`,
  ];

  return {
    system: BASE_INSTRUCTION,
    user: blocks.filter((block): block is string => block !== null).join("\n\n"),
  };
};
