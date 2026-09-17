import { Suspense } from "react";

import type { WrittenInterpretation } from "../lib/ai/interpretRange";
import { SECTION_KEYS, type SectionKey } from "../lib/ai/interpretationSections";
import type { InterpretationOutcome } from "../lib/ai/rangeInterpretationAdapter";
import type { SectionOutcome } from "../lib/ai/sectionGates";
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
 *
 * The schema's own, because that is the order the model is asked to write them
 * in and therefore the order they arrive in — a section that appeared after the
 * one it explains would read as an afterthought. Pinned by that module's test
 * rather than left to object order by accident.
 */
const SECTION_ORDER = SECTION_KEYS;

/** One finished paragraph under its heading. */
const Section = ({ title, prose }: { title: string; prose: string }) => (
  <div className="flex flex-col gap-1">
    <h3 className="text-xs uppercase tracking-widest text-muted">{title}</h3>
    <p className="text-sm leading-relaxed">{prose}</p>
  </div>
);

/** A paragraph still being written, holding its own place in the reading order. */
const SectionWriting = ({ title, t }: { title: string; t: Dictionary }) => (
  <div className="flex flex-col gap-1">
    <h3 className="text-xs uppercase tracking-widest text-muted">{title}</h3>
    <p className="text-sm leading-relaxed text-muted">{t.explanation.sectionWriting}</p>
  </div>
);

/**
 * One paragraph of a streamed answer, rendered when it settles.
 *
 * `missing` covers both halves of the same thing: a section the answer never
 * reached, and one that broke the rule every section is held to. Either way
 * there is nothing to show and the page says so rather than leaving a gap.
 */
async function StreamedSection({
  title,
  outcome,
  t,
}: {
  title: string;
  outcome: Promise<SectionOutcome>;
  t: Dictionary;
}) {
  const settled = await outcome;

  return settled.status === "written" ? (
    <Section title={title} prose={settled.prose} />
  ) : (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs uppercase tracking-widest text-muted">{title}</h3>
      <p className="text-sm leading-relaxed text-muted">{t.explanation.sectionMissing}</p>
    </div>
  );
}

/**
 * The line under the prose, once the answer is finished: who wrote it, or why
 * the rest of it never came.
 *
 * It waits for the whole answer rather than the last paragraph, because the
 * model it credits is the one the provider reported and that arrives with the
 * finished response.
 */
async function WrittenByLine({
  whole,
  t,
}: {
  whole: Promise<InterpretationOutcome<WrittenInterpretation>>;
  t: Dictionary;
}) {
  const settled = await whole;

  return (
    <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted">
      {settled.status === "success"
        ? t.explanation.writtenBy(settled.data.model)
        : t.notices.failure[settled.notice]}
    </p>
  );
}

/**
 * The explanation as it is written, one paragraph at a time.
 *
 * The first section is already here — the page waited for it, because a panel
 * that appears empty is worse than one that appears late — and each of the
 * others has a boundary of its own, so the framework sends it the moment its
 * promise settles. No script runs in the browser for any of that.
 *
 * Measured against the live model: the first paragraph lands at about eight
 * seconds and the last at about thirteen. The panel used to show nothing until
 * the thirteenth.
 */
export function PoolExplanationStreamed({
  first,
  sections,
  whole,
  t,
}: {
  first: string;
  sections: Readonly<Record<SectionKey, Promise<SectionOutcome>>>;
  whole: Promise<InterpretationOutcome<WrittenInterpretation>>;
  t: Dictionary;
}) {
  const [firstKey, ...rest] = SECTION_ORDER;
  if (firstKey === undefined) return null;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {t.explanation.heading}
      </h2>

      {/*
       * Announced as it fills in, because that is what it does: a reader who
       * cannot see the paragraphs appear is otherwise left with the first one
       * and no sign that the rest are on their way. Polite, so it waits for a
       * pause rather than interrupting.
       */}
      <div className="flex flex-col gap-5" aria-live="polite">
        <Section title={t.explanation.sections[firstKey]} prose={first} />
        {rest.map((key) => (
          <Suspense key={key} fallback={<SectionWriting title={t.explanation.sections[key]} t={t} />}>
            <StreamedSection title={t.explanation.sections[key]} outcome={sections[key]} t={t} />
          </Suspense>
        ))}
      </div>

      <Suspense fallback={null}>
        <WrittenByLine whole={whole} t={t} />
      </Suspense>
    </section>
  );
}

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
              <Section
                key={section}
                title={t.explanation.sections[section]}
                prose={result.data.interpretation[section]}
              />
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
