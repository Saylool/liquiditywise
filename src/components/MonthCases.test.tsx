import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_DEPOSIT_USD, DEFAULT_PRICE_BAND_PARAMETERS } from "../lib/advisor/poolRangeAnalysis";
import type { MonthCasesRead } from "../lib/advisor/readMonthCases";
import { chainOf } from "../lib/chains/chains";
import { getCasesCopy } from "../lib/i18n/casesCopy";
import { getDictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import { CASE_LIQUIDITY_HOOK, fixtureCase } from "../lib/testing/monthCaseFixture";
import { MonthCases } from "./MonthCases";

/*
 * What a reader sees of the month: the stated order and the measurement time
 * before any card; on each card the pool page's own figures, the re-centring
 * verdict and the standing note; and the honest states — not yet measured,
 * unavailable, nothing whole this time.
 */

/** Thirty closes: ten at the opening, then the rest at `to` times it. */
const stepTo = (to: number): readonly number[] => Array.from({ length: 30 }, (_, index) => (index < 10 ? 1 : to));

const flat = fixtureCase();
const left = fixtureCase({ protocol: "v4", hookAddress: CASE_LIQUIDITY_HOOK, path: stepTo(1.5) });

const measured = (cases = [flat, left]): MonthCasesRead => ({
  status: "measured",
  chainId: 1,
  measuredAt: "2026-10-07T09:40:00.000Z",
  poolsAsked: 19,
  cases,
});

/** A sentence as the renderer writes it: with its apostrophes escaped. */
const written = (sentence: string): string => sentence.replace(/'/g, "&#x27;");

const render = (read: MonthCasesRead | null, locale: Locale = "en", chainId: number = 1) =>
  renderToStaticMarkup(
    <MonthCases
      read={read}
      chain={chainOf(chainId)}
      pageHref={`/${locale}/cases`}
      networkLabel="Network"
      copy={getCasesCopy(locale)}
      parameters={DEFAULT_PRICE_BAND_PARAMETERS}
      depositUsd={DEFAULT_DEPOSIT_USD}
      t={getDictionary(locale)}
      locale={locale}
    />,
  );

describe("the cases page", () => {
  it("states the order's one figure and the deposit, and when it was measured, before any card", () => {
    const markup = render(measured());
    const copy = getCasesCopy("en");

    expect(markup.indexOf(copy.criterion("$1,000"))).toBeLessThan(markup.indexOf("USDC / WETH"));
    expect(markup).toContain(written(copy.intro("Ethereum", "$1,000")));
    expect(markup).toContain("Measured 2026-10-07 09:40 UTC.");
    expect(markup).toContain(copy.poolsRead("2", "19"));
  });

  it("writes each case with the pool page's own labels and figures, in the page's own quote", () => {
    const markup = render(measured([flat]));
    const t = getDictionary("en");

    expect(markup).toContain("USDC / WETH");
    expect(markup).toContain("0.30%");
    expect(markup).toContain("Ethereum mainnet");
    expect(markup).toContain("Opened at the close of 2026-08-31, read to the close of 2026-09-30.");
    /* The range the pool page's way round: USDC per WETH, around 3,000, not WETH per USDC around 0.0003. */
    expect(markup).toMatch(/2,8\d\d(\.\d+)? – 3,1\d\d(\.\d+)? USDC per WETH/);
    expect(markup).toContain(t.outOfSample.fullyInside);
    expect(markup).toContain("30 of 30");
    expect(markup).toContain(t.backtest.worth);
    expect(markup).toContain(t.backtest.fees("$1,000"));
    expect(markup).toContain("$18.72");
    expect(markup).toContain(t.backtest.feesOfDeposit);
    expect(markup).toContain("1.87%");
    expect(markup).toContain("Against holding, fees in");
    expect(markup).toContain("+$18.62");
  });

  it("gives the re-centring verdict: never, or how many times and better or worse by how much", () => {
    const markup = render(measured());

    expect(markup).toContain(getCasesCopy("en").neverRecentred);
    expect(markup).toContain("Re-centres over the same month: 1.");
    expect(markup).toMatch(/Re-centring would have ended \$13\.\d\d better than never re-centring\./);
  });

  it("labels the best and the worst by the stated figure, and a lone case only best", () => {
    const markup = render(measured());
    const best = markup.indexOf("Best of the month");
    const worst = markup.indexOf("Worst of the month");

    expect(best).toBeGreaterThan(-1);
    expect(worst).toBeGreaterThan(best);
    /* The order is the reader's: the first card is the one with the larger result. */
    expect(markup.indexOf("+$18.62")).toBeLessThan(markup.indexOf("-$232"));

    const lone = render(measured([flat]));
    expect(lone).toContain("Best of the month");
    expect(lone).not.toContain("Worst of the month");
  });

  it("links each case to its pool's page with the default band, the deposit and the chain, never prefetched", () => {
    const markup = render(measured(), "en", 8453);

    expect(markup).toContain(`href="/pool?chain=base&amp;address=${flat.pool.id}&amp;days=30&amp;sigma=1&amp;usd=1000"`);
    expect(markup).toContain(`href="/v4?chain=base&amp;id=${left.pool.id}&amp;days=30&amp;sigma=1&amp;usd=1000"`);
    expect(markup).toContain("Open the full analysis");
  });

  it("writes the standing note under every card", () => {
    const markup = render(measured());
    const note = written(getCasesCopy("en").note);

    expect(markup.split(note)).toHaveLength(3);
  });

  it("says the month has not been measured yet when nothing is kept, and still states the criterion", () => {
    const markup = render(null, "en", 137);

    expect(markup).toContain(getCasesCopy("en").notYet("Polygon"));
    expect(markup).toContain(getCasesCopy("en").criterion("$1,000"));
    expect(markup).not.toContain("Measured ");
  });

  it("says why when the list could not be read, and when no month was whole", () => {
    expect(render({ status: "unavailable", notice: "market-data-timed-out" })).toContain(written(getCasesCopy("en").unavailable));
    expect(render(measured([]))).toContain(written(getCasesCopy("en").empty("Ethereum")));
    expect(render(measured([]))).not.toContain("Best of the month");
  });

  it("offers every network as a tab, the current one marked, on the page's own address", () => {
    const markup = render(measured(), "tr", 8453);

    expect(markup).toContain('href="/tr/cases"');
    expect(markup).toContain('href="/tr/cases?chain=base" aria-current="page"');
    expect(markup).toContain('href="/tr/cases?chain=unichain"');
  });

  it("speaks the reader's language on every line, Turkish figures included", () => {
    const markup = render(measured(), "tr");
    const copy = getCasesCopy("tr");

    expect(markup).toContain(copy.heading.length > 0 ? copy.criterion("$1.000") : "");
    expect(markup).toContain("Ölçüm: 2026-10-07 09:40 UTC.");
    expect(markup).toContain("Ayın en iyisi");
    expect(markup).toContain(getDictionary("tr").backtest.worth);
    expect(markup).toContain("Ethereum ana ağı");
  });

  it("gives every element a width it can shrink inside, so a long pair name clips rather than overflows a phone", () => {
    const markup = render(measured());

    expect(markup).toContain("min-w-0");
    expect(markup).toContain('class="truncate text-base font-semibold"');
    expect(markup).toContain("break-words");
  });
});
