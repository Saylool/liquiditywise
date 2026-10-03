import { z } from "zod";

import { IsoTimestampSchema } from "../../schemas/primitives";
import { lpFeePpm, VOLATILITY_WINDOW_DAYS } from "../../schemas";
import {
  DEFAULT_PRICE_BAND_PARAMETERS,
  type PoolRangeAnalysis,
} from "../advisor/poolRangeAnalysis";
import { feeDisclosureFor } from "../advisor/feeDisclosure";
import { poolAnalysisHref, v4PoolAnalysisHref } from "../advisor/requestedParameters";
import { choosePriceQuote, quotedEnds, quotedInterval, quotedPrice } from "../format/priceQuote";
import { getEmbedCopy } from "../i18n/embedCopy";
import type { Locale } from "../i18n/locales";
import { SITE_URL } from "../site/indexing";
import type { EmbedRequest } from "./embedRequest";

/*
 * What an embedded card shows, and what the JSON beside it returns: one pool's
 * suggested range for the default horizon and width, at the price it was read
 * at — every figure the pipeline's own, turned the way the pool page turns it.
 *
 * Pure: the analysis comes in already worked out, and nothing here reads the
 * network, the clock or the environment. No figure is made here either. The
 * range, the price and the time are the pipeline's; this only chooses the
 * direction they are written in, with the same rule as the page, so a reader
 * following the card's link finds the same numbers the same way round.
 *
 * The default parameters only, and stated with the figures: a card on another
 * site has no form beside it, and a range is meaningless without the horizon
 * and the width it was drawn for.
 */

const PositiveFinite = z.number().positive().refine(Number.isFinite, { error: "Must be finite." });

export const PoolEmbedSchema = z.strictObject({
  protocol: z.enum(["v3", "v4"]),
  chain: z.strictObject({ id: z.number().int().positive(), slug: z.string().min(1), name: z.string().min(1) }),
  /** A v3 pool's address or a v4 pool's id, lower case. */
  pool: z.string().regex(/^0x(?:[0-9a-f]{40}|[0-9a-f]{64})$/),
  pair: z.strictObject({ token0: z.string(), token1: z.string() }),
  /** The fee providers are paid, in millionths; `null` when the pool's hook sets it per swap. */
  lpFeePpm: z.number().int().min(0).nullable(),
  /** Every price in one direction: how many `quote` one `base` is worth. */
  price: z.strictObject({
    base: z.string(),
    quote: z.string(),
    current: PositiveFinite,
  }),
  range: z
    .strictObject({
      lower: PositiveFinite,
      upper: PositiveFinite,
      currentInRange: z.boolean(),
      /** An edge the pool's tick grid could not reach, so it stops short of the band. */
      lowerTruncated: z.boolean(),
      upperTruncated: z.boolean(),
    })
    .refine((range) => range.lower < range.upper, { error: "The lower edge must be below the upper." }),
  parameters: z.strictObject({
    horizonDays: z.number().int().positive(),
    standardDeviationMultiplier: z.number().positive(),
  }),
  /** True for a v4 pool whose hook may change what a swap costs: the range is drawn from the curve. */
  hookMayAlterSwaps: z.boolean(),
  /** When the price was read — not when this was served. */
  analysedAt: IsoTimestampSchema,
  /** The pool's page on this site, at the same horizon and width. */
  poolUrl: z.string().startsWith(`${SITE_URL}/`),
  disclaimer: z.string().min(1),
});

export type PoolEmbed = z.infer<typeof PoolEmbedSchema>;

/** Everything but the disclaimer, which is in the reader's language: what is kept per pool. */
export type PoolEmbedFigures = Omit<PoolEmbed, "disclaimer">;

/** The pool's page, at the horizon and width the card was drawn for; the chain unsaid on mainnet. */
export const embeddedPoolUrl = (request: EmbedRequest): string =>
  `${SITE_URL}${
    request.protocol === "v3"
      ? poolAnalysisHref(request.poolId, DEFAULT_PRICE_BAND_PARAMETERS, undefined, request.chain)
      : v4PoolAnalysisHref(request.poolId, DEFAULT_PRICE_BAND_PARAMETERS, undefined, request.chain)
  }`;

/** The card's figures, from an analysis of the pool it was asked for. */
export const poolEmbedFigures = (analysis: PoolRangeAnalysis, request: EmbedRequest): PoolEmbedFigures => {
  const { pool, band, range, parameters } = analysis;
  const quote = choosePriceQuote(pool, band.currentPrice);
  const edges = quotedInterval(quote, { lower: range.lowerPrice, upper: range.upperPrice });
  /* Inverting renames the edges, so the flags move with them (see priceQuote.ts). */
  const truncated = quotedEnds(quote, { lower: range.lowerBoundTruncated, upper: range.upperBoundTruncated });

  return {
    protocol: pool.protocolVersion,
    chain: { id: request.chain.id, slug: request.chain.slug, name: request.chain.name },
    pool: request.poolId,
    pair: { token0: pool.token0.symbol, token1: pool.token1.symbol },
    lpFeePpm: lpFeePpm(pool),
    price: { base: quote.base.symbol, quote: quote.quote.symbol, current: quotedPrice(quote, band.currentPrice) },
    range: {
      lower: edges.lower,
      upper: edges.upper,
      currentInRange: range.containsCurrentPrice,
      lowerTruncated: truncated.lower,
      upperTruncated: truncated.upper,
    },
    parameters: {
      horizonDays: parameters.horizonDays,
      standardDeviationMultiplier: parameters.standardDeviationMultiplier,
    },
    hookMayAlterSwaps: feeDisclosureFor(pool).hookMayAlterSwaps,
    analysedAt: band.currentPriceFetchedAt,
    poolUrl: embeddedPoolUrl(request),
  };
};

/**
 * The days the range's movement is measured over: the returns between the
 * window's closes, one fewer than the closes themselves.
 */
export const MEASURED_DAYS = VOLATILITY_WINDOW_DAYS - 1;

/**
 * The JSON a caller is answered with, checked against the schema on its way
 * out — `null` if it does not hold, which the route answers as a pool that
 * could not be read rather than as a shape nobody promised.
 */
export const poolEmbedData = (figures: PoolEmbedFigures, locale: Locale): PoolEmbed | null => {
  const parsed = PoolEmbedSchema.safeParse({
    ...figures,
    disclaimer: getEmbedCopy(locale).disclaimer(String(MEASURED_DAYS)),
  });
  return parsed.success ? parsed.data : null;
};
