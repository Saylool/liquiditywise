import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HORIZON_CHOICES, MULTIPLIER_CHOICES } from "../lib/advisor/requestedParameters";
import { getDictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import type { PriceBandParameters } from "../schemas";
import { BandParametersForm } from "./BandParametersForm";

const POOL = `0x${"a".repeat(40)}`;

const render = (
  parameters: PriceBandParameters = { horizonDays: 30, standardDeviationMultiplier: 1 },
  { fellBack = false, locale = "en" as Locale } = {},
) =>
  renderToStaticMarkup(
    <BandParametersForm
      poolAddress={POOL}
      parameters={parameters}
      fellBack={fellBack}
      t={getDictionary(locale)}
      locale={locale}
    />,
  );

describe("BandParametersForm", () => {
  /*
   * A plain GET form, so a chosen band lives in the URL: linkable, reloadable,
   * and comparable by opening two of them.
   */
  it("is a GET form back to the same route", () => {
    const markup = render();

    expect(markup).toContain('method="get"');
    expect(markup).toContain('action="/pool"');
  });

  it("carries the pool it is changing the band for", () => {
    expect(render()).toContain(`<input type="hidden" name="address" value="${POOL}"/>`);
  });

  it("offers every horizon and every multiplier", () => {
    const markup = render();

    for (const days of HORIZON_CHOICES) expect(markup).toContain(`value="${days}"`);
    for (const sigma of MULTIPLIER_CHOICES) expect(markup).toContain(`value="${sigma}"`);
  });

  it("labels the fields with the same words the figures above them use", () => {
    const markup = render();
    const t = getDictionary("en");

    expect(markup).toContain(t.report.horizon);
    expect(markup).toContain(t.report.multiplier);
  });

  /*
   * The value is what a URL carries and must parse the same way everywhere; only
   * the label follows the reader's language. A select that submitted "1,5" would
   * come back unreadable.
   */
  it("keeps option values locale-independent while translating their labels", () => {
    const markup = render({ horizonDays: 30, standardDeviationMultiplier: 1.5 }, { locale: "tr" });

    expect(markup).toContain('value="1.5"');
    expect(markup).toContain("1,5σ");
    expect(markup).not.toContain('value="1,5"');
  });

  it("shows the multiplier in effect without rounding it away", () => {
    // `formatWhole` would have made this "2σ" while the band used 1.5.
    expect(render({ horizonDays: 30, standardDeviationMultiplier: 1.5 })).toContain("1.5σ");
  });

  /*
   * The schema accepts more than the interface offers, so this is reachable by
   * typing a URL. Without it the select would show the first option while the
   * page showed a different band, and submitting would change a setting nobody
   * touched.
   */
  it("keeps a value that is in effect but not offered", () => {
    const markup = render({ horizonDays: 365, standardDeviationMultiplier: 0.5 });

    expect(markup).toContain('value="365"');
    expect(markup).toContain('value="0.5"');
  });

  it("puts an unoffered value in its place among the others", () => {
    const markup = render({ horizonDays: 60, standardDeviationMultiplier: 1 });
    const order = [7, 30, 60, 90].map((days) => markup.indexOf(`value="${days}"`));

    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("says what the horizon does and does not change", () => {
    expect(render()).toContain("volatility always comes from the last 30 completed days");
  });

  it("stays quiet about a fallback that did not happen", () => {
    expect(render()).not.toContain("could not be read");
  });

  it("says so when something asked for could not be used", () => {
    expect(render(undefined, { fellBack: true })).toContain("could not be read");
  });

  it("translates", () => {
    const markup = render(undefined, { locale: "tr", fellBack: true });

    expect(markup).toContain("Aralığı değiştir");
    expect(markup).toContain("Yeniden hesapla");
    expect(markup).toContain("30 gün");
    expect(markup).toContain("okunamadı");
    expect(markup).not.toContain("Recalculate");
  });
});
