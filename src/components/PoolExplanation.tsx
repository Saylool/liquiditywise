import type { WrittenInterpretation } from "../lib/ai/interpretRange";
import type { InterpretationOutcome } from "../lib/ai/rangeInterpretationAdapter";
import type { Dictionary } from "../lib/i18n/dictionaries";

/**
 * The plain-language explanation that sits under the figures.
 *
 * Presentational only. It renders prose a model wrote and says so, because the
 * numbers above it were computed and cross-checked and these sentences were
 * not — a reader who cannot tell which is which has been given a false
 * impression of where the authority lies.
 *
 * The model it credits is the one the provider reported, carried along with the
 * text rather than passed in beside it. A name supplied separately would be the
 * one that was *asked for*, and an alias can resolve to something else.
 *
 * When there is no explanation the section still appears, saying so. Silently
 * omitting it would leave a reader wondering whether the page had finished.
 */

/**
 * The order the sections are read in: what the range is, what happens when it
 * ends, what the measurement behind it means, and what none of it covers.
 * Written out rather than taken from object order, which no one should have to
 * rely on to get a sensible reading order.
 */
const SECTION_ORDER = [
  "whatThisRangeMeans",
  "ifPriceLeavesTheRange",
  "whatTheVolatilitySays",
  "whatThisDoesNotCover",
] as const;

export function PoolExplanation({
  result,
  t,
}: {
  result: InterpretationOutcome<WrittenInterpretation>;
  t: Dictionary;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {t.explanation.heading}
      </h2>

      {result.status === "unavailable" ? (
        <>
          <p className="text-sm leading-relaxed">{t.explanation.unavailable}</p>
          <p className="text-sm leading-relaxed text-muted">{t.notices.failure[result.notice]}</p>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-5">
            {SECTION_ORDER.map((section) => (
              <div key={section} className="flex flex-col gap-1">
                <h3 className="text-xs uppercase tracking-widest text-muted">
                  {t.explanation.sections[section]}
                </h3>
                <p className="text-sm leading-relaxed">
                  {result.data.interpretation[section]}
                </p>
              </div>
            ))}
          </div>
          <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted">
            {t.explanation.writtenBy(result.data.model)}
          </p>
        </>
      )}
    </section>
  );
}

/** Shown in the explanation's place while the model is still writing. */
export function PoolExplanationPending({ t }: { t: Dictionary }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {t.explanation.heading}
      </h2>
      <p className="text-sm leading-relaxed text-muted">{t.explanation.pending}</p>
      <div className="h-20 animate-pulse rounded-md border border-border" aria-hidden="true" />
    </section>
  );
}
