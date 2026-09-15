import Link from "next/link";

import { poolAnalysisHref } from "../lib/advisor/requestedParameters";
import { formatFeePpm, formatTokenAmount } from "../lib/format/displayFormats";
import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import type { DataResult, PairFeeTier, PairFeeTiers, PriceBandParameters } from "../schemas";

/**
 * Where else this pair trades.
 *
 * Presentational only. The panel exists because a pair is not one market: v3
 * deploys a pool per fee tier, and someone who arrived by pasting an address has
 * no way to know the others are there. Three things about it are deliberate:
 *
 *   - **It is ordered by fee, not by liquidity.** Ordering by dollars would make
 *     the list a ranking, and the figure it ranked by is the source's own.
 *   - **It answers "which one" with a link, not a verdict.** Choosing between
 *     tiers needs the tick-level liquidity distribution this application does not
 *     read. What it can do is run the same analysis again, one click away.
 *   - **The chosen band travels with every link.** Landing on the next tier at a
 *     different horizon would make two incomparable readings look comparable.
 *
 * Token addresses are not repeated here, unlike the search list: every row is
 * the same pair, shown in full above, so an address per row would be noise
 * rather than the thing that tells two lookalikes apart.
 */

const TierRow = ({
  tier,
  current,
  parameters,
  t,
  locale,
}: {
  tier: PairFeeTier;
  current: boolean;
  parameters: PriceBandParameters;
  t: Dictionary;
  locale: Locale;
}) => {
  const body = (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-mono text-base font-medium">
          {formatFeePpm(tier.pool.feePpm, locale)}
        </span>
        {current ? (
          <span className="text-xs uppercase tracking-widest text-muted">{t.feeTiers.thisOne}</span>
        ) : (
          <span className="text-xs text-accent">{t.feeTiers.open}</span>
        )}
      </div>
      {/*
       * Two token amounts rather than one dollar figure. Every tier of a pair
       * holds the same two tokens, so nothing has to be priced to compare them
       * — and the priced figure the indexer publishes is wrong by up to an
       * order of magnitude, which is why it is not here.
       */}
      <p className="text-xs text-muted">
        {tier.reserves === null ? (
          t.feeTiers.reservesUnread
        ) : (
          <>
            {t.feeTiers.holds}{" "}
            <span className="font-mono">
              {formatTokenAmount(tier.reserves.token0, tier.pool.token0.decimals, locale)}{" "}
              {tier.pool.token0.symbol}
              {" + "}
              {formatTokenAmount(tier.reserves.token1, tier.pool.token1.decimals, locale)}{" "}
              {tier.pool.token1.symbol}
            </span>
          </>
        )}
      </p>
    </>
  );

  /*
   * The pool being read is a row, not a link. It is what tells the reader where
   * they already are, and a link back to the page they are on is a dead end
   * dressed as a choice.
   */
  return (
    <li>
      {current ? (
        <div className="flex flex-col gap-2 rounded-md border border-accent bg-background p-4">
          {body}
        </div>
      ) : (
        <Link
          href={poolAnalysisHref(tier.pool.id, parameters)}
          className="flex flex-col gap-2 rounded-md border border-border bg-background p-4"
        >
          {body}
        </Link>
      )}
    </li>
  );
};

export function PoolFeeTiers({
  result,
  pair,
  parameters,
  t,
  locale,
}: {
  result: DataResult<PairFeeTiers>;
  /** The pair as the report above names it, so the two agree. */
  pair: string;
  /** The band in effect, carried into every link out of here. */
  parameters: PriceBandParameters;
  t: Dictionary;
  locale: Locale;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {t.feeTiers.heading}
      </h2>

      {result.status === "unavailable" ? (
        <>
          {/*
           * Said rather than left blank. An empty space here would read as "this
           * pair trades nowhere else", which is a different claim entirely.
           */}
          <p className="text-sm leading-relaxed">{t.feeTiers.unavailableHeading}</p>
          <p className="text-sm leading-relaxed text-muted">{t.notices.failure[result.notice]}</p>
        </>
      ) : result.data.tiers.length === 1 ? (
        <p className="text-sm leading-relaxed text-muted">{t.feeTiers.onlyOne(pair)}</p>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-muted">{t.feeTiers.intro(pair)}</p>

          <ul className="flex flex-col gap-3">
            {result.data.tiers.map((tier) => (
              <TierRow
                key={tier.pool.id}
                tier={tier}
                current={tier.pool.id === result.data.analysedPoolId}
                parameters={parameters}
                t={t}
                locale={locale}
              />
            ))}
          </ul>

          <div className="flex flex-col gap-3 border-t border-border pt-3 text-xs leading-relaxed text-muted">
            <p>{t.feeTiers.biggerIsNotBetter}</p>
            <p>{t.feeTiers.reservesNote}</p>
          </div>
        </>
      )}
    </section>
  );
}

/**
 * The panel's shape while the read is still in flight.
 *
 * The heading is already the truth — the question is asked whether or not the
 * answer has arrived — so only the rows are a placeholder.
 */
export function PoolFeeTiersPending({ t }: { t: Dictionary }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {t.feeTiers.heading}
      </h2>
      <div className="h-16 animate-pulse rounded-md border border-border" aria-hidden="true" />
    </section>
  );
}
