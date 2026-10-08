import { describe, expect, it } from "vitest";

import { CASE_LIQUIDITY_HOOK, CASE_SWAP_HOOK, caseAnalysis, fixtureCase } from "../testing/monthCaseFixture";
import { caseCandidates, CASES_SHOWN, caseOf, orderCases } from "./monthCases";
import type { MostTradedPool } from "./mostTraded";
import type { MostTraded } from "./readMostTraded";

/*
 * A case is one pool's month, whole or nothing; the order is one stated
 * figure. Every gate here is a blank a card would otherwise have carried.
 */

/** Thirty closes: `before` days at the opening price, then the rest at `to` times it. */
const stepTo = (to: number, before = 10): readonly number[] =>
  Array.from({ length: 30 }, (_, index) => (index < before ? 1 : to));

describe("one pool's month as a case", () => {
  it("carries the pool page's own figures: the window, the range, the days, the fees on the default deposit, the result", () => {
    const analysis = caseAnalysis({ path: stepTo(1.5) });
    const made = caseOf(analysis, 1);
    if (analysis.status === "unavailable" || made === null) throw new Error("the fixture should make a case");
    const { backtest, recentring, band, depositUsd } = analysis.data;
    if (backtest === null || recentring === null || backtest.fees === null || recentring.afterFees === null) throw new Error("fixture");

    expect(made.openedAt).toBe(backtest.openedAt);
    expect(made.closedAt).toBe(backtest.days[backtest.days.length - 1]!.timestamp);
    expect(made.closedAt > made.openedAt).toBe(true);
    expect([made.lowerPrice, made.upperPrice]).toEqual([backtest.lowerPrice, backtest.upperPrice]);
    expect([made.inside, made.outside, made.crossed]).toEqual([backtest.inside, backtest.outside, backtest.crossed]);
    expect(made.inside + made.outside + made.crossed).toBe(30);
    expect(made.endValueVsHold).toBe(backtest.endValueVsHold);
    expect(made.depositUsd).toBe(depositUsd);
    expect(made.depositUsd).toBe(1_000);
    expect([made.feesUsd, made.feesOfDeposit]).toEqual([backtest.fees.usd, backtest.fees.ofDeposit]);
    expect(made.currentPrice).toBe(band.currentPrice);
    expect(made.chainId).toBe(1);
  });

  it("takes its result and its verdict from the re-centring replay: never re-centred against holding, and re-centred less never", () => {
    const analysis = caseAnalysis({ path: stepTo(1.5) });
    const made = caseOf(analysis, 1);
    if (analysis.status === "unavailable" || made === null) throw new Error("the fixture should make a case");
    const { recentring } = analysis.data;
    if (recentring === null || recentring.afterFees === null) throw new Error("fixture");

    expect(made.resultVsHeldUsd).toBe(recentring.afterFees.neverVsHeldUsd);
    expect(made.recentres).toBe(recentring.recentres.length);
    expect(made.recentres).toBe(1);
    expect(made.recentringDifferenceUsd).toBe(recentring.afterFees.differenceUsd);
    /* The price left and stayed out: the position that moved with it earned on days the other sat out. */
    expect(made.recentringDifferenceUsd).toBeGreaterThan(0);
    expect(made.resultVsHeldUsd).toBeLessThan(0);
  });

  it("names a v3 pool as the most-traded list does, without the tick spacing the analysis read", () => {
    const made = fixtureCase();

    expect(made.pool).toEqual({
      protocolVersion: "v3",
      chainId: 1,
      id: `0x${"c".repeat(40)}`,
      token0: expect.objectContaining({ symbol: "USDC" }),
      token1: expect.objectContaining({ symbol: "WETH" }),
      feePpm: 3000,
    });
    expect("tickSpacing" in made.pool).toBe(false);
  });

  it("keeps a v4 pool whole, hook and fee included, where its hook cannot alter swaps", () => {
    const made = fixtureCase({ protocol: "v4", hookAddress: CASE_LIQUIDITY_HOOK });

    expect(made.pool.protocolVersion).toBe("v4");
    if (made.pool.protocolVersion !== "v4") throw new Error("v4");
    expect(made.pool.hookAddress).toBe(CASE_LIQUIDITY_HOOK);
    expect(made.pool.fee).toEqual({ kind: "static", feePpm: 3000 });
  });

  it("makes no case of an analysis that stopped before a range", () => {
    expect(caseOf({ status: "unavailable", step: "history", reason: "timeout", notice: "market-data-timed-out" }, 1)).toBeNull();
  });

  it("makes no case of a pool whose hook may alter what swaps pay, since no fee may be attributed to its range", () => {
    const analysis = caseAnalysis({ protocol: "v4", hookAddress: CASE_SWAP_HOOK });
    /* The pipeline still replays it — the gate is the disclosure's, not a missing figure. */
    expect(analysis.status).not.toBe("unavailable");
    if (analysis.status !== "unavailable") expect(analysis.data.backtest).not.toBeNull();

    expect(caseOf(analysis, 1)).toBeNull();
  });

  it("makes no case of a history too short to open a position thirty days ago", () => {
    const analysis = caseAnalysis({ days: 45 });
    if (analysis.status === "unavailable") throw new Error("forty-five days analyse; they just cannot open a month ago");
    expect(analysis.data.backtest).toBeNull();

    expect(caseOf(analysis, 1)).toBeNull();
  });

  it("makes no case where the dollar rate was unread, so the deposit could not be sized", () => {
    const analysis = caseAnalysis({ tvlUsd: null });
    if (analysis.status === "unavailable") throw new Error("fixture");
    expect(analysis.data.backtest?.fees).toBeNull();

    expect(caseOf(analysis, 1)).toBeNull();
  });

  it("makes no case where a wholly-inside day had no published fees: a smaller figure is not a figure", () => {
    const analysis = caseAnalysis({ feesMissingOn: [7] });
    if (analysis.status === "unavailable") throw new Error("fixture");
    expect(analysis.data.backtest?.fees?.daysUnmeasurable).toBe(1);

    expect(caseOf(analysis, 1)).toBeNull();
    /* And the same day missing before the window costs nothing: it is not a replayed day. */
    expect(caseOf(caseAnalysis({ feesMissingOn: [40] }), 1)).not.toBeNull();
  });

  /*
   * The two replays count different days once the price has left: the price
   * comes back to a range the static position still holds and the re-centred
   * one has moved away from. A day unmeasurable there is the static replay's
   * blank alone, and it is refused on that alone — and the other way round.
   */
  it("refuses an unmeasurable day whichever of the two replays counted it", () => {
    const away = [...Array.from({ length: 10 }, () => 1), ...Array.from({ length: 10 }, () => 1.5), ...Array.from({ length: 10 }, () => 1)];
    const staticOnly = caseAnalysis({ path: away, feesMissingOn: [10] });
    if (staticOnly.status === "unavailable") throw new Error("fixture");
    expect(staticOnly.data.backtest?.fees?.daysUnmeasurable).toBe(1);
    expect(staticOnly.data.recentring?.fees?.daysUnmeasurable).toBe(0);
    expect(caseOf(staticOnly, 1)).toBeNull();

    const recentredOnly = caseAnalysis({ path: away, feesMissingOn: [15] });
    if (recentredOnly.status === "unavailable") throw new Error("fixture");
    expect(recentredOnly.data.backtest?.fees?.daysUnmeasurable).toBe(0);
    expect(recentredOnly.data.recentring?.fees?.daysUnmeasurable).toBe(1);
    expect(caseOf(recentredOnly, 1)).toBeNull();
  });

  it("makes no case where the re-centring replay has no verdict", () => {
    const analysis = caseAnalysis();
    if (analysis.status === "unavailable") throw new Error("fixture");
    const without = { ...analysis, data: { ...analysis.data, recentring: null } };
    const unsized =
      analysis.data.recentring === null
        ? null
        : { ...analysis, data: { ...analysis.data, recentring: { ...analysis.data.recentring, afterFees: null } } };

    expect(caseOf(without, 1)).toBeNull();
    expect(unsized === null ? null : caseOf(unsized, 1)).toBeNull();
  });

  it("reads a partial analysis as it reads a whole one: the caveats are about figures a case does not carry", () => {
    const analysis = caseAnalysis();
    if (analysis.status !== "success") throw new Error("fixture");
    const partial = { status: "partial" as const, data: analysis.data, warnings: ["market-data-partial" as never] };

    expect(caseOf(partial, 1)).toEqual(caseOf(analysis, 1));
  });
});

describe("the order of the cases", () => {
  const made = (id: string, resultVsHeldUsd: number) => ({ ...fixtureCase(), pool: { ...fixtureCase().pool, id }, resultVsHeldUsd });

  it("is best first by the result against holding, fees in, and nothing else", () => {
    const worst = made(`0x${"1".repeat(40)}`, -40);
    const middling = made(`0x${"2".repeat(40)}`, 3);
    const best = made(`0x${"3".repeat(40)}`, 12.5);
    /* A larger fee figure does not lift a case: the order is the result, not the fees. */
    const richInFees = { ...worst, feesUsd: 500, feesOfDeposit: 0.5 };

    expect(orderCases([middling, richInFees, best]).map((one) => one.pool.id)).toEqual([best, middling, richInFees].map((one) => one.pool.id));
  });

  it("breaks a tie by pool id, so the same month orders the same way twice", () => {
    const a = made(`0x${"a".repeat(40)}`, 1);
    const b = made(`0x${"b".repeat(40)}`, 1);

    expect(orderCases([b, a]).map((one) => one.pool.id)).toEqual([a.pool.id, b.pool.id]);
    expect(orderCases([a, b]).map((one) => one.pool.id)).toEqual([a.pool.id, b.pool.id]);
  });

  it("leaves what it was given as it was", () => {
    const given = [made(`0x${"1".repeat(40)}`, -1), made(`0x${"2".repeat(40)}`, 1)];
    orderCases(given);

    expect(given.map((one) => one.resultVsHeldUsd)).toEqual([-1, 1]);
  });

  it("shows a dozen at most", () => {
    expect(CASES_SHOWN).toBe(12);
  });
});

describe("which of the week's pools are worth replaying", () => {
  const token = (symbol: string, address: string) => ({ chainId: 1, symbol, decimals: 18, address });
  const v3 = (id: string, volumeUsd: number): MostTradedPool => ({
    pool: { protocolVersion: "v3", chainId: 1, id, token0: token("A", `0x${"1".repeat(40)}`), token1: token("B", `0x${"2".repeat(40)}`), feePpm: 500 },
    volumeUsd,
    feesUsd: null,
    daysCounted: 7,
    hookAltersSwaps: false,
  });
  const v4 = (id: string, volumeUsd: number, hookAltersSwaps: boolean): MostTradedPool => ({
    pool: {
      protocolVersion: "v4",
      chainId: 1,
      id,
      token0: token("A", `0x${"1".repeat(40)}`),
      token1: token("B", `0x${"2".repeat(40)}`),
      tickSpacing: 10,
      fee: { kind: "static", feePpm: 500 },
      protocolFee: null,
      hookAddress: hookAltersSwaps ? `0x${"1".repeat(36)}00c4` : null,
    },
    volumeUsd,
    feesUsd: null,
    daysCounted: 7,
    hookAltersSwaps,
  });
  const listed = (v3Pools: readonly MostTradedPool[], v4Pools: readonly MostTradedPool[] | null): MostTraded => ({
    v3: { status: "listed", pools: v3Pools, fetchedAt: "2026-10-01T00:00:00.000Z" },
    v4: v4Pools === null ? null : { status: "listed", pools: v4Pools, fetchedAt: "2026-10-01T00:00:00.000Z" },
  });

  it("merges both halves, busiest first, since this list decides what is read and not how any is ranked", () => {
    const candidates = caseCandidates(
      listed([v3(`0x${"1".repeat(40)}`, 100), v3(`0x${"2".repeat(40)}`, 300)], [v4(`0x${"3".repeat(64)}`, 200, false)]),
    );

    expect(candidates).toEqual([
      { protocolVersion: "v3", id: `0x${"2".repeat(40)}`, volumeUsd: 300 },
      { protocolVersion: "v4", id: `0x${"3".repeat(64)}`, volumeUsd: 200 },
      { protocolVersion: "v3", id: `0x${"1".repeat(40)}`, volumeUsd: 100 },
    ]);
  });

  it("leaves out a pool whose hook may alter swaps before its reads are spent", () => {
    const candidates = caseCandidates(listed([], [v4(`0x${"3".repeat(64)}`, 900, true), v4(`0x${"4".repeat(64)}`, 1, false)]));

    expect(candidates.map(({ id }) => id)).toEqual([`0x${"4".repeat(64)}`]);
  });

  it("reads a half that is missing or unavailable as empty, not as a failure of the other", () => {
    expect(caseCandidates(listed([v3(`0x${"1".repeat(40)}`, 1)], null))).toHaveLength(1);
    expect(
      caseCandidates({ v3: { status: "unavailable", notice: "market-data-timed-out" }, v4: listed([], [v4(`0x${"3".repeat(64)}`, 1, false)]).v4 }),
    ).toHaveLength(1);
  });
});
