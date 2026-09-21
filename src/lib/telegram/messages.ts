import type { Position } from "../../schemas";
import { formatPrice } from "../format/displayFormats";
import { choosePriceQuote, quotedInterval } from "../format/priceQuote";
import type { Dictionary } from "../i18n/dictionaries";
import type { Locale } from "../i18n/locales";
import type { PositionChange } from "./positionChanges";

/*
 * The text of one alert, in the reader's language.
 *
 * A position is named the way the page names it — the pair, the protocol, and
 * the range quoted with the dearer token as the base — so a message and the
 * panel it points back to read the same. Every alert ends with the same line
 * the site carries: this is information, not advice.
 */

const describe = (position: Position, locale: Locale): { pair: string; protocol: string; range: string } => {
  const { pool } = position;
  const quote = choosePriceQuote(pool, Math.sqrt(position.lowerPrice) * Math.sqrt(position.upperPrice));
  const edges = quotedInterval(quote, { lower: position.lowerPrice, upper: position.upperPrice });

  return {
    pair: `${pool.token0.symbol}/${pool.token1.symbol}`,
    protocol: `Uniswap ${pool.protocolVersion}`,
    range: `${formatPrice(edges.lower, locale)} – ${formatPrice(edges.upper, locale)} ${quote.quote.symbol}/${quote.base.symbol}`,
  };
};

export const alertText = (change: PositionChange, t: Dictionary, locale: Locale): string => {
  const body = (() => {
    switch (change.kind) {
      case "left": {
        const { pair, protocol, range } = describe(change.position, locale);
        return t.telegram.left(pair, protocol, range);
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
        return t.telegram.closed(`Uniswap ${protocol ?? ""}`.trim(), tokenId ?? "");
      }
    }
  })();

  return `${body}\n\n${t.telegram.footer}`;
};
