import { renderToReadableStream } from "react-dom/server.edge";
import { describe, expect, it } from "vitest";

import type { WrittenInterpretation } from "../lib/ai/interpretRange";
import { SECTION_KEYS, type SectionKey } from "../lib/ai/interpretationSections";
import type { InterpretationOutcome } from "../lib/ai/rangeInterpretationAdapter";
import type { SectionOutcome } from "../lib/ai/sectionGates";
import { getDictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import { PoolExplanationStreamed } from "./PoolExplanation";

/*
 * The one thing worth proving about a streamed panel: the first paragraph
 * reaches the reader before the others exist. That is invisible in finished
 * markup, so the shell is read off the stream while the rest is still pending.
 */

const FIRST = "The suggested range is a band of prices with the current price inside it today.";
const LATER = "Below the range the position holds one token, and above it the other one.";

type Deferred = {
  readonly promise: Promise<SectionOutcome>;
  readonly settle: (outcome: SectionOutcome) => void;
};

const deferred = (): Deferred => {
  let settle: (outcome: SectionOutcome) => void = () => undefined;
  const promise = new Promise<SectionOutcome>((resolve) => {
    settle = resolve;
  });

  return { promise, settle };
};

const written = (model = "gpt-5.6-luna"): InterpretationOutcome<WrittenInterpretation> => ({
  status: "success",
  data: {
    model,
    interpretation: {
      method: "verified-figures-plain-language-explanation",
      whatThisRangeMeans: FIRST,
      ifPriceLeavesTheRange: LATER,
      whatTheVolatilitySays: LATER,
      whatThisDoesNotCover: LATER,
    },
  },
});

/** Renders the panel and hands back the shell, plus everything else on demand. */
const render = async (
  sections: Readonly<Record<SectionKey, Promise<SectionOutcome>>>,
  whole: Promise<InterpretationOutcome<WrittenInterpretation>>,
  locale: Locale = "en",
) => {
  const stream = await renderToReadableStream(
    <PoolExplanationStreamed
      first={FIRST}
      sections={sections}
      whole={whole}
      t={getDictionary(locale)}
    />,
  );
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const shell = decoder.decode((await reader.read()).value);

  const rest = async () => {
    let markup = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return markup;
      markup += decoder.decode(value);
    }
  };

  return { shell, rest };
};

const pending = () => {
  const gates = Object.fromEntries(SECTION_KEYS.map((key) => [key, deferred()])) as Record<
    SectionKey,
    Deferred
  >;
  const sections = Object.fromEntries(
    SECTION_KEYS.map((key) => [key, gates[key].promise]),
  ) as Record<SectionKey, Promise<SectionOutcome>>;

  return { gates, sections };
};

describe("PoolExplanationStreamed", () => {
  it("sends the first paragraph before the others have been written", async () => {
    const { gates, sections } = pending();
    const { shell, rest } = await render(sections, Promise.resolve(written()));

    expect(shell).toContain(FIRST);
    expect(shell).toContain("Still being written…");
    expect(shell).not.toContain(LATER);

    for (const key of SECTION_KEYS.slice(1)) {
      gates[key].settle({ status: "written", prose: LATER });
    }
    expect(await rest()).toContain(LATER);
  });

  it("names every section, written or not, so the reading order stays put", async () => {
    const { gates, sections } = pending();
    const { shell } = await render(sections, Promise.resolve(written()));
    for (const key of SECTION_KEYS.slice(1)) gates[key].settle({ status: "missing" });
    const t = getDictionary("en");

    for (const key of SECTION_KEYS) expect(shell).toContain(t.explanation.sections[key]);
  });

  /* A section that never arrived, or that broke the rule, says so rather than leaving a gap. */
  it("says a part could not be written when it never arrived", async () => {
    const { gates, sections } = pending();
    const { shell, rest } = await render(sections, Promise.resolve(written()));
    for (const key of SECTION_KEYS.slice(1)) gates[key].settle({ status: "missing" });

    expect(`${shell}${await rest()}`).toContain("This part could not be written.");
  });

  it("credits the model the provider named, once the answer is finished", async () => {
    const { gates, sections } = pending();
    const { shell, rest } = await render(sections, Promise.resolve(written("gpt-5.6-luna-2026-09-01")));
    for (const key of SECTION_KEYS.slice(1)) gates[key].settle({ status: "written", prose: LATER });

    expect(`${shell}${await rest()}`).toContain("gpt-5.6-luna-2026-09-01");
  });

  /* Paragraphs that were written stand; the line below says why the rest never came. */
  it("says what went wrong under the paragraphs that did arrive", async () => {
    const { gates, sections } = pending();
    const { shell, rest } = await render(
      sections,
      Promise.resolve({
        status: "unavailable",
        reason: "rate-limited",
        notice: "explanation-rate-limited",
      } as InterpretationOutcome<WrittenInterpretation>),
    );
    for (const key of SECTION_KEYS.slice(1)) gates[key].settle({ status: "missing" });
    const markup = `${shell}${await rest()}`;

    expect(markup).toContain(FIRST);
    expect(markup).toContain(getDictionary("en").notices.failure["explanation-rate-limited"]);
  });

  it("writes its own words in Turkish", async () => {
    const { sections } = pending();
    const { shell } = await render(sections, Promise.resolve(written()), "tr");

    expect(shell).toContain("Hâlâ yazılıyor…");
    expect(shell).not.toContain("Still being written");
  });
});
