
import { GuardedLink } from "./GuardedLink";
import { formatFeePpm, formatTokenAmount } from "../lib/format/displayFormats";
import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import type { DataResult, PoolSearchMatch, PoolSearchResults as SearchResults } from "../schemas";

/**
 * The pools one search matched.
 *
 * Presentational only. Three things about it are deliberate, and all three are
 * there because this is the one page that puts a pool in front of someone who
 * did not go looking for it:
 *
 *   - **Every token's contract address is shown, in full.** A symbol is whatever
 *     its contract says, and deploying a token that calls itself USDC costs
 *     nothing — the live source returns several. A truncated address is exactly
 *     what a lookalike hides behind, so these are not truncated.
 *   - **The ordering explains itself.** A list's order is a claim about what
 *     matters, and a reader cannot check a claim nobody made out loud.
 *   - **Nothing is marked as trustworthy.** No badge, no tick, no "official".
 *     This application cannot tell which USDC is the real one, and a mark that
 *     implied otherwise would be worse than no mark at all.
 */

const PairRow = ({ match, t, locale }: { match: PoolSearchMatch; t: Dictionary; locale: Locale }) => {
  const { pool, reserves } = match;

  return (
    <li>
      <GuardedLink
        href={`/pool?address=${pool.id}`}
        className="flex flex-col gap-2 rounded-md border border-border bg-surface-sunken p-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-base font-medium">
            {pool.token0.symbol} / {pool.token1.symbol}
          </span>
          <span className="font-mono text-xs text-muted">
            {t.search.feeTier} {formatFeePpm(pool.feePpm, locale)}
          </span>
        </div>

        {/*
         * What the pool contracts say they hold, not what the indexer claims.
         * The claim was wrong by up to a thousand times and it decided this
         * list's order; the amounts here decided it instead.
         */}
        <p className="text-xs text-muted">
          {reserves === null ? (
            t.search.reservesUnread
          ) : (
            <>
              {t.search.holds}{" "}
              <span className="font-mono">
                {formatTokenAmount(reserves.token0, pool.token0.decimals, locale)}{" "}
                {pool.token0.symbol}
                {" + "}
                {formatTokenAmount(reserves.token1, pool.token1.decimals, locale)}{" "}
                {pool.token1.symbol}
              </span>
            </>
          )}
        </p>

        {/* What actually tells two tokens with the same symbol apart. */}
        <div className="flex flex-col gap-0.5 font-mono text-[11px] leading-relaxed text-muted">
          <span className="break-all">
            {pool.token0.symbol} {pool.token0.address}
          </span>
          <span className="break-all">
            {pool.token1.symbol} {pool.token1.address}
          </span>
        </div>
      </GuardedLink>
    </li>
  );
};

export function PoolSearchResults({
  result,
  terms,
  t,
  locale,
}: {
  result: DataResult<SearchResults>;
  /** What was searched for, as the reader typed it, already validated. */
  terms: readonly string[];
  t: Dictionary;
  locale: Locale;
}) {
  const searched = terms.join(" / ");

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {t.search.heading}
      </h2>

      {result.status === "unavailable" ? (
        <>
          <p className="text-sm leading-relaxed">{t.search.unavailableHeading}</p>
          {/*
           * A code, turned into a sentence here. Nothing the provider wrote can
           * reach this line, because nothing the provider wrote ever became one
           * of the codes.
           */}
          <p className="text-sm leading-relaxed text-muted">
            {t.notices.failure[result.notice]}
          </p>
        </>
      ) : result.data.matches.length === 0 ? (
        <>
          <p className="text-sm leading-relaxed">{t.search.empty(searched)}</p>
          <p className="text-sm leading-relaxed text-muted">{t.search.emptyHint}</p>
        </>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-muted">{t.search.resultsFor(searched)}</p>

          <ul className="flex flex-col gap-3">
            {result.data.matches.map((match) => (
              <PairRow key={match.pool.id} match={match} t={t} locale={locale} />
            ))}
          </ul>

          <div className="flex flex-col gap-3 border-t border-border pt-3 text-xs leading-relaxed text-muted">
            <p>{t.search.symbolWarning}</p>
            <p>{t.search.ordering}</p>
            <p>{t.search.windowing}</p>
          </div>
        </>
      )}
    </section>
  );
}

/** The panel's shape while the search and its balance reads are still running. */
export function PoolSearchPending({ t }: { t: Dictionary }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {t.search.heading}
      </h2>
      <div className="h-24 animate-pulse rounded-md border border-border" aria-hidden="true" />
    </section>
  );
}
