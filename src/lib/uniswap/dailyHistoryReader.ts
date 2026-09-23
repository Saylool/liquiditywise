import type { DataResult, PoolDailyPriceHistory, ProtocolVersion } from "../../schemas";

/*
 * What stands between the pool page and the slowest read it makes.
 *
 * The daily price history is the largest query this application sends, and
 * the gateway's cold path for it is slow: 5.5 seconds on a first ask, 280
 * milliseconds on a repeat. Three times in three days it took longer than the
 * 25 seconds allowed, and each time the reader got a page that said the market
 * data had timed out — for a pool whose next request, a moment later, came
 * back fine. So two things, both only for this read:
 *
 *  - **Kept for the rest of the UTC day.** It is completed days only, and a
 *    completed day does not change. A reader moving between 7, 30 and 90 days
 *    on the same pool, or a second reader on it, no longer pays for it again.
 *
 *  - **One more try after a timeout, and only a timeout.** The first ask is
 *    what warms the gateway; the second is the one that is fast. A refused key
 *    or an unknown pool would answer the same way twice, so those are handed
 *    straight back.
 *
 * Pure: the fetch and the clock come in, which is what lets every case here
 * be a test.
 */

export type HistoryFetch = (
  protocolVersion: ProtocolVersion,
  poolId: string,
  timeoutMs: number,
) => Promise<DataResult<PoolDailyPriceHistory>>;

/** The first ask: long enough for a cold gateway on a bad day. */
export const FIRST_TIMEOUT_MS = 25_000;

/** The second: it is expected to find the gateway warm, and a reader has already waited. */
export const RETRY_TIMEOUT_MS = 10_000;

/** Enough for every pool anybody opens in a day, and a bound on what a crawler can make it hold. */
export const MAX_ENTRIES = 500;

const utcDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * Whether a history can stand for the rest of the day.
 *
 * Only once the source had indexed past the end of the last day it covers.
 * Just after midnight the indexer can still be a few blocks short of it, and a
 * history read then has yesterday closing early — right for a minute, wrong to
 * keep until tomorrow. A source that does not say how far it had got is asked
 * again rather than trusted.
 */
const complete = (history: PoolDailyPriceHistory): boolean =>
  history.sourceBlockTimestamp !== null &&
  Date.parse(history.sourceBlockTimestamp) >= Date.parse(history.rangeEndExclusive);

export const createDailyHistoryReader = (
  fetchHistory: HistoryFetch,
  now: () => number = Date.now,
  /** Told when a first ask timed out and a second is being made, so a log can say the first was not the end of it. */
  onRetry: (protocolVersion: ProtocolVersion) => void = () => undefined,
) => {
  const kept = new Map<string, DataResult<PoolDailyPriceHistory>>();
  const asking = new Map<string, Promise<DataResult<PoolDailyPriceHistory>>>();

  const ask = async (protocolVersion: ProtocolVersion, poolId: string) => {
    const first = await fetchHistory(protocolVersion, poolId, FIRST_TIMEOUT_MS);
    if (first.status !== "unavailable" || first.reason !== "timeout") return first;
    onRetry(protocolVersion);
    return fetchHistory(protocolVersion, poolId, RETRY_TIMEOUT_MS);
  };

  const read = (protocolVersion: ProtocolVersion, poolId: string): Promise<DataResult<PoolDailyPriceHistory>> => {
    const key = `${utcDay(now())}|${protocolVersion}|${poolId.toLowerCase()}`;

    const hit = kept.get(key);
    if (hit !== undefined) return Promise.resolve(hit);

    // Two readers opening the same pool at once share one ask.
    const pending = asking.get(key);
    if (pending !== undefined) return pending;

    const started = ask(protocolVersion, poolId)
      .then((result) => {
        if (result.status === "success" && complete(result.data)) {
          // A new day's first entry clears the old day's: none of them can be asked for again.
          const today = key.slice(0, 10);
          for (const old of kept.keys()) if (!old.startsWith(today)) kept.delete(old);
          if (kept.size >= MAX_ENTRIES) {
            const oldest = kept.keys().next().value;
            if (oldest !== undefined) kept.delete(oldest);
          }
          kept.set(key, result);
        }
        return result;
      })
      .finally(() => asking.delete(key));

    asking.set(key, started);
    return started;
  };

  return { read, size: () => kept.size };
};
