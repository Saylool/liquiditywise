import { Suspense } from "react";

import { PoolExplanationPending } from "@/components/PoolExplanation";
import { PoolRangeReport } from "@/components/PoolRangeReport";
import { V4PairPanelPending } from "@/components/V4PairPanel";
import { V4PoolIdentity } from "@/components/V4PoolIdentity";
import { PoolExplanationSection } from "@/app/pool/PoolExplanationSection";
import { V4PairSection } from "./V4PairSection";
import { getPoolRangeAnalysis } from "@/lib/advisor/getPoolRangeAnalysis";
import type { PoolRangeAnalysisResult } from "@/lib/advisor/poolRangeAnalysis";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { getEthereumV4Pool } from "@/lib/uniswap/getEthereumV4Pool";
import type { PriceBandParameters } from "@/schemas";

/**
 * Reads one v4 pool, and works it through to a range.
 *
 * Lives in the route rather than in `src/components`, because it reads data and
 * components there do not.
 *
 * The pool is read once and the promise is shared. The identity panel needs it
 * to print the hook's permissions and the pipeline needs it for the tick grid,
 * and handing over the promise rather than the value keeps the snapshot and the
 * daily history starting at the same moment — awaiting the pool first would put
 * the slowest read of the three behind the fastest.
 */
export async function V4PoolSection({
  poolId,
  parameters,
  depositUsd,
  controls,
  locale,
  t,
}: {
  poolId: string;
  parameters: PriceBandParameters;
  /** The deposit the fee-share figure is worked out for. Scales nothing else. */
  depositUsd: number;
  /** The form that changes the range; the report places it under the figures it changes. */
  controls: React.ReactNode;
  locale: Locale;
  t: Dictionary;
}) {
  const poolRead = getEthereumV4Pool(poolId);
  const analysis = getPoolRangeAnalysis("v4", poolId, parameters, depositUsd, poolRead);

  const pool = await poolRead;

  return (
    <>
      <V4PoolIdentity result={pool} t={t} locale={locale} />

      {/*
       * Only when the pool was read at all. An id nobody initialised has no
       * identity and no range, and the panel above has already said which.
       */}
      {pool.status === "unavailable" ? null : (
        <Suspense fallback={<V4RangePending t={t} />}>
          <V4RangeReport
            analysis={analysis}
            poolId={poolId}
            controls={controls}
            t={t}
            locale={locale}
          />
        </Suspense>
      )}
    </>
  );
}

/**
 * Awaits the analysis inside its own boundary, so the identity above it is sent
 * as soon as it exists rather than waiting on two more reads.
 */
async function V4RangeReport({
  analysis,
  poolId,
  controls,
  t,
  locale,
}: {
  analysis: Promise<PoolRangeAnalysisResult>;
  poolId: string;
  controls: React.ReactNode;
  t: Dictionary;
  locale: Locale;
}) {
  const result = await analysis;

  return (
    <>
      <PoolRangeReport
        result={result}
        poolId={poolId}
        controls={controls}
        t={t}
        locale={locale}
      />
      {/*
       * The same explanation the v3 page streams in behind its figures, and
       * not awaited here either: the numbers are sent the moment they exist,
       * and the prose follows. The prompt it is written from names the hook
       * and what the protocol permits it to do, and nothing more about it.
       */}
      {result.status === "unavailable" || result.data.pool.protocolVersion !== "v4" ? null : (
        <>
          {/*
           * Where else the pair trades, first, as on the v3 page: it is about
           * which pool to read, a question that precedes everything the
           * explanation says, and it arrives in a fraction of the time.
           */}
          <Suspense fallback={<V4PairPanelPending t={t} />}>
            <V4PairSection
              pool={result.data.pool}
              parameters={result.data.parameters}
              depositUsd={result.data.depositUsd}
              locale={locale}
              t={t}
            />
          </Suspense>

          <Suspense fallback={<PoolExplanationPending t={t} />}>
            <PoolExplanationSection
              analysis={result.data}
              warnings={result.status === "partial" ? result.warnings : []}
              locale={locale}
              t={t}
            />
          </Suspense>
        </>
      )}
    </>
  );
}

/** The page's shape while the pool read is still in flight. */
export function V4PoolPending({ t }: { t: Dictionary }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {t.v4.heading}
      </h2>
      <div className="h-24 animate-pulse rounded-md border border-border" aria-hidden="true" />
    </section>
  );
}

/** And while the range behind it is. */
function V4RangePending({ t }: { t: Dictionary }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {t.report.rangeHeading}
      </h2>
      <div className="h-40 animate-pulse rounded-md border border-border" aria-hidden="true" />
    </section>
  );
}
