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
 */

const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  tr: "Turkish",
};

/** One labelled figure. A list of these is easier for a model to hold than JSON. */
const line = (label: string, value: string): string => `- ${label}: ${value}`;

const describePool = (analysis: PoolRangeAnalysis, locale: Locale): readonly string[] => {
  const { pool } = analysis;

  return [
    line("Pair", `${pool.token0.symbol} / ${pool.token1.symbol}`),
    line("Fee tier", formatFeePpm(pool.feePpm, locale)),
    line("Tick spacing", formatWhole(pool.tickSpacing, locale)),
    line("Price direction", `${pool.token1.symbol} per ${pool.token0.symbol}`),
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

  const blocks = [
    `Write in ${LANGUAGE_NAMES[locale]}.`,
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

  return { system: BASE_INSTRUCTION, user: blocks.join("\n\n") };
};
