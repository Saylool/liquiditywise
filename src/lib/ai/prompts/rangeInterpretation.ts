import { feeDisclosureFor } from "../../advisor/feeDisclosure";
import {
  formatFeePpm,
  formatMeasuredFeePpm,
  formatMultiplier,
  formatPercent,
  formatPrice,
  formatUsd,
  formatUtcDate,
  formatWhole,
} from "../../format/displayFormats";
import {
  choosePriceQuote,
  edgeDistances,
  heldAboveRange,
  heldBelowRange,
  type PriceQuote,
  quotedEnds,
  quotedInterval,
  quotedPrice,
} from "../../format/priceQuote";
import { priceStepRatio } from "../../format/priceStep";
import { getDictionary } from "../../i18n/dictionaries";
import type { Locale } from "../../i18n/locales";
import type { PoolRangeAnalysis } from "../../advisor/poolRangeAnalysis";
import {
  alterSwapEconomics,
  type DataWarningNotice,
  hookPermissionsOf,
} from "../../../schemas";
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
 * reader's language, and every price the same way round the page writes it —
 * one unit of the dearer token, priced in the cheaper. The model is told not
 * to repeat them, but it will refer to them, and a model reasoning over
 * "%70,50" while the page shows "70.50%", or over ether priced in dollars
 * while the page prices dollars in ether, is reasoning about a different page
 * than the one being read.
 *
 * Anything directional is stated here as a finished sentence rather than left
 * for the model to work out. See {@link describeRange}.
 *
 * No tick reaches the prompt. The page shows the range as two prices and
 * folds the ticks away, and a model handed a coordinate the reader has not
 * seen would explain it to them.
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
    'the price step between usable edges: "fiyat adımı"',
    'the suggested range: "aralık"',
    'the price band it was derived from: "bant"',
  ],
};

/** One labelled figure. A list of these is easier for a model to hold than JSON. */
const line = (label: string, value: string): string => `- ${label}: ${value}`;

/**
 * The direction every price in the prompt is written in: the page's, chosen
 * from the current price exactly as the page chooses it.
 */
const quoteFor = (analysis: PoolRangeAnalysis): PriceQuote =>
  choosePriceQuote(analysis.pool, analysis.band.currentPrice);

/** A stated swap fee as one figure, or two when the protocol's cut differs by direction. */
const formatStatedFee = (stated: { readonly lowestPpm: number; readonly highestPpm: number }, locale: Locale): string =>
  stated.lowestPpm === stated.highestPpm
    ? formatFeePpm(stated.lowestPpm, locale)
    : `${formatFeePpm(stated.lowestPpm, locale)} to ${formatFeePpm(stated.highestPpm, locale)}`;

const describePool = (analysis: PoolRangeAnalysis, locale: Locale): readonly string[] => {
  const { pool } = analysis;
  const { lpFeePpm, protocolFee, statedSwapFee } = feeDisclosureFor(pool);
  const quote = quoteFor(analysis);
  const protocolTakes =
    protocolFee !== null && (protocolFee.zeroForOnePpm > 0 || protocolFee.oneForZeroPpm > 0);

  return [
    line("Pair", `${pool.token0.symbol} / ${pool.token1.symbol}`),
    line("Protocol", `Uniswap ${pool.protocolVersion}`),
    /*
     * The pool's own fee, read from its key on the chain, and what a swap pays
     * once the protocol's cut is on top. Named for who receives it rather than
     * as a "tier", because a hook may charge something else on every swap —
     * the measured rate follows below — and because on v4 the two figures are
     * not the same number.
     */
    line(
      "Fee to liquidity providers",
      lpFeePpm === null
        ? "none fixed; this pool's hook sets the fee on each swap"
        : formatFeePpm(lpFeePpm, locale),
    ),
    ...(protocolTakes
      ? [
          line(
            "Fee to the protocol, taken on top",
            formatStatedFee(
              {
                lowestPpm: Math.min(protocolFee.zeroForOnePpm, protocolFee.oneForZeroPpm),
                highestPpm: Math.max(protocolFee.zeroForOnePpm, protocolFee.oneForZeroPpm),
              },
              locale,
            ),
          ),
        ]
      : []),
    line(
      "What a swap pays, by the pool's own terms",
      statedSwapFee === null
        ? "decided per swap by the hook"
        : formatStatedFee(statedSwapFee, locale),
    ),
    /* As the page says it: a percentage, not a tick count. */
    line(
      "Price step between the edges a position may use",
      formatPercent(priceStepRatio(pool.tickSpacing), locale),
    ),
    /*
     * Spelled out rather than given as "token1 per token0". The short form is
     * the one that inverts: a model handed "WETH per USDC" wrote "WETH başına
     * USDC" — which is Turkish for USDC per WETH — and every price on that page
     * then read backwards. A sentence with a subject and a verb survives the
     * translation the two-word form does not.
     */
    line(
      "What every price figure on the page means",
      `how much ${quote.quote.symbol} one ${quote.base.symbol} is worth`,
    ),
  ];
};

/**
 * The hook, for a v4 pool, in the only terms that need trusting nobody.
 *
 * What a hook is *permitted* to do is fixed in its address — v4 stores a hook's
 * permissions nowhere else — so that is what the model is told, as the page
 * prints it. What the hook *does* is not knowable from here and is not said.
 * Nothing about the hook's identity travels either: no address, no name. The
 * permission names are the protocol's own fixed vocabulary, and the model is
 * asked to describe the effect rather than repeat them.
 *
 * A v3 pool gets no section at all. Telling the model "hook: none" about a
 * protocol that has no hooks would invite a sentence explaining an absence
 * the reader never had reason to expect.
 */
const describeHook = (analysis: PoolRangeAnalysis): readonly string[] | null => {
  const { pool } = analysis;
  if (pool.protocolVersion !== "v4") return null;

  if (pool.hookAddress === null) {
    return [line("Hook", "none; the pool behaves the way a v3 pool does")];
  }

  return [
    line("Hook", "present: a contract the protocol calls around this pool's swaps and deposits"),
    line("What it is permitted to do", hookPermissionsOf(pool.hookAddress).join(", ")),
    line(
      "May change what a swap costs or pays",
      alterSwapEconomics(pool.hookAddress) ? "yes" : "no",
    ),
    line(
      "Say",
      "in one or two sentences, that a hook is attached and what it may change, in plain words rather than the names above; never what it does, whether it is safe, or who wrote it",
    ),
  ];
};

/** A price as the page writes it: "1 WETH = 3,412 USDC". */
const priceSentence = (quote: PriceQuote, token0PriceInToken1: number, locale: Locale): string =>
  `1 ${quote.base.symbol} = ${formatPrice(quotedPrice(quote, token0PriceInToken1), locale)} ${quote.quote.symbol}`;

const describeMarket = (analysis: PoolRangeAnalysis, locale: Locale): readonly string[] => {
  const { snapshot, band } = analysis;

  return [
    line("Current price", priceSentence(quoteFor(analysis), band.currentPrice, locale)),
    line("Total value locked", formatUsd(snapshot.tvlUsd, locale)),
  ];
};

/**
 * Where the range came from, in the page's words: how much the price moves on
 * a typical day, what that comes to over the horizon, and how many of those
 * the range is wide. The standard deviation is named once, so the model can
 * explain the term if it chooses to and is not made to.
 */
const describeBasis = (analysis: PoolRangeAnalysis, locale: Locale): readonly string[] => {
  const { volatility, band, parameters } = analysis;

  return [
    line(
      "Typical daily move, one standard deviation",
      formatPercent(volatility.dailyVolatility, locale),
    ),
    line("Horizon", `${formatWhole(parameters.horizonDays, locale)} days`),
    line("The same movement over the horizon", formatPercent(band.horizonVolatility, locale)),
    line(
      "Range width, in multiples of that, each way",
      formatMultiplier(parameters.standardDeviationMultiplier, locale),
    ),
    line(
      "Measured over",
      `${formatUtcDate(volatility.rangeStart)} to ${formatUtcDate(volatility.rangeEndExclusive)}`,
    ),
    line("Usable daily changes", formatWhole(volatility.usableReturnCount, locale)),
    line("Window coverage", formatPercent(volatility.returnCoverageRatio, locale)),
  ];
};

const describeRange = (analysis: PoolRangeAnalysis, locale: Locale): readonly string[] => {
  const { range, band } = analysis;
  const quote = quoteFor(analysis);
  const edges = quotedInterval(quote, { lower: range.lowerPrice, upper: range.upperPrice });
  const distances = edgeDistances(quotedPrice(quote, band.currentPrice), edges);
  /* The flags name the pool's edges; the prices above name the reader's. */
  const truncated = quotedEnds(quote, {
    lower: range.lowerBoundTruncated,
    upper: range.upperBoundTruncated,
  });
  const unit = `${quote.quote.symbol} per ${quote.base.symbol}`;

  return [
    line("Lower edge", `${formatPrice(edges.lower, locale)} ${unit}`),
    line("Upper edge", `${formatPrice(edges.upper, locale)} ${unit}`),
    /*
     * The distances only while the price is between the edges, as on the page:
     * a negative distance below is not a distance, and the line after says the
     * price is outside.
     */
    ...(range.containsCurrentPrice
      ? [
          line("Distance down to the lower edge", formatPercent(distances.down, locale)),
          line("Distance up to the upper edge", formatPercent(distances.up, locale)),
        ]
      : []),
    line("Current price inside the range", range.containsCurrentPrice ? "yes" : "no"),
    /*
     * Which token a position is left holding at each edge is fixed by the
     * protocol — below the range it is all token0, above it all token1 — and
     * stated here in the direction the prices are written in, where the two
     * inversions cancel: the position finishes in the base as the base gets
     * cheaper. Asked to work it out, a model got it right for one pool and
     * backwards for the next, in the one paragraph whose whole subject is what
     * happens at the edges. Something this deterministic has no business being
     * inferred.
     */
    line("If price falls below the range, a position holds only", heldBelowRange(quote).symbol),
    line("If price rises above the range, a position holds only", heldAboveRange(quote).symbol),
    line(
      "Lower edge placement",
      truncated.lower
        ? "truncated at the lowest price this pool can express"
        : "placed where the band asked",
    ),
    line(
      "Upper edge placement",
      truncated.upper
        ? "truncated at the highest price this pool can express"
        : "placed where the band asked",
    ),
  ];
};

/**
 * What the range is worth against holding, at the prices it was measured at.
 *
 * Given to the model because the explanation is the only place a reader is told
 * what the table means — and because the instruction's account of what this
 * application cannot do would otherwise be out of date the moment it read one.
 */
const describeDivergence = (analysis: PoolRangeAnalysis, locale: Locale): readonly string[] => {
  const { divergence } = analysis;
  const quote = quoteFor(analysis);
  /* In the page's direction, and in the page's order: ascending. */
  const points = divergence.points.map((point) => ({
    price: quotedPrice(quote, point.price),
    lossRatio: point.lossRatio,
  }));
  if (quote.inverted) points.reverse();

  return [
    line("Measured from", priceSentence(quote, divergence.entryPrice, locale)),
    ...points.map((point) =>
      line(
        `Against holding, at ${formatPrice(point.price, locale)} ${quote.quote.symbol}`,
        formatPercent(point.lossRatio, locale),
      ),
    ),
    line("What it counts", "price movement only, exactly; no fees, no gas"),
  ];
};

/**
 * What the pool did over the window, and where those days sat.
 *
 * The model is given these so the explanation can say what they mean — and told,
 * in the same breath, what they are not. A reader who takes "the pool charged
 * this" for "you would have earned this" has misread the page, and the
 * explanation is the only place that can head it off in a sentence.
 */
const describeActivity = (analysis: PoolRangeAnalysis, locale: Locale): readonly string[] => {
  const { activity } = analysis;
  const usd = (value: number | null) => (value === null ? "not available" : formatUsd(value, locale));

  return [
    line("Volume over the last day", usd(activity.volume24hUsd)),
    line("Volume over the last week", usd(activity.volume7dUsd)),
    line("Volume over the last month", usd(activity.volume30dUsd)),
    line("Fees the pool charged over the last month", usd(activity.fees30dUsd)),
    line("Days measured", formatWhole(activity.daysMeasured, locale)),
    line("Days entirely inside the range", formatWhole(activity.occupancy.fullyInside, locale)),
    line("Days entirely outside it", formatWhole(activity.occupancy.fullyOutside, locale)),
    line("Days that crossed an edge", formatWhole(activity.occupancy.undetermined, locale)),
    line(
      "Fees charged on the days entirely inside",
      feeDisclosureFor(analysis.pool).mayAttributeFeesToRange
        ? usd(activity.feesWhileFullyInsideUsd)
        : "withheld; this pool's hook may take a share of a swap and the source does not separate it",
    ),
    line(
      "What these are not",
      "anyone's earnings; they are the whole pool's, and the share a position would take is not known here",
    ),
    line(
      "Why these day counts do not test the range",
      "they are the same days the range was measured from, so they describe how it was fitted",
    ),
  ];
};

/**
 * What the pool actually charged, in three lines.
 *
 * Deliberately short, for the reason the out-of-sample block below spells out:
 * the page prints its own caveats in its own deterministic sentences, and every
 * caveat handed across here comes back as prose that has to fit inside a section
 * bound. So this gives the model the figures and the one fact it cannot derive —
 * whether the declared rate and the charged rate are the same number.
 */
const describeRealizedFee = (
  analysis: PoolRangeAnalysis,
  locale: Locale,
): readonly string[] => {
  const { realizedFee } = analysis;
  if (realizedFee.status === "unavailable") {
    return [line("Measured rate", "not measurable; this pool traded nothing in the window")];
  }

  const { rate, verdict } = realizedFee;

  return [
    line("Rate actually charged, median day", formatMeasuredFeePpm(rate.medianPpm, locale)),
    line(
      "Cheapest to dearest day",
      `${formatMeasuredFeePpm(rate.lowestPpm, locale)} to ${formatMeasuredFeePpm(rate.highestPpm, locale)}`,
    ),
    line(
      "Against what the pool says a swap pays",
      verdict.kind === "matches"
        ? "the same on every measured day"
        : verdict.kind === "none-stated"
          ? "nothing to compare; this pool states no rate"
          : `different on ${formatWhole(verdict.daysDiffering, locale)} of ${formatWhole(rate.daysMeasured, locale)} measured days`,
    ),
  ];
};

/**
 * The check that does test it, kept deliberately short.
 *
 * The model is told the outcome because the page shows it, and a text saying the
 * analysis has no out-of-sample verification would be describing a different
 * page. It is not told the outcome three times over — the first version of this
 * handed across every caveat the panel prints, the model dutifully wrote all of
 * them out, and the section grew from five hundred characters to nearly nine
 * hundred. In English it fitted; in Turkish, which runs a quarter longer again,
 * the whole answer was refused.
 *
 * So the page keeps its own caveats, in its own deterministic sentences, in both
 * languages, directly beside the figures they qualify. What is left for the
 * prose is the one thing the panel cannot do: stop the reader concluding from a
 * table that the method has been shown to work. One sentence, and the standing
 * instruction carries the rest.
 *
 * The spread between stretches is still handed over rather than inferred. A
 * total of two thirds means something different when every stretch behaved
 * alike than when two were perfect and one collapsed, and the model cannot see
 * the rows.
 */
const describeOutOfSample = (analysis: PoolRangeAnalysis, locale: Locale): readonly string[] => {
  const { outOfSample } = analysis;
  const whole = (value: number) => formatWhole(value, locale);

  if (outOfSample.status !== "success") {
    return [
      line("Was the method checked on days it was not fitted to", "no"),
      line("Why not", "this pool has too little indexed history to fit a band in the past and still leave a full horizon to check it against"),
      line("Say", "at most that no such check was possible here. Never that one was run"),
    ];
  }

  const { folds, daysMeasured, occupancy } = outOfSample.data;
  const insideCounts = folds.map((fold) => fold.occupancy.fullyInside);

  return [
    line("Was the method checked on days it was not fitted to", "yes"),
    line(
      "How",
      "a band drawn the same way at points in the past, each centred on the price at that point and laid over the days that came after it",
    ),
    line("Stretches checked", whole(folds.length)),
    line("Days checked", whole(daysMeasured)),
    line("Days that stayed entirely inside", whole(occupancy.fullyInside)),
    line("Best single stretch, days inside", whole(Math.max(...insideCounts))),
    line("Worst single stretch, days inside", whole(Math.min(...insideCounts))),
    line(
      "Say",
      "one sentence: that this was checked on days the fit never saw, and roughly how it came out. Do not restate the limits printed beside the figures, and never write that the method works, usually works, or is reliable",
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
   * still shows each caveat on its own.
   *
   * Codes, rendered below into the same sentences the page shows, in the same
   * language. A model reasoning over an English caveat while writing Turkish
   * prose about it is reasoning about a different page than the one being read
   * — the same argument that puts the figures through the interface's own
   * formatters.
   */
  readonly warnings: readonly DataWarningNotice[];
};

export const buildRangeInterpretationPrompt = (
  input: RangeInterpretationPromptInput,
): RangeInterpretationPrompt => {
  const { analysis, locale, warnings } = input;
  const terminology = TERMINOLOGY[locale];
  const hookLines = describeHook(analysis);

  const blocks: readonly (string | null)[] = [
    `Write in ${LANGUAGE_NAMES[locale]}.`,
    terminology.length === 0
      ? null
      : section(
          "WORDS TO USE, SO THE TEXT AND THE INTERFACE AGREE",
          terminology.map((term) => `- ${term}`),
        ),
    section("POOL", describePool(analysis, locale)),
    hookLines === null ? null : section("HOOK", hookLines),
    section("CURRENT STATE", describeMarket(analysis, locale)),
    section("HOW THE RANGE WAS DRAWN", describeBasis(analysis, locale)),
    section("SUGGESTED PRICE RANGE", describeRange(analysis, locale)),
    section("AGAINST SIMPLY HOLDING", describeDivergence(analysis, locale)),
    section("WHAT THE POOL ACTUALLY DID", describeActivity(analysis, locale)),
    section("WHAT IT ACTUALLY CHARGED", describeRealizedFee(analysis, locale)),
    section("THE SAME METHOD, ON DAYS IT NEVER SAW", describeOutOfSample(analysis, locale)),
    warnings.length === 0
      ? "CAVEATS\n- none"
      : section(
          "CAVEATS",
          warnings.map((warning) => `- ${getDictionary(locale).notices.warning[warning]}`),
        ),
    `Explain these figures in four parts: what the suggested range means, what happens if price leaves it, what the volatility figure is saying, and what this analysis does not cover. Remember that you may not write any number.`,
  ];

  return {
    system: BASE_INSTRUCTION,
    user: blocks.filter((block): block is string => block !== null).join("\n\n"),
  };
};
