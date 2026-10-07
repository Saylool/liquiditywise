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
import type { PoolRangeReading, PriceRange } from "./poolRangeShift";
import type { PoolWatch } from "./poolWatches";
import { poolWatchWords } from "./poolWatchCommand";
import type { SmartShift } from "./smartShift";
import type { RangeMove, WeeklyDigest } from "./weeklyDigest";
import { chainOf } from "../chains/chains";
import { DEFAULT_PRICE_BAND_PARAMETERS } from "../advisor/poolRangeAnalysis";

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

/** A kept pair as the smart-money page names it: "USDC / WETH · 0.05%". Shared with the /weekly page, which names them the same way. */
export const keptPair = (pair: string, feePpm: number, locale: Locale): string => `${pair} · ${formatFeePpm(feePpm, locale)}`;

/**
 * A kept range, then and now, as prices quoted the way the pair is at its
 * price now — both ends the same way round, so the two can be compared. The
 * kept series has the pair's symbols ("USDC / WETH", token0 first) and not its
 * tokens; where they cannot be told apart, the prices go without a unit
 * rather than with a wrong one. The /weekly page writes its ranges through
 * this too, so a range reads the same on the page as in the message.
 */
export const keptRanges = (range: RangeMove, locale: Locale): { readonly then: string; readonly now: string } => {
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

/** A list in the digest: its heading, and one line per pair, without the bullet the message puts in front. */
export type DigestSection = { readonly heading: string; readonly items: readonly string[] };

/**
 * The Monday digest in its parts: the heading with the chain and the days,
 * the lists with something in them — gaining, losing, the ranges that moved,
 * each as prices then and now — the note that it is a measurement, the link
 * to the page it all comes from, and the footer. The message joins them
 * (`weeklyDigestText`); the e-mail lays them out (email/digestEmail.ts). One
 * composition, so the two cannot drift apart on a word.
 */
export const weeklyDigestParts = (
  digest: WeeklyDigest,
  t: Dictionary,
  locale: Locale,
  chainId: number,
): {
  readonly heading: string;
  readonly sections: readonly DigestSection[];
  readonly note: string;
  readonly link: string;
  readonly footer: string;
} => {
  const movers = (heading: string, list: readonly Mover[]): DigestSection[] =>
    list.length === 0
      ? []
      : [
          {
            heading,
            items: list.map(({ pair, feePpm, from, to }) =>
              t.telegram.weeklyMover(keptPair(pair, feePpm, locale), formatPercent(from, locale), formatPercent(to, locale)),
            ),
          },
        ];
  const ranges: DigestSection[] =
    digest.ranges.length === 0
      ? []
      : [
          {
            heading: t.telegram.weeklyRanges,
            items: digest.ranges.map((range) => {
              const { then, now } = keptRanges(range, locale);
              return t.telegram.weeklyRange(keptPair(range.pair, range.feePpm, locale), then, now);
            }),
          },
        ];

  return {
    heading: t.telegram.weeklyHeading(chainOf(chainId).name, formatWhole(Math.round(digest.days), locale)),
    sections: [...movers(t.telegram.weeklyGaining, digest.gaining), ...movers(t.telegram.weeklyLosing, digest.losing), ...ranges],
    note: t.telegram.weeklyNote,
    link: t.telegram.weeklyLink(smartMoneyUrl(locale, chainId)),
    footer: t.telegram.footer,
  };
};

/**
 * The Monday digest: the pairs gaining and losing a share of the smart money
 * over the week, the pairs whose smart range moved — each as prices then and
 * now — and the page it all comes from. Says, as the smart-money alert does,
 * that it is a measurement and not a suggestion, and ends with the footer.
 */
export const weeklyDigestText = (digest: WeeklyDigest, t: Dictionary, locale: Locale, chainId: number): string => {
  const parts = weeklyDigestParts(digest, t, locale, chainId);

  return [
    parts.heading,
    ...parts.sections.map(({ heading, items }) => [heading, ...items.map((item) => `• ${item}`)].join("\n")),
    `${parts.note}\n${parts.link}`,
    parts.footer,
  ].join("\n\n");
};

/*
 * A watched pool, named the way the position alerts name one: the pair, the
 * protocol with its chain, and the fee — "0.05%", or the v4 page's words for
 * a pool whose hook sets one per swap (v4.dynamicFee). Its ranges and price are written
 * in the direction the pool page shows them, chosen from the price now, so
 * the range told and the range it moved to are both the same way round and
 * read beside the page.
 */
const poolQuote = (reading: PoolRangeReading): { readonly inverted: boolean; readonly unit: string } => {
  const inverted = isInverted(reading.currentPrice);
  return { inverted, unit: inverted ? `${reading.pair.token0}/${reading.pair.token1}` : `${reading.pair.token1}/${reading.pair.token0}` };
};

const poolRangeText = (reading: PoolRangeReading, range: PriceRange, locale: Locale): string => {
  const quote = poolQuote(reading);
  const quoted = quotedInterval(quote, { lower: range[0], upper: range[1] });
  return `${formatPrice(quoted.lower, locale)} – ${formatPrice(quoted.upper, locale)} ${quote.unit}`;
};

const poolPriceText = (reading: PoolRangeReading, locale: Locale): string =>
  formatPrice(poolQuote(reading).inverted ? 1 / reading.currentPrice : reading.currentPrice, locale);

const poolName = (reading: PoolRangeReading, t: Dictionary, locale: Locale): { pair: string; protocol: string; fee: string } => ({
  pair: `${reading.pair.token0}/${reading.pair.token1}`,
  protocol: protocolOn(reading.protocol, reading.chainId),
  fee: reading.lpFeePpm === null ? t.v4.dynamicFee : formatFeePpm(reading.lpFeePpm, locale),
});

/**
 * The answer to `/watch`: the pool as read, the suggested range now for the
 * default horizon and width, the price, the rule for when the chat will hear
 * again, what is kept for it, and the footer.
 */
export const poolWatchedText = (reading: PoolRangeReading, t: Dictionary, locale: Locale): string => {
  const { pair, protocol, fee } = poolName(reading, t, locale);
  const { horizonDays, standardDeviationMultiplier } = DEFAULT_PRICE_BAND_PARAMETERS;

  return [
    t.telegram.watching(pair, protocol, fee),
    t.telegram.watchRange(
      poolRangeText(reading, reading.range, locale),
      poolPriceText(reading, locale),
      formatWhole(horizonDays, locale),
      formatWhole(standardDeviationMultiplier, locale),
    ),
    `${t.telegram.watchRule}\n${t.telegram.watchKept}`,
    t.telegram.footer,
  ].join("\n\n");
};

/**
 * The alert that a watched pool's suggested range has moved: the pool, the
 * range the chat was last told and the one drawn now — in that order, with
 * the arrow between them, as the digest writes a range then → now — the
 * price, the note that it is a measurement, and the footer.
 */
export const poolRangeMovedText = (reading: PoolRangeReading, told: PriceRange, t: Dictionary, locale: Locale): string => {
  const { pair, protocol, fee } = poolName(reading, t, locale);

  return [
    t.telegram.watchMoved(pair, protocol, fee, poolRangeText(reading, told, locale), poolRangeText(reading, reading.range, locale), poolPriceText(reading, locale)),
    t.telegram.watchNote,
    t.telegram.footer,
  ].join("\n\n");
};

/**
 * The answer to `/watches`: one line per watched pool — named from a fresh
 * read where one could be made, and by the words `/unwatch` takes where it
 * could not — with the range it was last told, and the words to stop each.
 */
export const poolWatchesText = (
  watches: readonly { readonly watch: PoolWatch; readonly reading: PoolRangeReading | null }[],
  t: Dictionary,
  locale: Locale,
): string => {
  if (watches.length === 0) return t.telegram.watchesNone;

  const lines = watches.map(({ watch, reading }) => {
    const words = poolWatchWords(watch, chainOf(watch.chainId));
    if (reading === null) return `• ${protocolOn(watch.protocol, watch.chainId)} ${watch.poolId}\n  /unwatch ${words}`;
    const { pair, protocol, fee } = poolName(reading, t, locale);
    const told = poolRangeText(reading, [watch.told.lower, watch.told.upper], locale);
    return `• ${t.telegram.watchesItem(pair, protocol, fee, told)}\n  /unwatch ${words}`;
  });

  return [t.telegram.watchesHeading(formatWhole(watches.length, locale)), lines.join("\n"), t.telegram.footer].join("\n\n");
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
