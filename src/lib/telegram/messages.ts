import type { Position } from "../../schemas";
import type { Mover } from "../analytics/smartHistory";
import { formatFeePpm, formatPercent, formatPrice, formatTokenQuantity, formatWhole } from "../format/displayFormats";
import { choosePriceQuote, isInverted, quotedInterval, quotedPrice } from "../format/priceQuote";
import type { Dictionary } from "../i18n/dictionaries";
import type { Locale } from "../i18n/locales";
import { localePath } from "../i18n/localePath";
import { SITE_URL } from "../site/indexing";
import { type LeftRangeLines, NO_LINES, type RecentreCost } from "./leftRange";
import type { PositionChange } from "./positionChanges";
import type { SmartShift } from "./smartShift";
import type { RangeMove, WeeklyDigest } from "./weeklyDigest";
import { chainOf } from "../chains/chains";

/*
 * The text of one alert, in the reader's language.
 *
 * A position is named the way the page names it — the pair, the protocol, and
 * the range quoted with the dearer token as the base — so a message and the
 * panel it points back to read the same. Every alert ends with the same line
 * the site carries: this is information, not advice.
 *
 * An alert that a position has left its range can carry two lines more (see
 * leftRange.ts): what the pool's liquidity in range was paid over the last
 * seven days, and what re-centring the position would cost in swap fees. They
 * sit between what happened and the footer, each one only where it could be
 * made, and on no other kind of alert.
 */

/**
 * "Uniswap v3", and off mainnet the chain after it — "Uniswap v3 · Base" — so
 * an alert about a Base position cannot be read as one about a mainnet pool
 * of the same pair.
 */
const protocolOn = (protocolVersion: string, chainId: number): string =>
  chainId === 1 ? `Uniswap ${protocolVersion}` : `Uniswap ${protocolVersion} · ${chainOf(chainId).name}`;

/** The way the page quotes a position's pool: the dearer token as the base, judged at the range's centre. */
const positionQuote = (position: Position) =>
  choosePriceQuote(position.pool, Math.sqrt(position.lowerPrice) * Math.sqrt(position.upperPrice));

/** Two edges in the pool's own direction, written as a range the way the position's quote writes it. */
const quotedRange = (position: Position, lower: number, upper: number, locale: Locale): string => {
  const quote = positionQuote(position);
  const edges = quotedInterval(quote, { lower, upper });

  return `${formatPrice(edges.lower, locale)} – ${formatPrice(edges.upper, locale)} ${quote.quote.symbol}/${quote.base.symbol}`;
};

const describe = (position: Position, locale: Locale): { pair: string; protocol: string; range: string } => {
  const { pool } = position;

  return {
    pair: `${pool.token0.symbol}/${pool.token1.symbol}`,
    protocol: protocolOn(pool.protocolVersion, pool.chainId),
    range: quotedRange(position, position.lowerPrice, position.upperPrice, locale),
  };
};

/**
 * The re-centre's line: the range it would sit in, quoted the way the range it
 * left is so the two read side by side, the swap and its fee in the token sold,
 * and the qualifier where a hook may change what a swap costs.
 */
const recentreLine = (position: Position, cost: RecentreCost, t: Dictionary, locale: Locale): string => {
  const { symbol } = cost.sold === "token0" ? position.pool.token0 : position.pool.token1;
  const line = t.telegram.leftRecentre(
    quotedRange(position, cost.lowerPrice, cost.upperPrice, locale),
    `${formatTokenQuantity(cost.amountIn, locale)} ${symbol}`,
    formatFeePpm(cost.feePpm, locale),
    `${formatTokenQuantity(cost.fee, locale)} ${symbol}`,
  );

  return cost.hookMayAlterSwaps ? `${line} ${t.telegram.leftRecentreHook}` : line;
};

/** The lines a left-range alert carries beyond what happened, in their order; none that could not be made. */
const leftRangeText = (position: Position, lines: LeftRangeLines, t: Dictionary, locale: Locale): readonly string[] => [
  ...(lines.feeYield === null ? [] : [t.telegram.leftFeeYield(formatPercent(lines.feeYield, locale))]),
  ...(lines.recentre === null ? [] : [recentreLine(position, lines.recentre, t, locale)]),
];

/**
 * Where the price is now, and the edge it is close to, both as the page quotes
 * them. The current price follows from the ticks: each is a factor of 1.0001,
 * counted from the lower edge whose price is already known.
 */
const nearingPrices = (position: Position, edge: "lower" | "upper", locale: Locale): { price: string; edge: string } => {
  const quote = positionQuote(position);
  const current = position.lowerPrice * 1.0001 ** ((position.currentTick ?? position.tickLower) - position.tickLower);
  const edgePrice = edge === "lower" ? position.lowerPrice : position.upperPrice;

  return {
    price: formatPrice(quotedPrice(quote, current), locale),
    edge: formatPrice(quotedPrice(quote, edgePrice), locale),
  };
};

/**
 * The alert for a pool whose best-earning liquidity has moved: where it sat and
 * where it sits, as prices in the pair's own quote, like every other range
 * here. Says whose measurement it is — the chain's — and that it is not advice
 * for the reader's own position.
 */
export const smartShiftText = (shift: SmartShift, t: Dictionary, locale: Locale, chainId: number = 1): string => {
  const { pool } = shift.pair;
  const quote = choosePriceQuote(pool, shift.pair.currentPrice);
  const range = (edges: readonly [number, number]): string => {
    const quoted = quotedInterval(quote, { lower: edges[0], upper: edges[1] });
    return `${formatPrice(quoted.lower, locale)} – ${formatPrice(quoted.upper, locale)} ${quote.quote.symbol}/${quote.base.symbol}`;
  };

  return `${t.telegram.smartShift(`${pool.token0.symbol}/${pool.token1.symbol}`, protocolOn(pool.protocolVersion, chainId), range(shift.then), range(shift.now))}\n\n${t.telegram.footer}`;
};

/** A kept pair as the smart-money page names it: "USDC / WETH · 0.05%". */
const keptPair = (pair: string, feePpm: number, locale: Locale): string => `${pair} · ${formatFeePpm(feePpm, locale)}`;

/**
 * A kept range, then and now, as prices quoted the way the pair is at its
 * price now — both ends the same way round, so the two can be compared. The
 * kept series has the pair's symbols ("USDC / WETH", token0 first) and not its
 * tokens; where they cannot be told apart, the prices go without a unit
 * rather than with a wrong one.
 */
const keptRanges = (range: RangeMove, locale: Locale): { readonly then: string; readonly now: string } => {
  const quote = { inverted: isInverted(range.currentPrice) };
  const symbols = range.pair.split(" / ");
  const [token0, token1] = symbols;
  const unit =
    symbols.length === 2 && token0 !== undefined && token1 !== undefined
      ? ` ${quote.inverted ? token0 : token1}/${quote.inverted ? token1 : token0}`
      : "";
  const text = (edges: readonly [number, number]): string => {
    const quoted = quotedInterval(quote, { lower: edges[0], upper: edges[1] });
    return `${formatPrice(quoted.lower, locale)} – ${formatPrice(quoted.upper, locale)}${unit}`;
  };
  return { then: text(range.then), now: text(range.now) };
};

/** The page the digest is a summary of, in the reader's language and on the digest's chain. */
export const smartMoneyUrl = (locale: Locale, chainId: number): string =>
  `${SITE_URL}${localePath(locale, "/smart-money")}?chain=${chainOf(chainId).slug}`;

/**
 * The Monday digest: the pairs gaining and losing a share of the smart money
 * over the week, the pairs whose smart range moved — each as prices then and
 * now — and the page it all comes from. Says, as the smart-money alert does,
 * that it is a measurement and not a suggestion, and ends with the footer.
 */
export const weeklyDigestText = (digest: WeeklyDigest, t: Dictionary, locale: Locale, chainId: number): string => {
  const movers = (heading: string, list: readonly Mover[]): string[] =>
    list.length === 0
      ? []
      : [
          [
            heading,
            ...list.map(({ pair, feePpm, from, to }) =>
              `• ${t.telegram.weeklyMover(keptPair(pair, feePpm, locale), formatPercent(from, locale), formatPercent(to, locale))}`,
            ),
          ].join("\n"),
        ];
  const ranges =
    digest.ranges.length === 0
      ? []
      : [
          [
            t.telegram.weeklyRanges,
            ...digest.ranges.map((range) => {
              const { then, now } = keptRanges(range, locale);
              return `• ${t.telegram.weeklyRange(keptPair(range.pair, range.feePpm, locale), then, now)}`;
            }),
          ].join("\n"),
        ];

  return [
    t.telegram.weeklyHeading(chainOf(chainId).name, formatWhole(Math.round(digest.days), locale)),
    ...movers(t.telegram.weeklyGaining, digest.gaining),
    ...movers(t.telegram.weeklyLosing, digest.losing),
    ...ranges,
    `${t.telegram.weeklyNote}\n${t.telegram.weeklyLink(smartMoneyUrl(locale, chainId))}`,
    t.telegram.footer,
  ].join("\n\n");
};

/**
 * One alert's text. `lines` are a left-range alert's two additions, and are
 * read for that kind alone: whatever is handed in with any other change, it
 * goes out as it always has.
 */
export const alertText = (
  change: PositionChange,
  t: Dictionary,
  locale: Locale,
  chainId: number = 1,
  lines: LeftRangeLines = NO_LINES,
): string => {
  const body = (() => {
    switch (change.kind) {
      case "left": {
        const { pair, protocol, range } = describe(change.position, locale);
        return [t.telegram.left(pair, protocol, range), ...leftRangeText(change.position, lines, t, locale)].join("\n\n");
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
