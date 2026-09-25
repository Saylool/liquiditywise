import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PoolRangeAnalysisResult } from "../lib/advisor/poolRangeAnalysis";
import { HOOK_PERMISSION_FLAGS } from "../schemas";
import { formatUsd } from "../lib/format/displayFormats";
import { getDictionary } from "../lib/i18n/dictionaries";
import { chainOf } from "../lib/chains/chains";
import { PoolComparison, type ComparedTier, type ComparedV4 } from "./PoolComparison";

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
  protocol: "v3",
  id: address,
  fee: { kind: "static", feePpm },
  tickSpacing: null,
  hookAltersSwaps: false,
  current,
  result,
});

const NO_V4: ComparedV4 = { status: "none" };

const A = `0x${"1".repeat(40)}`;
const B = `0x${"2".repeat(40)}`;
const C = `0x${"3".repeat(40)}`;

/** How react-dom writes an apostrophe. */
const escaped = (value: string) => value.replace(/'/g, "&#x27;");

const render = (v3: readonly ComparedTier[], v4: ComparedV4 = NO_V4) =>
  renderToStaticMarkup(
    <PoolComparison pair="USDC / WETH" v3={v3} v4={v4} parameters={PARAMETERS} depositUsd={5_000} t={t} locale="en" />,
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
    // Two section headings, v3 and v4, and one per tier.
    expect(html.match(/<h3/g)).toHaveLength(4);
  });

  it("says there is nothing to set beside a pair with one pool", () => {
    expect(render([tier(A, 500, analysed(1), true)])).toContain(t.compare.onlyOne("USDC / WETH"));
  });

  it("says nothing is beside a lone v3 pool only when v4 has nothing either", () => {
    const lone = [tier(A, 500, analysed(1), true)];
    const withV4 = render(lone, { status: "listed", tiers: [v4Tier(POOL_ID(3), { kind: "static", feePpm: 500 }, false)], notShown: 0 });

    expect(render(lone)).toContain(t.compare.onlyOne("USDC / WETH"));
    expect(withV4).not.toContain(t.compare.onlyOne("USDC / WETH"));
  });

  it("says fees are half of it", () => {
    const html = render([tier(A, 100, analysed(1)), tier(B, 500, analysed(2))]);

    expect(html).toContain(t.compare.readTogether.replace(/'/g, "&#x27;"));
  });
});

/** A v4 pool as the comparison reads it: its fee, its own price step, and whether its hook may reprice a swap. */
const v4Tier = (id: string, fee: ComparedTier["fee"], hookAltersSwaps: boolean, result = analysed(3)): ComparedTier => ({
  protocol: "v4",
  id,
  fee,
  tickSpacing: 60,
  hookAltersSwaps,
  current: false,
  result,
});

const POOL_ID = (n: number) => `0x${String(n).repeat(64)}`;

describe("the v4 pools beside the tiers", () => {
  it("sets them under their own heading, links each to the v4 page under the same settings, and explains their order", () => {
    const html = render([tier(A, 500, analysed(1), true)], {
      status: "listed",
      tiers: [v4Tier(POOL_ID(7), { kind: "static", feePpm: 500 }, false)],
      notShown: 0,
    });

    expect(html).toContain(t.feeTiers.onV3);
    expect(html).toContain(t.feeTiers.onV4);
    expect(html).toContain(`/v4?id=${POOL_ID(7)}&amp;days=30&amp;sigma=1.5&amp;usd=5000`);
    expect(html).toContain(escaped(t.feeTiers.v4Ordering));
  });

  it("names a v4 pool by its fee and its own price step, and a dynamic fee as dynamic", () => {
    const html = render([tier(A, 500, analysed(1))], {
      status: "listed",
      tiers: [v4Tier(POOL_ID(1), { kind: "static", feePpm: 500 }, false), v4Tier(POOL_ID(2), { kind: "dynamic", currentFeePpm: null }, false)],
      notShown: 0,
    });

    expect(html).toContain(`0.05% · ${t.feeTiers.priceStep("0.60%")}`);
    expect(html).toContain(t.v4.dynamicFee);
  });

  it("says a pool's hook may change what a swap costs, on that pool's card only", () => {
    const note = `${t.feeTiers.hook}: ${t.feeTiers.hookAltersSwaps}`;
    const html = render([tier(A, 500, analysed(1))], {
      status: "listed",
      tiers: [v4Tier(POOL_ID(1), { kind: "static", feePpm: 500 }, true), v4Tier(POOL_ID(2), { kind: "static", feePpm: 3000 }, false)],
      notShown: 0,
    });

    expect(html.split(note)).toHaveLength(2);
  });

  it("counts the pools it left out, and says so", () => {
    const html = render([tier(A, 500, analysed(1))], {
      status: "listed",
      tiers: [v4Tier(POOL_ID(1), { kind: "static", feePpm: 500 }, false)],
      notShown: 9,
    });

    expect(html).toContain(t.feeTiers.moreNotShown("9"));
  });

  it("says there are none, or that they could not be read, rather than leaving the section empty", () => {
    expect(render([tier(A, 500, analysed(1))], { status: "none" })).toContain(t.feeTiers.v4None("USDC / WETH"));

    const unread = render([tier(A, 500, analysed(1))], { status: "unavailable", notice: "market-data-timed-out" });
    expect(unread).toContain(escaped(t.feeTiers.v4Unavailable));
    expect(unread).toContain(t.notices.failure["market-data-timed-out"]);
  });
});

describe("tiers on another chain", () => {
  const onArbitrum = () =>
    renderToStaticMarkup(
      <PoolComparison
        pair="USDC / WETH"
        v3={[tier(A, 500, analysed(1), true), tier(B, 3_000, analysed(2))]}
        v4={{ status: "not-read" }}
        parameters={PARAMETERS}
        depositUsd={1_000}
        chain={chainOf(42161)}
        t={t}
        locale="en"
      />,
    );

  it("links each tier's analysis on that chain", () => {
    expect(onArbitrum()).toContain(`/pool?chain=arbitrum&amp;address=${B}`);
  });

  it("leaves v4 out altogether rather than saying the pair has none", () => {
    const html = onArbitrum();

    expect(html).not.toContain(t.feeTiers.onV4);
    expect(html).not.toContain(t.feeTiers.v4None("USDC / WETH"));
  });
});
