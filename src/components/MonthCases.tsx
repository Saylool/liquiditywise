import type { MonthCase } from "../lib/advisor/monthCases";
import type { MonthCasesRead } from "../lib/advisor/readMonthCases";
import { poolAnalysisHref, v4PoolAnalysisHref } from "../lib/advisor/requestedParameters";
import { type Chain, ETHEREUM } from "../lib/chains/chains";
import { chainLabel } from "../lib/chains/chainLabel";
import { formatFeePpm, formatPercent, formatPrice, formatUsd, formatUtcDate, formatUtcMinute, formatWhole } from "../lib/format/displayFormats";
import { choosePriceQuote, quotedInterval } from "../lib/format/priceQuote";
import { priceStepRatio } from "../lib/format/priceStep";
import type { CasesCopy } from "../lib/i18n/casesCopy";
import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import type { PriceBandParameters } from "../schemas";
import { ChainTabs } from "./ChainTabs";
import { GuardedLink } from "./GuardedLink";

/*
 * The month that already happened, as cards: one pool's replay each, best
 * first by the one figure the page states above them.
 *
 * Each card is the pool page's own month, reduced: the pair, the fee and the
 * network; the window and the range it was replayed in; how the days sat
 * against that range; the fees the default deposit would have taken and what
 * the position ended the month worth against holding; the re-centring
 * verdict; and the way into the page the figures came from. The labels a
 * card shares with that page are that page's own words, so a figure cannot
 * be called one thing there and another here.
 *
 * Nothing is computed on a visit. The page shows what the warmer kept and
 * says when it was measured, or that it has not been yet.
 */

type Shared = {
  readonly chain: Chain;
  readonly copy: CasesCopy;
  readonly parameters: PriceBandParameters;
  readonly t: Dictionary;
  readonly locale: Locale;
};

/** The pool's fee as the most-traded page writes it: a v3 tier; a v4 fee with its price step. */
const feeLabel = ({ pool }: MonthCase, { t, locale }: Shared): string => {
  if (pool.protocolVersion === "v3") return formatFeePpm(pool.feePpm, locale);
  const fee =
    pool.fee.kind === "static"
      ? formatFeePpm(pool.fee.feePpm, locale)
      : pool.fee.kind === "dynamic"
        ? t.v4.dynamicFee
        : t.v4.feeUnread;

  return `${fee} · ${t.feeTiers.priceStep(formatPercent(priceStepRatio(pool.tickSpacing), locale))}`;
};

/** A signed dollar figure, as the re-centring panel writes one: a plus where the formatter adds none. */
const signedUsd = (value: number, locale: Locale): string => `${value > 0 ? "+" : ""}${formatUsd(value, locale)}`;

const Figure = ({ label, value }: { label: string; value: string }) => (
  <div className="flex min-w-0 flex-col gap-1">
    <dt className="text-xs text-muted">{label}</dt>
    <dd className="font-mono text-sm">{value}</dd>
  </div>
);

const recentringVerdict = (entry: MonthCase, { copy, locale }: Shared): string => {
  if (entry.recentres === 0) return copy.neverRecentred;
  const difference = Math.abs(entry.recentringDifferenceUsd);
  const verdict =
    entry.recentringDifferenceUsd > 0
      ? copy.recentringBetter(formatUsd(difference, locale))
      : entry.recentringDifferenceUsd < 0
        ? copy.recentringWorse(formatUsd(difference, locale))
        : copy.recentringSame;

  return `${copy.recentres(formatWhole(entry.recentres, locale))} ${verdict}`;
};

const CaseCard = ({ entry, badge, shared }: { entry: MonthCase; badge: string | null; shared: Shared }) => {
  const { chain, copy, parameters, t, locale } = shared;
  const { pool } = entry;
  const href =
    pool.protocolVersion === "v3"
      ? poolAnalysisHref(pool.id, parameters, entry.depositUsd, chain)
      : v4PoolAnalysisHref(pool.id, parameters, entry.depositUsd, chain);

  /* The range the pool page's way round, decided from the same price it decides by. */
  const quote = choosePriceQuote(pool, entry.currentPrice);
  const shown = quotedInterval(quote, { lower: entry.lowerPrice, upper: entry.upperPrice });
  const range = t.report.rangeValue(
    formatPrice(shown.lower, locale),
    formatPrice(shown.upper, locale),
    quote.quote.symbol,
    quote.base.symbol,
  );
  const total = entry.inside + entry.outside + entry.crossed;
  const whole = (value: number) => formatWhole(value, locale);

  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-5">
      <header className="flex flex-col gap-1">
        {badge === null ? null : <p className="font-mono text-xs uppercase tracking-widest text-accent">{badge}</p>}
        <h3 className="truncate text-base font-semibold">{`${pool.token0.symbol} / ${pool.token1.symbol}`}</h3>
        <p className="font-mono text-xs text-muted">{`${feeLabel(entry, shared)} · ${chainLabel(entry.chainId, locale)}`}</p>
      </header>
      <p className="text-xs leading-relaxed text-muted">
        {copy.window(formatUtcDate(entry.openedAt), formatUtcDate(entry.closedAt))}
      </p>
      <dl className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex min-w-0 flex-col gap-1">
          <dt className="text-xs text-muted">{copy.range}</dt>
          <dd className="break-words font-mono text-sm">{range}</dd>
        </div>
        <Figure label={t.outOfSample.fullyInside} value={t.compare.daysInsideValue(whole(entry.inside), whole(total))} />
        <Figure label={t.outOfSample.fullyOutside} value={whole(entry.outside)} />
        <Figure label={t.outOfSample.undetermined} value={whole(entry.crossed)} />
        <Figure label={t.backtest.worth} value={formatPercent(entry.endValueVsHold, locale)} />
        <Figure label={t.backtest.fees(formatUsd(entry.depositUsd, locale))} value={formatUsd(entry.feesUsd, locale)} />
        <Figure label={t.backtest.feesOfDeposit} value={formatPercent(entry.feesOfDeposit, locale)} />
        <div className="col-span-2 flex min-w-0 flex-col gap-1">
          <dt className="text-xs text-muted">{copy.result}</dt>
          <dd className="font-mono text-base font-semibold">{signedUsd(entry.resultVsHeldUsd, locale)}</dd>
        </div>
      </dl>
      <p className="text-xs leading-relaxed text-muted">{recentringVerdict(entry, shared)}</p>
      <GuardedLink className="text-link text-sm" href={href}>
        {t.compare.open}
      </GuardedLink>
      <p className="text-xs leading-relaxed text-muted">{copy.note}</p>
    </li>
  );
};

export function MonthCases({
  read,
  chain = ETHEREUM,
  pageHref,
  networkLabel,
  copy,
  parameters,
  depositUsd,
  t,
  locale,
}: {
  /** What is kept for the chain; `null` until the warmer's first measurement. */
  read: MonthCasesRead | null;
  chain?: Chain;
  /** The deposit the cases were measured for, named in the introduction before any card. */
  depositUsd: number;
  /** The page's own address in the reader's language, for the chain tabs. */
  pageHref: string;
  /** What the chain tabs are called for a screen reader. */
  networkLabel: string;
  copy: CasesCopy;
  parameters: PriceBandParameters;
  t: Dictionary;
  locale: Locale;
}) {
  const shared = { chain, copy, parameters, t, locale };
  const deposit = formatUsd(depositUsd, locale);

  return (
    <>
      <ChainTabs current={chain} label={networkLabel} pageHref={pageHref} />
      <p className="max-w-2xl text-sm leading-relaxed text-muted">{copy.intro(chain.name, deposit)}</p>
      <p className="max-w-2xl text-sm leading-relaxed text-muted">{copy.criterion(deposit)}</p>
      {read === null ? (
        <p className="text-sm leading-relaxed">{copy.notYet(chain.name)}</p>
      ) : read.status === "unavailable" ? (
        <p className="text-sm leading-relaxed">{`${copy.unavailable} ${t.notices.failure[read.notice]}`}</p>
      ) : (
        <>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">{copy.measuredAt(formatUtcMinute(read.measuredAt))}</p>
          {read.cases.length === 0 ? (
            <p className="text-sm leading-relaxed">{copy.empty(chain.name)}</p>
          ) : (
            <>
              <p className="max-w-2xl text-sm leading-relaxed text-muted">
                {copy.poolsRead(formatWhole(read.cases.length, locale), formatWhole(read.poolsAsked, locale))}
              </p>
              <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {read.cases.map((entry, index) => (
                  <CaseCard
                    key={`${entry.pool.protocolVersion}:${entry.pool.id}`}
                    entry={entry}
                    /* The first and the last, by the stated figure; a lone case is best and worst alike, and says only best. */
                    badge={index === 0 ? copy.best : index === read.cases.length - 1 ? copy.worst : null}
                    shared={shared}
                  />
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </>
  );
}
