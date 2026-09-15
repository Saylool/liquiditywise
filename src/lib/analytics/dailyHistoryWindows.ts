import { type PoolDailyPriceHistory, PoolDailyPriceHistorySchema } from "../../schemas";
import { MS_PER_DAY } from "./dailyLogReturns";

/*
 * Narrowing one fetched history into the several windows that are measured over
 * it.
 *
 * The reader fetches a long span deliberately. A volatility figure is measured
 * over the most recent days of it, and the days before those are what a band
 * fitted in the past can be checked against — so exactly one request answers
 * both questions, and the two windows cannot come from different readings of a
 * moving market.
 *
 * Pure: no clock, no network, no environment. Every result is re-parsed through
 * the domain schema, because a window is a history in its own right and the
 * calculations downstream depend on the same invariants — ordering, day
 * alignment, points inside the stated range.
 */

/**
 * Narrows a history to the `days` days ending at `endExclusive`.
 *
 * Both bounds stay day-aligned, which is what keeps the daily-return arithmetic
 * exact. A window reaching back before the history starts is clamped to it
 * rather than refused: a pool younger than the window asked for still has a real,
 * shorter history, and the volatility layer already reports how much of a window
 * it could use.
 *
 * Returns `null` if the result is not a history the domain schema accepts —
 * which is the honest outcome for a window with no days in it at all.
 */
export const takeDaysEnding = (
  history: PoolDailyPriceHistory,
  endExclusive: string,
  days: number,
): PoolDailyPriceHistory | null => {
  if (!Number.isSafeInteger(days) || days < 1) return null;

  const endMs = Date.parse(endExclusive);
  if (!Number.isFinite(endMs)) return null;

  const historyStartMs = Date.parse(history.rangeStart);
  const startMs = Math.max(endMs - days * MS_PER_DAY, historyStartMs);
  if (startMs >= endMs) return null;

  const candidate = {
    ...history,
    rangeStart: new Date(startMs).toISOString(),
    rangeEndExclusive: new Date(endMs).toISOString(),
    points: history.points.filter((point) => {
      const instant = Date.parse(point.timestamp);

      return instant >= startMs && instant < endMs;
    }),
  };

  const parsed = PoolDailyPriceHistorySchema.safeParse(candidate);

  return parsed.success ? parsed.data : null;
};

/**
 * The most recent `days` days of a history — the window every published figure
 * is measured over today.
 */
export const takeRecentDays = (
  history: PoolDailyPriceHistory,
  days: number,
): PoolDailyPriceHistory | null => takeDaysEnding(history, history.rangeEndExclusive, days);
