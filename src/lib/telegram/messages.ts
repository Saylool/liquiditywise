import type { Position } from "../../schemas";
import { formatPrice } from "../format/displayFormats";
import { choosePriceQuote, quotedInterval, quotedPrice } from "../format/priceQuote";
import type { Dictionary } from "../i18n/dictionaries";
import type { Locale } from "../i18n/locales";
import type { PositionChange } from "./positionChanges";
import { chainOf } from "../chains/chains";

/*
 * The text of one alert, in the reader's language.
 *
 * A position is named the way the page names it — the pair, the protocol, and
 * the range quoted with the dearer token as the base — so a message and the
 * panel it points back to read the same. Every alert ends with the same line
 * the site carries: this is information, not advice.
 */

/**
 * "Uniswap v3", and off mainnet the chain after it — "Uniswap v3 · Base" — so
 * an alert about a Base position cannot be read as one about a mainnet pool
 * of the same pair.
 */
const protocolOn = (protocolVersion: string, chainId: number): string =>
  chainId === 1 ? `Uniswap ${protocolVersion}` : `Uniswap ${protocolVersion} · ${chainOf(chainId).name}`;

const describe = (position: Position, locale: Locale): { pair: string; protocol: string; range: string } => {
  const { pool } = position;
  const quote = choosePriceQuote(pool, Math.sqrt(position.lowerPrice) * Math.sqrt(position.upperPrice));
  const edges = quotedInterval(quote, { lower: position.lowerPrice, upper: position.upperPrice });

  return {
    pair: `${pool.token0.symbol}/${pool.token1.symbol}`,
    protocol: protocolOn(pool.protocolVersion, pool.chainId),
    range: `${formatPrice(edges.lower, locale)} – ${formatPrice(edges.upper, locale)} ${quote.quote.symbol}/${quote.base.symbol}`,
  };
};

/**
 * Where the price is now, and the edge it is close to, both as the page quotes
 * them. The current price follows from the ticks: each is a factor of 1.0001,
 * counted from the lower edge whose price is already known.
 */
const nearingPrices = (position: Position, edge: "lower" | "upper", locale: Locale): { price: string; edge: string } => {
  const { pool } = position;
  const quote = choosePriceQuote(pool, Math.sqrt(position.lowerPrice) * Math.sqrt(position.upperPrice));
  const current = position.lowerPrice * 1.0001 ** ((position.currentTick ?? position.tickLower) - position.tickLower);
  const edgePrice = edge === "lower" ? position.lowerPrice : position.upperPrice;

  return {
    price: formatPrice(quotedPrice(quote, current), locale),
    edge: formatPrice(quotedPrice(quote, edgePrice), locale),
  };
};

export const alertText = (change: PositionChange, t: Dictionary, locale: Locale, chainId: number = 1): string => {
  const body = (() => {
    switch (change.kind) {
      case "left": {
        const { pair, protocol, range } = describe(change.position, locale);
        return t.telegram.left(pair, protocol, range);
      }
      case "nearing": {
        const { pair, protocol, range } = describe(change.position, locale);
        const { price, edge } = nearingPrices(change.position, change.edge, locale);
        return t.telegram.nearing(pair, protocol, range, price, edge);
      }
      case "entered": {
        const { pair, protocol, range } = describe(change.position, locale);
        return t.telegram.entered(pair, protocol, range);
      }
      case "opened": {
        const { pair, protocol, range } = describe(change.position, locale);
        return t.telegram.opened(pair, protocol, range);
      }
      case "closed": {
        const [protocol, tokenId] = change.key.split(":");
        /* A closed position is gone from the read, so its chain comes from the link that followed it. */
        return t.telegram.closed(protocolOn(protocol ?? "", chainId), tokenId ?? "");
      }
    }
  })();

  return `${body}\n\n${t.telegram.footer}`;
};
