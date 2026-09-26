import type { AddressPositionsResult } from "../lib/advisor/addressPositions";
import { poolAnalysisHref, v4PoolAnalysisHref } from "../lib/advisor/requestedParameters";
import {
  formatFeePpm,
  formatPrice,
  formatTokenAmount,
  formatWhole,
} from "../lib/format/displayFormats";
import { choosePriceQuote, quotedInterval } from "../lib/format/priceQuote";
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

const PositionRow = ({
  position,
  parameters,
  t,
  locale,
}: {
  position: Position;
  parameters: PriceBandParameters;
  t: Dictionary;
  locale: Locale;
}) => {
  const { pool } = position;
  const quote = choosePriceQuote(pool, referencePrice(position));
  const edges = quotedInterval(quote, { lower: position.lowerPrice, upper: position.upperPrice });
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
        <p className="text-xs text-accent">{t.positions.analyse}</p>
      </GuardedLink>
    </li>
  );
};

export function AddressPositions({
  result,
  parameters,
  t,
  locale,
}: {
  result: AddressPositionsResult;
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
