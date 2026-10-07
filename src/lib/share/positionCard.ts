import type { Position } from "../../schemas";
import type { DescribedV3Position } from "../advisor/addressPositions";
import { coversEveryPrice, positionQuote } from "../advisor/positionQuote";
import { type PositionRecord, type TokenAmounts, valueRecord } from "../advisor/positionRecord";
import { chainLabel } from "../chains/chainLabel";
import { formatFeePpm, formatPrice, formatTokenQuantity, formatUtcDate } from "../format/displayFormats";
import { quotedInterval } from "../format/priceQuote";
import { getDictionary } from "../i18n/dictionaries";
import type { Locale } from "../i18n/locales";
import { getPositionRecordCopy } from "../i18n/positionRecordCopy";
import { getPositionShareCopy } from "../i18n/positionShareCopy";

/*
 * What a shared position's card says, and what the post beside it says: the
 * pair with its fee tier and network, the position's range, the fees it has
 * earned over its whole life, and the result against simply holding with its
 * two parts — each figure written as the holdings page writes it, in the
 * token that page quotes the pool in, so the card and the row it was offered
 * on say the same thing.
 *
 * A figure is on the card only when the record is verified against the chain
 * (advisor/positionRecord.ts). A record that is not — a history that does not
 * reach the present, or one that could not be read — gives a plain card that
 * says so and shows nothing else: never a partial figure, and never a figure
 * from a source the chain did not confirm.
 *
 * Pure: no clock, no network, no environment. The route draws from this and
 * the share row links to it; neither writes a figure of its own.
 */

/** The record's figures as the page and the card write them, in the quote the page chose. */
export type RecordFigures = {
  /** "USDC / WETH" */
  readonly pair: string;
  /** "v3 · 0.05% · Ethereum mainnet" */
  readonly detail: string;
  /** The position's range, in the row's quote, or the words for every price. */
  readonly range: string;
  /** "3 XOR + 1 WETH" */
  readonly fees: string;
  /** The same fees valued in the quote and signed, as the result's first part: "+5 XOR". */
  readonly feesValued: string;
  /** The result against holding, signed, in the quote: "-3 XOR". */
  readonly result: string;
  /** Its two parts, in the record's own words: "fees +5 XOR, range effect -8 XOR". */
  readonly parts: string;
  /** The day the position was opened, as the page writes it. */
  readonly openedOn: string;
};

const pairOf = (position: Position): string => `${position.pool.token0.symbol} / ${position.pool.token1.symbol}`;

const detailOf = (position: Position, locale: Locale): string => {
  const { pool } = position;
  const fee =
    pool.protocolVersion === "v3"
      ? formatFeePpm(pool.feePpm, locale)
      : pool.fee.kind === "static"
        ? formatFeePpm(pool.fee.feePpm, locale)
        : null;

  return [pool.protocolVersion, fee, chainLabel(pool.chainId, locale)].filter((part) => part !== null).join(" · ");
};

/** The position's range as its row writes it: in the row's own quote, or the words for every price. */
const rangeOf = (position: Position, locale: Locale): string => {
  const t = getDictionary(locale);
  if (coversEveryPrice(position)) return t.positions.everyPrice;

  const quote = positionQuote(position);
  const edges = quotedInterval(quote, { lower: position.lowerPrice, upper: position.upperPrice });
  return t.report.rangeValue(formatPrice(edges.lower, locale), formatPrice(edges.upper, locale), quote.quote.symbol, quote.base.symbol);
};

/**
 * Every figure a verified record puts on the card and in the post, written
 * exactly as the holdings page writes them (components/AddressPositions.tsx):
 * the same quote, the same formatter, the same signs.
 */
export const recordFigures = (position: Position, record: PositionRecord, locale: Locale): RecordFigures => {
  const quote = positionQuote(position);
  const values = valueRecord(record, quote.inverted ? "token0" : "token1");
  const symbol = quote.quote.symbol;
  const quantity = (value: number) => formatTokenQuantity(value, locale);
  const amounts = ({ token0, token1 }: TokenAmounts) =>
    `${quantity(token0)} ${position.pool.token0.symbol} + ${quantity(token1)} ${position.pool.token1.symbol}`;
  const signed = (value: number) => `${value > 0 ? "+" : ""}${quantity(value)} ${symbol}`;

  return {
    pair: pairOf(position),
    detail: detailOf(position, locale),
    range: rangeOf(position, locale),
    fees: amounts(record.fees),
    feesValued: signed(values.fees),
    result: signed(values.result),
    parts: getPositionRecordCopy(locale).parts(signed(values.fees), signed(values.rangeEffect)),
    openedOn: formatUtcDate(record.openedAt),
  };
};

export type PositionCardText =
  | {
      readonly kind: "record";
      readonly title: string;
      readonly figures: RecordFigures;
      /** "since 2024-05-01" */
      readonly since: string;
      readonly labels: { readonly range: string; readonly fees: string; readonly against: string };
      readonly footer: string;
    }
  | {
      readonly kind: "unverified";
      readonly title: string;
      readonly pair: string;
      readonly detail: string;
      readonly message: string;
      readonly footer: string;
    };

/** What the card says for one position, in one language: its figures, or that it has none to show. */
export const positionCardText = ({ position, record }: DescribedV3Position, locale: Locale): PositionCardText => {
  const copy = getPositionShareCopy(locale);
  if (record.status !== "verified") {
    return {
      kind: "unverified",
      title: copy.card.title,
      pair: pairOf(position),
      detail: detailOf(position, locale),
      message: copy.card.unverified,
      footer: copy.card.footer,
    };
  }

  const figures = recordFigures(position, record.record, locale);
  return {
    kind: "record",
    title: copy.card.title,
    figures,
    since: copy.card.since(figures.openedOn),
    labels: { range: copy.card.range, fees: getPositionRecordCopy(locale).fees, against: copy.card.against },
    footer: copy.card.footer,
  };
};

/** The post the share row prewrites, from the same figures the card shows. */
export const positionPostText = (position: Position, record: PositionRecord, locale: Locale): string => {
  const figures = recordFigures(position, record, locale);
  return getPositionShareCopy(locale).text(figures.pair, figures.result, figures.feesValued, figures.openedOn);
};
