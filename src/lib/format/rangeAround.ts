import type { Locale } from "../i18n/locales";
import { formatPercent } from "./displayFormats";

/*
 * A range as how far below and above the price its edges sit, in the
 * direction the rest of the site quotes the pair.
 *
 * Ratios are computed in the pool's `token0PriceInToken1` direction, so a pair
 * quoted the other way round has to be inverted — and inverting swaps the
 * ends: the reciprocal of the higher edge is the lower one. Written once
 * because "invert each end" is the mistake that produces a lower edge above
 * its upper, and two pages state ranges this way.
 */

export type RangeAround = { readonly below: number; readonly above: number };

/** `lowerRatio` and `upperRatio` are the edges' prices over the price now. */
export const rangeAroundInverted = (inverted: boolean, lowerRatio: number, upperRatio: number): RangeAround =>
  inverted
    ? { below: 1 / upperRatio - 1, above: 1 / lowerRatio - 1 }
    : { below: lowerRatio - 1, above: upperRatio - 1 };

/** A ratio as a percentage with its sign written, so a range reads as a distance either way. */
export const signedPercent = (ratio: number, locale: Locale): string =>
  `${ratio > 0 ? "+" : ""}${formatPercent(ratio, locale)}`;
