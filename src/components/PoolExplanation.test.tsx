import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { INTERPRETATION_METHOD, type RangeInterpretation } from "../schemas";
import type { WrittenInterpretation } from "../lib/ai/interpretRange";
import type { InterpretationOutcome } from "../lib/ai/rangeInterpretationAdapter";
import { getDictionary } from "../lib/i18n/dictionaries";
import { PoolExplanation, PoolExplanationPending } from "./PoolExplanation";

const interpretation = {
  method: INTERPRETATION_METHOD,
  whatThisRangeMeans: "FIRST SECTION about what the range covers and why it sits where it does.",
  ifPriceLeavesTheRange: "SECOND SECTION about the position converting into one token and stopping.",
  whatTheVolatilitySays: "THIRD SECTION about what the measurement describes and what it does not.",
  whatThisDoesNotCover: "FOURTH SECTION about fees, impermanent loss, gas and contract trust.",
} as RangeInterpretation;

const written = (model = "gpt-5.6-terra"): InterpretationOutcome<WrittenInterpretation> => ({
  status: "success",
  data: { interpretation, model },
});

const render = (
  result: InterpretationOutcome<WrittenInterpretation>,
  locale: "en" | "tr" = "en",
) => renderToStaticMarkup(<PoolExplanation result={result} t={getDictionary(locale)} />);

describe("PoolExplanation", () => {
  const markup = render(written());

  it("shows every section", () => {
    expect(markup).toContain("What this range means");
    expect(markup).toContain("If price leaves the range");
    expect(markup).toContain("What the volatility says");
    expect(markup).toContain("What this does not cover");
    expect(markup).toContain("FIRST SECTION");
    expect(markup).toContain("FOURTH SECTION");
  });

  it("reads in a deliberate order", () => {
    // What the range is, what happens when it ends, what the measurement behind
    // it means, and what none of it covers.
    const positions = ["FIRST", "SECOND", "THIRD", "FOURTH"].map((n) => markup.indexOf(n));

    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions.every((position) => position >= 0)).toBe(true);
  });

  /*
   * The numbers above this section were computed and cross-checked; these
   * sentences were not. A reader who cannot tell which is which has been given
   * a false impression of where the authority lies.
   */
  it("names the model that wrote the prose, and says the figures are not its work", () => {
    expect(markup).toContain("gpt-5.6-terra");
    expect(markup).toContain("The figures above were not");
  });

  it("credits whichever model actually ran", () => {
    expect(render(written("gpt-5.6-luna"))).toContain(
      "gpt-5.6-luna",
    );
  });

  it("says so when there is no explanation, rather than vanishing", () => {
    // A section that simply disappears leaves a reader wondering whether the
    // page had finished loading.
    const failed = render({
      status: "unavailable",
      reason: "configuration-error",
      message: "This application is not configured to write explanations, so none is shown.",
    });

    expect(failed).toContain("Explanation");
    expect(failed).toContain("No explanation is available");
    expect(failed).toContain("not configured");
    expect(failed).not.toContain("What this range means");
  });

  it("credits nobody when nothing was written", () => {
    const failed = render({ status: "unavailable", reason: "network-error", message: "Down." });

    expect(failed).not.toContain("gpt-5.6-terra");
  });

  it("translates the headings", () => {
    const turkish = render(written(), "tr");

    expect(turkish).toContain("Bu aralık ne demek");
    expect(turkish).toContain("Fiyat aralığın dışına çıkarsa");
    expect(turkish).toContain("Yukarıdaki sayılar ona ait değil");
    expect(turkish).not.toContain("What this range means");
  });

  it("leaves the model's own words untouched", () => {
    expect(markup).toContain(interpretation.whatTheVolatilitySays);
  });
});

describe("PoolExplanationPending", () => {
  it("holds the section's place while the model is still writing", () => {
    const markup = renderToStaticMarkup(<PoolExplanationPending t={getDictionary("en")} />);

    expect(markup).toContain("Explanation");
    expect(markup).toContain("Writing the explanation");
  });

  it("says it in the reader's language", () => {
    const markup = renderToStaticMarkup(<PoolExplanationPending t={getDictionary("tr")} />);

    expect(markup).toContain("Açıklama yazılıyor");
  });
});
