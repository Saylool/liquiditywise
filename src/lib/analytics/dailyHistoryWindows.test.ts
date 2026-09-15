import { describe, expect, it } from "vitest";

import type { PoolDailyPriceHistory } from "../../schemas";
import { takeDaysEnding, takeRecentDays } from "./dailyHistoryWindows";

const DAY_MS = 86_400_000;
const START = Date.parse("2026-05-01T00:00:00.000Z");
const at = (index: number) => new Date(START + index * DAY_MS).toISOString();

const historyOf = (dayCount: number, presentDays?: readonly number[]): PoolDailyPriceHistory => {
  const days = presentDays ?? Array.from({ length: dayCount }, (_unused, index) => index);

  return {
    pool: { protocolVersion: "v3", chainId: 1, id: `0x${"a".repeat(40)}` },
    fetchedAt: at(dayCount),
    sourceBlockNumber: "21500000",
    sourceBlockTimestamp: at(dayCount),
    rangeStart: at(0),
    rangeEndExclusive: at(dayCount),
    interval: "1d",
    priceDirection: "token0PriceInToken1",
    points: days.map((index) => ({
      timestamp: at(index),
      price: 1_000 + index,
      low: 990 + index,
      high: 1_010 + index,
      volumeUsd: 1_000,
      feesUsd: 5,
    })),
    source: "uniswap-v3-subgraph",
  } as PoolDailyPriceHistory;
};

describe("takeRecentDays", () => {
  it("keeps only the most recent days, bounds included", () => {
    const window = takeRecentDays(historyOf(121), 31);

    expect(window).not.toBeNull();
    expect(window?.rangeStart).toBe(at(90));
    expect(window?.rangeEndExclusive).toBe(at(121));
    expect(window?.points).toHaveLength(31);
    expect(window?.points[0]?.timestamp).toBe(at(90));
    expect(window?.points.at(-1)?.timestamp).toBe(at(120));
  });

  /*
   * The property the whole change rests on: slicing a long history to the window
   * a figure is measured over must give exactly what a short history would have.
   */
  it("gives the same window a shorter history would have given on its own", () => {
    const fromLong = takeRecentDays(historyOf(121), 31);
    const short = historyOf(121);
    const fromShort = takeDaysEnding(short, at(121), 31);

    expect(fromLong).toEqual(fromShort);
    expect(fromLong?.points.map((point) => point.price)).toEqual(
      Array.from({ length: 31 }, (_unused, index) => 1_090 + index),
    );
  });

  it("carries the source metadata through untouched", () => {
    const window = takeRecentDays(historyOf(121), 31);

    expect(window?.pool.id).toBe(`0x${"a".repeat(40)}`);
    expect(window?.sourceBlockNumber).toBe("21500000");
    expect(window?.priceDirection).toBe("token0PriceInToken1");
  });

  /*
   * A pool younger than the window asked for still has a real history, and the
   * volatility layer already reports how much of a window it could use. Refusing
   * here would take a whole analysis down over a pool's age.
   */
  it("clamps to the history's own start rather than refusing", () => {
    const window = takeRecentDays(historyOf(10), 31);

    expect(window?.rangeStart).toBe(at(0));
    expect(window?.points).toHaveLength(10);
  });

  it("keeps a gap as a gap instead of filling it", () => {
    const withGap = historyOf(40, [35, 36, 38, 39]);
    const window = takeRecentDays(withGap, 10);

    expect(window?.points.map((point) => point.timestamp)).toEqual([
      at(35),
      at(36),
      at(38),
      at(39),
    ]);
  });

  it.each([
    ["zero days", 0],
    ["a negative span", -5],
    ["a fractional span", 2.5],
  ])("refuses %s", (_label, days) => {
    expect(takeRecentDays(historyOf(40), days)).toBeNull();
  });
});

describe("takeDaysEnding", () => {
  it("windows an interval that ends in the past", () => {
    const window = takeDaysEnding(historyOf(121), at(91), 31);

    expect(window?.rangeStart).toBe(at(60));
    expect(window?.rangeEndExclusive).toBe(at(91));
    expect(window?.points).toHaveLength(31);
    expect(window?.points.at(-1)?.timestamp).toBe(at(90));
  });

  /*
   * The two windows a walk-forward check needs must not share a day: one is what
   * the band was fitted from, the other is what it is measured against.
   */
  it("produces windows that meet without overlapping", () => {
    const history = historyOf(121);
    const fitted = takeDaysEnding(history, at(91), 31);
    const measured = takeDaysEnding(history, at(121), 30);

    expect(fitted?.rangeEndExclusive).toBe(measured?.rangeStart);
    const fittedDays = new Set(fitted?.points.map((point) => point.timestamp));
    const shared = measured?.points.filter((point) => fittedDays.has(point.timestamp));
    expect(shared).toEqual([]);
  });

  it("refuses an end that is not a readable instant", () => {
    expect(takeDaysEnding(historyOf(40), "not a date", 10)).toBeNull();
  });

  it("refuses a window with no days in it", () => {
    // An end at or before the history's own start leaves nothing to window.
    expect(takeDaysEnding(historyOf(40), at(0), 10)).toBeNull();
  });
});
