import type { Token } from "../../schemas";

/*
 * Which way round a price is written for a reader.
 *
 * Every price this application computes is `token0PriceInToken1`: how much
 * token1 one token0 is worth, because that is the direction the pool and its
 * source quote in. For a USDC/WETH pool that is 0.000293 WETH per USDC, and
 * nobody thinks about the price of a dollar in ether. A reader wants to be told
 * that one WETH is worth 3,412 USDC.
 *
 * The rule is numeric, not a list of well-known symbols: a price is written the
 * way round that makes it at least one — one unit of the dearer token, priced
 * in the cheaper. A symbol is whatever its contract says it is, so a rule keyed
 * on symbols would be keyed on nothing; a rule keyed on the price itself needs
 * to trust nobody, and it reads the right way for the pairs people actually
 * open: a stablecoin against ether, ether against bitcoin, a small token against
 * either.
 *
 * Near parity the direction can change between two readings of the same pool —
 * a stablecoin pair at 0.9998 one day and 1.0002 the next. That is the cost of
 * the rule, and it is small: each page is consistent with itself, which is the
 * property that matters, and the two readings state the same fact.
 *
 * Everything here is arithmetic on figures that were computed and verified
 * upstream. Nothing is estimated, and a reciprocal introduces no new
 * information — only a new way of reading the same one.
 */

export type PriceQuote = {
  /** The token one unit of which is being priced: "1 base = price quote". */
  readonly base: Token;
  /** The token the price is counted in. */
  readonly quote: Token;
  /** True when every shown price is the reciprocal of the computed one. */
  readonly inverted: boolean;
};

/** The two tokens the quote is chosen between, in the pool's own order. */
export type QuotedPair = {
  readonly token0: Token;
  readonly token1: Token;
};

/**
 * Chooses the direction from the current price alone.
 *
 * At exactly one the pool's own direction stands, so a pair at parity is not
 * flipped for nothing.
 */
export const choosePriceQuote = (pair: QuotedPair, token0PriceInToken1: number): PriceQuote =>
  token0PriceInToken1 >= 1
    ? { base: pair.token0, quote: pair.token1, inverted: false }
    : { base: pair.token1, quote: pair.token0, inverted: true };

/** One computed `token0PriceInToken1` figure, as the quote writes it. */
export const quotedPrice = (quote: PriceQuote, token0PriceInToken1: number): number =>
  quote.inverted ? 1 / token0PriceInToken1 : token0PriceInToken1;

export type PriceInterval = {
  readonly lower: number;
  readonly upper: number;
};

/**
 * An interval of computed prices, as the quote writes it.
 *
 * Inverting swaps the ends: the reciprocal of the higher price is the lower one.
 * Written out rather than left to the caller, because "invert each end" is the
 * mistake that produces a range whose lower edge is above its upper.
 */
export const quotedInterval = (quote: PriceQuote, interval: PriceInterval): PriceInterval =>
  quote.inverted
    ? { lower: 1 / interval.upper, upper: 1 / interval.lower }
    : { lower: interval.lower, upper: interval.upper };

/**
 * Anything stated per edge — a truncation flag, a note — moved to the edge it
 * belongs to in the shown direction.
 *
 * Inverting swaps the ends, exactly as it does for the prices: the pool's upper
 * edge, where its price can go no higher, is the reader's lower edge, where
 * theirs can go no lower. A flag carried across without this ends up on the
 * wrong edge of the page, saying the range stops short at the top when it is
 * the bottom that was cut.
 */
export const quotedEnds = <T,>(quote: PriceQuote, ends: { readonly lower: T; readonly upper: T }): { readonly lower: T; readonly upper: T } =>
  quote.inverted ? { lower: ends.upper, upper: ends.lower } : { lower: ends.lower, upper: ends.upper };

export type EdgeDistances = {
  /** How far below the current price the lower edge sits, as a ratio of the current price. */
  readonly down: number;
  /** How far above it the upper edge sits, likewise. */
  readonly up: number;
};

/**
 * How far each edge of an interval is from a price, in the direction the
 * interval is written.
 *
 * Measured afresh in the shown direction rather than carried over from the
 * computed one, because the two do not agree: ten percent up in one direction
 * is nine percent down in the other. The figure a reader sees must be the
 * figure for the prices they see.
 */
export const edgeDistances = (current: number, interval: PriceInterval): EdgeDistances => ({
  down: 1 - interval.lower / current,
  up: interval.upper / current - 1,
});

/**
 * Which token a position is left holding once price leaves the range, in the
 * shown direction.
 *
 * The protocol fixes it in the pool's direction: below the range a position
 * holds only token0, above it only token1. Inverting the quote inverts which
 * way is "below" and swaps which token is the base, and the two inversions
 * cancel — so in either direction, a position ends up holding only the base
 * when the base gets cheaper, and only the quote when the base gets dearer.
 * Which is also the intuitive reading: as ether falls the position finishes in
 * ether, as it rises the position finishes in dollars.
 */
export const heldBelowRange = (quote: PriceQuote): Token => quote.base;
export const heldAboveRange = (quote: PriceQuote): Token => quote.quote;
