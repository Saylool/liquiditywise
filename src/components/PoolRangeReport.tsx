import Link from "next/link";

import { type FeeDisclosure, feeDisclosureFor } from "../lib/advisor/feeDisclosure";
import type { CustomRangeBacktest, RangeBacktest } from "../lib/analytics/rangeBacktest";
import type { RecentringReplay } from "../lib/analytics/recentringReplay";
import {
  carriedRecentreGas,
  DEPOSIT_PARAMETER,
  GAS_PARAMETER,
  HORIZON_PARAMETER,
  LOWER_PARAMETER,
  MULTIPLIER_PARAMETER,
  RECENTRE_GAS_CHOICES,
  type RequestedCustomRange,
  type RequestedRecentreGas,
  UPPER_PARAMETER,
} from "../lib/advisor/requestedParameters";
import type { ChainSlug } from "../lib/chains/chains";
import type {
  PoolRangeAnalysisResult,
  PoolRangeAnalysisStep,
} from "../lib/advisor/poolRangeAnalysis";
import { compareWidths } from "../lib/advisor/widthComparison";
import { widthWord } from "../lib/advisor/widthWords";
import type { RealizedFeeRateResult } from "../lib/analytics/realizedFeeRate";
import { Fragment } from "react";

import {
  ABSENT,
  formatEtherAmount,
  formatFeePpm,
  formatMeasuredFeePpm,
  formatMultiplier,
  formatPercent,
  formatPrice,
  formatTick,
  formatUsd,
  formatUtcDate,
  formatUtcMinute,
  formatWhole,
} from "../lib/format/displayFormats";
import {
  choosePriceQuote,
  edgeDistances,
  heldAboveRange,
  heldBelowRange,
  quotedEnds,
  quotedInterval,
  quotedPrice,
} from "../lib/format/priceQuote";
import { ACTIVITY_WINDOW_DAYS } from "../lib/analytics/poolActivity";
import { chartDays, layoutPriceChart } from "../lib/format/priceChartLayout";
import { priceStepRatio } from "../lib/format/priceStep";
import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import { localePath } from "../lib/i18n/localePath";
import { getMethodCopy } from "../lib/i18n/methodCopy";
import { getRecentringCopy } from "../lib/i18n/recentringCopy";
import type { PriceBandParameters, StatedSwapFee, V4ProtocolFee } from "../schemas";
import { Choice, optionsIncluding } from "./BandChoices";
import { PriceHistoryChart } from "./PriceHistoryChart";
import { chainLabel } from "../lib/chains/chainLabel";

/**
 * Renders one pool's range analysis, for someone who has never heard of a tick.
 *
 * Presentational only: it fetches nothing, computes nothing, and holds no
 * credential. Every figure comes from the result it is handed, and every figure
 * it cannot show is shown as absent rather than as a zero. The one thing it
 * decides is how a figure is *read*: every price on the page is written the way
 * round that makes it at least one — one unit of the dearer token, priced in
 * the cheaper — because that is how a person thinks of a price, and the pool's
 * own direction is how a contract does. The reciprocal is arithmetic on a
 * verified figure, not a new one; see `priceQuote.ts`.
 *
 * The page leads with what a reader would act on — two prices, whether the
 * current price sits between them, and how far it has to move to leave — and
 * ends with what a reader would check it against: the ticks those prices
 * encode, the blocks they were read at, the pool's own direction. The second
 * half is folded away, not removed. Nothing is hidden; it is ordered.
 *
 * Both the words and the numbers follow the reader's language — a translated
 * page that still writes "0.30%" to a Turkish reader is only half translated.
 *
 * The warnings are the exception. They arrive from the data layer as codes and
 * are rendered through the dictionary like everything else.
 */

function Figure({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string | undefined;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs uppercase tracking-widest text-muted">{label}</dt>
      <dd className="font-mono text-sm">{value}</dd>
      {note === undefined ? null : <p className="text-xs leading-relaxed text-muted">{note}</p>}
    </div>
  );
}

/*
 * The panels this report is made of, in the order it renders them.
 *
 * Not everything on the page: where the pair also trades, and the written
 * explanation, are streamed in by the route after this component has returned.
 * Linking to a section that has not arrived would be a link to nothing, so the
 * contents name what is there when the page first paints.
 *
 * One list, used twice: to title each panel and to build the contents that jump
 * to them. Keeping them apart would let the contents name a panel that had been
 * renamed, moved or removed — the kind of drift nobody notices because both
 * halves still look right on their own. A panel added without an entry here is a
 * type error, and an entry with no panel is a link to nothing, which is why the
 * ids are checked against the rendered markup by a test.
 *
 * The technical fold is in the list because it is the longest thing on the page
 * and the hardest to scroll to, even though it opens closed.
 */
const PANELS = [
  "range",
  "basis",
  "widths",
  "activity",
  "deposit",
  "realizedFee",
  "outOfSample",
  "backtest",
  "customRange",
  "recentring",
  "divergence",
  "rangeOrder",
  "swapDepth",
  "technical",
] as const;

type PanelId = (typeof PANELS)[number];

const panelTitles = (t: Dictionary, locale: Locale): Record<PanelId, string> => ({
  range: t.report.rangeHeading,
  basis: t.report.basisHeading,
  widths: t.widths.heading,
  activity: t.activity.heading,
  deposit: t.deposit.heading,
  realizedFee: t.realizedFee.heading,
  outOfSample: t.outOfSample.heading,
  backtest: t.backtest.heading,
  customRange: t.customRange.heading,
  recentring: getRecentringCopy(locale).heading,
  divergence: t.divergence.heading,
  rangeOrder: t.rangeOrder.heading,
  swapDepth: t.swapDepth.heading,
  technical: t.technical.heading,
});

/**
 * Where the page's own sections are, without leaving it.
 *
 * Eleven panels is more than a reader will scroll through looking for one, and
 * the page grew to that a panel at a time without anyone deciding it should.
 * Plain anchors: no JavaScript, every one of them a real link that can be copied
 * and sent.
 *
 * Under the range rather than above it. The range is what somebody came for, and
 * a list of contents standing in front of it would make them read an index
 * before an answer.
 */
/**
 * Every panel is always there but three: the month replayed needs a history
 * long enough to draw a range before it, the reader's own range goes wherever
 * that does and only on a page that can submit one, and the re-centring
 * strategy is on every page that can submit its cost — saying so where the
 * history is too short, rather than vanishing.
 */
function Contents({ t, locale, absent = [] }: { t: Dictionary; locale: Locale; absent?: readonly PanelId[] }) {
  const titles = panelTitles(t, locale);

  return (
    <nav aria-label={t.report.contentsLabel} className="flex flex-col gap-2">
      <h2 className="text-xs uppercase tracking-widest text-muted">{t.report.contentsHeading}</h2>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {PANELS.filter((id) => !absent.includes(id)).map((id) => (
          <li key={id}>
            <a href={`#${id}`} className="text-sm leading-relaxed text-accent underline">
              {titles[id]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A titled panel. A `<dl>` inside it is the caller's, so prose can sit beside it. */
function Panel({
  id,
  title,
  children,
}: {
  /** What the contents above link to. Typed, so the two lists cannot drift. */
  id: PanelId;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      /*
       * A little room above, so a heading jumped to is not flush against the
       * top of the window with its panel running off the bottom.
       */
      className="flex scroll-mt-4 flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card"
    >
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">{title}</h2>
      {children}
    </section>
  );
}

/** The grid the figures sit in, everywhere they sit in one. */
const FIGURE_GRID = "grid gap-5 sm:grid-cols-2 lg:grid-cols-3";

/** A stated swap fee: one figure, or two when the protocol's cut differs by direction. */
const formatStatedFee = (stated: StatedSwapFee, locale: Locale): string =>
  stated.lowestPpm === stated.highestPpm
    ? formatFeePpm(stated.lowestPpm, locale)
    : `${formatFeePpm(stated.lowestPpm, locale)} – ${formatFeePpm(stated.highestPpm, locale)}`;

/** The protocol's cut, likewise. */
const formatProtocolFee = (fee: V4ProtocolFee, locale: Locale): string =>
  formatStatedFee(
    {
      lowestPpm: Math.min(fee.zeroForOnePpm, fee.oneForZeroPpm),
      highestPpm: Math.max(fee.zeroForOnePpm, fee.oneForZeroPpm),
    },
    locale,
  );

/** Whether the protocol takes anything at all, in either direction. */
const takesProtocolFee = (fee: V4ProtocolFee | null): fee is V4ProtocolFee =>
  fee !== null && (fee.zeroForOnePpm > 0 || fee.oneForZeroPpm > 0);

/** Each day of a replayed month, folded away: where the price was, and the worth against holding. */
function BacktestDays({
  days,
  t,
  locale,
}: {
  days: RangeBacktest["days"];
  t: Dictionary;
  locale: Locale;
}) {
  const place = { inside: t.backtest.placeInside, outside: t.backtest.placeOutside, undetermined: t.backtest.placeCrossed };

  return (
    <details className="flex flex-col gap-2">
      <summary className="cursor-pointer text-xs uppercase tracking-widest text-muted">{t.backtest.showDays}</summary>
      <div className="scroll-hint mt-3 overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <caption className="sr-only">{t.backtest.daysCaption}</caption>
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-muted">
              <th scope="col" className="pr-6 pb-1 font-normal">{t.backtest.dayDate}</th>
              <th scope="col" className="pr-6 pb-1 font-normal">{t.backtest.dayPlace}</th>
              <th scope="col" className="pb-1 font-normal">{t.backtest.dayWorth}</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.timestamp} className="font-mono">
                <th scope="row" className="py-0.5 pr-6 text-left font-normal">{formatUtcDate(day.timestamp)}</th>
                <td className="py-0.5 pr-6 text-muted">{place[day.placement]}</td>
                <td className="py-0.5">{formatPercent(day.valueVsHold, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * A position opened thirty days ago in the range drawn then, day by day.
 * Figures only; the words around them say what each rests on.
 */
function BacktestPanel({
  backtest,
  depositUsd,
  attributesFees,
  inQuote,
  t,
  locale,
}: {
  backtest: RangeBacktest;
  depositUsd: number;
  /** False where a hook may change what swaps pay, as the deposit panel's gate says. */
  attributesFees: boolean;
  /** A range in the page's own quote. */
  inQuote: (lower: number, upper: number) => string;
  t: Dictionary;
  locale: Locale;
}) {
  const whole = (value: number) => formatWhole(value, locale);
  const percent = (ratio: number) => formatPercent(ratio, locale);

  return (
    <Panel id="backtest" title={t.backtest.heading}>
      <p className="text-sm leading-relaxed">
        {t.backtest.opened(formatUtcDate(backtest.openedAt), inQuote(backtest.lowerPrice, backtest.upperPrice))}
      </p>
      <p className="text-sm leading-relaxed text-muted">{t.backtest.intro}</p>

      <dl className={FIGURE_GRID}>
        <Figure label={t.outOfSample.fullyInside} value={whole(backtest.inside)} />
        <Figure label={t.outOfSample.fullyOutside} value={whole(backtest.outside)} />
        <Figure label={t.outOfSample.undetermined} value={whole(backtest.crossed)} />
        <Figure label={t.backtest.worth} value={percent(backtest.endValueVsHold)} note={t.backtest.worthNote} />
        {!attributesFees || backtest.fees === null ? null : (
          <>
            <Figure label={t.backtest.fees(formatUsd(depositUsd, locale))} value={formatUsd(backtest.fees.usd, locale)} />
            <Figure label={t.backtest.feesOfDeposit} value={percent(backtest.fees.ofDeposit)} />
          </>
        )}
      </dl>
      {!attributesFees ? (
        <p className="text-xs leading-relaxed text-muted">{t.backtest.feesWithheld}</p>
      ) : backtest.fees === null ? (
        <p className="text-xs leading-relaxed text-muted">{t.backtest.feesUnread}</p>
      ) : null}

      <BacktestDays days={backtest.days} t={t} locale={locale} />

      <p className="text-xs leading-relaxed text-muted">{t.backtest.caveat}</p>
    </Panel>
  );
}

/**
 * Where a reader tries a range of their own, and — once they have — the same
 * month replayed in it, beside the suggested range's figures.
 *
 * A plain GET form like the one that sets the band, carrying everything that
 * shaped the analysis above as hidden fields, so the replay beside the
 * suggested one is a replay under the *same* settings: the same horizon, the
 * same width, the same deposit, the same chain. The two prices are typed the
 * way the page writes prices, and labelled so.
 *
 * Every figure in it is computed; none comes from the explanation below.
 */
function CustomRangePanel({
  custom,
  suggested,
  requested,
  form,
  poolId,
  parameters,
  depositUsd,
  attributesFees,
  unit,
  inQuote,
  t,
  locale,
}: {
  custom: CustomRangeBacktest | null;
  suggested: RangeBacktest;
  requested: RequestedCustomRange;
  form: CustomRangeForm;
  poolId: string;
  parameters: PriceBandParameters;
  depositUsd: number;
  /** The same gate the month replayed reads, read the same way. */
  attributesFees: boolean;
  /** "USDC per WETH": the direction every price on the page is written in. */
  unit: string;
  inQuote: (lower: number, upper: number) => string;
  t: Dictionary;
  locale: Locale;
}) {
  const whole = (value: number) => formatWhole(value, locale);
  const percent = (ratio: number) => formatPercent(ratio, locale);
  const usd = (value: number) => formatUsd(value, locale);
  const written = requested.status === "usable" ? requested.written : null;
  const gas = form.gas === undefined ? undefined : carriedRecentreGas(form.gas);

  /* One row per figure the month replayed shows, its own label on it. */
  const rows: readonly { readonly label: string; readonly yours: string; readonly theirs: string }[] =
    custom === null
      ? []
      : [
          { label: t.outOfSample.fullyInside, yours: whole(custom.inside), theirs: whole(suggested.inside) },
          { label: t.outOfSample.fullyOutside, yours: whole(custom.outside), theirs: whole(suggested.outside) },
          { label: t.outOfSample.undetermined, yours: whole(custom.crossed), theirs: whole(suggested.crossed) },
          { label: t.backtest.worth, yours: percent(custom.endValueVsHold), theirs: percent(suggested.endValueVsHold) },
          ...(!attributesFees
            ? []
            : [
                {
                  label: t.backtest.fees(usd(depositUsd)),
                  yours: custom.fees === null ? ABSENT : usd(custom.fees.usd),
                  theirs: suggested.fees === null ? ABSENT : usd(suggested.fees.usd),
                },
                {
                  label: t.backtest.feesOfDeposit,
                  yours: custom.fees === null ? ABSENT : percent(custom.fees.ofDeposit),
                  theirs: suggested.fees === null ? ABSENT : percent(suggested.fees.ofDeposit),
                },
              ]),
        ];

  return (
    <Panel id="customRange" title={t.customRange.heading}>
      <p className="text-sm leading-relaxed text-muted">{t.customRange.intro}</p>

      <form method="get" action={form.action} className="flex flex-col gap-4">
        {/* Everything that shaped the figures above travels unchanged, so the two columns are read under one setting. */}
        <input type="hidden" name={form.poolParameter} value={poolId} />
        {form.chain === undefined || form.chain === "ethereum" ? null : (
          <input type="hidden" name="chain" value={form.chain} />
        )}
        <input type="hidden" name={HORIZON_PARAMETER} value={String(parameters.horizonDays)} />
        <input type="hidden" name={MULTIPLIER_PARAMETER} value={String(parameters.standardDeviationMultiplier)} />
        <input type="hidden" name={DEPOSIT_PARAMETER} value={String(depositUsd)} />
        {/* The cost per re-centre, too, so trying a range does not quietly drop it from the panel below. */}
        {gas === undefined ? null : <input type="hidden" name={GAS_PARAMETER} value={gas} />}

        <div className="flex flex-wrap items-end gap-4">
          {(
            [
              [LOWER_PARAMETER, t.customRange.lowerLabel(unit), written?.lower],
              [UPPER_PARAMETER, t.customRange.upperLabel(unit), written?.upper],
            ] as const
          ).map(([name, label, value]) => (
            /* min-w-0, as the band's controls are: a row too wide for a phone is clipped, not scrolled. */
            <label key={name} className="flex min-w-0 flex-col gap-1">
              <span className="text-xs uppercase tracking-widest text-muted">{label}</span>
              <input
                type="text"
                inputMode="decimal"
                name={name}
                defaultValue={value ?? ""}
                autoComplete="off"
                spellCheck={false}
                className="w-full min-w-0 rounded-md border border-border bg-surface-sunken px-3 py-2 font-mono text-sm"
              />
            </label>
          ))}
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-on transition-[filter] hover:brightness-110"
          >
            {t.customRange.apply}
          </button>
        </div>
      </form>

      {requested.status === "unusable" ? (
        <p className="text-sm leading-relaxed text-muted">{t.customRange.unusable}</p>
      ) : requested.status === "usable" && custom === null ? (
        <p className="text-sm leading-relaxed text-muted">{t.customRange.unreplayed}</p>
      ) : null}

      {custom === null ? null : (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">{t.customRange.resultHeading}</h3>
          <p className="text-sm leading-relaxed">
            {t.backtest.opened(formatUtcDate(custom.openedAt), inQuote(custom.lowerPrice, custom.upperPrice))}
          </p>
          {custom.openedInside ? null : (
            <p className="text-sm leading-relaxed">{t.customRange.openedOutside}</p>
          )}

          <div className="scroll-hint overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t.customRange.tableCaption}</caption>
              <thead>
                <tr className="text-left text-xs uppercase tracking-widest text-muted">
                  <th scope="col" className="pr-4 pb-1 font-normal">{t.customRange.columnFigure}</th>
                  <th scope="col" className="pr-4 pb-1 font-normal">{t.customRange.columnYours}</th>
                  <th scope="col" className="pb-1 font-normal">{t.customRange.columnSuggested}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="py-1 pr-4 text-left font-normal">{row.label}</th>
                    <td className="py-1 pr-4 font-mono">{row.yours}</td>
                    <td className="py-1 font-mono text-muted">{row.theirs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-relaxed text-muted">{t.backtest.worthNote}</p>
          {!attributesFees ? (
            <p className="text-xs leading-relaxed text-muted">{t.backtest.feesWithheld}</p>
          ) : custom.fees === null || suggested.fees === null ? (
            <p className="text-xs leading-relaxed text-muted">{t.backtest.feesUnread}</p>
          ) : null}

          <BacktestDays days={custom.days} t={t} locale={locale} />

          <p className="text-xs leading-relaxed text-muted">{t.customRange.caveat}</p>
        </div>
      )}
    </Panel>
  );
}

/**
 * Where the reader's own range is submitted, and under what name the pool
 * travels — the page's to know, as for the band's form.
 */
export type CustomRangeForm = {
  readonly action: string;
  readonly poolParameter: string;
  /** The pool's chain, which travels hidden beside it; unsaid for mainnet. */
  readonly chain?: ChainSlug | undefined;
  /** What the URL asked for, read and checked by the route. */
  readonly requested: RequestedCustomRange;
  /**
   * The cost per re-centre the URL asked for. It travels with every form on
   * the page, as the band does, and the re-centring panel submits it; absent
   * is the same as not asked.
   */
  readonly gas?: RequestedRecentreGas | undefined;
};

/**
 * One simple active strategy over the month replayed: re-centre whenever a day
 * closes outside the range. Set beside the same month never re-centred, whose
 * figures it reuses rather than recomputes.
 *
 * Every figure is the analysis's; this decides only which of two endings to
 * show — with the fees in, or before them where they are withheld or unread —
 * and it decides that through the same gate the month replayed reads.
 *
 * A plain GET form sets the gas cost, carrying everything that shaped the
 * page, the reader's own range included, so recounting changes nothing but
 * the cost.
 */
function RecentringPanel({
  recentring,
  suggested,
  form,
  poolId,
  parameters,
  depositUsd,
  disclosure,
  symbols,
  inQuote,
  edgesInQuote,
  atClose,
  t,
  locale,
}: {
  recentring: RecentringReplay | null;
  /** The month never re-centred, or `null` where the history cannot hold one. */
  suggested: RangeBacktest | null;
  form: CustomRangeForm;
  poolId: string;
  parameters: PriceBandParameters;
  depositUsd: number;
  disclosure: FeeDisclosure;
  symbols: { readonly token0: string; readonly token1: string };
  inQuote: (lower: number, upper: number) => string;
  /** The same, shorter, for a table cell: both ends and the quote token. */
  edgesInQuote: (lower: number, upper: number) => string;
  /** A close in the page's own quote. */
  atClose: (price: number) => string;
  t: Dictionary;
  locale: Locale;
}) {
  const copy = getRecentringCopy(locale);
  const whole = (value: number) => formatWhole(value, locale);
  const percent = (ratio: number) => formatPercent(ratio, locale);
  const usd = (value: number) => formatUsd(value, locale);
  const signed = (value: number) => `${value > 0 ? "+" : ""}${usd(value)}`;

  return (
    <Panel id="recentring" title={copy.heading}>
      <p className="text-sm leading-relaxed text-muted">{copy.intro}</p>

      {suggested === null ? (
        <p className="text-sm leading-relaxed">{copy.noHistory}</p>
      ) : recentring === null ? (
        <p className="text-sm leading-relaxed">{copy.unreplayed}</p>
      ) : (
        <RecentringResult
          recentring={recentring}
          suggested={suggested}
          form={form}
          poolId={poolId}
          parameters={parameters}
          depositUsd={depositUsd}
          disclosure={disclosure}
          symbols={symbols}
          inQuote={inQuote}
          edgesInQuote={edgesInQuote}
          atClose={atClose}
          format={{ whole, percent, usd, signed }}
          t={t}
          locale={locale}
        />
      )}

      <Link href={`${localePath(locale, "/method")}#recentring`} prefetch={false} className="text-link text-sm">
        {getMethodCopy(locale).pointer}
      </Link>
    </Panel>
  );
}

function RecentringResult({
  recentring,
  suggested,
  form,
  poolId,
  parameters,
  depositUsd,
  disclosure,
  symbols,
  inQuote,
  edgesInQuote,
  atClose,
  format: { whole, percent, usd, signed },
  t,
  locale,
}: {
  recentring: RecentringReplay;
  suggested: RangeBacktest;
  form: CustomRangeForm;
  poolId: string;
  parameters: PriceBandParameters;
  depositUsd: number;
  disclosure: FeeDisclosure;
  symbols: { readonly token0: string; readonly token1: string };
  inQuote: (lower: number, upper: number) => string;
  edgesInQuote: (lower: number, upper: number) => string;
  atClose: (price: number) => string;
  format: {
    whole: (value: number) => string;
    percent: (ratio: number) => string;
    usd: (value: number) => string;
    signed: (value: number) => string;
  };
  t: Dictionary;
  locale: Locale;
}) {
  const copy = getRecentringCopy(locale);
  const { recentres, swapFee, gas } = recentring;
  /*
   * With the fees in only where the month replayed shows its fees — the same
   * gate, read the same way — and before them everywhere else.
   */
  const withFees = disclosure.mayAttributeFeesToRange ? recentring.afterFees : null;
  const outcome = withFees ?? recentring.beforeFees;
  const dates = new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(
    recentres.map(({ timestamp }) => formatUtcDate(timestamp)),
  );
  const fee =
    swapFee.basis === "stated"
      ? copy.feeStated(
          formatStatedFee(
            {
              lowestPpm: Math.min(swapFee.zeroForOnePpm, swapFee.oneForZeroPpm),
              highestPpm: Math.max(swapFee.zeroForOnePpm, swapFee.oneForZeroPpm),
            },
            locale,
          ),
        )
      : copy.feeMeasured(formatMeasuredFeePpm(swapFee.zeroForOnePpm, locale));

  const rows: readonly { readonly label: string; readonly recentred: string; readonly never: string }[] = [
    { label: copy.recentres, recentred: whole(recentres.length), never: whole(0) },
    { label: t.outOfSample.fullyInside, recentred: whole(recentring.inside), never: whole(suggested.inside) },
    ...(withFees === null || recentring.fees === null || suggested.fees === null
      ? []
      : [{ label: t.backtest.fees(usd(depositUsd)), recentred: usd(recentring.fees.usd), never: usd(suggested.fees.usd) }]),
    { label: copy.swapFees, recentred: usd(recentring.swapFees.usd), never: usd(0) },
    gas.perRecentreUsd > 0
      ? {
          label: copy.gas,
          recentred: copy.gasValue(whole(recentres.length), usd(gas.perRecentreUsd), usd(gas.usd)),
          never: usd(0),
        }
      : { label: copy.gas, recentred: copy.gasNotCounted, never: copy.gasNotCounted },
    { label: t.backtest.worth, recentred: percent(recentring.endValueVsHold), never: percent(suggested.endValueVsHold) },
    {
      label: withFees === null ? copy.endValueBeforeFees : copy.endValue,
      recentred: usd(outcome.recentredUsd),
      never: usd(outcome.neverUsd),
    },
    { label: copy.vsHeld, recentred: signed(outcome.recentredVsHeldUsd), never: signed(outcome.neverVsHeldUsd) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed">
        {t.backtest.opened(formatUtcDate(recentring.openedAt), inQuote(recentring.lowerPrice, recentring.upperPrice))}
      </p>

      {recentres.length === 0 ? (
        <p className="text-sm leading-relaxed">{copy.never}</p>
      ) : (
        <>
          <p className="text-sm leading-relaxed">{copy.recentredOn(dates)}</p>
          <p className="text-sm leading-relaxed">{fee}</p>
          {/*
           * Only where it is true, as the swap-cost panel says it: a hook
           * that may rewrite a swap's fee or take part of it makes the fee
           * charged here the curve's figure and nothing more.
           */}
          {disclosure.hookMayAlterSwaps ? <p className="text-sm leading-relaxed">{copy.hookMayAlter}</p> : null}

          <form method="get" action={form.action} className="flex flex-col gap-2">
            <input type="hidden" name={form.poolParameter} value={poolId} />
            {form.chain === undefined || form.chain === "ethereum" ? null : (
              <input type="hidden" name="chain" value={form.chain} />
            )}
            <input type="hidden" name={HORIZON_PARAMETER} value={String(parameters.horizonDays)} />
            <input type="hidden" name={MULTIPLIER_PARAMETER} value={String(parameters.standardDeviationMultiplier)} />
            <input type="hidden" name={DEPOSIT_PARAMETER} value={String(depositUsd)} />
            {form.requested.status === "usable" ? (
              <>
                <input type="hidden" name={LOWER_PARAMETER} value={form.requested.written.lower} />
                <input type="hidden" name={UPPER_PARAMETER} value={form.requested.written.upper} />
              </>
            ) : null}
            <div className="flex flex-wrap items-end gap-4">
              <Choice
                name={GAS_PARAMETER}
                label={copy.gasLabel}
                current={gas.perRecentreUsd}
                options={optionsIncluding(RECENTRE_GAS_CHOICES, gas.perRecentreUsd)}
                format={(value) => (value === 0 ? copy.gasNotCounted : usd(value))}
              />
              <button
                type="submit"
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-on transition-[filter] hover:brightness-110"
              >
                {copy.apply}
              </button>
            </div>
          </form>
          {form.gas?.status === "unusable" ? (
            <p className="text-sm leading-relaxed text-muted">{copy.gasUnusable}</p>
          ) : null}
          <p className="text-xs leading-relaxed text-muted">{copy.gasNote}</p>

          {/*
           * Hyphenated in the page's own language, because some of these
           * labels are one long word — Russian "перецентрирование" in capitals
           * is wider than half a phone — and a table that has to be scrolled
           * sideways to read two figures side by side has lost its point.
           */}
          <div className="scroll-hint overflow-x-auto">
            <table className="w-full text-sm hyphens-auto">
              <caption className="sr-only">{copy.tableCaption}</caption>
              <thead>
                <tr className="text-left text-xs uppercase tracking-widest text-muted">
                  <th scope="col" className="pr-4 pb-1 font-normal">{copy.columnFigure}</th>
                  <th scope="col" className="pr-4 pb-1 font-normal">{copy.columnRecentred}</th>
                  <th scope="col" className="pb-1 font-normal">{copy.columnNever}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="py-1 pr-4 text-left font-normal">{row.label}</th>
                    <td className="py-1 pr-4 font-mono">{row.recentred}</td>
                    <td className="py-1 font-mono text-muted">{row.never}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-relaxed text-muted">{copy.endValueNote}</p>
          {!disclosure.mayAttributeFeesToRange ? (
            <p className="text-xs leading-relaxed text-muted">{t.backtest.feesWithheld}</p>
          ) : withFees === null ? (
            <p className="text-xs leading-relaxed text-muted">{t.backtest.feesUnread}</p>
          ) : null}

          <p className="text-sm leading-relaxed">{copy.held(usd(recentring.heldUsd))}</p>
          <p className="text-sm font-medium leading-relaxed">
            {withFees === null
              ? copy.differenceBeforeFees(signed(outcome.differenceUsd))
              : copy.difference(signed(outcome.differenceUsd))}
          </p>

          <details className="flex flex-col gap-2">
            <summary className="cursor-pointer text-xs uppercase tracking-widest text-muted">{copy.showRecentres}</summary>
            <div className="scroll-hint mt-3 overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <caption className="sr-only">{copy.recentresCaption}</caption>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-widest text-muted">
                    <th scope="col" className="pr-6 pb-1 font-normal">{copy.columnDay}</th>
                    <th scope="col" className="pr-6 pb-1 font-normal">{copy.columnClose}</th>
                    <th scope="col" className="pr-6 pb-1 font-normal">{copy.columnRange}</th>
                    <th scope="col" className="pr-6 pb-1 font-normal">{copy.columnSwapped}</th>
                    <th scope="col" className="pb-1 font-normal">{copy.columnSwapFee}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentres.map((recentre) => (
                    <tr key={recentre.timestamp} className="font-mono">
                      <th scope="row" className="py-0.5 pr-6 text-left font-normal">{formatUtcDate(recentre.timestamp)}</th>
                      <td className="py-0.5 pr-6">{atClose(recentre.price)}</td>
                      <td className="py-0.5 pr-6">{edgesInQuote(recentre.lowerPrice, recentre.upperPrice)}</td>
                      <td className="py-0.5 pr-6">
                        {recentre.sold === "token0"
                          ? copy.swapped(usd(recentre.swappedUsd), symbols.token0, symbols.token1)
                          : copy.swapped(usd(recentre.swappedUsd), symbols.token1, symbols.token0)}
                      </td>
                      <td className="py-0.5">{usd(recentre.swapFeeUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}

      <p className="text-xs leading-relaxed text-muted">{copy.closesOnly}</p>
      {recentres.length === 0 ? null : <p className="text-xs leading-relaxed text-muted">{copy.noImpact}</p>}
      <p className="text-xs leading-relaxed text-muted">{copy.caveat}</p>
    </div>
  );
}

/**
 * What the pool actually charged, beside what it says it charges.
 *
 * In v3 the two are the same number and this panel says so, which is worth a
 * line: it is the one place the source's own arithmetic is checked rather than
 * repeated. In v4 they can differ by a factor of nine inside a month, and then
 * this is the only place the real rate appears.
 *
 * The verdict sentence is chosen by the calculator, not by a threshold applied
 * here — a component deciding what counts as agreement would be a second policy
 * in a second place, and the day the two disagreed nothing would say which.
 */
function RealizedFeePanel({
  result,
  disclosure,
  t,
  locale,
}: {
  result: RealizedFeeRateResult;
  disclosure: FeeDisclosure;
  t: Dictionary;
  locale: Locale;
}) {
  if (result.status === "unavailable") {
    return (
      <Panel id="realizedFee" title={t.realizedFee.heading}>
        <p className="text-sm leading-relaxed">{t.realizedFee.unavailableHeading}</p>
        <p className="text-sm leading-relaxed text-muted">{t.notices.failure[result.notice]}</p>
      </Panel>
    );
  }

  const { rate, verdict } = result;

  return (
    <Panel id="realizedFee" title={t.realizedFee.heading}>
      <p className="text-sm leading-relaxed">
        {verdict.kind === "matches"
          ? t.realizedFee.verdictMatches
          : verdict.kind === "none-stated"
            ? t.realizedFee.verdictNoneDeclared
            : t.realizedFee.verdictDiffers(
                formatWhole(verdict.daysDiffering, locale),
                formatWhole(rate.daysMeasured, locale),
              )}
      </p>

      <dl className={FIGURE_GRID}>
        {/*
         * What a swap pays by the pool's own terms: on v4 the key's fee and the
         * protocol's cut combined, which is what the measured rate is a
         * measurement of. The note says how the figure was arrived at where
         * there was arithmetic in it.
         */}
        <Figure
          label={t.realizedFee.declared}
          value={
            verdict.kind === "none-stated"
              ? t.realizedFee.noDeclared
              : formatStatedFee(verdict.stated, locale)
          }
          {...(verdict.kind === "none-stated"
            ? { note: t.realizedFee.noDeclaredNote }
            : disclosure.lpFeePpm !== null && takesProtocolFee(disclosure.protocolFee)
              ? {
                  note: t.realizedFee.statedNote(
                    formatFeePpm(disclosure.lpFeePpm, locale),
                    formatProtocolFee(disclosure.protocolFee, locale),
                  ),
                }
              : {})}
        />
        <Figure
          label={t.realizedFee.median}
          value={formatMeasuredFeePpm(rate.medianPpm, locale)}
        />
        <Figure
          label={t.realizedFee.spread}
          value={t.realizedFee.spreadValue(
            formatMeasuredFeePpm(rate.lowestPpm, locale),
            formatMeasuredFeePpm(rate.highestPpm, locale),
          )}
        />
        <Figure
          label={t.realizedFee.aggregate}
          value={formatMeasuredFeePpm(rate.aggregatePpm, locale)}
          note={t.realizedFee.aggregateNote}
        />
        <Figure
          label={t.realizedFee.daysMeasured}
          value={formatWhole(rate.daysMeasured, locale)}
          {...(rate.daysUnmeasurable === 0
            ? {}
            : {
                note: t.realizedFee.daysMeasuredNote(
                  formatWhole(rate.daysUnmeasurable, locale),
                ),
              })}
        />
      </dl>

      <p className="text-xs leading-relaxed text-muted">{t.realizedFee.intro}</p>

      {/* Only where it is true. A pool with no such hook is not owed the caveat. */}
      {disclosure.hookMayAlterSwaps ? (
        <p className="text-sm leading-relaxed">{t.realizedFee.notLpShare}</p>
      ) : null}
    </Panel>
  );
}

export function PoolRangeReport({
  result,
  poolId,
  controls,
  customRange,
  introducedAbove = false,
  t,
  locale,
}: {
  result: PoolRangeAnalysisResult;
  /** A v3 pool address or a v4 PoolId; shown only when there is no analysis. */
  poolId: string;
  /**
   * The form that changes the range, rendered directly under the figures it
   * changes — the horizon and the width — rather than after the whole report.
   * A slot rather than a component, because the page knows where the form
   * submits and this does not.
   */
  controls?: React.ReactNode;
  /**
   * Where the reader's own range is submitted, and what the URL asked for.
   * Without it there is no such panel — the comparison page, for one, has
   * nowhere for the form to go.
   */
  customRange?: CustomRangeForm | undefined;
  /**
   * Whether the page has already named this pool directly above the report.
   *
   * The v4 page puts a card first that is the pool's identity in full — the
   * pair, the id, and the fee read from the key, with far more said about a
   * hook-set fee than a one-line summary can. This report's own header would
   * then repeat all three, under a second heading identical to the first,
   * which a screen reader announces twice and a reader scrolls past twice.
   */
  introducedAbove?: boolean;
  t: Dictionary;
  locale: Locale;
}) {
  if (result.status === "unavailable") {
    const step: PoolRangeAnalysisStep = result.step;

    return (
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-card">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
            {t.report.noRangeHeading}
          </h2>
          <p className="text-sm leading-relaxed">{t.report.stoppedWhile(t.report.steps[step])}</p>
          <p className="text-sm leading-relaxed text-muted">{t.notices.failure[result.notice]}</p>
          <p className="font-mono text-xs text-muted">
            {poolId} · {result.reason}
          </p>
        </section>
        {controls}
      </div>
    );
  }

  const {
    pool,
    snapshot,
    history,
    volatility,
    band,
    range,
    divergence,
    activity,
    outOfSample,
    realizedFee,
    depositFeeShare,
    rangeOrders,
    swapDepth,
    backtest,
    customBacktest,
    recentring,
    parameters,
  } = result.data;
  const disclosure = feeDisclosureFor(pool);
  const warnings = result.status === "partial" ? result.warnings : [];

  /*
   * One direction for every price on the page, chosen once from the current
   * price. Everything below that shows a price shows it this way round, and
   * the technical details at the end show the pool's own.
   */
  const quote = choosePriceQuote(pool, band.currentPrice);
  const base = quote.base.symbol;
  const counter = quote.quote.symbol;
  const current = quotedPrice(quote, band.currentPrice);
  const edges = quotedInterval(quote, { lower: range.lowerPrice, upper: range.upperPrice });
  const distances = edgeDistances(current, edges);
  /*
   * Which of the *shown* edges was cut short. The flags name the pool's
   * edges, and inverting the quote renames them: where the pool's price can
   * go no higher is where the reader's can go no lower.
   */
  const truncated = quotedEnds(quote, {
    lower: range.lowerBoundTruncated,
    upper: range.upperBoundTruncated,
  });
  /*
   * The last month drawn through the range: the same days the activity
   * figures are counted over, turned the reader's way round. A truncated
   * edge is left open — the band runs off the chart on that side, which is
   * what an edge the pool could not express means — rather than drawn at a
   * price forty orders of magnitude away.
   */
  const month = chartDays(history.points.slice(-ACTIVITY_WINDOW_DAYS), quote, range);
  const chart = layoutPriceChart({
    days: month,
    lower: truncated.lower ? null : edges.lower,
    upper: truncated.upper ? null : edges.upper,
    current,
  });
  /* The comparison table, in the same direction, still ascending. */
  const divergencePoints = divergence.points.map((point) => ({
    price: quotedPrice(quote, point.price),
    lossRatio: point.lossRatio,
  }));
  if (quote.inverted) divergencePoints.reverse();

  const price = (value: number) => formatPrice(value, locale);
  const percent = (ratio: number) => formatPercent(ratio, locale);
  const whole = (value: number) => formatWhole(value, locale);
  const widthInTicks = range.upperTick - range.lowerTick;
  /* A computed interval as the page writes ranges: shown direction, both ends, both symbols. */
  const inQuote = (lower: number, upper: number) => {
    const shown = quotedInterval(quote, { lower, upper });
    return t.report.rangeValue(price(shown.lower), price(shown.upper), counter, base);
  };
  /* The same, shorter, for a table cell, as the widths table writes one. */
  const edgesInQuote = (lower: number, upper: number) => {
    const shown = quotedInterval(quote, { lower, upper });
    return `${price(shown.lower)} – ${price(shown.upper)} ${counter}`;
  };
  const atClose = (close: number) => `${price(quotedPrice(quote, close))} ${counter}`;
  /*
   * The two one-sided halves of the range, quoted like everything else.
   *
   * Which half sells and which buys is decided by comparing the quoted average
   * against the quoted current price, not by the leg's own name. The names are
   * the pool's — "above" means above *its* price — and inverting the quote turns
   * the pool's upper half into the reader's lower one. Reading the label off the
   * figures rather than off the name is what keeps the two from swapping when a
   * pair is shown the other way round.
   */
  const quotedLegs =
    rangeOrders.status !== "success"
      ? []
      : [rangeOrders.data.above, rangeOrders.data.below]
          .filter((entry) => entry !== null)
          .map((entry) => ({
            edges: quotedInterval(quote, { lower: entry.lowerPrice, upper: entry.upperPrice }),
            average: quotedPrice(quote, entry.averagePrice),
          }));
  const sellingLeg = quotedLegs.find((entry) => entry.average > current) ?? null;
  const buyingLeg = quotedLegs.find((entry) => entry.average < current) ?? null;

  /* Every offered width beside the chosen one, in the same direction as everything else. */
  const widths = compareWidths(result.data).map((row) => ({
    ...row,
    label: t.parameters.widthChoice(
      t.parameters.sigma(formatMultiplier(row.standardDeviationMultiplier, locale)),
      widthWord(row.standardDeviationMultiplier, t),
    ),
    edges: quotedInterval(quote, { lower: row.range.lowerPrice, upper: row.range.upperPrice }),
  }));

  return (
    <div className="flex flex-col gap-6">
      {introducedAbove ? null : (
        <header className="flex flex-col gap-2">
          <h2 className="text-3xl font-semibold tracking-tight">
            {pool.token0.symbol} / {pool.token1.symbol}
          </h2>
          <p className="text-sm leading-relaxed text-muted">
            {t.report.poolSummary(
              pool.protocolVersion,
              disclosure.lpFeePpm === null
                ? t.report.noDeclaredFee
                : takesProtocolFee(disclosure.protocolFee)
                  ? t.report.feePlusProtocol(
                      formatFeePpm(disclosure.lpFeePpm, locale),
                      formatProtocolFee(disclosure.protocolFee, locale),
                    )
                  : t.report.feePerSwap(formatFeePpm(disclosure.lpFeePpm, locale)),
              chainLabel(pool.chainId, locale),
            )}
          </p>
          <p className="break-all font-mono text-xs text-muted">{pool.id}</p>
        </header>
      )}

      {warnings.length === 0 ? null : (
        <aside
          aria-label={t.report.caveatsAriaLabel}
          className="rounded-lg border border-warning-border bg-warning-surface px-4 py-3 text-sm text-warning-foreground"
        >
          <p className="font-medium">{t.report.caveatsHeading(warnings.length)}</p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
            {warnings.map((warning) => (
              <li key={warning} className="leading-relaxed">
                {t.notices.warning[warning]}
              </li>
            ))}
          </ul>
        </aside>
      )}

      {/*
       * The range, as two prices, first. It is what a reader came for and what
       * they would type into a position; everything after it says where it
       * came from and what it is not.
       */}
      <Panel id="range" title={t.report.rangeHeading}>
        <p className="text-sm leading-relaxed text-muted">{t.report.rangeIntro(base, counter)}</p>
        <p className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
          {t.report.rangeValue(price(edges.lower), price(edges.upper), counter, base)}
        </p>
        {/*
         * Only while the price is between the edges. "Minus two percent below"
         * is not a sentence, and the box beneath already says the price is
         * outside.
         */}
        {range.containsCurrentPrice ? (
          <p className="text-sm leading-relaxed">
            {t.report.rangeDistances(percent(distances.down), percent(distances.up))}
          </p>
        ) : null}

        {chart === null ? null : (
          <figure className="flex flex-col gap-2">
            <PriceHistoryChart
              layout={chart}
              labels={{
                current: price(current),
                upper: price(edges.upper),
                lower: price(edges.lower),
                first: month[0]?.date ?? "",
                last: month[month.length - 1]?.date ?? "",
              }}
              label={t.report.chartLabel}
            />
            <figcaption className="text-xs leading-relaxed text-muted">
              {t.report.chartCaption(whole(month.length))} {t.report.chartLegend}
            </figcaption>
          </figure>
        )}

        <div
          className={
            range.containsCurrentPrice
              ? "flex flex-col gap-1 rounded-md border border-border bg-surface-sunken px-4 py-3 text-sm"
              : "flex flex-col gap-1 rounded-md border border-warning-border bg-warning-surface px-4 py-3 text-sm text-warning-foreground"
          }
        >
          <p>
            <span className="text-muted">{t.report.currentPrice}</span>{" "}
            <span className="font-mono font-medium">
              {t.report.priceSentence(base, price(current), counter)}
            </span>
          </p>
          <p className="leading-relaxed">
            {range.containsCurrentPrice ? t.report.inRangeYes : t.report.inRangeNo}{" "}
            {range.containsCurrentPrice ? t.report.inRangeYesNote : t.report.inRangeNoNote}
          </p>
        </div>

        <p className="text-sm leading-relaxed">{t.report.rangeMeaning}</p>
        <p className="text-sm leading-relaxed">
          {t.report.beyondEdges(heldBelowRange(quote).symbol, heldAboveRange(quote).symbol)}
        </p>
        {truncated.lower ? (
          <p className="text-xs leading-relaxed text-muted">{t.report.lowerTruncatedNote}</p>
        ) : null}
        {truncated.upper ? (
          <p className="text-xs leading-relaxed text-muted">{t.report.upperTruncatedNote}</p>
        ) : null}
      </Panel>

      {/*
       * Where it came from, in the words a reader has. The labels of the two
       * knobs are the labels of the form below, so a reader changing one can
       * see which figure they are changing.
       */}
      <Contents
        t={t}
        locale={locale}
        absent={[
          ...(backtest === null ? (["backtest"] as const) : []),
          ...(backtest === null || customRange === undefined ? (["customRange"] as const) : []),
          ...(customRange === undefined ? (["recentring"] as const) : []),
        ]}
      />

      <Panel id="basis" title={t.report.basisHeading}>
        <p className="text-sm leading-relaxed text-muted">
          {t.report.basisIntro(base, whole(volatility.expectedReturnCount))}
        </p>
        <dl className={FIGURE_GRID}>
          <Figure
            label={t.report.dailyMove}
            value={percent(volatility.dailyVolatility)}
            note={t.report.dailyMoveNote}
          />
          <Figure
            label={t.parameters.horizonLabel}
            value={t.parameters.days(whole(parameters.horizonDays))}
          />
          <Figure
            label={t.report.horizonMove(whole(parameters.horizonDays))}
            value={percent(band.horizonVolatility)}
            note={t.report.horizonMoveNote}
          />
          <Figure
            label={t.parameters.widthLabel}
            value={t.report.widthValue(
              formatMultiplier(parameters.standardDeviationMultiplier, locale),
            )}
            note={t.report.widthNote}
          />
          <Figure
            label={t.report.measuredOver}
            value={`${formatUtcDate(volatility.rangeStart)} → ${formatUtcDate(volatility.rangeEndExclusive)}`}
            note={t.report.measuredOverNote(whole(volatility.usableReturnCount))}
          />
        </dl>
        <p className="text-sm leading-relaxed text-muted">{t.report.epilogue}</p>
      </Panel>

      {controls}

      {/*
       * The form above changes one width at a time; this shows all of them at
       * once, computed the way the page computes its own. Two day counts per
       * width, and the note says which is the fit and which is the check.
       */}
      <Panel id="widths" title={t.widths.heading}>
        <p className="text-sm leading-relaxed text-muted">{t.widths.intro}</p>
        <div className="scroll-hint overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <caption className="sr-only">{t.widths.heading}</caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-muted">
                <th scope="col" className="pr-4 pb-2 font-normal">{t.widths.width}</th>
                <th scope="col" className="pr-4 pb-2 font-normal">{t.widths.range}</th>
                <th scope="col" className="pr-4 pb-2 font-normal">{t.widths.recent(whole(activity.daysMeasured))}</th>
                <th scope="col" className="pr-4 pb-2 font-normal">{t.widths.unseen}</th>
                <th scope="col" className="pb-2 font-normal">{t.widths.feeShare}</th>
              </tr>
            </thead>
            <tbody>
              {widths.map((row) => (
                <tr
                  key={row.standardDeviationMultiplier}
                  className={row.chosen ? "font-medium" : "text-muted"}
                  data-chosen={row.chosen ? "true" : undefined}
                >
                  <th scope="row" className="py-1 pr-4 text-left font-medium">
                    {row.label}
                    {row.chosen ? ` · ${t.widths.chosen}` : ""}
                  </th>
                  <td className="py-1 pr-4 font-mono">
                    {price(row.edges.lower)} – {price(row.edges.upper)} {counter}
                  </td>
                  <td className="py-1 pr-4 font-mono">
                    {t.widths.insideOf(whole(row.occupancy.fullyInside), whole(row.daysMeasured))}
                  </td>
                  <td className="py-1 pr-4 font-mono">
                    {row.outOfSample === null
                      ? t.widths.unseenNone
                      : t.widths.insideOf(
                          whole(row.outOfSample.occupancy.fullyInside),
                          whole(row.outOfSample.daysMeasured),
                        )}
                  </td>
                  <td className="py-1 font-mono">
                    {row.relativeFeeShare === null
                      ? ABSENT
                      : t.widths.feeShareValue(formatMultiplier(row.relativeFeeShare, locale))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs leading-relaxed text-muted">{t.widths.columnsNote}</p>
        <p className="text-xs leading-relaxed text-muted">{t.widths.feeShareNote}</p>
        <p className="text-sm leading-relaxed">{t.widths.notAdvice}</p>
      </Panel>

      <Panel id="activity" title={t.activity.heading}>
        <dl className={FIGURE_GRID}>
          <Figure label={t.activity.tvl} value={formatUsd(snapshot.tvlUsd, locale)} />
          <Figure label={t.activity.volume24h} value={formatUsd(activity.volume24hUsd, locale)} />
          <Figure label={t.activity.volume7d} value={formatUsd(activity.volume7dUsd, locale)} />
          <Figure label={t.activity.volume30d} value={formatUsd(activity.volume30dUsd, locale)} />
          <Figure
            label={t.activity.fees30d}
            value={formatUsd(activity.fees30dUsd, locale)}
            note={t.activity.feesNote}
          />
          {/*
           * Withheld rather than shown when the pool's hook may take a share of
           * a swap. The fees above it are what the pool charged and stay; this
           * one ties a portion of them to the range, which is the step a reader
           * turns into an expectation — and the source does not separate the
           * hook's share from the providers'.
           */}
          <Figure
            label={t.activity.feesWhileInside}
            value={
              disclosure.mayAttributeFeesToRange
                ? formatUsd(activity.feesWhileFullyInsideUsd, locale)
                : t.activity.feesWithheld
            }
            {...(disclosure.mayAttributeFeesToRange
              ? {}
              : { note: t.activity.feesWithheldNote })}
          />
        </dl>

        <p className="text-sm leading-relaxed">
          {t.activity.occupancySentence(
            whole(activity.daysMeasured),
            whole(activity.occupancy.fullyInside),
            whole(activity.occupancy.fullyOutside),
            whole(activity.occupancy.undetermined),
          )}
        </p>
        {activity.occupancy.undetermined === 0 ? null : (
          <p className="text-xs leading-relaxed text-muted">{t.activity.undeterminedNote}</p>
        )}
        <p className="text-xs leading-relaxed text-muted">{t.activity.inSample}</p>
        <p className="text-sm leading-relaxed">{t.activity.notYourEarnings}</p>
      </Panel>

      {/*
       * Directly under the fees it divides up, because it is the same figure
       * with one division applied — and because the sentence above it says so.
       *
       * Withheld on exactly the pools the figure above it is withheld on, and
       * through the same flag. A share of a total nobody may attribute to the
       * range is not something this page knows how to attribute either, and
       * showing it here after refusing it there would be the same claim made
       * quietly.
       */}
      <Panel id="deposit" title={t.deposit.heading}>
        {depositFeeShare.status !== "success" ? (
          <>
            <p className="text-sm leading-relaxed">{t.deposit.unavailable}</p>
            <p className="text-sm leading-relaxed text-muted">
              {t.notices.failure[depositFeeShare.notice]}
            </p>
          </>
        ) : !disclosure.mayAttributeFeesToRange ? (
          <>
            <p className="text-sm leading-relaxed">{t.activity.feesWithheld}</p>
            <p className="text-sm leading-relaxed text-muted">{t.deposit.withheldNote}</p>
          </>
        ) : (
          <>
            <dl className={FIGURE_GRID}>
              <Figure
                label={t.deposit.deposited}
                value={formatUsd(depositFeeShare.data.depositUsd, locale)}
                note={t.deposit.depositedNote}
              />
              <Figure
                label={t.deposit.collected}
                value={formatUsd(depositFeeShare.data.depositFeesUsd, locale)}
                note={t.deposit.collectedNote(whole(depositFeeShare.data.daysCounted))}
              />
              <Figure
                label={t.deposit.ofDeposit}
                value={percent(depositFeeShare.data.shareOfDeposit)}
                note={t.deposit.ofDepositNote}
              />
            </dl>

            <p className="text-sm leading-relaxed">
              {t.deposit.sentence(
                formatUsd(depositFeeShare.data.depositUsd, locale),
                whole(depositFeeShare.data.daysCounted),
                formatUsd(depositFeeShare.data.poolFeesUsd, locale),
                formatUsd(depositFeeShare.data.depositFeesUsd, locale),
              )}
            </p>
            {depositFeeShare.data.daysUnmeasurable === 0 ? null : (
              <p className="text-xs leading-relaxed text-muted">
                {t.deposit.unmeasurableNote(whole(depositFeeShare.data.daysUnmeasurable))}
              </p>
            )}
            <p className="text-sm leading-relaxed">{t.deposit.dilution}</p>
            <p className="text-xs leading-relaxed text-muted">{t.deposit.caveat}</p>
          </>
        )}
      </Panel>

      {/*
       * Directly under the fees it explains. In v3 this panel confirms what the
       * tier already said; in v4 it is often the only place the real rate
       * appears, because the tier and the rate stopped being the same number.
       */}
      <RealizedFeePanel result={realizedFee} disclosure={disclosure} t={t} locale={locale} />

      {/*
       * The check that does test something, after the figures that do not. The
       * verdict leads; the rows behind it are folded away for a reader who
       * wants to know whether the total rests on a single lucky month.
       */}
      {outOfSample.status !== "success" ? (
        <Panel id="outOfSample" title={t.outOfSample.heading}>
          <p className="text-sm leading-relaxed">{t.outOfSample.unavailableHeading}</p>
          <p className="text-sm leading-relaxed text-muted">
            {t.notices.failure[outOfSample.notice]}
          </p>
        </Panel>
      ) : (
        <Panel id="outOfSample" title={t.outOfSample.heading}>
          <p className="text-sm leading-relaxed">
            {t.outOfSample.verdict(
              whole(outOfSample.data.occupancy.fullyInside),
              whole(outOfSample.data.daysMeasured),
              whole(outOfSample.data.folds.length),
            )}
          </p>
          <p className="text-sm leading-relaxed text-muted">
            {t.outOfSample.intro(t.parameters.days(whole(outOfSample.data.horizonDays)))}
          </p>

          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Figure
              label={t.outOfSample.folds}
              value={whole(outOfSample.data.folds.length)}
              note={t.outOfSample.foldsNote}
            />
            <Figure
              label={t.outOfSample.fullyInside}
              value={whole(outOfSample.data.occupancy.fullyInside)}
            />
            <Figure
              label={t.outOfSample.fullyOutside}
              value={whole(outOfSample.data.occupancy.fullyOutside)}
            />
            <Figure
              label={t.outOfSample.undetermined}
              value={whole(outOfSample.data.occupancy.undetermined)}
            />
          </dl>

          <details className="flex flex-col gap-2">
            <summary className="cursor-pointer text-xs uppercase tracking-widest text-muted">
              {t.outOfSample.showFolds}
            </summary>
            {/* One row per fold, oldest first, so a run of them can be scanned. */}
            <div className="scroll-hint mt-3 overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <caption className="sr-only">{t.outOfSample.foldsCaption}</caption>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-widest text-muted">
                    <th scope="col" className="pr-6 pb-1 font-normal">{t.outOfSample.foldPeriod}</th>
                    <th scope="col" className="pr-6 pb-1 font-normal">{t.outOfSample.foldVolatility}</th>
                    <th scope="col" className="pb-1 font-normal">{t.outOfSample.foldVerdict}</th>
                  </tr>
                </thead>
                <tbody>
                  {outOfSample.data.folds.map((fold) => (
                    <tr key={fold.measuredRangeStart} className="font-mono">
                      <th scope="row" className="py-0.5 pr-6 text-left font-normal">
                        {formatUtcDate(fold.measuredRangeStart)} →{" "}
                        {formatUtcDate(fold.measuredRangeEndExclusive)}
                      </th>
                      <td className="py-0.5 pr-6 text-muted">{percent(fold.annualizedVolatility)}</td>
                      <td className="py-0.5">
                        {whole(fold.occupancy.fullyInside)} / {whole(fold.occupancy.fullyOutside)} /{" "}
                        {whole(fold.occupancy.undetermined)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">{t.outOfSample.foldColumns}</p>
          </details>

          <p className="text-xs leading-relaxed text-muted">{t.outOfSample.notHeld}</p>
          <p className="text-xs leading-relaxed text-muted">{t.outOfSample.notIndependent}</p>
        </Panel>
      )}

      {/*
       * The same method, replayed as if a position had been opened at the
       * start of the last month — after the check that tests the method, and
       * before the curve that explains the worth-against-holding figure in it.
       */}
      {backtest === null ? null : (
        <BacktestPanel
          backtest={backtest}
          depositUsd={result.data.depositUsd}
          attributesFees={disclosure.mayAttributeFeesToRange}
          inQuote={inQuote}
          t={t}
          locale={locale}
        />
      )}

      {/*
       * The reader's own range, straight after the month it is compared with,
       * and only where that month could be replayed: the same history refuses
       * both, and a form for a replay that cannot run would be a form for
       * nothing.
       */}
      {backtest === null || customRange === undefined ? null : (
        <CustomRangePanel
          custom={customBacktest}
          suggested={backtest}
          requested={customRange.requested}
          form={customRange}
          poolId={poolId}
          parameters={parameters}
          depositUsd={result.data.depositUsd}
          attributesFees={disclosure.mayAttributeFeesToRange}
          unit={t.technical.quotePerBase(counter, base)}
          inQuote={inQuote}
          t={t}
          locale={locale}
        />
      )}

      {/*
       * The strategy that moves the range, after the two that do not, on
       * every page that can submit its cost. Where the month cannot be
       * replayed it says so rather than vanishing: a reader looking for it
       * should learn why it is empty.
       */}
      {customRange === undefined ? null : (
        <RecentringPanel
          recentring={recentring}
          suggested={backtest}
          form={customRange}
          poolId={poolId}
          parameters={parameters}
          depositUsd={result.data.depositUsd}
          disclosure={disclosure}
          symbols={{ token0: pool.token0.symbol, token1: pool.token1.symbol }}
          inQuote={inQuote}
          edgesInQuote={edgesInQuote}
          atClose={atClose}
          t={t}
          locale={locale}
        />
      )}

      <Panel id="divergence" title={t.divergence.heading}>
        <p className="text-sm leading-relaxed">{t.divergence.intro}</p>

        <table className="w-full text-sm">
          <caption className="sr-only">{t.divergence.heading}</caption>
          <thead>
            <tr className="text-xs uppercase tracking-widest text-muted">
              <th scope="col" className="pb-1 text-left font-normal">{t.divergence.price(base)}</th>
              <th scope="col" className="pb-1 text-right font-normal">{t.divergence.loss}</th>
            </tr>
          </thead>
          <tbody>
            {divergencePoints.map((point) => (
              <tr key={point.price} className="font-mono">
                <th scope="row" className="py-0.5 text-left font-normal">
                  {price(point.price)} {counter}
                </th>
                <td className="py-0.5 text-right">{percent(point.lossRatio)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-xs leading-relaxed text-muted">{t.divergence.entryRow}</p>
        <p className="text-xs leading-relaxed text-muted">{t.divergence.impermanentNote}</p>
      </Panel>

      {/*
       * Last of the panels that interpret anything, because it is about a
       * different use of the same range rather than another property of it: the
       * figures above describe holding it, and this describes passing through
       * it.
       */}
      <Panel id="rangeOrder" title={t.rangeOrder.heading}>
        {rangeOrders.status !== "success" ? (
          <>
            <p className="text-sm leading-relaxed">{t.rangeOrder.unavailable}</p>
            <p className="text-sm leading-relaxed text-muted">
              {t.notices.failure[rangeOrders.notice]}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed">{t.rangeOrder.intro}</p>

            <dl className={FIGURE_GRID}>
              {sellingLeg === null ? null : (
                <>
                  <Figure
                    label={t.rangeOrder.selling(base)}
                    value={t.report.rangeValue(
                      price(sellingLeg.edges.lower),
                      price(sellingLeg.edges.upper),
                      counter,
                      base,
                    )}
                    note={t.rangeOrder.bandNote}
                  />
                  <Figure
                    label={t.rangeOrder.average}
                    value={t.report.priceSentence(base, price(sellingLeg.average), counter)}
                    note={t.rangeOrder.averageNote}
                  />
                  <Figure
                    label={t.rangeOrder.against}
                    value={percent(sellingLeg.average / current - 1)}
                  />
                </>
              )}
              {buyingLeg === null ? null : (
                <>
                  <Figure
                    label={t.rangeOrder.buying(base)}
                    value={t.report.rangeValue(
                      price(buyingLeg.edges.lower),
                      price(buyingLeg.edges.upper),
                      counter,
                      base,
                    )}
                    note={t.rangeOrder.bandNote}
                  />
                  <Figure
                    label={t.rangeOrder.average}
                    value={t.report.priceSentence(base, price(buyingLeg.average), counter)}
                    note={t.rangeOrder.averageNote}
                  />
                  <Figure
                    label={t.rangeOrder.against}
                    value={percent(buyingLeg.average / current - 1)}
                  />
                </>
              )}
            </dl>

            <p className="text-sm leading-relaxed">{t.rangeOrder.exact}</p>
            <p className="text-sm leading-relaxed">{t.rangeOrder.onlyIfThrough}</p>
            <p className="text-xs leading-relaxed text-muted">{t.rangeOrder.notAnOrderBook}</p>
          </>
        )}
      </Panel>

      {/*
       * The other side of the trade, directly under the panel whose arithmetic
       * it shares. Labelled by which token goes in rather than by the shown
       * direction: an amount of a token is the same amount whichever way round
       * the pair is quoted, so nothing here has to be inverted.
       */}
      <Panel id="swapDepth" title={t.swapDepth.heading}>
        {swapDepth.status !== "success" ? (
          <>
            <p className="text-sm leading-relaxed">{t.swapDepth.unavailable}</p>
            <p className="text-sm leading-relaxed text-muted">
              {t.notices.failure[swapDepth.notice]}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed">{t.swapDepth.intro}</p>

            {/*
             * Directly under the sentence it qualifies. The intro says a swap
             * inside the step is priced "with nothing assumed", which is true of
             * the curve and is exactly what a swap-altering hook makes false: it
             * can rewrite the fee, price the swap itself, or take a share after.
             *
             * Through the same flag every fee figure on this page already obeys.
             * The hook's own section says outright that figures drawn from the
             * curve are not safe here, and this was the one panel presenting a
             * swap's cost that never heard it — the most direct of them all,
             * since it is literally what a swap costs.
             */}
            {disclosure.hookMayAlterSwaps ? (
              <p className="text-sm leading-relaxed">{t.swapDepth.hookMayAlter}</p>
            ) : null}

            <dl className={FIGURE_GRID}>
              {[swapDepth.data.sellingToken0, swapDepth.data.sellingToken1].map((entry) =>
                entry === null ? null : (
                  <Fragment key={entry.tokenIn}>
                    <Figure
                      label={t.swapDepth.selling(
                        entry.tokenIn === "token0" ? pool.token0.symbol : pool.token1.symbol,
                      )}
                      value={t.swapDepth.amount(
                        formatEtherAmount(entry.amountIn, locale),
                        entry.tokenIn === "token0" ? pool.token0.symbol : pool.token1.symbol,
                      )}
                      note={t.swapDepth.largestNote}
                    />
                    <Figure
                      label={t.swapDepth.cost}
                      value={percent(entry.costRatio)}
                      note={t.swapDepth.costNote}
                    />
                  </Fragment>
                ),
              )}
            </dl>

            {swapDepth.data.sellingToken0 !== null && swapDepth.data.sellingToken1 !== null ? null : (
              <p className="text-sm leading-relaxed">{t.swapDepth.oneSideOnly}</p>
            )}
            <p className="text-sm leading-relaxed">{t.swapDepth.geometric}</p>
            <p className="text-xs leading-relaxed text-muted">{t.swapDepth.whyItDiffers}</p>
          </>
        )}
      </Panel>

      {/*
       * Everything a reader checking the page would want, folded away at the
       * end: the ticks the prices above encode, the pool's own direction, the
       * blocks the figures were read at.
       */}
      <details id="technical" className="scroll-mt-4 rounded-xl border border-border bg-surface p-5 shadow-card">
        <summary className="cursor-pointer text-sm font-semibold uppercase tracking-widest text-muted">
          {t.technical.heading}
        </summary>
        <p className="mt-3 text-sm leading-relaxed text-muted">{t.technical.summary}</p>
        <dl className={`mt-4 ${FIGURE_GRID}`}>
          <Figure label={t.technical.lowerTick} value={formatTick(range.lowerTick, locale)} />
          <Figure label={t.technical.upperTick} value={formatTick(range.upperTick, locale)} />
          <Figure
            label={t.technical.currentTick}
            value={formatTick(range.currentTick, locale)}
            note={
              range.chainReportedTick === null
                ? t.technical.noSourceTick
                : t.technical.sourceReportedTick(formatTick(range.chainReportedTick, locale))
            }
          />
          <Figure
            label={t.technical.tickSpacing}
            value={whole(pool.tickSpacing)}
            note={t.technical.tickSpacingNote(percent(priceStepRatio(pool.tickSpacing)))}
          />
          <Figure
            label={t.technical.width}
            value={t.technical.widthValue(
              whole(widthInTicks),
              whole(widthInTicks / pool.tickSpacing),
            )}
          />
          <Figure
            label={t.technical.poolPrice}
            value={price(band.currentPrice)}
            note={t.technical.quotePerBase(pool.token1.symbol, pool.token0.symbol)}
          />
          <Figure
            label={t.technical.bandLower}
            value={price(band.lowerPrice)}
            note={t.technical.bandNote}
          />
          <Figure label={t.technical.bandUpper} value={price(band.upperPrice)} />
          <Figure
            label={t.technical.annualised}
            value={percent(volatility.annualizedVolatility)}
            note={t.technical.annualisedNote}
          />
          <Figure
            label={t.technical.coverage}
            value={percent(volatility.returnCoverageRatio)}
            note={t.technical.coverageNote}
          />
          <Figure
            label={t.technical.sourceBlock}
            value={snapshot.sourceBlockNumber ?? ABSENT}
            note={
              snapshot.sourceBlockTimestamp === null
                ? t.technical.noBlockTime
                : formatUtcMinute(snapshot.sourceBlockTimestamp)
            }
          />
          <Figure
            label={t.technical.fetchedAt}
            value={formatUtcMinute(snapshot.fetchedAt)}
            note={t.technical.fetchedAtNote}
          />
          <Figure
            label={t.technical.lowerEdge}
            value={range.lowerBoundTruncated ? t.technical.truncated : t.technical.asAsked}
          />
          <Figure
            label={t.technical.upperEdge}
            value={range.upperBoundTruncated ? t.technical.truncated : t.technical.asAsked}
          />
        </dl>
      </details>
    </div>
  );
}
