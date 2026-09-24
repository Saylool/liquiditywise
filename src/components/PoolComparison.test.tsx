import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PoolRangeAnalysisResult } from "../lib/advisor/poolRangeAnalysis";
import { HOOK_PERMISSION_FLAGS } from "../schemas";
import { formatUsd } from "../lib/format/displayFormats";
import { getDictionary } from "../lib/i18n/dictionaries";
import { PoolComparison, type ComparedTier } from "./PoolComparison";

const t = getDictionary("en");
const PARAMETERS = { horizonDays: 30, standardDeviationMultiplier: 1.5 };

/** Only what a card reads; the rest of an analysis is the pool page's business. */
const analysed = (depositFeesUsd: number, fullyInside = 20): PoolRangeAnalysisResult =>
  ({
    status: "success",
    data: {
      pool: { protocolVersion: "v3" },
      activity: { daysMeasured: 30, occupancy: { fullyInside }, volume30dUsd: 5_000_000, fees30dUsd: 2_500 },
      depositFeeShare: { status: "success", data: { depositFeesUsd, daysCounted: fullyInside } },
    },
  }) as unknown as PoolRangeAnalysisResult;

const tier = (address: string, feePpm: number, result: PoolRangeAnalysisResult, current = false): ComparedTier => ({
  address,
  feePpm,
  current,
  result,
});

const A = `0x${"1".repeat(40)}`;
const B = `0x${"2".repeat(40)}`;
const C = `0x${"3".repeat(40)}`;

const render = (tiers: readonly ComparedTier[]) =>
  renderToStaticMarkup(
    <PoolComparison pair="USDC / WETH" tiers={tiers} parameters={PARAMETERS} depositUsd={5_000} t={t} locale="en" />,
  );

describe("the comparison page", () => {
  /*
   * The property the page is built around. The last tier here would have
   * taken the most in fees; it stays last, because the order is the fee's and
   * a figure is not a verdict.
   */
  it("keeps the tiers in the order they came, never re-ranked by a figure", () => {
    const html = render([tier(A, 100, analysed(1)), tier(B, 500, analysed(5)), tier(C, 3_000, analysed(90))]);

    const order = ["0.01%", "0.05%", "0.30%"].map((fee) => html.indexOf(fee));
    expect(order.every((position, index) => position > (order[index - 1] ?? -1))).toBe(true);
  });

  it("states the one footing every card stands on, once", () => {
    const html = render([tier(A, 100, analysed(1)), tier(B, 500, analysed(2))]);

    expect(html).toContain("How far ahead: 30 days · How wide: 1.5σ · How much: $5,000");
  });

  it("gives each tier what the deposit would have taken, over the days it was inside", () => {
    const html = render([tier(A, 100, analysed(12.5, 18)), tier(B, 500, analysed(2))]);

    expect(html).toContain(formatUsd(12.5, "en"));
    expect(html).toContain(t.compare.depositFeesNote("18"));
    expect(html).toContain(t.compare.daysInsideValue("18", "30"));
  });

  it("marks the pool the reader came from, and links every tier to its full analysis under the same settings", () => {
    const html = render([tier(A, 100, analysed(1), true), tier(B, 500, analysed(2))]);

    expect(html.match(new RegExp(t.feeTiers.thisOne, "g"))).toHaveLength(1);
    for (const address of [A, B]) {
      expect(html).toContain(`/pool?address=${address}&amp;days=30&amp;sigma=1.5&amp;usd=5000`);
    }
  });

  it("says a tier could not be read rather than leaving a hole", () => {
    const failed = { status: "unavailable", step: "history", reason: "timeout", notice: "market-data-timed-out" } as unknown as PoolRangeAnalysisResult;
    const html = render([tier(A, 100, analysed(1)), tier(B, 500, failed)]);

    expect(html).toContain(t.compare.unavailable);
    expect(html).toContain(t.notices.failure["market-data-timed-out"]);
  });

  /*
   * Never true of a v3 pool, which is all this page is given today — but the
   * card reads the same flag the pool page does, so a pool whose hook may
   * reprice a swap would not have fees credited to a range here either.
   */
  it("withholds the deposit's fees where a hook may reprice swaps, as the pool page does", () => {
    const hook = `0x${"1".repeat(36)}${HOOK_PERMISSION_FLAGS.BEFORE_SWAP.toString(16).padStart(4, "0")}`;
    const hooked = analysed(40) as unknown as { data: { pool: unknown } };
    hooked.data.pool = { protocolVersion: "v4", fee: { kind: "static", feePpm: 3000 }, protocolFee: null, hookAddress: hook };
    const html = render([tier(A, 100, analysed(1)), tier(B, 500, hooked as unknown as PoolRangeAnalysisResult)]);

    expect(html).toContain(t.activity.feesWithheld);
    expect(html).not.toContain(formatUsd(40, "en"));
  });

  it("leaves the page's one h1 to the workspace, and heads each tier below its own heading", () => {
    const html = render([tier(A, 100, analysed(1)), tier(B, 500, analysed(2))]);

    expect(html).not.toContain("<h1");
    expect(html.match(/<h2/g)).toHaveLength(1);
    expect(html.match(/<h3/g)).toHaveLength(2);
  });

  it("says there is nothing to set beside a pair with one pool", () => {
    expect(render([tier(A, 500, analysed(1), true)])).toContain(t.compare.onlyOne("USDC / WETH"));
  });

  it("says fees are half of it, and why v4 is not here", () => {
    const html = render([tier(A, 100, analysed(1)), tier(B, 500, analysed(2))]);

    expect(html).toContain(t.compare.readTogether.replace(/'/g, "&#x27;"));
    expect(html).toContain(t.compare.notV4.replace(/'/g, "&#x27;"));
  });
});
