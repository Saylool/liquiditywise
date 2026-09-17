import { PoolExplanation, PoolExplanationStreamed } from "@/components/PoolExplanation";
import { streamRangeInterpretation } from "@/lib/ai/getRangeInterpretation";
import { SECTION_KEYS } from "@/lib/ai/interpretationSections";
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
 *
 * It waits here for the first paragraph and not for the answer. A panel that
 * appeared with its heading and nothing under it would read as broken, so the
 * pending panel stands until there is something to put in it — and from then on
 * each paragraph arrives in a boundary of its own.
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
  const streamed = streamRangeInterpretation({ analysis, warnings, locale });
  const [firstKey] = SECTION_KEYS;
  if (firstKey === undefined) return null;

  const first = await streamed.sections[firstKey];

  /*
   * Nothing to open with means nothing was written at all — a key that is not
   * configured, a provider that refused, an answer that broke its contract. The
   * panel that has always said so says so.
   */
  if (first.status === "missing") return <PoolExplanation result={await streamed.whole} t={t} />;

  return (
    <PoolExplanationStreamed
      first={first.prose}
      sections={streamed.sections}
      whole={streamed.whole}
      t={t}
    />
  );
}
