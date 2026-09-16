import Link from "next/link";

import { formatEtherAmount, formatFeePpm } from "../lib/format/displayFormats";
import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import {
  alterSwapEconomics,
  type DataResult,
  depthInEth,
  type V4PoolSearchMatch,
  type V4PoolSearchResults as SearchResults,
} from "../schemas";

/**
 * The v4 pools one search matched.
 *
 * Presentational only, and built on the same three rules as the v3 list beside
 * it: every token's contract address in full, an ordering that explains itself,
 * and no mark of trust on anything. It adds the one fact a v4 row cannot leave
 * out. A hook runs alongside every swap in the pool it is attached to, and a
 * reader who lands on a hooked pool from a list should learn that from the
 * list, not from the page after it.
 */

const HookLine = ({ match, t }: { match: V4PoolSearchMatch; t: Dictionary }) => {
  const { hookAddress } = match.pool;
  if (hookAddress === null) {
    return (
      <span>
        {t.search.v4Hook} {t.search.v4NoHook}
      </span>
    );
  }

  return (
    <span className="break-all">
      {t.search.v4Hook} {hookAddress}
      {alterSwapEconomics(hookAddress) ? ` · ${t.search.v4HookAltersSwaps}` : ""}
    </span>
  );
};

const PairRow = ({ match, t, locale }: { match: V4PoolSearchMatch; t: Dictionary; locale: Locale }) => {
  const { pool } = match;
  const depth = depthInEth(match);

  return (
    <li>
      <Link
        href={`/v4?id=${pool.id}`}
        className="flex flex-col gap-2 rounded-md border border-border bg-background p-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-base font-medium">
            {pool.token0.symbol} / {pool.token1.symbol}
          </span>
          <span className="font-mono text-xs text-muted">
            {t.search.feeTier}{" "}
            {pool.fee.kind === "static"
              ? formatFeePpm(pool.fee.feePpm, locale)
              : pool.fee.kind === "dynamic"
                ? t.v4.dynamicFee
                : t.v4.feeUnread}
          </span>
        </div>

        {/*
         * What the pool's active liquidity is worth at its price, read from the
         * PoolManager's storage. Not "holds": nothing on chain reports that per
         * v4 pool, and the note under the list says so.
         */}
        <p className="text-xs text-muted">
          {depth === null ? (
            t.search.v4StateUnread
          ) : (
            <>
              {t.search.v4Depth}{" "}
              <span className="font-mono">
                {t.search.v4DepthValue(formatEtherAmount(depth, locale))}
              </span>
            </>
          )}
        </p>

        <div className="flex flex-col gap-0.5 font-mono text-[11px] leading-relaxed text-muted">
          <span className="break-all">
            {pool.token0.symbol} {pool.token0.address}
          </span>
          <span className="break-all">
            {pool.token1.symbol} {pool.token1.address}
          </span>
          <HookLine match={match} t={t} />
        </div>
      </Link>
    </li>
  );
};

export function V4PoolSearchResults({
  result,
  terms,
  t,
  locale,
}: {
  result: DataResult<SearchResults>;
  terms: readonly string[];
  t: Dictionary;
  locale: Locale;
}) {
  const searched = terms.join(" / ");

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {t.search.v4Heading}
      </h2>

      {result.status === "unavailable" ? (
        <>
          <p className="text-sm leading-relaxed">{t.search.unavailableHeading}</p>
          <p className="text-sm leading-relaxed text-muted">
            {t.notices.failure[result.notice]}
          </p>
        </>
      ) : result.data.matches.length === 0 ? (
        <p className="text-sm leading-relaxed">{t.search.v4Empty(searched)}</p>
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
            <p>{t.search.v4Ordering}</p>
            <p>{t.search.v4DepthNote}</p>
            <p>{t.search.v4FeeNote}</p>
            <p>{t.search.v4Windowing}</p>
          </div>
        </>
      )}
    </section>
  );
}

/** The panel's shape while the search and its chain reads are still running. */
export function V4PoolSearchPending({ t }: { t: Dictionary }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {t.search.v4Heading}
      </h2>
      <div className="h-24 animate-pulse rounded-md border border-border" aria-hidden="true" />
    </section>
  );
}
