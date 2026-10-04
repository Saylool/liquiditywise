import { describe, expect, it } from "vitest";

import type { DataResult } from "../../schemas";
import type { V3PositionHistories, V3PositionSnapshot } from "../uniswap/ethereumV3PositionSnapshots";
import {
  amountsHeld,
  amountsHeldAtTick,
  composePositionRecord,
  feesBetweenChanges,
  historyOf,
  type ManagerPosition,
  type PositionRecord,
  type PositionRecordInput,
  priceAtSqrt,
  valueRecord,
  verifyHistory,
} from "./positionRecord";

/*
 * The position the chain fixtures elsewhere are built from (see
 * uniswap/feeGrowth.test.ts): mainnet #998651, USDC/WETH at 0.05%, ticks
 * 190190 to 200570. Its liquidity and the manager's fee-growth snapshot are
 * the chain's, read at block 26,006,326, and so is what it had earned since
 * its last change: 161,442,767 base units of USDC and 64,800,531,737,822,263
 * of WETH.
 *
 * Its history is not the chain's. The stretch before the last change is
 * written to come to 956.148775 USDC — the figure the position actually
 * collected after its first stretch, measured on 2026-10-04 — and an amount
 * of WETH chosen here; the block numbers, dates and deposits are invented.
 * What is checked is the arithmetic, against figures worked out separately.
 */

const Q128 = 1n << 128n;
const UINT256 = 1n << 256n;

const LIQUIDITY = 2_204_989_653_163_776n;
const INSIDE_LAST0 = 3_979_518_691_523_452_388_431_907_510_082_993n;
const INSIDE_LAST1 = 1_726_981_430_484_923_575_981_082_306_417_489_046_260_583n;
/** What the stretch before the last change grew by, chosen so the stretch earns the figures below. */
const GROWTH0 = 147_556_505_681_883_859_350_850_059_210_209n;
const GROWTH1 = 58_662_093_680_458_079_105_034_725_300_833_359_593_964n;
const STRETCH0 = 956_148_775n;
const STRETCH1 = 380_123_456_789_012_345n;
/** Since the last change, as the chain had it: `uncollectedFee` with nothing owed. */
const SINCE0 = 161_442_767n;
const SINCE1 = 64_800_531_737_822_263n;

const USDC_WETH = { token0: 6, token1: 18 } as const;
/** A price inside the range, a little above tick 197,645: `1.0001^(197645.5 / 2) * 2^96`. */
const SQRT_PRICE = BigInt(Math.round(1.0001 ** (197_645.5 / 2) * 2 ** 96));

const manager = (overrides: Partial<ManagerPosition> = {}): ManagerPosition => ({
  tickLower: 190_190,
  tickUpper: 200_570,
  liquidity: LIQUIDITY.toString(),
  feeGrowthInside0Last: INSIDE_LAST0,
  feeGrowthInside1Last: INSIDE_LAST1,
  tokensOwed0: 0n,
  tokensOwed1: 0n,
  ...overrides,
});

const snapshot = (overrides: Partial<V3PositionSnapshot> = {}): V3PositionSnapshot => ({
  blockNumber: 20_000_000n,
  at: "2024-05-01T10:00:00.000Z",
  liquidity: LIQUIDITY,
  deposited0: 5_000,
  deposited1: 1.5,
  withdrawn0: 0,
  withdrawn1: 0,
  feeGrowthInside0: INSIDE_LAST0 - GROWTH0,
  feeGrowthInside1: INSIDE_LAST1 - GROWTH1,
  ...overrides,
});

/** Opened, then collected from: the second row is the manager's snapshot now. */
const OPENED = snapshot();
const COLLECTED = snapshot({
  blockNumber: 20_100_000n,
  at: "2024-05-15T10:00:00.000Z",
  feeGrowthInside0: INSIDE_LAST0,
  feeGrowthInside1: INSIDE_LAST1,
});

const input = (overrides: Partial<PositionRecordInput> = {}): PositionRecordInput => ({
  position: manager(),
  decimals: USDC_WETH,
  history: { kind: "read", snapshots: [OPENED, COLLECTED] },
  uncollected: { token0: SINCE0.toString(), token1: SINCE1.toString() },
  sqrtPriceX96: SQRT_PRICE,
  ...overrides,
});

const verified = (overrides: Partial<PositionRecordInput> = {}): PositionRecord => {
  const result = composePositionRecord(input(overrides));
  if (result.status !== "verified") throw new Error(`expected a record: ${JSON.stringify(result)}`);
  return result.record;
};

describe("one position's history out of a read of several", () => {
  const read = (overrides: Partial<V3PositionHistories> = {}): DataResult<V3PositionHistories> => ({
    status: "success",
    data: {
      asked: new Set(["7", "8", "9"]),
      snapshots: new Map([["7", [OPENED]]]),
      unreadable: new Set(["8"]),
      ...overrides,
    },
  });

  it("is its rows when it was asked about and read", () => {
    expect(historyOf(read(), "7")).toEqual({ kind: "read", snapshots: [OPENED] });
  });

  /* Asked and answered with nothing is a history with nothing in it, not an unread one. */
  it("is empty when it was asked about and has no rows", () => {
    expect(historyOf(read(), "9")).toEqual({ kind: "read", snapshots: [] });
  });

  it("is unreadable when a row of it could not be read", () => {
    expect(historyOf(read(), "8")).toEqual({ kind: "unreadable" });
  });

  it.each([
    ["was never asked for", undefined],
    ["failed", { status: "unavailable", reason: "timeout", notice: "market-data-timed-out" } as const],
    ["did not ask about this position", read()],
  ])("is unread when the read %s", (_label, history) => {
    expect(historyOf(history, "10")).toEqual({ kind: "unread" });
  });

  it("is unread when the read failed, even for a position it would have asked about", () => {
    expect(historyOf({ status: "unavailable", reason: "timeout", notice: "market-data-timed-out" }, "7")).toEqual({
      kind: "unread",
    });
  });
});

describe("whether a history reaches the chain's present", () => {
  it("accepts one whose newest row is the manager's own record, and orders it oldest first", () => {
    expect(verifyHistory([COLLECTED, OPENED], manager())).toEqual({ ok: true, ordered: [OPENED, COLLECTED] });
  });

  it("refuses a position the subgraph has no row for", () => {
    expect(verifyHistory([], manager())).toEqual({ ok: false, reason: "no-history" });
  });

  /* The newest row is what is compared, and it is the newest by block — not the last to arrive. */
  it("compares the newest row by block, not the first or the last given", () => {
    /* A later change the chain has not got: the subgraph and the manager disagree, whatever order it came in. */
    const later = snapshot({ blockNumber: 20_200_000n });
    expect(verifyHistory([COLLECTED, later], manager())).toEqual({ ok: false, reason: "fee-growth-differs" });
    expect(verifyHistory([later, COLLECTED], manager())).toEqual({ ok: false, reason: "fee-growth-differs" });
  });

  it("refuses two rows for one block, whose order nothing says", () => {
    expect(verifyHistory([OPENED, snapshot({ blockNumber: OPENED.blockNumber }), COLLECTED], manager())).toEqual({
      ok: false,
      reason: "same-block",
    });
  });

  it("refuses a history whose running totals record no deposit", () => {
    const empty = { deposited0: 0, deposited1: 0 };
    expect(verifyHistory([snapshot(empty), { ...COLLECTED, ...empty }], manager())).toEqual({
      ok: false,
      reason: "no-deposit",
    });
  });

  /* A range wholly above or below the price is opened with one token alone. */
  it.each([
    ["token0 alone", { deposited0: 5_000, deposited1: 0 }],
    ["token1 alone", { deposited0: 0, deposited1: 1.5 }],
  ])("accepts a deposit of %s", (_label, deposits) => {
    expect(verifyHistory([OPENED, { ...COLLECTED, ...deposits }], manager())).toMatchObject({ ok: true });
  });

  it("takes the deposits from the newest row, where the running totals are whole", () => {
    expect(verifyHistory([OPENED, { ...COLLECTED, deposited0: 0, deposited1: 0 }], manager())).toEqual({
      ok: false,
      reason: "no-deposit",
    });
  });

  it("refuses a history whose newest liquidity is not the manager's, by a single unit", () => {
    expect(verifyHistory([OPENED, COLLECTED], manager({ liquidity: (LIQUIDITY + 1n).toString() }))).toEqual({
      ok: false,
      reason: "liquidity-differs",
    });
  });

  it.each([
    ["token0's", { feeGrowthInside0Last: INSIDE_LAST0 + 1n }],
    ["token1's", { feeGrowthInside1Last: INSIDE_LAST1 + 1n }],
  ])("refuses a history whose newest fee-growth snapshot is not the manager's, in %s alone", (_label, overrides) => {
    expect(verifyHistory([OPENED, COLLECTED], manager(overrides))).toEqual({
      ok: false,
      reason: "fee-growth-differs",
    });
  });
});

describe("the fees earned up to the last change", () => {
  it("are the liquidity times the growth across each stretch, floored as the manager floors it", () => {
    expect(feesBetweenChanges([OPENED, COLLECTED])).toEqual({ token0: STRETCH0, token1: STRETCH1 });
  });

  it("are nothing for a position changed only once", () => {
    expect(feesBetweenChanges([OPENED])).toEqual({ token0: 0n, token1: 0n });
  });

  /*
   * The counters are uint256 and wrap. A later snapshot numerically below the
   * earlier one is the counter having passed 2^256, not a negative fee.
   */
  it("subtract across the wrap of a uint256 counter", () => {
    const earlier = snapshot({ feeGrowthInside0: UINT256 - 5n * 10n ** 30n, feeGrowthInside1: UINT256 - 1n });
    const later = snapshot({ blockNumber: 20_000_001n, feeGrowthInside0: 7n * 10n ** 30n, feeGrowthInside1: Q128 - 1n });

    expect(feesBetweenChanges([earlier, later])).toEqual({
      token0: (12n * 10n ** 30n * LIQUIDITY) / Q128,
      token1: LIQUIDITY,
    });
    expect((12n * 10n ** 30n * LIQUIDITY) / Q128).toBe(77_758_586n);
  });

  /*
   * The liquidity a stretch was earned with is the one the change at its
   * start left behind: here, a deposit tripled the position half-way.
   */
  it("count each stretch at the liquidity its earlier row left, not the later one", () => {
    const rows = [
      snapshot({ liquidity: 100n, feeGrowthInside0: 0n, feeGrowthInside1: 0n }),
      snapshot({ blockNumber: 20_000_001n, liquidity: 300n, feeGrowthInside0: 10n * Q128, feeGrowthInside1: 2n * Q128 }),
      snapshot({ blockNumber: 20_000_002n, liquidity: 300n, feeGrowthInside0: 11n * Q128, feeGrowthInside1: 5n * Q128 }),
    ];

    expect(feesBetweenChanges(rows)).toEqual({ token0: 100n * 10n + 300n * 1n, token1: 100n * 2n + 300n * 3n });
  });

  /* Withdrawn to nothing and topped up again: the empty stretch earned nothing, whatever the pool did. */
  it("earn nothing over a stretch with no liquidity in it", () => {
    const rows = [
      snapshot({ liquidity: 0n, feeGrowthInside0: 0n, feeGrowthInside1: 0n }),
      snapshot({ blockNumber: 20_000_001n, liquidity: 50n, feeGrowthInside0: 1_000n * Q128, feeGrowthInside1: 9n * Q128 }),
      snapshot({ blockNumber: 20_000_002n, liquidity: 50n, feeGrowthInside0: 1_002n * Q128, feeGrowthInside1: 10n * Q128 }),
    ];

    expect(feesBetweenChanges(rows)).toEqual({ token0: 100n, token1: 50n });
  });

  /* A junk-token pool's accounting: past what the protocol can record is not a fee anybody earned. */
  it.each([
    ["token0's", { feeGrowthInside0: 0n }, { feeGrowthInside0: 1n << 200n }],
    ["token1's", { feeGrowthInside1: 0n }, { feeGrowthInside1: 1n << 200n }],
  ])("are unreadable when %s stretch does not fit the protocol's uint128", (_label, earlier, later) => {
    const rows = [
      snapshot({ liquidity: 1n << 100n, feeGrowthInside0: 0n, feeGrowthInside1: 0n, ...earlier }),
      snapshot({ blockNumber: 20_000_001n, feeGrowthInside0: 0n, feeGrowthInside1: 0n, ...later }),
    ];

    expect(feesBetweenChanges(rows)).toBeNull();
  });
});

describe("what a liquidity holds at a price", () => {
  const Q96 = 2 ** 96;
  const held = (sqrtPriceX96: bigint, decimals = { token0: 0, token1: 0 }) =>
    amountsHeld({ liquidity: 10n ** 18n, tickLower: -1_000, tickUpper: 1_000, sqrtPriceX96, decimals });

  /* The protocol's formulas, written out again here rather than called, and compared to ten figures. */
  const lower = 1.0001 ** -500;
  const upper = 1.0001 ** 500;
  const near = (value: number | undefined, expected: number) => expect((value ?? 0) / expected).toBeCloseTo(1, 10);

  it("is both tokens inside the range", () => {
    const amounts = held(BigInt(Q96));

    near(amounts?.token0, 1e18 * (1 - 1 / upper));
    near(amounts?.token1, 1e18 * (1 - lower));
  });

  it("is token0 alone below the range and token1 alone above it", () => {
    const below = held(BigInt(Math.round(0.5 * Q96)));
    near(below?.token0, 1e18 * (1 / lower - 1 / upper));
    expect(below?.token1).toBe(0);
    const above = held(BigInt(2 * Q96));
    expect(above?.token0).toBe(0);
    near(above?.token1, 1e18 * (upper - lower));
  });

  it("is unread for a range with no width, or a liquidity past what a double holds", () => {
    const at = { sqrtPriceX96: 1n << 96n, decimals: USDC_WETH };
    expect(amountsHeld({ ...at, liquidity: 1n, tickLower: 10, tickUpper: 10 })).toBeNull();
    expect(amountsHeld({ ...at, liquidity: 1n << 1100n, tickLower: -10, tickUpper: 10 })).toBeNull();
  });

  it("applies each token's own decimals", () => {
    const raw = held(BigInt(Q96));
    const scaled = held(BigInt(Q96), { token0: 6, token1: 18 });

    expect(scaled?.token0).toBeCloseTo((raw?.token0 ?? 0) / 1e6, 6);
    expect(scaled?.token1).toBeCloseTo((raw?.token1 ?? 0) / 1e18, 12);
  });

  /* The reading a listed position carries: the pool's tick, not its exact price. */
  it("is the same at a tick as at that tick's own square-root price", () => {
    const atTick = (tick: number) =>
      amountsHeldAtTick({ liquidity: 10n ** 18n, tickLower: -1_000, tickUpper: 1_000, tick, decimals: { token0: 0, token1: 0 } });

    /* To a part in a trillion of the liquidity: the square-root price is rounded to an integer on the way in. */
    for (const tick of [-1_500, -1_000, 0, 999, 1_000, 2_000]) {
      const exact = held(BigInt(Math.round(1.0001 ** (tick / 2) * Q96)));
      expect(Math.abs((atTick(tick)?.token0 ?? Number.NaN) - (exact?.token0 ?? Number.NaN)), `${tick}`).toBeLessThan(1e6);
      expect(Math.abs((atTick(tick)?.token1 ?? Number.NaN) - (exact?.token1 ?? Number.NaN)), `${tick}`).toBeLessThan(1e6);
    }
    /* Past an edge, one token alone, wherever on that side. */
    expect(atTick(-5_000)).toEqual(atTick(-1_001));
    expect(atTick(1_000)?.token0).toBe(0);
    near(atTick(1_000)?.token1, 1e18 * (upper - lower));
    expect(atTick(900_000)).toBeNull();
  });

  it("is unread for ticks outside the protocol's range", () => {
    expect(amountsHeld({ liquidity: 1n, tickLower: -900_000, tickUpper: 0, sqrtPriceX96: 1n << 96n, decimals: USDC_WETH })).toBeNull();
  });

  it("prices token0 in token1 in whole tokens, decimals applied", () => {
    expect(priceAtSqrt(1n << 96n, { token0: 0, token1: 0 })).toBe(1);
    expect(priceAtSqrt(2n << 96n, { token0: 0, token1: 0 })).toBe(4);
    /* USDC/WETH: about 2,590 USDC to the WETH, which is 1 / 2,590 WETH to the USDC. */
    expect(1 / (priceAtSqrt(SQRT_PRICE, USDC_WETH) ?? 0)).toBeCloseTo(1 / (1.0001 ** 197_645.5 * 1e-12), 6);
  });

  /* Neither is a price a pool can hold; both are refused rather than turned into a figure. */
  it("does not price a zero, or a price past what a double holds", () => {
    expect(priceAtSqrt(0n, USDC_WETH)).toBeNull();
    expect(priceAtSqrt(1n << 700n, USDC_WETH)).toBeNull();
  });
});

describe("a position's record", () => {
  it("adds every stretch's fees to what the chain says it has earned since the last change", () => {
    const record = verified();

    expect(record.fees.token0).toBeCloseTo(Number(STRETCH0 + SINCE0) / 1e6, 9);
    expect(record.fees.token1).toBeCloseTo(Number(STRETCH1 + SINCE1) / 1e18, 15);
    expect(record.fees.token0).toBeCloseTo(1_117.591542, 6);
  });

  /*
   * After a withdrawal the manager's owed amounts hold the withdrawn principal
   * until it is collected, and the fees of every stretch before. Both are
   * counted elsewhere — as withdrawn, and in the sum above — so only what has
   * accrued since the last change is taken from the chain's figure.
   */
  it("counts what the manager had already credited once, not twice", () => {
    const owed0 = 2_000_000_000n + STRETCH0;
    const owed1 = 500_000_000_000_000_000n + STRETCH1;
    const record = verified({
      position: manager({ tokensOwed0: owed0, tokensOwed1: owed1 }),
      uncollected: { token0: (owed0 + SINCE0).toString(), token1: (owed1 + SINCE1).toString() },
      history: {
        kind: "read",
        snapshots: [OPENED, { ...COLLECTED, withdrawn0: 2_000, withdrawn1: 0.5 }],
      },
    });

    expect(record.fees.token0).toBeCloseTo(Number(STRETCH0 + SINCE0) / 1e6, 9);
    expect(record.fees.token1).toBeCloseTo(Number(STRETCH1 + SINCE1) / 1e18, 15);
    expect(record.withdrawn).toEqual({ token0: 2_000, token1: 0.5 });
  });

  it("takes deposits and withdrawals from the newest row's running totals, and its date from the first", () => {
    const record = verified({
      history: {
        kind: "read",
        snapshots: [OPENED, { ...COLLECTED, deposited0: 7_500, deposited1: 2, withdrawn0: 10, withdrawn1: 0.01 }],
      },
    });

    expect(record.deposited).toEqual({ token0: 7_500, token1: 2 });
    expect(record.withdrawn).toEqual({ token0: 10, token1: 0.01 });
    expect(record.openedAt).toBe("2024-05-01T10:00:00.000Z");
  });

  it("holds what its liquidity holds at the pool's price now, which is the chain's", () => {
    const record = verified();
    const root = Number(SQRT_PRICE) / 2 ** 96;
    const upper = 1.0001 ** (200_570 / 2);
    const lower = 1.0001 ** (190_190 / 2);

    expect(record.now.token0).toBeCloseTo((Number(LIQUIDITY) * (1 / root - 1 / upper)) / 1e6, 4);
    expect(record.now.token1).toBeCloseTo((Number(LIQUIDITY) * (root - lower)) / 1e18, 10);
    expect(record.price).toBeCloseTo(root * root * 1e-12, 12);
  });

  it.each([
    ["the history was not read", { history: { kind: "unread" } as const }],
    ["the fees were not read", { uncollected: null }],
    ["the price was not read", { sqrtPriceX96: null }],
    [
      "the chain's figure is below what the manager had credited, which is not a reading of one position",
      { position: manager({ tokensOwed0: SINCE0 + 1n }) },
    ],
    ["its ticks cannot be priced", { position: manager({ tickLower: -900_000 }) }],
    ["the price is not one a pool can hold", { sqrtPriceX96: 0n }],
  ])("is unread when %s", (_label, overrides) => {
    expect(composePositionRecord(input(overrides))).toEqual({ status: "unread" });
  });

  /*
   * A figure the chain did not give is "could not be read", whatever the
   * history says: the record could not have been worked out either way, and
   * "could not be checked" would blame a history nobody got to compare.
   */
  it.each([
    ["the price", { sqrtPriceX96: null }],
    ["the fees", { uncollected: null }],
  ])("is unread when %s was not read, even beside a history that is itself unreadable", (_label, overrides) => {
    expect(composePositionRecord(input({ ...overrides, history: { kind: "unreadable" } }))).toEqual({ status: "unread" });
    expect(composePositionRecord(input({ ...overrides, history: { kind: "read", snapshots: [] } }))).toEqual({
      status: "unread",
    });
  });

  it("is unread, not unverified, when the token1 fee is the one below what was credited", () => {
    expect(composePositionRecord(input({ position: manager({ tokensOwed1: SINCE1 + 1n }) }))).toEqual({
      status: "unread",
    });
  });

  it.each([
    ["a row could not be read", { history: { kind: "unreadable" } as const }, "unreadable-history"],
    ["the subgraph has no row", { history: { kind: "read", snapshots: [] } as const }, "no-history"],
    ["the subgraph is behind the chain", { history: { kind: "read", snapshots: [OPENED] } as const }, "fee-growth-differs"],
    [
      "a stretch overflowed",
      {
        position: manager({ liquidity: (1n << 100n).toString(), feeGrowthInside0Last: 1n << 200n, feeGrowthInside1Last: 0n }),
        history: {
          kind: "read",
          snapshots: [
            snapshot({ liquidity: 1n << 100n, feeGrowthInside0: 0n, feeGrowthInside1: 0n }),
            snapshot({ blockNumber: 20_000_001n, liquidity: 1n << 100n, feeGrowthInside0: 1n << 200n, feeGrowthInside1: 0n }),
          ],
        } as const,
      },
      "fees-overflow",
    ],
  ])("is unverified when %s", (_label, overrides, reason) => {
    expect(composePositionRecord(input(overrides))).toEqual({ status: "unverified", reason });
  });
});

describe("a record valued in one token", () => {
  /* Round figures, so every line below can be checked by hand: one token0 is worth 4 token1. */
  const RECORD: PositionRecord = {
    openedAt: "2024-05-01T10:00:00.000Z",
    deposited: { token0: 10, token1: 40 },
    withdrawn: { token0: 1, token1: 2 },
    now: { token0: 5, token1: 50 },
    fees: { token0: 0.5, token1: 3 },
    price: 4,
  };

  it("values every line in token1 at the record's own price", () => {
    expect(valueRecord(RECORD, "token1")).toEqual({
      held: 80,
      now: 70,
      withdrawn: 6,
      fees: 5,
      rangeEffect: -4,
      result: 1,
    });
  });

  it("values every line in token0 at the same price, turned round", () => {
    expect(valueRecord(RECORD, "token0")).toEqual({
      held: 20,
      now: 17.5,
      withdrawn: 1.5,
      fees: 1.25,
      rangeEffect: -1,
      result: 0.25,
    });
  });

  /* The result is the position's side less holding's, so a position that did worse than holding comes out negative. */
  it("is negative when the position is worth less than holding, fees and all", () => {
    const values = valueRecord({ ...RECORD, fees: { token0: 0, token1: 1 } }, "token1");

    expect(values.result).toBe(-3);
    expect(values.rangeEffect + values.fees).toBe(values.result);
  });

  /*
   * Measured on 2026-10-04: an untouched position holding 3.8 * 10^25 of a
   * token came out 6 * 10^10 ahead of holding — the doubles disagreeing in
   * the fifteenth figure. Below a billionth of the sums compared is no effect.
   */
  it("reports no range effect where the difference is below what the arithmetic resolves", () => {
    const untouched = { ...RECORD, deposited: { token0: 3.8185e25, token1: 0 }, withdrawn: { token0: 0, token1: 0 }, fees: { token0: 0, token1: 0 } };

    expect(valueRecord({ ...untouched, now: { token0: 3.8185e25 + 6.013e10, token1: 0 } }, "token0")).toMatchObject({
      rangeEffect: 0,
      result: 0,
    });
    expect(valueRecord({ ...untouched, now: { token0: 3.8185e25 - 6.013e10, token1: 0 } }, "token0").rangeEffect).toBe(0);
  });

  it("still reports a range effect just past a billionth of what holding would be worth", () => {
    const deposited = { token0: 1_000_000, token1: 0 };
    const base = { ...RECORD, deposited, withdrawn: { token0: 0, token1: 0 }, fees: { token0: 0, token1: 0 } };

    expect(valueRecord({ ...base, now: { token0: 1_000_000 - 0.0011, token1: 0 } }, "token0").rangeEffect).toBeCloseTo(-0.0011, 9);
    expect(valueRecord({ ...base, now: { token0: 1_000_000 + 0.0011, token1: 0 } }, "token0").rangeEffect).toBeCloseTo(0.0011, 9);
    expect(valueRecord({ ...base, now: { token0: 1_000_000 - 0.0009, token1: 0 } }, "token0").rangeEffect).toBe(0);
  });

  /*
   * Against the textbook: a range as wide as the protocol allows behaves as a
   * full-range position, and at four times the price it opened at, the
   * position is worth 2·√4 / (1 + 4) of holding — twenty per cent less.
   */
  it("finds the textbook impermanent loss for a full range at four times the opening price", () => {
    const wide = { liquidity: 10n ** 24n, tickLower: -887_200, tickUpper: 887_200, decimals: { token0: 0, token1: 0 } };
    const opened = amountsHeld({ ...wide, sqrtPriceX96: 1n << 96n });
    const now = amountsHeld({ ...wide, sqrtPriceX96: 2n << 96n });
    if (opened === null || now === null) throw new Error("expected amounts");

    const values = valueRecord(
      { openedAt: RECORD.openedAt, deposited: opened, withdrawn: { token0: 0, token1: 0 }, now, fees: { token0: 0, token1: 0 }, price: 4 },
      "token1",
    );

    expect(values.rangeEffect / values.held).toBeCloseTo(-0.2, 6);
    expect(values.result).toBe(values.rangeEffect);
  });
});
