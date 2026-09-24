import { feeDisclosureFor } from "../lib/advisor/feeDisclosure";
import type { PoolRangeAnalysisResult } from "../lib/advisor/poolRangeAnalysis";
import { poolAnalysisHref, v4PoolAnalysisHref } from "../lib/advisor/requestedParameters";
import { formatFeePpm, formatMultiplier, formatPercent, formatUsd, formatWhole } from "../lib/format/displayFormats";
import { priceStepRatio } from "../lib/format/priceStep";
import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import type { DataFailureNotice, PriceBandParameters, V4FeeConfiguration } from "../schemas";
import { GuardedLink } from "./GuardedLink";

/**
 * Every v3 fee tier of one pair, each read in full under one band and one
 * deposit, set side by side.
 *
 * Presentational only. What it will not do is the point of it, the same as the
 * panel it is reached from:
 *
 *   - **No ranking.** The v3 pools stand in fee order, as the source lists
 *     them; the v4 pools deepest first, because a v4 pair is mostly pools
 *     somebody opened and left, and the note under them says so. Nothing is
 *     sorted by what it would have earned or marked as the best. A column of
 *     numbers beside each other invites a verdict; the page leaves it to the
 *     reader and says why.
 *   - **One footing, stated.** Horizon, width and deposit are the same for
 *     every card and printed once above them. Two pools read under different
 *     settings look comparable and are not.
 *   - **Days that happened.** Every figure is about the window already read.
 *     None of it is a yield or a forecast.
 *   - **Fees are half of it.** What a range gives up against holding is on
 *     each pool's own page, one click away, and the page says to read both.
 */

export type ComparedTier = {
  readonly protocol: "v3" | "v4";
  /** A v3 pool's address or a v4 pool's id. */
  readonly id: string;
  readonly fee: V4FeeConfiguration;
  /** Shown for v4, where the price step is the pool's own choice; `null` for v3, where the tier sets it. */
  readonly tickSpacing: number | null;
  /** A v4 hook that may change what a swap costs — the card then says so. */
  readonly hookAltersSwaps: boolean;
  /** The pool the reader came from. */
  readonly current: boolean;
  readonly result: PoolRangeAnalysisResult;
};

/** The v4 half: the pools read, how many more the pair has, or why there are none. */
export type ComparedV4 =
  | { readonly status: "listed"; readonly tiers: readonly ComparedTier[]; readonly notShown: number }
  | { readonly status: "none" }
  | { readonly status: "unavailable"; readonly notice: DataFailureNotice };

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
  const fee =
    tier.fee.kind === "static"
      ? formatFeePpm(tier.fee.feePpm, locale)
      : tier.fee.kind === "dynamic"
        ? t.v4.dynamicFee
        : t.v4.feeUnread;
  const heading =
    tier.tickSpacing === null
      ? fee
      : `${fee} · ${t.feeTiers.priceStep(formatPercent(priceStepRatio(tier.tickSpacing), locale))}`;
  const href =
    tier.protocol === "v3"
      ? poolAnalysisHref(tier.id, parameters, depositUsd)
      : v4PoolAnalysisHref(tier.id, parameters, depositUsd);

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-mono text-base font-medium">{heading}</h3>
        {tier.current ? (
          <span className="text-xs uppercase tracking-widest text-muted">{t.feeTiers.thisOne}</span>
        ) : null}
      </header>
      {tier.hookAltersSwaps ? (
        <p className="text-xs leading-relaxed text-muted">{`${t.feeTiers.hook}: ${t.feeTiers.hookAltersSwaps}`}</p>
      ) : null}

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

      <GuardedLink className="text-link text-sm" href={href}>
        {t.compare.open}
      </GuardedLink>
    </section>
  );
};

const Cards = ({
  tiers,
  parameters,
  depositUsd,
  t,
  locale,
}: {
  tiers: readonly ComparedTier[];
  parameters: PriceBandParameters;
  depositUsd: number;
  t: Dictionary;
  locale: Locale;
}) => (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    {tiers.map((tier) => (
      <TierCard key={tier.id} tier={tier} parameters={parameters} depositUsd={depositUsd} t={t} locale={locale} />
    ))}
  </div>
);

export function PoolComparison({
  pair,
  v3,
  v4,
  parameters,
  depositUsd,
  t,
  locale,
}: {
  pair: string;
  /** Every v3 tier of the pair, in fee order. */
  v3: readonly ComparedTier[];
  v4: ComparedV4;
  parameters: PriceBandParameters;
  depositUsd: number;
  t: Dictionary;
  locale: Locale;
}) {
  const cards = { parameters, depositUsd, t, locale };
  // "Nothing to set beside it" is only true when v4 has nothing either.
  const alone = v3.length < 2 && (v4.status !== "listed" || v4.tiers.length === 0);

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

      <section className="flex flex-col gap-4" aria-label={t.feeTiers.onV3}>
        <h3 className="text-xs uppercase tracking-widest text-muted">{t.feeTiers.onV3}</h3>
        {alone ? <p className="text-sm leading-relaxed">{t.compare.onlyOne(pair)}</p> : null}
        <Cards tiers={v3} {...cards} />
      </section>

      <section className="flex flex-col gap-4" aria-label={t.feeTiers.onV4}>
        <h3 className="text-xs uppercase tracking-widest text-muted">{t.feeTiers.onV4}</h3>
        {v4.status === "unavailable" ? (
          <>
            <p className="text-sm leading-relaxed">{t.feeTiers.v4Unavailable}</p>
            <p className="text-sm leading-relaxed text-muted">{t.notices.failure[v4.notice]}</p>
          </>
        ) : v4.status === "none" || v4.tiers.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted">{t.feeTiers.v4None(pair)}</p>
        ) : (
          <>
            <Cards tiers={v4.tiers} {...cards} />
            <p className="text-xs leading-relaxed text-muted">{t.feeTiers.v4Ordering}</p>
            {v4.notShown > 0 ? (
              <p className="text-xs leading-relaxed text-muted">{t.feeTiers.moreNotShown(formatWhole(v4.notShown, locale))}</p>
            ) : null}
          </>
        )}
      </section>

      <p className="text-sm leading-relaxed">{t.compare.readTogether}</p>
    </div>
  );
}
