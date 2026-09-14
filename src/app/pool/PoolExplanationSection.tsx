import { PoolExplanation } from "@/components/PoolExplanation";
import { getRangeInterpretation } from "@/lib/ai/getRangeInterpretation";
import type { PoolRangeAnalysis } from "@/lib/advisor/poolRangeAnalysis";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { DataWarningNotice } from "@/schemas";

/**
 * Fetches the explanation for one finished analysis.
 *
 * Lives in the route rather than in `src/components`, because it reads data and
 * components there do not. It is rendered inside a `<Suspense>` boundary and
 * never awaited by the page, which is what makes the figures reach the reader
 * immediately while the model is still writing: the analysis takes about a
 * second, the prose takes several, and there is no reason to hold verified
 * numbers back for sentences about them.
 */
export async function PoolExplanationSection({
  analysis,
  warnings,
  locale,
  t,
}: {
  analysis: PoolRangeAnalysis;
  warnings: readonly DataWarningNotice[];
  locale: Locale;
  t: Dictionary;
}) {
  const result = await getRangeInterpretation({ analysis, warnings, locale });

  return <PoolExplanation result={result} t={t} />;
}
