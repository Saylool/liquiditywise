import type { AddressPositionsResult } from "../lib/advisor/addressPositions";
import type { PositionOutlook } from "../lib/advisor/positionOutlook";
import { type PositionRecord, type PositionRecordResult, type TokenAmounts, valueRecord } from "../lib/advisor/positionRecord";
import { type SmartRange, smartRangeKey } from "../lib/advisor/smartRanges";
import { type RangeAround, rangeAroundInverted, signedPercent } from "../lib/format/rangeAround";
import { getSmartLiquidityCopy } from "../lib/i18n/smartLiquidityCopy";
import { getPositionOutlookCopy } from "../lib/i18n/positionOutlookCopy";
import { getPositionRecordCopy } from "../lib/i18n/positionRecordCopy";
import { poolAnalysisHref, v4PoolAnalysisHref } from "../lib/advisor/requestedParameters";
import {
  formatFeePpm,
  formatPrice,
  formatTokenAmount,
  formatTokenQuantity,
  formatUtcDate,
  formatWhole,
} from "../lib/format/displayFormats";
import { choosePriceQuote, type PriceQuote, quotedInterval } from "../lib/format/priceQuote";
import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import {
  MAX_TICK,
  MIN_TICK,
  type Position,
  type PriceBandParameters,
  V3_MAX_TICK_SPACING,
} from "../schemas";
import { GuardedLink } from "./GuardedLink";
import { chainOf } from "../lib/chains/chains";

/**
 * The positions an address is already in, of either protocol.
 *
 * Everything else on this page is about what the address *could* do. This is
 * what it has done, and it is the only place in the application that describes
 * somebody's own money rather than a pool's — so it says, beside the answer,
 * that the same list is public and that nothing here is stored.
 *
 * Each position is quoted the way the rest of the application quotes a pair: one
 * direction chosen from the price, the dearer token as the base. The direction
 * is picked from where the pool is now when that is known, and from the middle
 * of the position's own band when it is not, so a range never comes out upside
 * down for want of a tick.
 */
const referencePrice = (position: Position): number =>
  Math.sqrt(position.lowerPrice) * Math.sqrt(position.upperPrice);

/**
 * Whether a position covers every price its pool can express.
 *
 * A deliberate and common choice, and one the page was printing as
 * `2.96E-39 – 3.38E38`, which is true and tells a reader nothing.
 *
 * A v4 position carries its pool's tick spacing, so the outermost usable ticks
 * are exact: they are the last multiples of the spacing inside TickMath's
 * limits, and no tick between one of those and the limit exists. A v3 position
 * does not — no subgraph publishes a pool's spacing, and the metadata behind
 * these stops short of it — so there the test is "beyond anything any pool could
 * offer" rather than "exactly the edge".
 */
const coversEveryPrice = (position: Position): boolean => {
  const spacing =
    position.pool.protocolVersion === "v4" ? position.pool.tickSpacing : V3_MAX_TICK_SPACING;

  return position.tickLower <= MIN_TICK + spacing && position.tickUpper >= MAX_TICK - spacing;
};

/**
 * Earning first.
 *
 * The list is capped, and the two protocols are read separately, so an order
 * that simply followed the reads would hide every v4 position behind a long v3
 * list. Whether a position is earning right now is the one thing a holder looks
 * for first, so it is what decides the order, and the sort is stable — within
 * either group nothing is reordered.
 */
const earningFirst = (positions: readonly Position[]): readonly Position[] =>
  [...positions].sort(
    (left, right) => Number(right.inRange === true) - Number(left.inRange === true),
  );

/**
 * How an open v3 position has done since it was opened, at today's price (see
 * advisor/positionRecord.ts).
 *
 * Valued in the token the row already quotes its prices in, so the record and
 * the range above it read in the same units. Laid out as label and value, one
 * under the other on a phone and side by side where there is room — never as
 * a table, because six figures across would not fit a phone's width and
 * whatever did not fit would be clipped without a word.
 *
 * The result is shown with its two parts, fees and the range effect, so a
 * reader can see which one made it; and what it leaves out is said under it
 * every time, not only on the method page.
 */
const RecordFigures = ({
  record,
  quote,
  pool,
  locale,
}: {
  record: PositionRecord;
  quote: PriceQuote;
  pool: Position["pool"];
  locale: Locale;
}) => {
  const copy = getPositionRecordCopy(locale);
  const values = valueRecord(record, quote.inverted ? "token0" : "token1");
  const symbol = quote.quote.symbol;
  const quantity = (value: number) => formatTokenQuantity(value, locale);
  const amounts = ({ token0, token1 }: TokenAmounts) =>
    `${quantity(token0)} ${pool.token0.symbol} + ${quantity(token1)} ${pool.token1.symbol}`;
  const signed = (value: number) => `${value > 0 ? "+" : ""}${quantity(value)} ${symbol}`;
  const rows: readonly (readonly [string, React.ReactNode])[] = [
    [copy.deposited, amounts(record.deposited)],
    [copy.withdrawn, amounts(record.withdrawn)],
    [copy.now, amounts(record.now)],
    [copy.fees, amounts(record.fees)],
    [copy.held, `${quantity(values.held)} ${symbol}`],
    [
      copy.result,
      <>
        {signed(values.result)}
        <span className="block text-muted">{copy.parts(signed(values.fees), signed(values.rangeEffect))}</span>
      </>,
    ],
  ];

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-2 text-xs leading-relaxed">
      <p className="font-medium">{copy.heading(formatUtcDate(record.openedAt), symbol)}</p>
      <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-[max-content_minmax(0,1fr)]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="mt-1 text-muted sm:mt-0">{label}</dt>
            <dd className="min-w-0 break-words font-mono">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-muted">{copy.note}</p>
    </div>
  );
};

/**
 * The record under a position, or the one line that says why there is none:
 * not verified, not read, or — for v4, whose indexers keep no history for a
 * position — not something that can be worked out here at all.
 */
const RecordSection = ({
  position,
  record,
  quote,
  locale,
}: {
  position: Position;
  record: PositionRecordResult | undefined;
  quote: PriceQuote;
  locale: Locale;
}) => {
  const copy = getPositionRecordCopy(locale);
  const line = (text: string) => (
    <p className="border-t border-border pt-2 text-xs leading-relaxed text-muted">{text}</p>
  );

  if (position.pool.protocolVersion === "v4") return line(copy.v4);
  if (record === undefined) return null;
  if (record.status === "unverified") return line(copy.unverified);
  if (record.status === "unread") return line(copy.unread);

  return <RecordFigures record={record.record} quote={quote} pool={position.pool} locale={locale} />;
};

const PositionRow = ({
  position,
  outlook,
  smartRange,
  record,
  recordsAsked,
  parameters,
  t,
  locale,
}: {
  position: Position;
  /** How it has done since it was opened, when it is v3 and its history was asked for. */
  record: PositionRecordResult | undefined;
  /** Whether records were asked for at all; when not, no row says anything about one. */
  recordsAsked: boolean;
  /** How it has fared against its pool's last days, when the pool's history could be read. */
  outlook: PositionOutlook | undefined;
  /** Where the pool's best-earning liquidity sits, when the pool is one that was measured. */
  smartRange: SmartRange | undefined;
  parameters: PriceBandParameters;
  t: Dictionary;
  locale: Locale;
}) => {
  const { pool } = position;
  const quote = choosePriceQuote(pool, referencePrice(position));
  const edges = quotedInterval(quote, { lower: position.lowerPrice, upper: position.upperPrice });
  /* A range in the row's own quote, so the position's and the suggested one read in the same units. */
  const inQuote = (lower: number, upper: number) => {
    const band = quotedInterval(quote, { lower, upper });
    return t.report.rangeValue(formatPrice(band.lower, locale), formatPrice(band.upper, locale), quote.quote.symbol, quote.base.symbol);
  };
  /*
   * The two ranges as distances from the price now, in this row's own quote:
   * the smart one was measured as ratios to the price then, and this
   * position's edges are ticks against the tick now.
   */
  const around = (range: RangeAround) => `${signedPercent(range.below, locale)} … ${signedPercent(range.above, locale)}`;
  const smartLine =
    smartRange === undefined || position.currentTick === null
      ? null
      : getSmartLiquidityCopy(locale).alongside(
          around(rangeAroundInverted(quote.inverted, smartRange.lowerRatio, smartRange.upperRatio)),
          around(
            rangeAroundInverted(
              quote.inverted,
              1.0001 ** (position.tickLower - position.currentTick),
              1.0001 ** (position.tickUpper - position.currentTick),
            ),
          ),
          formatWhole(smartRange.positions, locale),
        );
  const href =
    pool.protocolVersion === "v3"
      ? poolAnalysisHref(pool.id, parameters, undefined, chainOf(pool.chainId))
      : v4PoolAnalysisHref(pool.id, parameters, undefined, chainOf(pool.chainId));
  const fee =
    pool.protocolVersion === "v3"
      ? formatFeePpm(pool.feePpm, locale)
      : pool.fee.kind === "static"
        ? formatFeePpm(pool.fee.feePpm, locale)
        : pool.fee.kind === "dynamic"
          ? t.v4.dynamicFee
          : t.v4.feeUnread;
  const hooked = pool.protocolVersion === "v4" && pool.hookAddress !== null;

  return (
    <li>
      <GuardedLink
        href={href}
        className="flex flex-col gap-2 rounded-md border border-border bg-surface-sunken p-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="font-mono text-base font-medium">
            {pool.token0.symbol} / {pool.token1.symbol}
          </span>
          {/*
           * Whether it is earning at all, which is the one thing a holder wants
           * first. Unread is its own answer: a pool nobody has swapped in
           * reports no tick, and "not earning" and "not known" are different
           * things to say.
           */}
          <span className="text-xs uppercase tracking-widest text-muted">
            {position.inRange === null
              ? t.positions.rangeUnknown
              : position.inRange
                ? t.positions.inRange
                : t.positions.outOfRange}
          </span>
        </div>
        {/*
         * The protocol is on the row because the two are not interchangeable for
         * a holder: a v3 pool wants wrapped ether where a v4 one may take the
         * chain's own, and a v4 pool may carry a hook.
         */}
        <span className="font-mono text-xs text-muted">
          {pool.protocolVersion} · {fee}
          {hooked ? ` · ${t.holdings.hookTag}` : ""}
        </span>
        <p className="font-mono text-sm">
          {coversEveryPrice(position)
            ? t.positions.everyPrice
            : t.report.rangeValue(
                formatPrice(edges.lower, locale),
                formatPrice(edges.upper, locale),
                quote.quote.symbol,
                quote.base.symbol,
              )}
        </p>
        {/*
         * What it has earned and not yet taken out, from the pool's own fee
         * accounting. Three states rather than two: nothing earned and nothing
         * read are different facts, and this is the one panel where a reader
         * might act on the difference.
         */}
        <p className="text-xs leading-relaxed text-muted">
          {position.uncollected === null
            ? t.positions.feesUnread
            : position.uncollected.token0 === "0" && position.uncollected.token1 === "0"
              ? t.positions.feesNone
              : t.positions.feesEarned(
                  formatTokenAmount(position.uncollected.token0, pool.token0.decimals, locale),
                  pool.token0.symbol,
                  formatTokenAmount(position.uncollected.token1, pool.token1.decimals, locale),
                  pool.token1.symbol,
                )}
        </p>
        {/*
         * How it has fared, in the row's own quote so the two ranges read in
         * the same units — counted and drawn by the same code the pool page
         * uses, and said as counts, not as a verdict on the position.
         */}
        {outlook === undefined ? null : (
          <div className="flex flex-col gap-1 border-t border-border pt-2 text-xs leading-relaxed text-muted">
            <p>
              {getPositionOutlookCopy(locale).days(
                formatWhole(outlook.days, locale),
                formatWhole(outlook.inside, locale),
                formatWhole(outlook.outside, locale),
                formatWhole(outlook.crossed, locale),
              )}
            </p>
            {outlook.suggested === null ? null : (
              <p>
                {getPositionOutlookCopy(locale).suggested(inQuote(outlook.suggested.lowerPrice, outlook.suggested.upperPrice))}
              </p>
            )}
          </div>
        )}
        {smartLine === null ? null : <p className="text-xs leading-relaxed text-muted">{smartLine}</p>}
        {recordsAsked ? <RecordSection position={position} record={record} quote={quote} locale={locale} /> : null}
        <p className="text-xs text-accent">{t.positions.analyse}</p>
      </GuardedLink>
    </li>
  );
};

export function AddressPositions({
  result,
  outlooks = new Map(),
  smartRanges = new Map(),
  parameters,
  t,
  locale,
}: {
  result: AddressPositionsResult;
  /** Each open position's outlook, keyed as getPositionOutlooks.ts keys it; none when not read. */
  outlooks?: ReadonlyMap<string, PositionOutlook>;
  /** Where each measured pool's best-earning liquidity sits, keyed as smartRanges.ts keys it; none when not measured. */
  smartRanges?: ReadonlyMap<string, SmartRange>;
  /** Carried into the links out, so a chosen band survives leaving this page. */
  parameters: PriceBandParameters;
  t: Dictionary;
  locale: Locale;
}) {
  if (result.status === "unavailable") {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-card">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
          {t.positions.heading}
        </h2>
        <p className="text-sm leading-relaxed">{t.positions.unavailable}</p>
        <p className="text-sm leading-relaxed text-muted">{t.notices.failure[result.notice]}</p>
      </section>
    );
  }

  const { positions, held, read, open, closed, unread } = result.data;
  const { records } = result;
  const whole = (value: number) => formatWhole(value, locale);
  const shown = earningFirst(positions);

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5 shadow-card">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {t.positions.heading}
      </h2>
      <p className="text-sm leading-relaxed">{t.positions.intro}</p>

      {/*
       * Named rather than skipped. The counts below cover one protocol only when
       * this is here, and an address with v4 positions must not read a v3-only
       * "no positions" as an answer about everything it holds.
       */}
      {unread.map((protocol) => (
        <p key={protocol} className="text-sm leading-relaxed text-muted">
          {t.positions.unreadProtocol(protocol)}
        </p>
      ))}

      {held === 0 ? (
        <p className="text-sm leading-relaxed">{t.positions.none}</p>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-muted">
            {t.positions.counts(whole(held), whole(open), whole(closed))}
          </p>

          {shown.length === 0 ? (
            <p className="text-sm leading-relaxed">{t.positions.noneOpen}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {shown.map((position) => (
                <PositionRow
                  key={`${position.pool.protocolVersion}-${position.tokenId}`}
                  position={position}
                  outlook={outlooks.get(`${position.pool.protocolVersion}-${position.tokenId}`)}
                  smartRange={
                    position.pool.protocolVersion === "v3"
                      ? smartRanges.get(smartRangeKey(position.pool.chainId, position.pool.id))
                      : undefined
                  }
                  record={position.pool.protocolVersion === "v3" ? records?.get(position.tokenId) : undefined}
                  recordsAsked={records !== undefined}
                  parameters={parameters}
                  t={t}
                  locale={locale}
                />
              ))}
            </ul>
          )}

          {open <= shown.length ? null : (
            <p className="text-xs leading-relaxed text-muted">
              {t.positions.moreNotShown(whole(open - shown.length))}
            </p>
          )}
          {read >= held ? null : (
            <p className="text-xs leading-relaxed text-muted">
              {t.positions.readCap(whole(read), whole(held))}
            </p>
          )}
        </>
      )}

      <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted">
        {t.positions.publicNote}
      </p>
    </section>
  );
}
