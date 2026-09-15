import { describe, expect, it } from "vitest";

import type { PoolDailyPriceHistory, TickRange } from "../../schemas";
import { calculatePoolActivity } from "./poolActivity";

const DAY_MS = 86_400_000;
const START = Date.parse("2026-07-21T00:00:00.000Z");

type DayInput = {
  price?: number;
  low?: number | null;
  high?: number | null;
  volumeUsd?: number | null;
  feesUsd?: number | null;
};

const day = (index: number, overrides: DayInput = {}) => ({
  timestamp: new Date(START + index * DAY_MS).toISOString(),
  price: overrides.price ?? 100,
  low: overrides.low === undefined ? 99 : overrides.low,
  high: overrides.high === undefined ? 101 : overrides.high,
  volumeUsd: overrides.volumeUsd === undefined ? 1_000 : overrides.volumeUsd,
  feesUsd: overrides.feesUsd === undefined ? 5 : overrides.feesUsd,
});

const historyOf = (points: readonly unknown[]) => ({ points }) as unknown as PoolDailyPriceHistory;

/** Only the two prices matter; the rest of a range is irrelevant to occupancy. */
const rangeOf = (lowerPrice: number, upperPrice: number) =>
  ({ lowerPrice, upperPrice }) as unknown as TickRange;

const succeeded = (result: ReturnType<typeof calculatePoolActivity>) => {
  if (result.status !== "success") throw new Error(`expected success, got ${result.notice}`);
  return result.data;
};

const activityOf = (points: readonly unknown[], lower = 90, upper = 110) =>
  succeeded(calculatePoolActivity({ history: historyOf(points), range: rangeOf(lower, upper) }));

describe("calculatePoolActivity", () => {
  it("counts a day whose whole range sat inside", () => {
    expect(activityOf([day(0)]).occupancy).toEqual({
      fullyInside: 1,
      fullyOutside: 0,
      undetermined: 0,
    });
  });

  it("counts a day whose whole range sat outside", () => {
    const below = day(0, { price: 50, low: 49, high: 51 });

    expect(activityOf([below]).occupancy.fullyOutside).toBe(1);
  });

  /*
   * A daily high and low cannot say where inside the day the price was, so a day
   * that crossed an edge is left unplaced rather than apportioned by a guess.
   */
  it("leaves a day that crossed an edge undetermined", () => {
    const straddling = day(0, { price: 95, low: 85, high: 105 });

    expect(activityOf([straddling]).occupancy.undetermined).toBe(1);
  });

  it("leaves a day whose extremes were unusable undetermined too", () => {
    const noExtremes = day(0, { low: null, high: null });

    expect(activityOf([noExtremes]).occupancy.undetermined).toBe(1);
  });

  it("places every measured day in exactly one bucket", () => {
    const activity = activityOf([
      day(0),
      day(1, { price: 50, low: 49, high: 51 }),
      day(2, { price: 95, low: 85, high: 105 }),
      day(3, { low: null, high: null }),
    ]);
    const { fullyInside, fullyOutside, undetermined } = activity.occupancy;

    expect(fullyInside + fullyOutside + undetermined).toBe(activity.daysMeasured);
    expect(activity.daysMeasured).toBe(4);
  });

  it("sums the last day, week and month separately", () => {
    const points = Array.from({ length: 30 }, (_unused, index) =>
      day(index, { volumeUsd: index + 1 }),
    );
    const activity = activityOf(points);

    expect(activity.volume24hUsd).toBe(30);
    expect(activity.volume7dUsd).toBe(24 + 25 + 26 + 27 + 28 + 29 + 30);
    expect(activity.volume30dUsd).toBe((30 * 31) / 2);
  });

  /*
   * A seven-day total assembled from four days is not a seven-day total, and
   * there is no honest way to label one.
   */
  it("reports nothing for a window longer than the history", () => {
    const activity = activityOf([day(0), day(1), day(2)]);

    expect(activity.volume24hUsd).toBe(1_000);
    expect(activity.volume7dUsd).toBeNull();
    expect(activity.volume30dUsd).toBeNull();
  });

  it("reports nothing for a window with a day the source left out", () => {
    const points = Array.from({ length: 7 }, (_unused, index) =>
      day(index, index === 3 ? { volumeUsd: null } : {}),
    );

    expect(activityOf(points).volume7dUsd).toBeNull();
  });

  it("keeps a day the pool saw no trade on as the zero it was", () => {
    const quiet = Array.from({ length: 7 }, (_unused, index) =>
      day(index, { volumeUsd: 0, feesUsd: 0 }),
    );

    expect(activityOf(quiet).volume7dUsd).toBe(0);
  });

  /*
   * The closest honest answer to "would this range have been earning", and still
   * the whole pool's fees rather than anyone's earnings.
   */
  it("adds up fees only over the days that sat entirely inside", () => {
    const activity = activityOf([
      day(0, { feesUsd: 5 }),
      day(1, { price: 50, low: 49, high: 51, feesUsd: 900 }),
      day(2, { feesUsd: 7 }),
    ]);

    expect(activity.feesWhileFullyInsideUsd).toBe(12);
  });

  it("never claims more fees inside the range than the pool charged at all", () => {
    const points = Array.from({ length: 30 }, (_unused, index) => day(index, { feesUsd: 3 }));
    const activity = activityOf(points);

    expect(activity.feesWhileFullyInsideUsd).toBe(90);
    expect(activity.fees30dUsd).toBe(90);
  });

  it("refuses a history with no days in it", () => {
    const result = calculatePoolActivity({ history: historyOf([]), range: rangeOf(90, 110) });

    expect(result.status).toBe("unavailable");
  });

  it("counts a day touching an edge exactly as inside", () => {
    // The range is inclusive of its bounds, as a position is.
    const touching = day(0, { price: 100, low: 90, high: 110 });

    expect(activityOf([touching]).occupancy.fullyInside).toBe(1);
  });
});

/*
 * The bug this file did not catch until production did.
 *
 * A history carries 31 closes because 30 daily returns need 31 of them. The
 * occupancy was counted over all 31 while the fee total covered the last 30, so
 * a range wide enough to contain every day reported more fees charged inside the
 * range than the pool had charged at all — and the schema refused to publish the
 * whole analysis. Correct refusal, unusable page.
 */
describe("one window, when the history carries the extra day returns need", () => {
  const thirtyOne = Array.from({ length: 31 }, (_unused, index) => day(index, { feesUsd: 4 }));

  it("measures exactly the days the rolling sums cover", () => {
    expect(activityOf(thirtyOne).daysMeasured).toBe(30);
  });

  it("does not charge more inside the range than the pool charged at all", () => {
    const activity = activityOf(thirtyOne);

    expect(activity.occupancy.fullyInside).toBe(30);
    expect(activity.feesWhileFullyInsideUsd).toBe(120);
    expect(activity.fees30dUsd).toBe(120);
  });

  it("publishes an answer for a range that contains every measured day", () => {
    // The shape that failed: wide range, every day inside.
    const result = calculatePoolActivity({
      history: historyOf(thirtyOne),
      range: rangeOf(1, 10_000),
    });

    expect(result.status).toBe("success");
  });

  it("still measures a history shorter than the window", () => {
    expect(activityOf(thirtyOne.slice(0, 5)).daysMeasured).toBe(5);
  });
});
