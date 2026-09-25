import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  DEPOSIT_CHOICES,
  DEPOSIT_PARAMETER,
  HORIZON_CHOICES,
  MULTIPLIER_CHOICES,
} from "../lib/advisor/requestedParameters";
import { getDictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import type { PriceBandParameters } from "../schemas";
import { BandParametersForm } from "./BandParametersForm";

const POOL = `0x${"a".repeat(40)}`;

const render = (
  parameters: PriceBandParameters = { horizonDays: 30, standardDeviationMultiplier: 1 },
  {
    fellBack = false,
    locale = "en" as Locale,
    action = "/pool",
    poolParameter = "address",
    poolId = POOL,
    depositUsd = 1_000,
  } = {},
) =>
  renderToStaticMarkup(
    <BandParametersForm
      action={action}
      poolParameter={poolParameter}
      poolId={poolId}
      parameters={parameters}
      depositUsd={depositUsd}
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

    expect(markup).toContain(t.parameters.horizonLabel);
    expect(markup).toContain(t.parameters.widthLabel);
    expect(markup).toContain("How far ahead");
    expect(markup).toContain("How wide");
  });

  /*
   * "1σ" means nothing to most people. Each offered width carries a word, the
   * sigma stays beside it, and the words are relative to each other only.
   */
  it("gives every offered width a word, with the sigma beside it", () => {
    const markup = render();

    expect(markup).toContain("Tight (1σ)");
    expect(markup).toContain("Medium (1.5σ)");
    expect(markup).toContain("Wide (2σ)");
    expect(markup).toContain("Very wide (3σ)");
    for (const sigma of MULTIPLIER_CHOICES) {
      expect(markup).toMatch(new RegExp(`>[A-Z][a-z ]+ \\(${sigma}σ\\)<`));
    }
  });

  it("gives a width that was typed rather than offered no word at all", () => {
    const markup = render({ horizonDays: 30, standardDeviationMultiplier: 0.5 });

    expect(markup).toContain(">0.5σ<");
  });

  /*
   * The value is what a URL carries and must parse the same way everywhere; only
   * the label follows the reader's language. A select that submitted "1,5" would
   * come back unreadable.
   */
  it("keeps option values locale-independent while translating their labels", () => {
    const markup = render({ horizonDays: 30, standardDeviationMultiplier: 1.5 }, { locale: "tr" });

    expect(markup).toContain('value="1.5"');
    expect(markup).toContain("Orta (1,5σ)");
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

/*
 * The same form serves the v4 page, which addresses a pool by a 32-byte PoolId
 * under a different parameter name. A second copy would be a second place for
 * the horizon and the multiplier to drift apart.
 */
describe("BandParametersForm, pointed at the v4 page", () => {
  const POOL_ID = `0x${"b".repeat(64)}`;

  it("submits to the route it was given, carrying the id under its own name", () => {
    const markup = render(
      { horizonDays: 30, standardDeviationMultiplier: 1 },
      { action: "/v4", poolParameter: "id", poolId: POOL_ID },
    );

    expect(markup).toContain('action="/v4"');
    expect(markup).toContain(`name="id" value="${POOL_ID}"`);
    expect(markup).not.toContain('name="address"');
  });
});

/*
 * The third knob, which is not part of the band and says so everywhere it
 * appears. It is here because this is where a reader already is when they want
 * to change what the fee figure is worked out for.
 */
describe("the deposit", () => {
  it("offers every size, by the name the URL gives it", () => {
    const markup = render();

    expect(markup).toContain(`name="${DEPOSIT_PARAMETER}"`);
    for (const choice of DEPOSIT_CHOICES) {
      expect(markup).toContain(`value="${choice}"`);
    }
  });

  it("shows the size in effect as selected", () => {
    const markup = render(undefined, { depositUsd: 100_000 });

    expect(markup).toContain('value="100000" selected=""');
  });

  /* The schema accepts more than the buttons offer, so a URL can reach here. */
  it("adds a size nobody offered when that is what is in effect", () => {
    const markup = render(undefined, { depositUsd: 2_500 });

    expect(markup).toContain('value="2500" selected=""');
    expect(markup).toContain('value="1000"');
  });

  it("writes the amounts in the reader's language", () => {
    expect(render(undefined, { locale: "tr" })).toContain("Ne kadar para");
  });
});

describe("the chain a pool is on", () => {
  const withChain = (chain: "ethereum" | "base" | undefined) =>
    renderToStaticMarkup(
      <BandParametersForm
        action="/pool"
        poolParameter="address"
        poolId={POOL}
        chain={chain}
        parameters={{ horizonDays: 30, standardDeviationMultiplier: 1 }}
        depositUsd={1_000}
        fellBack={false}
        t={getDictionary("en")}
        locale="en"
      />,
    );

  it("travels hidden beside the pool off mainnet, so a changed band stays on that chain", () => {
    expect(withChain("base")).toContain('<input type="hidden" name="chain" value="base"/>');
  });

  it("goes unsaid on mainnet", () => {
    expect(withChain("ethereum")).not.toContain('name="chain"');
    expect(withChain(undefined)).not.toContain('name="chain"');
  });
});
