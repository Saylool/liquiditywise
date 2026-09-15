import { feeDisclosureFor } from "../lib/advisor/feeDisclosure";
import type {
  PoolRangeAnalysisResult,
  PoolRangeAnalysisStep,
} from "../lib/advisor/poolRangeAnalysis";
import type { RealizedFeeRateResult } from "../lib/analytics/realizedFeeRate";
import {
  ABSENT,
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
import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";

/**
 * Renders one pool's tick-range analysis.
 *
 * Presentational only: it fetches nothing, computes nothing, and holds no
 * credential. Every figure comes from the result it is handed, and every figure
 * it cannot show is shown as absent rather than as a zero.
 *
 * Both the words and the numbers follow the reader's language — a translated
 * page that still writes "0.30%" to a Turkish reader is only half translated.
 *
 * The warnings are the exception. They arrive from the data layer as fixed
 * sentences and are rendered as they come, in English, because making them
 * translatable means turning them into codes down there rather than text up
 * here.
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

/** A titled panel of `Figure`s. Its children are description-list entries. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel title={title}>
      <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
    </Panel>
  );
}

/**
 * The same panel without the description list.
 *
 * Extracted because two sections carry prose alongside their figures, and a
 * paragraph is not a valid child of `<dl>` — which is what they were until the
 * markup was read back.
 */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">{title}</h2>
      {children}
    </section>
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
  hookMayAlterSwaps,
  t,
  locale,
}: {
  result: RealizedFeeRateResult;
  hookMayAlterSwaps: boolean;
  t: Dictionary;
  locale: Locale;
}) {
  if (result.status === "unavailable") {
    return (
      <Panel title={t.realizedFee.heading}>
        <p className="text-sm leading-relaxed">{t.realizedFee.unavailableHeading}</p>
        <p className="text-sm leading-relaxed text-muted">{t.notices.failure[result.notice]}</p>
      </Panel>
    );
  }

  const { rate, verdict } = result;

  return (
    <Panel title={t.realizedFee.heading}>
      <p className="text-sm leading-relaxed text-muted">{t.realizedFee.intro}</p>

      <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Figure
          label={t.realizedFee.declared}
          value={
            verdict.kind === "none-declared"
              ? t.realizedFee.noDeclared
              : formatFeePpm(verdict.declaredPpm, locale)
          }
          {...(verdict.kind === "none-declared"
            ? { note: t.realizedFee.noDeclaredNote }
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

      <p className="text-sm leading-relaxed">
        {verdict.kind === "matches"
          ? t.realizedFee.verdictMatches
          : verdict.kind === "none-declared"
            ? t.realizedFee.verdictNoneDeclared
            : t.realizedFee.verdictDiffers(
                formatWhole(verdict.daysDiffering, locale),
                formatWhole(rate.daysMeasured, locale),
              )}
      </p>

      {/* Only where it is true. A pool with no such hook is not owed the caveat. */}
      {hookMayAlterSwaps ? (
        <p className="text-sm leading-relaxed">{t.realizedFee.notLpShare}</p>
      ) : null}
    </Panel>
  );
}

export function PoolRangeReport({
  result,
  poolId,
  t,
  locale,
}: {
  result: PoolRangeAnalysisResult;
  /** A v3 pool address or a v4 PoolId; shown only when there is no analysis. */
  poolId: string;
  t: Dictionary;
  locale: Locale;
}) {
  if (result.status === "unavailable") {
    const step: PoolRangeAnalysisStep = result.step;

    return (
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
          {t.report.noRangeHeading}
        </h2>
        <p className="text-sm leading-relaxed">{t.report.stoppedWhile(t.report.steps[step])}</p>
        <p className="text-sm leading-relaxed text-muted">{t.notices.failure[result.notice]}</p>
        <p className="font-mono text-xs text-muted">
          {poolId} · {result.reason}
        </p>
      </section>
    );
  }

  const {
    pool,
    snapshot,
    volatility,
    band,
    range,
    divergence,
    activity,
    outOfSample,
    realizedFee,
    parameters,
  } = result.data;
  const disclosure = feeDisclosureFor(pool);
  const warnings = result.status === "partial" ? result.warnings : [];

  const base = pool.token0.symbol;
  const quote = pool.token1.symbol;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {base} / {quote}
        </h1>
        <p className="font-mono text-xs text-muted">{pool.id}</p>
        <p className="text-sm leading-relaxed text-muted">
          {t.report.poolSummary(
            pool.protocolVersion,
            disclosure.declaredPpm === null
              ? t.report.noDeclaredFee
              : formatFeePpm(disclosure.declaredPpm, locale),
            formatWhole(pool.tickSpacing, locale),
          )}
        </p>
      </header>

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

      <Section title={t.report.rangeHeading}>
        <Figure
          label={t.report.lowerTick}
          value={formatTick(range.lowerTick, locale)}
          note={t.report.priceAt(formatPrice(range.lowerPrice, locale), quote, base)}
        />
        <Figure
          label={t.report.upperTick}
          value={formatTick(range.upperTick, locale)}
          note={t.report.priceAt(formatPrice(range.upperPrice, locale), quote, base)}
        />
        <Figure
          label={t.report.width}
          value={t.report.widthValue(formatWhole(range.upperTick - range.lowerTick, locale))}
          note={t.report.widthNote(
            formatWhole((range.upperTick - range.lowerTick) / pool.tickSpacing, locale),
            formatWhole(pool.tickSpacing, locale),
          )}
        />
        <Figure
          label={t.report.inRange}
          value={range.containsCurrentPrice ? t.report.yes : t.report.no}
          note={range.containsCurrentPrice ? t.report.inRangeNote : t.report.outOfRangeNote}
        />
        <Figure
          label={t.report.lowerEdge}
          value={range.lowerBoundTruncated ? t.report.truncated : t.report.asAsked}
          {...(range.lowerBoundTruncated ? { note: t.report.lowerTruncatedNote } : {})}
        />
        <Figure
          label={t.report.upperEdge}
          value={range.upperBoundTruncated ? t.report.truncated : t.report.asAsked}
          {...(range.upperBoundTruncated ? { note: t.report.upperTruncatedNote } : {})}
        />
      </Section>

      <Section title={t.report.currentStateHeading}>
        <Figure
          label={t.report.tokenPrice(base)}
          value={formatPrice(band.currentPrice, locale)}
          note={t.report.quotePerBase(quote, base)}
        />
        <Figure
          label={t.report.currentTick}
          value={formatTick(range.currentTick, locale)}
          note={
            range.chainReportedTick === null
              ? t.report.noSourceTick
              : t.report.sourceReportedTick(formatTick(range.chainReportedTick, locale))
          }
        />
        <Figure label={t.report.tvl} value={formatUsd(snapshot.tvlUsd, locale)} />
        <Figure
          label={t.report.sourceBlock}
          value={snapshot.sourceBlockNumber ?? ABSENT}
          note={
            snapshot.sourceBlockTimestamp === null
              ? t.report.noBlockTime
              : formatUtcMinute(snapshot.sourceBlockTimestamp)
          }
        />
        <Figure
          label={t.report.fetchedAt}
          value={formatUtcMinute(snapshot.fetchedAt)}
          note={t.report.fetchedAtNote}
        />
      </Section>

      <Section title={t.report.volatilityHeading}>
        <Figure
          label={t.report.annualised}
          value={formatPercent(volatility.annualizedVolatility, locale)}
          note={t.report.annualisedNote}
        />
        <Figure
          label={t.report.daily}
          value={formatPercent(volatility.dailyVolatility, locale)}
        />
        <Figure
          label={t.report.window}
          value={`${formatUtcDate(volatility.rangeStart)} → ${formatUtcDate(volatility.rangeEndExclusive)}`}
          note={t.report.windowNote(formatWhole(volatility.usableReturnCount, locale))}
        />
        <Figure
          label={t.report.coverage}
          value={formatPercent(volatility.returnCoverageRatio, locale)}
          note={t.report.coverageNote}
        />
      </Section>

      <Section title={t.report.bandHeading}>
        <Figure
          label={t.report.horizon}
          value={t.report.horizonValue(formatWhole(parameters.horizonDays, locale))}
          note={t.report.horizonNote}
        />
        <Figure
          label={t.report.multiplier}
          value={`${formatMultiplier(parameters.standardDeviationMultiplier, locale)}σ`}
          note={t.report.multiplierNote}
        />
        <Figure label={t.report.lowerBound} value={formatPrice(band.lowerPrice, locale)} />
        <Figure label={t.report.upperBound} value={formatPrice(band.upperPrice, locale)} />
        <Figure
          label={t.report.downside}
          value={formatPercent(band.downsideDistanceRatio, locale)}
          note={t.report.downsideNote}
        />
        <Figure
          label={t.report.upside}
          value={formatPercent(band.upsideDistanceRatio, locale)}
          note={t.report.upsideNote}
        />
      </Section>

      <p className="text-sm leading-relaxed text-muted">{t.report.epilogue}</p>

      <Panel title={t.activity.heading}>
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Figure label={t.activity.volume24h} value={formatUsd(activity.volume24hUsd, locale)} />
          <Figure label={t.activity.volume7d} value={formatUsd(activity.volume7dUsd, locale)} />
          <Figure label={t.activity.volume30d} value={formatUsd(activity.volume30dUsd, locale)} />
          <Figure
            label={t.activity.fees30d}
            value={formatUsd(activity.fees30dUsd, locale)}
            note={t.activity.feesNote}
          />
          <Figure
            label={t.activity.fullyInside}
            value={formatWhole(activity.occupancy.fullyInside, locale)}
          />
          <Figure
            label={t.activity.fullyOutside}
            value={formatWhole(activity.occupancy.fullyOutside, locale)}
          />
          <Figure
            label={t.activity.undetermined}
            value={formatWhole(activity.occupancy.undetermined, locale)}
            note={t.activity.undeterminedNote}
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

        <p className="text-xs leading-relaxed text-muted">{t.activity.inSample}</p>
        <p className="text-sm leading-relaxed">{t.activity.notYourEarnings}</p>
      </Panel>

      {/*
       * Directly under the fees it explains. In v3 this panel confirms what the
       * tier already said; in v4 it is often the only place the real rate
       * appears, because the tier and the rate stopped being the same number.
       */}
      <RealizedFeePanel
        result={realizedFee}
        hookMayAlterSwaps={disclosure.hookMayAlterSwaps}
        t={t}
        locale={locale}
      />

      {/*
       * Directly under the in-sample figures, because the contrast is the whole
       * point: the same three buckets, counted over days the bands were not
       * drawn from. Read apart, either one is a number; read together, they say
       * how much of the picture above was the fitting.
       *
       * The totals lead and the folds follow. A reader who wants the headline
       * gets it in one line; one who wants to know whether it rests on a single
       * lucky month can count the rows.
       */}
      {outOfSample.status !== "success" ? (
        <Panel title={t.outOfSample.heading}>
          <p className="text-sm leading-relaxed">{t.outOfSample.unavailableHeading}</p>
          <p className="text-sm leading-relaxed text-muted">
            {t.notices.failure[outOfSample.notice]}
          </p>
        </Panel>
      ) : (
        <Panel title={t.outOfSample.heading}>
          <p className="text-sm leading-relaxed">
            {t.outOfSample.intro(
              t.parameters.days(formatWhole(outOfSample.data.horizonDays, locale)),
            )}
          </p>

          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Figure
              label={t.outOfSample.folds}
              value={formatWhole(outOfSample.data.folds.length, locale)}
              note={t.outOfSample.foldsNote}
            />
            <Figure
              label={t.outOfSample.fullyInside}
              value={formatWhole(outOfSample.data.occupancy.fullyInside, locale)}
            />
            <Figure
              label={t.outOfSample.fullyOutside}
              value={formatWhole(outOfSample.data.occupancy.fullyOutside, locale)}
            />
            <Figure
              label={t.outOfSample.undetermined}
              value={formatWhole(outOfSample.data.occupancy.undetermined, locale)}
            />
          </dl>

          <p className="text-sm leading-relaxed">
            {t.outOfSample.verdict(
              formatWhole(outOfSample.data.occupancy.fullyInside, locale),
              formatWhole(outOfSample.data.daysMeasured, locale),
              formatWhole(outOfSample.data.folds.length, locale),
            )}
          </p>

          {/* One row per fold, oldest first, so a run of them can be scanned. */}
          <div className="flex flex-col gap-1 overflow-x-auto">
            <div className="flex min-w-max justify-between gap-6 text-xs uppercase tracking-widest text-muted">
              <span>{t.outOfSample.foldPeriod}</span>
              <span>{t.outOfSample.foldVolatility}</span>
              <span>{t.outOfSample.foldVerdict}</span>
            </div>
            {outOfSample.data.folds.map((fold) => (
              <div
                key={fold.measuredRangeStart}
                className="flex min-w-max justify-between gap-6 font-mono text-sm"
              >
                <span>
                  {formatUtcDate(fold.measuredRangeStart)} → {formatUtcDate(fold.measuredRangeEndExclusive)}
                </span>
                <span className="text-muted">{formatPercent(fold.annualizedVolatility, locale)}</span>
                <span>
                  {formatWhole(fold.occupancy.fullyInside, locale)} /{" "}
                  {formatWhole(fold.occupancy.fullyOutside, locale)} /{" "}
                  {formatWhole(fold.occupancy.undetermined, locale)}
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs leading-relaxed text-muted">{t.outOfSample.foldColumns}</p>
          <p className="text-xs leading-relaxed text-muted">{t.outOfSample.notHeld}</p>
          <p className="text-xs leading-relaxed text-muted">{t.outOfSample.notIndependent}</p>
        </Panel>
      )}

      <Panel title={t.divergence.heading}>
        <p className="text-sm leading-relaxed">{t.divergence.intro}</p>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between gap-4 text-xs uppercase tracking-widest text-muted">
            <span>{t.divergence.price}</span>
            <span>{t.divergence.loss}</span>
          </div>
          {divergence.points.map((point) => (
            <div key={point.price} className="flex justify-between gap-4 font-mono text-sm">
              <span>{formatPrice(point.price, locale)}</span>
              <span>{formatPercent(point.lossRatio, locale)}</span>
            </div>
          ))}
        </div>

        <p className="text-xs leading-relaxed text-muted">{t.divergence.entryRow}</p>
        <p className="text-xs leading-relaxed text-muted">{t.divergence.impermanentNote}</p>
      </Panel>
    </div>
  );
}
