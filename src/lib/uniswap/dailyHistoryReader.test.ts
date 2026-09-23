import { describe, expect, it } from "vitest";

import type { DataFailureReason, DataResult, PoolDailyPriceHistory } from "../../schemas";
import {
  createDailyHistoryReader,
  FIRST_TIMEOUT_MS,
  MAX_ENTRIES,
  RETRY_TIMEOUT_MS,
  type HistoryFetch,
} from "./dailyHistoryReader";

const POOL = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";
const NOON = Date.parse("2026-09-23T12:00:00Z");
const MIDNIGHT = "2026-09-23T00:00:00.000Z";

/** Only the fields the reader looks at; the rest is the fetch's business. */
const history = (sourceBlockTimestamp: string | null = "2026-09-23T11:59:48.000Z"): PoolDailyPriceHistory =>
  ({ rangeEndExclusive: MIDNIGHT, sourceBlockTimestamp }) as unknown as PoolDailyPriceHistory;

const ok = (data = history()): DataResult<PoolDailyPriceHistory> => ({ status: "success", data });
const failed = (reason: DataFailureReason): DataResult<PoolDailyPriceHistory> =>
  ({ status: "unavailable", reason, notice: "market-data-timed-out" }) as DataResult<PoolDailyPriceHistory>;

/** A fetch that answers from a script, one answer per call, and remembers the timeouts it was given. */
const scripted = (...answers: DataResult<PoolDailyPriceHistory>[]) => {
  const timeouts: number[] = [];
  const fetchHistory: HistoryFetch = async (_protocol, _pool, timeoutMs) => {
    timeouts.push(timeoutMs);
    const answer = answers.shift();
    if (answer === undefined) throw new Error("asked more often than scripted");
    return answer;
  };
  return { fetchHistory, timeouts };
};

describe("keeping a history for the rest of the day", () => {
  it("asks once for the same pool on the same day, whatever the window the reader chose", async () => {
    const { fetchHistory, timeouts } = scripted(ok());
    const { read } = createDailyHistoryReader(fetchHistory, () => NOON);

    const first = await read("v3", POOL);
    const second = await read("v3", POOL.toUpperCase().replace("0X", "0x"));

    expect(second).toBe(first);
    expect(timeouts).toEqual([FIRST_TIMEOUT_MS]);
  });

  it("asks again on a new UTC day, and lets the old day's copies go", async () => {
    let clock = NOON;
    const { fetchHistory, timeouts } = scripted(ok(), ok());
    const reader = createDailyHistoryReader(fetchHistory, () => clock);

    await reader.read("v3", POOL);
    clock = NOON + 24 * 60 * 60 * 1_000;
    await reader.read("v3", POOL);

    expect(timeouts).toHaveLength(2);
    expect(reader.size()).toBe(1);
  });

  it("keeps the protocols apart", async () => {
    const { fetchHistory, timeouts } = scripted(ok(), ok());
    const { read } = createDailyHistoryReader(fetchHistory, () => NOON);

    await read("v3", POOL);
    await read("v4", POOL);

    expect(timeouts).toHaveLength(2);
  });

  /*
   * Just after midnight the indexer may not have reached the end of
   * yesterday. A history read then is right for a minute and would be wrong
   * all day, so it is used once and not kept.
   */
  it("does not keep a history the source had not finished indexing", async () => {
    const { fetchHistory, timeouts } = scripted(
      ok(history("2026-09-22T23:59:30.000Z")),
      ok(history(null)),
      ok(history(MIDNIGHT)),
      ok(),
    );
    const { read } = createDailyHistoryReader(fetchHistory, () => NOON);

    await read("v3", POOL);
    await read("v3", POOL);
    await read("v3", POOL);
    await read("v3", POOL);

    expect(timeouts).toHaveLength(3);
  });

  it("keeps no failure, so the next reader asks afresh", async () => {
    const { fetchHistory, timeouts } = scripted(failed("configuration-error"), ok());
    const { read } = createDailyHistoryReader(fetchHistory, () => NOON);

    expect((await read("v3", POOL)).status).toBe("unavailable");
    expect((await read("v3", POOL)).status).toBe("success");
    expect(timeouts).toHaveLength(2);
  });

  it("does not keep a partial history either", async () => {
    const partial = { status: "partial", data: history(), missingFields: ["points"], warnings: [] } as never;
    const { fetchHistory, timeouts } = scripted(partial, ok());
    const { read } = createDailyHistoryReader(fetchHistory, () => NOON);

    await read("v3", POOL);
    await read("v3", POOL);

    expect(timeouts).toHaveLength(2);
  });

  it("holds no more than its bound", async () => {
    const { fetchHistory } = scripted(...Array.from({ length: MAX_ENTRIES + 1 }, () => ok()), ok());
    const reader = createDailyHistoryReader(fetchHistory, () => NOON);

    for (let index = 0; index <= MAX_ENTRIES; index += 1) await reader.read("v3", `0x${String(index).padStart(40, "0")}`);
    expect(reader.size()).toBe(MAX_ENTRIES);
  });

  it("lets the oldest go, and keeps the newest", async () => {
    const asked: string[] = [];
    const fetchHistory: HistoryFetch = async (_protocol, pool) => {
      asked.push(pool);
      return ok();
    };
    const reader = createDailyHistoryReader(fetchHistory, () => NOON);
    const pool = (index: number) => `0x${String(index).padStart(40, "0")}`;

    for (let index = 0; index <= MAX_ENTRIES; index += 1) await reader.read("v3", pool(index));
    asked.length = 0;
    await reader.read("v3", pool(MAX_ENTRIES));
    await reader.read("v3", pool(0));

    expect(asked).toEqual([pool(0)]);
  });
});

describe("two readers on the same pool at once", () => {
  it("share one ask", async () => {
    let release: (value: DataResult<PoolDailyPriceHistory>) => void = () => undefined;
    let calls = 0;
    const fetchHistory: HistoryFetch = () => {
      calls += 1;
      return new Promise((resolve) => {
        release = resolve;
      });
    };
    const { read } = createDailyHistoryReader(fetchHistory, () => NOON);

    const one = read("v3", POOL);
    const two = read("v3", POOL);
    release(ok());

    expect(await one).toBe(await two);
    expect(calls).toBe(1);
  });

  it("do not share a failure beyond the moment it happened", async () => {
    const { fetchHistory, timeouts } = scripted(failed("rate-limited"), ok());
    const { read } = createDailyHistoryReader(fetchHistory, () => NOON);

    await Promise.all([read("v3", POOL), read("v3", POOL)]);
    expect((await read("v3", POOL)).status).toBe("success");
    expect(timeouts).toHaveLength(2);
  });
});

describe("one more try after a timeout", () => {
  it("tries once more, with the shorter wait, and hands back what that finds", async () => {
    const { fetchHistory, timeouts } = scripted(failed("timeout"), ok());
    const { read } = createDailyHistoryReader(fetchHistory, () => NOON);

    expect((await read("v3", POOL)).status).toBe("success");
    expect(timeouts).toEqual([FIRST_TIMEOUT_MS, RETRY_TIMEOUT_MS]);
    expect(RETRY_TIMEOUT_MS).toBeLessThan(FIRST_TIMEOUT_MS);
  });

  it("says when it is asking a second time, and only then", async () => {
    const retried: string[] = [];
    const { fetchHistory } = scripted(failed("timeout"), ok(), failed("not-found"));
    const { read } = createDailyHistoryReader(fetchHistory, () => NOON, (protocol) => retried.push(protocol));

    await read("v4", POOL);
    await read("v3", POOL);

    expect(retried).toEqual(["v4"]);
  });

  it("tries only once more, and says it timed out if that does too", async () => {
    const { fetchHistory, timeouts } = scripted(failed("timeout"), failed("timeout"));
    const { read } = createDailyHistoryReader(fetchHistory, () => NOON);

    const result = await read("v3", POOL);

    expect(result.status === "unavailable" && result.reason).toBe("timeout");
    expect(timeouts).toHaveLength(2);
  });

  it.each(["configuration-error", "not-found", "rate-limited", "network-error"] as const)("does not try again after %s, which would answer the same", async (reason) => {
    const { fetchHistory, timeouts } = scripted(failed(reason));
    const { read } = createDailyHistoryReader(fetchHistory, () => NOON);

    await read("v3", POOL);

    expect(timeouts).toEqual([FIRST_TIMEOUT_MS]);
  });
});
