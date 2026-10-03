import Link from "next/link";

import {
  PAIR_PARAMETER,
  PAIR_RANKING_FLOOR_USD,
  type PairPoolRow,
  type PairPools as PairPoolsData,
  type PairPoolsHalf,
  pairPoolHref,
} from "../lib/advisor/pairPools";
import { chainLabel } from "../lib/chains/chainLabel";
import { formatFeePpm, formatPercent, formatUsd, formatWhole } from "../lib/format/displayFormats";
import { priceStepRatio } from "../lib/format/priceStep";
import type { Dictionary } from "../lib/i18n/dictionaries";
import { localePath } from "../lib/i18n/localePath";
import type { Locale } from "../lib/i18n/locales";
import { getMethodCopy } from "../lib/i18n/methodCopy";
import type { MostTradedCopy } from "../lib/i18n/mostTradedCopy";
import type { PairPoolsCopy } from "../lib/i18n/pairPoolsCopy";
import type { PoolSearchRejection } from "../lib/search/poolSearchInput";
import { V4_POOL_DAYS_WINDOW } from "../lib/uniswap/ethereumV4PoolDays";
import { ArrowIcon } from "./BrandMark";
import { GuardedLink } from "./GuardedLink";
import { rejectionMessage } from "./PoolLookupForm";

/*
 * One pair's pools on every network, v3 and v4 apart.
 *
 * Presentational only. The order is the one claim the page makes, and the
 * words above it say what the order is before the reader meets it: fees
 * already charged over what is in the pool now, scaled to a year, above a
 * stated floor — not a forecast, not a position's earnings, and not a
 * recommendation. Under the ranking, every pool the ranking leaves out, each
 * with the reason it is left out, so nothing reads as missing that was only
 * set aside.
 */

type Shared = {
  readonly copy: PairPoolsCopy;
  readonly week: MostTradedCopy;
  readonly t: Dictionary;
  readonly locale: Locale;
};

const feeLabel = ({ pool }: PairPoolRow, { t, locale }: Shared): string => {
  if (pool.protocolVersion === "v3") return formatFeePpm(pool.feePpm, locale);
  const fee =
    pool.fee.kind === "static"
      ? formatFeePpm(pool.fee.feePpm, locale)
      : pool.fee.kind === "dynamic"
        ? t.v4.dynamicFee
        : t.v4.feeUnread;

  return `${fee} · ${t.feeTiers.priceStep(formatPercent(priceStepRatio(pool.tickSpacing), locale))}`;
};

/** Why a row has no yield, in the reader's words; `null` on a ranked row. */
const standingNote = (row: PairPoolRow, { copy, locale }: Shared): string | null => {
  switch (row.standing) {
    case "ranked":
      return null;
    case "hook":
      return copy.hook;
    case "thin":
      return copy.thin(formatUsd(PAIR_RANKING_FLOOR_USD, locale));
    case "unmeasured":
      if (row.liquidityUsd === null) return copy.liquidityUnread;
      if (row.week.status === "unread") return copy.weekUnread;
      if (row.week.status === "quiet") return copy.quiet;
      return null;
  }
};

const Figure = ({ label, value, note }: { label: string; value: string; note?: string | null }) => (
  <div className="flex min-w-0 flex-col gap-1">
    <dt className="text-xs text-muted">{label}</dt>
    <dd className="font-mono text-sm">{value}</dd>
    {note === undefined || note === null ? null : <p className="text-xs text-muted">{note}</p>}
  </div>
);

const PoolCard = ({ row, shared }: { row: PairPoolRow; shared: Shared }) => {
  const { copy, week: weekCopy, t, locale } = shared;
  const { pool, week } = row;
  const note = standingNote(row, shared);

  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-5">
      <header className="flex flex-col gap-1">
        <h4 className="truncate text-base font-semibold">{`${pool.token0.symbol} / ${pool.token1.symbol}`}</h4>
        <p className="font-mono text-xs text-muted">{`${chainLabel(row.chain.id, locale)} · ${feeLabel(row, shared)}`}</p>
      </header>
      {/* The note every v4 fee figure on this site carries where the hook may alter swaps. */}
      {row.hookAltersSwaps ? (
        <p className="text-xs leading-relaxed text-muted">{`${t.feeTiers.hook}: ${t.feeTiers.hookAltersSwaps}`}</p>
      ) : null}
      <dl className="grid grid-cols-2 gap-3">
        <Figure
          label={pool.protocolVersion === "v3" ? t.search.holds : t.search.v4Depth}
          value={formatUsd(row.liquidityUsd, locale)}
        />
        {row.standing === "ranked" && row.feeYield !== null ? (
          <Figure label={copy.feeYield} value={formatPercent(row.feeYield, locale)} />
        ) : null}
        {week.status === "counted" ? (
          <>
            <Figure label={weekCopy.volume} value={formatUsd(week.volumeUsd, locale)} />
            <Figure
              label={weekCopy.fees}
              value={week.feesUsd === null ? weekCopy.feesUnknown : formatUsd(week.feesUsd, locale)}
              note={
                week.daysCounted < V4_POOL_DAYS_WINDOW
                  ? weekCopy.days(formatWhole(week.daysCounted, locale), formatWhole(V4_POOL_DAYS_WINDOW, locale))
                  : null
              }
            />
          </>
        ) : null}
      </dl>
      {note === null ? null : <p className="text-xs leading-relaxed text-muted">{note}</p>}
      <GuardedLink className="text-link text-sm" href={pairPoolHref(row)}>
        {t.search.analyse}
      </GuardedLink>
    </li>
  );
};

const Half = ({ heading, half, shared }: { heading: string; half: PairPoolsHalf; shared: Shared }) => {
  const { copy, t, locale } = shared;

  return (
    <section className="flex flex-col gap-4" aria-label={heading}>
      <h2 className="text-lg font-medium tracking-tight">{heading}</h2>

      {half.ranked.length === 0 && half.unranked.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted">{copy.none}</p>
      ) : null}

      {half.ranked.length === 0 ? null : (
        <>
          <h3 className="text-xs uppercase tracking-widest text-muted">{copy.ranked}</h3>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {half.ranked.map((row) => (
              <PoolCard key={`${row.chain.id}:${row.pool.id}`} row={row} shared={shared} />
            ))}
          </ol>
        </>
      )}

      {half.unranked.length === 0 ? null : (
        <>
          <h3 className="text-xs uppercase tracking-widest text-muted">{copy.unranked}</h3>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {half.unranked.map((row) => (
              <PoolCard key={`${row.chain.id}:${row.pool.id}`} row={row} shared={shared} />
            ))}
          </ul>
        </>
      )}

      {/* Every network asked, and what came back: a network that could not be read is said, never left out. */}
      <div className="flex flex-col gap-1">
        <h3 className="text-xs uppercase tracking-widest text-muted">{copy.chainsHeading}</h3>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted">
          {half.chains.map((outcome) => (
            <li key={outcome.chain.id}>
              {outcome.status === "read"
                ? copy.chainRead(outcome.chain.name, formatWhole(outcome.pools, locale))
                : `${copy.chainUnread(outcome.chain.name)} — ${t.notices.failure[outcome.notice]}`}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

/**
 * The box: two symbols, sent as the pool search's own `q` so the same words
 * are read by the same rules. A plain GET form, as the pool search is.
 */
export function PairPoolsForm({
  copy,
  t,
  value,
  rejection,
  notAPair = false,
}: {
  copy: PairPoolsCopy;
  t: Dictionary;
  /** Only ever terms that have passed validation; what was typed is never echoed as typed. */
  value?: string | undefined;
  rejection?: PoolSearchRejection | undefined;
  notAPair?: boolean;
}) {
  const error = rejection !== undefined ? rejectionMessage(rejection, t) : notAPair ? copy.notAPair : null;

  return (
    <form method="get" action="/pair" className="pool-lookup">
      <label htmlFor={PAIR_PARAMETER}>{copy.label}</label>
      <div className="lookup-row">
        <div className="lookup-input">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="m16 16 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          <input
            id={PAIR_PARAMETER}
            name={PAIR_PARAMETER}
            type="text"
            required
            spellCheck={false}
            autoComplete="off"
            maxLength={40}
            placeholder={t.search.placeholder}
            defaultValue={value ?? ""}
            aria-describedby={error === null ? undefined : "pair-error"}
            aria-invalid={error !== null || undefined}
          />
        </div>
        <button type="submit" className="button-primary">
          {copy.submit}<ArrowIcon />
        </button>
      </div>
      {error === null ? null : (
        <p id="pair-error" role="alert" className="lookup-error">{error}</p>
      )}
    </form>
  );
}

export function PairPools({
  data,
  copy,
  week,
  t,
  locale,
}: {
  data: PairPoolsData;
  copy: PairPoolsCopy;
  /** The most-traded page's words for a week's volume, fees and days, so the two pages say them alike. */
  week: MostTradedCopy;
  t: Dictionary;
  locale: Locale;
}) {
  const shared = { copy, week, t, locale };
  const pair = `${data.terms[0]} / ${data.terms[1]}`;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex max-w-3xl flex-col gap-3">
        <p className="text-sm leading-relaxed">{copy.resultsFor(pair)}</p>
        <p className="text-sm leading-relaxed text-muted">
          {copy.method(formatUsd(PAIR_RANKING_FLOOR_USD, locale))}{" "}
          <Link href={`${localePath(locale, "/method")}#pair`} prefetch={false} className="text-link">
            {getMethodCopy(locale).pointer}
          </Link>
        </p>
        <p className="text-xs leading-relaxed text-muted">{copy.apart}</p>
        <p className="text-xs leading-relaxed text-muted">{copy.symbols}</p>
        <p className="text-xs leading-relaxed text-muted">{copy.window}</p>
      </header>
      <Half heading={t.feeTiers.onV3} half={data.v3} shared={shared} />
      <Half heading={t.feeTiers.onV4} half={data.v4} shared={shared} />
    </div>
  );
}
