import type { AddressPositionsResult } from "../lib/advisor/addressPositions";
import { poolAnalysisHref } from "../lib/advisor/requestedParameters";
import { formatFeePpm, formatPrice, formatWhole } from "../lib/format/displayFormats";
import { choosePriceQuote, quotedInterval } from "../lib/format/priceQuote";
import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import {
  MAX_TICK,
  MIN_TICK,
  type PriceBandParameters,
  V3_MAX_TICK_SPACING,
  type V3Position,
} from "../schemas";
import { GuardedLink } from "./GuardedLink";

/**
 * The positions an address is already in.
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
const referencePrice = (position: V3Position): number =>
  Math.sqrt(position.lowerPrice) * Math.sqrt(position.upperPrice);

/**
 * Whether a position covers every price its pool can express.
 *
 * A deliberate and common choice, and one the page was printing as
 * `2.96E-39 – 3.38E38`, which is true and tells a reader nothing. The bounds are
 * compared against TickMath's own limits with the widest spacing a v3 pool may
 * have allowed for, because the exact outermost usable tick depends on the
 * pool's spacing and no subgraph publishes that — so the test is "beyond
 * anything any pool could offer" rather than "exactly the edge".
 */
const coversEveryPrice = (position: V3Position): boolean =>
  position.tickLower <= MIN_TICK + V3_MAX_TICK_SPACING &&
  position.tickUpper >= MAX_TICK - V3_MAX_TICK_SPACING;

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
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
          {t.positions.heading}
        </h2>
        <p className="text-sm leading-relaxed">{t.positions.unavailable}</p>
        <p className="text-sm leading-relaxed text-muted">{t.notices.failure[result.notice]}</p>
      </section>
    );
  }

  const { positions, held, read, open, closed } = result.data;
  const whole = (value: number) => formatWhole(value, locale);

  return (
    <section className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {t.positions.heading}
      </h2>
      <p className="text-sm leading-relaxed">{t.positions.intro}</p>

      {held === 0 ? (
        <p className="text-sm leading-relaxed">{t.positions.none}</p>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-muted">
            {t.positions.counts(whole(held), whole(open), whole(closed))}
          </p>

          {positions.length === 0 ? (
            <p className="text-sm leading-relaxed">{t.positions.noneOpen}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {positions.map((position) => {
                const quote = choosePriceQuote(position.pool, referencePrice(position));
                const edges = quotedInterval(quote, {
                  lower: position.lowerPrice,
                  upper: position.upperPrice,
                });

                return (
                  <li key={position.tokenId}>
                    <GuardedLink
                      href={poolAnalysisHref(position.pool.id, parameters)}
                      className="flex flex-col gap-2 rounded-md border border-border bg-background p-4"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="font-mono text-base font-medium">
                          {position.pool.token0.symbol} / {position.pool.token1.symbol} ·{" "}
                          {formatFeePpm(position.pool.feePpm, locale)}
                        </span>
                        {/*
                         * Whether it is earning at all, which is the one thing a
                         * holder wants first. Unread is its own answer: a pool
                         * nobody has swapped in reports no tick, and "not
                         * earning" and "not known" are different things to say.
                         */}
                        <span className="text-xs uppercase tracking-widest text-muted">
                          {position.inRange === null
                            ? t.positions.rangeUnknown
                            : position.inRange
                              ? t.positions.inRange
                              : t.positions.outOfRange}
                        </span>
                      </div>
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
                      <p className="text-xs text-accent">{t.positions.analyse}</p>
                    </GuardedLink>
                  </li>
                );
              })}
            </ul>
          )}

          {open <= positions.length ? null : (
            <p className="text-xs leading-relaxed text-muted">
              {t.positions.moreNotShown(whole(open - positions.length))}
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
