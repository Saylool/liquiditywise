import { feeDisclosureFor } from "../lib/advisor/feeDisclosure";
import type { PoolRangeAnalysisResult } from "../lib/advisor/poolRangeAnalysis";
import { poolAnalysisHref } from "../lib/advisor/requestedParameters";
import { formatFeePpm, formatMultiplier, formatUsd, formatWhole } from "../lib/format/displayFormats";
import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import type { PriceBandParameters } from "../schemas";
import { GuardedLink } from "./GuardedLink";

/**
 * Every v3 fee tier of one pair, each read in full under one band and one
 * deposit, set side by side.
 *
 * Presentational only. What it will not do is the point of it, the same as the
 * panel it is reached from:
 *
 *   - **No ranking.** The pools stand in fee order, as the source lists them,
 *     and nothing on the page is sorted by a figure or marked as the best. A
 *     column of numbers beside each other invites a verdict; the page leaves
 *     it to the reader and says why.
 *   - **One footing, stated.** Horizon, width and deposit are the same for
 *     every card and printed once above them. Two pools read under different
 *     settings look comparable and are not.
 *   - **Days that happened.** Every figure is about the window already read.
 *     None of it is a yield or a forecast.
 *   - **Fees are half of it.** What a range gives up against holding is on
 *     each pool's own page, one click away, and the page says to read both.
 */

export type ComparedTier = {
  readonly address: string;
  readonly feePpm: number;
  /** The pool the reader came from. */
  readonly current: boolean;
  readonly result: PoolRangeAnalysisResult;
};

const Figure = ({ label, value, note }: { label: string; value: string; note?: string | undefined }) => (
  <div className="flex flex-col gap-1">
    <dt className="text-xs uppercase tracking-widest text-muted">{label}</dt>
    <dd className="font-mono text-sm">{value}</dd>
    {note === undefined ? null : <p className="text-xs leading-relaxed text-muted">{note}</p>}
  </div>
);

const TierCard = ({
  tier,
  parameters,
  depositUsd,
  t,
  locale,
}: {
  tier: ComparedTier;
  parameters: PriceBandParameters;
  depositUsd: number;
  t: Dictionary;
  locale: Locale;
}) => {
  const whole = (value: number) => formatWhole(value, locale);
  const { result } = tier;

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-mono text-base font-medium">{formatFeePpm(tier.feePpm, locale)}</h3>
        {tier.current ? (
          <span className="text-xs uppercase tracking-widest text-muted">{t.feeTiers.thisOne}</span>
        ) : null}
      </header>

      {result.status === "unavailable" ? (
        <>
          <p className="text-sm leading-relaxed">{t.compare.unavailable}</p>
          <p className="text-sm leading-relaxed text-muted">{t.notices.failure[result.notice]}</p>
        </>
      ) : (
        (() => {
          const { activity, depositFeeShare, pool } = result.data;
          const attributable = feeDisclosureFor(pool).mayAttributeFeesToRange;
          return (
            <dl className="grid gap-4">
              <Figure
                label={t.deposit.heading}
                value={
                  !attributable
                    ? t.activity.feesWithheld
                    : depositFeeShare.status === "success"
                      ? formatUsd(depositFeeShare.data.depositFeesUsd, locale)
                      : t.deposit.unavailable
                }
                {...(attributable && depositFeeShare.status === "success"
                  ? { note: t.compare.depositFeesNote(whole(depositFeeShare.data.daysCounted)) }
                  : {})}
              />
              <Figure
                label={t.compare.daysInside}
                value={t.compare.daysInsideValue(whole(activity.occupancy.fullyInside), whole(activity.daysMeasured))}
              />
              <Figure label={t.activity.volume30d} value={formatUsd(activity.volume30dUsd, locale)} />
              <Figure label={t.activity.fees30d} value={formatUsd(activity.fees30dUsd, locale)} />
            </dl>
          );
        })()
      )}

      <GuardedLink className="text-link text-sm" href={poolAnalysisHref(tier.address, parameters, depositUsd)}>
        {t.compare.open}
      </GuardedLink>
    </section>
  );
};

export function PoolComparison({
  pair,
  tiers,
  parameters,
  depositUsd,
  t,
  locale,
}: {
  pair: string;
  tiers: readonly ComparedTier[];
  parameters: PriceBandParameters;
  depositUsd: number;
  t: Dictionary;
  locale: Locale;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        {/* The page's one h1 is the workspace's own heading, above this. */}
        <h2 className="text-2xl font-semibold">{t.compare.heading}</h2>
        <p className="text-sm leading-relaxed">{t.compare.intro(pair)}</p>
        {/* The one footing every card stands on, printed once rather than on each. */}
        <p className="font-mono text-xs text-muted">
          {`${t.parameters.horizonLabel}: ${t.parameters.days(formatWhole(parameters.horizonDays, locale))} · ${t.parameters.widthLabel}: ${t.parameters.sigma(formatMultiplier(parameters.standardDeviationMultiplier, locale))} · ${t.parameters.depositLabel}: ${formatUsd(depositUsd, locale)}`}
        </p>
      </header>

      {tiers.length < 2 ? (
        <p className="text-sm leading-relaxed">{t.compare.onlyOne(pair)}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {tiers.map((tier) => (
            <TierCard key={tier.address} tier={tier} parameters={parameters} depositUsd={depositUsd} t={t} locale={locale} />
          ))}
        </div>
      )}

      <p className="text-sm leading-relaxed">{t.compare.readTogether}</p>
      <p className="text-xs leading-relaxed text-muted">{t.compare.notV4}</p>
    </div>
  );
}
