import { describe, expect, it } from "vitest";

import { DAILY_HISTORY_DAYS, resolveDailyHistoryWindow } from "./v3DailyHistoryWindow";
import { normalizeDailyPriceHistory } from "./dailyPriceHistoryAdapter";
import { v3PoolIdentity, v4PoolIdentity } from "./subgraphPoolIdentity";

const POOL_ADDRESS = "0xabcdef0123456789abcdef0123456789abcdef01";
const FETCHED_AT = "2026-08-20T09:15:00.000Z";
const WINDOW = resolveDailyHistoryWindow(new Date(FETCHED_AT));
const DAY = 86_400;
const FIRST_DAY_UNIX = WINDOW.rangeStartUnixSeconds;

/** 12 seconds before FETCHED_AT — one block of ordinary indexer lag. */
const BLOCK_TIMESTAMP_SECONDS = 1_787_217_288;

/*
 * The provider publishes extremes the other way up, so a row's `high` is the
 * *low* of our direction once inverted. Written here as the provider would, with
 * a spread wide enough to bracket the row's own price after inversion.
 */
const dayRow = (index: number, token1Price = String(2500 + index)) => ({
  id: `${POOL_ADDRESS}-${index}`,
  date: FIRST_DAY_UNIX + index * DAY,
  token1Price,
  /*
   * The provider's own direction, which is the inverse of `token1Price` — so
   * these bracket 1/price, not price. Written the other way round at first, and
   * the schema's cross-check caught it: the day's price fell nowhere near its
   * own extremes once inverted.
   */
  high: String((1 / Number(token1Price)) * 1.02),
  low: String((1 / Number(token1Price)) * 0.98),
  volumeUSD: String(1_000_000 + index),
  feesUSD: String(500 + index),
  liquidity: String(1_000_000_000_000_000_000n + BigInt(index)),
  pool: { id: POOL_ADDRESS },
});

const fullDays = () =>
  Array.from({ length: DAILY_HISTORY_DAYS }, (_unused, index) => dayRow(index));

const rawMeta = (overrides: Record<string, unknown> = {}) => ({
  block: { number: 21_500_000, timestamp: BLOCK_TIMESTAMP_SECONDS },
  hasIndexingErrors: false,
  ...overrides,
});

/**
 * The pool as the query asks for it: its id, and the last day it traded at
 * all, which the query fetches without the window's bounds.
 *
 * The default is a pool that traded on the window's first day — still active,
 * the ordinary case. `null` is a pool that has never had a day indexed.
 */
const rawPool = (lastDayUnix: number | null = WINDOW.rangeStartUnixSeconds) => ({
  id: POOL_ADDRESS,
  lastDay: lastDayUnix === null ? [] : [{ date: lastDayUnix }],
});

const payload = (
  poolDayDatas: unknown = fullDays(),
  meta: unknown = rawMeta(),
  pool: unknown = rawPool(),
) => ({ data: { pool, poolDayDatas, _meta: meta } });

/** Non-null by construction: the fixture address is a valid v3 pool address. */
const V3_IDENTITY = v3PoolIdentity(POOL_ADDRESS)!;

const normalize = (body: unknown) =>
  normalizeDailyPriceHistory({
    payload: body,
    identity: V3_IDENTITY,
    fetchedAt: FETCHED_AT,
    window: WINDOW,
  });

describe("a complete history", () => {
  it("produces the exact expected success object", () => {
    const result = normalize(payload());

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data).toEqual({
      pool: { protocolVersion: "v3", chainId: 1, id: POOL_ADDRESS },
      fetchedAt: FETCHED_AT,
      sourceBlockNumber: "21500000",
      sourceBlockTimestamp: "2026-08-20T09:14:48.000Z",
      rangeStart: WINDOW.rangeStart,
      rangeEndExclusive: WINDOW.rangeEndExclusive,
      interval: "1d",
      priceDirection: "token0PriceInToken1",
      points: Array.from({ length: DAILY_HISTORY_DAYS }, (_unused, index) => ({
        timestamp: new Date((FIRST_DAY_UNIX + index * DAY) * 1000).toISOString(),
        price: 2500 + index,
        /* Inverted from the provider's direction, which swaps which is which. */
        low: 1 / ((1 / (2500 + index)) * 1.02),
        high: 1 / ((1 / (2500 + index)) * 0.98),
        volumeUsd: 1_000_000 + index,
        feesUsd: 500 + index,
        activeLiquidity: String(1_000_000_000_000_000_000n + BigInt(index)),
      })),
      source: "uniswap-v3-subgraph",
    });
  });

  it("maps subgraph token1Price onto the token0PriceInToken1 direction", () => {
    // token1Price is token1 per token0 — the price of token0 quoted in token1.
    const rows = fullDays().map((row, index) => ({ ...row, token1Price: String(1000 + index) }));
    const result = normalize(payload(rows));

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.priceDirection).toBe("token0PriceInToken1");
    expect(result.data.points[0]?.price).toBe(1000);
    expect(result.data.points.at(-1)?.price).toBe(1000 + DAILY_HISTORY_DAYS - 1);
  });

  it("ignores a token0Price the provider also sends", () => {
    const rows = fullDays().map((row) => ({ ...row, token0Price: "0.0004" }));
    const result = normalize(payload(rows));

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.points[0]?.price).toBe(2500);
  });

  it("emits points in strictly ascending timestamp order", () => {
    const result = normalize(payload());

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    const instants = result.data.points.map((point) => Date.parse(point.timestamp));
    expect(instants).toEqual([...instants].sort((a, b) => a - b));
    expect(new Set(instants).size).toBe(DAILY_HISTORY_DAYS);
  });

  it("covers the whole window without touching the current day", () => {
    const result = normalize(payload());

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.points[0]?.timestamp).toBe(WINDOW.rangeStart);
    expect(result.data.points.at(-1)?.timestamp).toBe(
      new Date(Date.parse(WINDOW.rangeEndExclusive) - DAY * 1000).toISOString(),
    );
  });
});

describe("incomplete coverage", () => {
  it("keeps real observations and never fabricates a skipped day", () => {
    const withGap = fullDays().filter((_row, index) => index !== 10);
    const result = normalize(payload(withGap));

    expect(result.status).toBe("partial");
    if (result.status !== "partial") return;
    expect(result.data.points).toHaveLength(DAILY_HISTORY_DAYS - 1);
    const missingDay = new Date((FIRST_DAY_UNIX + 10 * DAY) * 1000).toISOString();
    expect(result.data.points.map((point) => point.timestamp)).not.toContain(missingDay);
    expect(result.missingFields).toContain("points");
    expect(result.warnings).toContain("history-window-incomplete");
  });

  it.each([[2], [5], [30]])("returns partial for %s real points", (count) => {
    const result = normalize(payload(fullDays().slice(0, count)));

    expect(result.status).toBe("partial");
    if (result.status !== "partial") return;
    expect(result.data.points).toHaveLength(count);
    expect(result.missingFields).toEqual(["points"]);
    expect(result.warnings).toHaveLength(1);
  });

  it("orders missing fields and warnings deterministically", () => {
    const result = normalize(payload(fullDays().slice(0, 5), null));

    expect(result.status).toBe("partial");
    if (result.status !== "partial") return;
    expect(result.missingFields).toEqual([
      "sourceBlockNumber",
      "sourceBlockTimestamp",
      "points",
    ]);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toContain("history-window-incomplete");
    expect(result.warnings[1]).toContain("block-time-unreported");
  });

  it("repeats identical output for an identical payload", () => {
    const body = payload(fullDays().slice(0, 7), null);
    expect(normalize(body)).toEqual(normalize(body));
  });

  it("stays a success when every day is present but block metadata is not", () => {
    const result = normalize(payload(fullDays(), rawMeta({ block: { number: 5, timestamp: null } })));

    expect(result.status).toBe("partial");
    if (result.status !== "partial") return;
    expect(result.data.points).toHaveLength(DAILY_HISTORY_DAYS);
    expect(result.missingFields).toEqual(["sourceBlockTimestamp"]);
    expect(result.warnings).toEqual(["block-time-unreported"]);
  });
});

describe("insufficient history", () => {
  it.each([
    ["no days at all", []],
    ["a single day", [dayRow(0)]],
  ])("reports %s as insufficient-data rather than not-found", (_label, rows) => {
    expect(normalize(payload(rows))).toMatchObject({
      status: "unavailable",
      reason: "insufficient-data",
    });
  });

  /*
   * The same absence, three things to say about it.
   *
   * For years all three got one sentence: not enough history to analyse
   * *yet*. For a pool opened this week that is true. For a pool abandoned
   * months ago it is a falsehood with a deadline in it — the reader is sent
   * away to wait for something that will never arrive. Which one it is cannot
   * be read from the window's own days, because in all three cases there are
   * none; it takes the pool's last day, fetched without the window's bounds.
   */
  describe("telling a young pool from an abandoned one", () => {
    const DAY = 86_400;

    /*
     * Required, not defaulted. An empty `lastDay` is a real answer — a pool
     * nothing ever touched — so a schema that supplied `[]` for a response
     * that simply did not carry the field would turn every absent field into
     * that answer, and describe thin pools as untouched ones on no evidence.
     * A response without it is malformed, which is loud.
     */
    it("refuses a response whose pool does not carry the field at all", () => {
      expect(normalize(payload([], rawMeta(), { id: POOL_ADDRESS }))).toMatchObject({
        status: "unavailable",
        reason: "invalid-response",
        notice: "market-data-malformed",
      });
    });

    it("says a pool has never traded when it has no day at all", () => {
      expect(normalize(payload([], rawMeta(), rawPool(null)))).toMatchObject({
        status: "unavailable",
        reason: "insufficient-data",
        notice: "pool-history-never-traded",
      });
    });

    it("says a pool has gone quiet when its last day is before the window", () => {
      const lastTraded = WINDOW.rangeStartUnixSeconds - 200 * DAY;

      expect(normalize(payload([], rawMeta(), rawPool(lastTraded)))).toMatchObject({
        notice: "pool-history-dormant",
      });
    });

    /*
     * The boundary belongs to the window. A pool that traded on the window's
     * first day has a day inside the period being read, so nothing about it
     * is dormant — and the query that fetched those days used this very
     * number as its lower bound, so answering otherwise would have the
     * request and the reply disagree about the same instant.
     */
    it("counts the window's first day as inside it", () => {
      expect(normalize(payload([], rawMeta(), rawPool(WINDOW.rangeStartUnixSeconds)))).toMatchObject({
        notice: "pool-history-insufficient",
      });
      expect(
        normalize(payload([], rawMeta(), rawPool(WINDOW.rangeStartUnixSeconds - 1))),
      ).toMatchObject({ notice: "pool-history-dormant" });
    });

    /*
     * A pool that opened yesterday: one closed day, and that day is recent.
     * This is the case the original wording was written for, and the only one
     * where "yet" is a promise this application can keep.
     */
    it("keeps the unchanged wording for a pool that is merely new", () => {
      const yesterday = WINDOW.rangeEndExclusiveUnixSeconds - DAY;

      expect(normalize(payload([dayRow(0)], rawMeta(), rawPool(yesterday)))).toMatchObject({
        notice: "pool-history-insufficient",
      });
    });

    /*
     * A pool with enough days is never described at all. The last day is read
     * only to explain an absence, so a working pool must not be reached by
     * any of this.
     */
    it("says none of it about a pool with history", () => {
      expect(normalize(payload(fullDays(), rawMeta(), rawPool(null))).status).toBe("success");
    });
  });

  it("becomes usable at two points", () => {
    expect(normalize(payload([dayRow(0), dayRow(1)])).status).toBe("partial");
  });

  it("keeps the insufficient-data message free of provider detail", () => {
    const result = normalize(payload([dayRow(0)]));

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.notice).not.toContain(POOL_ADDRESS);
    expect(result.notice).not.toContain("21500000");
  });
});

describe("failing closed", () => {
  it("reports an unknown pool as not-found", () => {
    expect(normalize(payload(fullDays(), rawMeta(), null))).toMatchObject({
      status: "unavailable",
      reason: "not-found",
    });
  });

  it("refuses a response carrying GraphQL errors even when data is present", () => {
    const body = { ...payload(), errors: [{ message: "boom" }] };
    expect(normalize(body)).toMatchObject({ status: "unavailable", reason: "invalid-response" });
  });

  it("refuses a response flagged with indexing errors", () => {
    expect(normalize(payload(fullDays(), rawMeta({ hasIndexingErrors: true })))).toMatchObject({
      status: "unavailable",
      reason: "invalid-response",
    });
  });

  it("refuses a pool id that does not match the requested address", () => {
    const other = `0x${"9".repeat(40)}`;
    expect(normalize(payload(fullDays(), rawMeta(), { id: other }))).toMatchObject({
      status: "unavailable",
      reason: "invalid-response",
    });
  });

  it("refuses duplicate day timestamps instead of de-duplicating them", () => {
    const duplicated = [...fullDays(), dayRow(10)];
    expect(normalize(payload(duplicated))).toMatchObject({
      status: "unavailable",
      reason: "invalid-response",
    });
  });

  it.each([
    ["a day before the window", FIRST_DAY_UNIX - DAY],
    ["the current incomplete day", WINDOW.rangeEndExclusiveUnixSeconds],
    ["a day beyond the window", WINDOW.rangeEndExclusiveUnixSeconds + DAY],
    ["a timestamp that is not a UTC day boundary", FIRST_DAY_UNIX + 3600],
  ])("refuses %s", (_label, date) => {
    const rows = [...fullDays().slice(0, 3), { ...dayRow(9), date }];
    expect(normalize(payload(rows))).toMatchObject({
      status: "unavailable",
      reason: "invalid-response",
    });
  });

  it("refuses a misaligned timestamp even when it is in range and in order", () => {
    // Inside the window and strictly ascending, so neither the range check nor
    // the ordering check would catch it: only day-boundary alignment does.
    const misaligned = [dayRow(0), { ...dayRow(1), date: FIRST_DAY_UNIX + DAY + 3600 }];

    expect(normalize(payload(misaligned))).toMatchObject({
      status: "unavailable",
      reason: "invalid-response",
    });
  });

  it("accepts the same two rows once the second lands on a day boundary", () => {
    expect(normalize(payload([dayRow(0), dayRow(1)])).status).toBe("partial");
  });

  it.each([
    ["a zero price", "0"],
    ["a zero price with decimals", "0.000"],
    ["a negative price", "-1500"],
    ["non-numeric text", "not-a-number"],
    ["an overflowing price", "1e400"],
    ["an empty string", ""],
  ])("refuses %s", (_label, token1Price) => {
    const rows = fullDays();
    rows[5] = dayRow(5, token1Price);
    expect(normalize(payload(rows))).toMatchObject({
      status: "unavailable",
      reason: "invalid-response",
    });
  });

  it("refuses a non-zero price that underflows to zero", () => {
    const rows = fullDays();
    rows[5] = dayRow(5, "1e-400");
    expect(normalize(payload(rows))).toMatchObject({
      status: "unavailable",
      reason: "invalid-response",
    });
  });

  it.each([
    ["a boolean price", true],
    ["a numeric price", 2500],
    ["a null price", null],
  ])("refuses %s rather than coercing it", (_label, token1Price) => {
    const rows: unknown[] = fullDays();
    rows[5] = { ...dayRow(5), token1Price };
    expect(normalize(payload(rows))).toMatchObject({
      status: "unavailable",
      reason: "invalid-response",
    });
  });

  it.each([
    ["a string date", "1784505600"],
    ["a fractional date", 1_784_505_600.5],
    ["a negative date", -1],
  ])("refuses %s", (_label, date) => {
    const rows: unknown[] = fullDays();
    rows[5] = { ...dayRow(5), date };
    expect(normalize(payload(rows))).toMatchObject({
      status: "unavailable",
      reason: "invalid-response",
    });
  });

  it.each([
    ["a missing data envelope", {}],
    ["a null data envelope", { data: null }],
    ["a non-object payload", 42],
    ["a missing poolDayDatas list", { data: { pool: rawPool(), _meta: rawMeta() } }],
    ["poolDayDatas as an object", { data: { pool: rawPool(), poolDayDatas: {}, _meta: rawMeta() } }],
  ])("refuses %s", (_label, body) => {
    expect(normalize(body)).toMatchObject({ status: "unavailable", reason: "invalid-response" });
  });
});

describe("source freshness reuse", () => {
  const withBlockTime = (secondsOfLag: number) =>
    normalize(
      payload(
        fullDays(),
        rawMeta({ block: { number: 21_500_000, timestamp: 1_787_217_300 - secondsOfLag } }),
      ),
    );

  it("accepts a source block exactly at the shared 15-minute limit", () => {
    expect(withBlockTime(15 * 60).status).toBe("success");
  });

  /*
   * A history is a series of closed UTC days, and an indexer a few minutes — or
   * a few hours — behind describes exactly the same days as one caught up. The
   * moment-in-time staleness bar used to refuse this read, which took a whole
   * analysis down for a reason that did not bear on it: the page said the pool
   * had no range, which was true of nothing.
   *
   * Whether the source indexed through the last completed day is a different
   * question, and it is answered below by which days are present.
   */
  it("accepts a lagging source, because a settled day does not go stale", () => {
    expect(withBlockTime(15 * 60 + 1).status).toBe("success");
    expect(withBlockTime(6 * 60 * 60).status).toBe("success");
  });

  it("tolerates the shared 2-minute future clock skew", () => {
    expect(withBlockTime(-(2 * 60)).status).toBe("success");
  });

  it("applies the shared future-timestamp policy beyond that skew", () => {
    expect(withBlockTime(-(2 * 60 + 1))).toMatchObject({
      status: "unavailable",
      reason: "invalid-response",
    });
  });

  it("never substitutes the fetch time for a missing block time", () => {
    const result = normalize(payload(fullDays(), rawMeta({ block: { number: 1, timestamp: null } })));

    expect(result.status).toBe("partial");
    if (result.status !== "partial") return;
    expect(result.data.sourceBlockTimestamp).toBeNull();
    expect(result.data.sourceBlockTimestamp).not.toBe(result.data.fetchedAt);
  });
});

describe("per-row pool ownership", () => {
  const rowWithPool = (index: number, poolId: unknown) => ({
    ...dayRow(index),
    pool: { id: poolId },
  });

  it("accepts rows whose pool id matches in lowercase", () => {
    expect(normalize(payload(fullDays())).status).toBe("success");
  });

  it("accepts a mixed-case row pool id and normalizes it", () => {
    const mixedCase = POOL_ADDRESS.toUpperCase().replace("0X", "0x");
    const rows = fullDays().map((_row, index) => rowWithPool(index, mixedCase));

    expect(normalize(payload(rows)).status).toBe("success");
  });

  it("refuses a single mismatched row among otherwise valid rows", () => {
    const rows: unknown[] = fullDays();
    rows[17] = rowWithPool(17, `0x${"9".repeat(40)}`);

    expect(normalize(payload(rows))).toMatchObject({
      status: "unavailable",
      reason: "invalid-response",
    });
  });

  it("does not let a matching top-level pool excuse a mismatched row", () => {
    const rows: unknown[] = fullDays();
    rows[0] = rowWithPool(0, `0x${"9".repeat(40)}`);

    // The top-level pool identity is the requested one, and the query filtered on
    // that pool — neither may stand in for per-row proof.
    const body = payload(rows, rawMeta(), { id: POOL_ADDRESS });
    expect(normalize(body)).toMatchObject({
      status: "unavailable",
      reason: "invalid-response",
    });
  });

  it.each([
    ["a malformed row pool address", "0xnope"],
    ["a truncated row pool address", "0x1234"],
    ["the zero address", `0x${"0".repeat(40)}`],
    ["a numeric row pool id", 12345],
    ["a null row pool id", null],
  ])("refuses %s", (_label, poolId) => {
    const rows: unknown[] = fullDays();
    rows[3] = rowWithPool(3, poolId);

    expect(normalize(payload(rows))).toMatchObject({
      status: "unavailable",
      reason: "invalid-response",
    });
  });

  it.each([
    ["a row with no pool field", (row: Record<string, unknown>) => {
      const copy = { ...row };
      delete copy.pool;
      return copy;
    }],
    ["a row whose pool has no id", (row: Record<string, unknown>) => ({ ...row, pool: {} })],
    ["a row whose pool is null", (row: Record<string, unknown>) => ({ ...row, pool: null })],
  ])("refuses %s", (_label, mutate) => {
    const rows: unknown[] = fullDays();
    rows[4] = mutate(dayRow(4));

    expect(normalize(payload(rows))).toMatchObject({
      status: "unavailable",
      reason: "invalid-response",
    });
  });

  it("does not infer ownership from array position or the row's opaque id", () => {
    // Right position, plausible-looking composite id, wrong pool.
    const rows: unknown[] = fullDays();
    rows[0] = { ...dayRow(0), id: `${POOL_ADDRESS}-0`, pool: { id: `0x${"9".repeat(40)}` } };

    expect(normalize(payload(rows))).toMatchObject({
      status: "unavailable",
      reason: "invalid-response",
    });
  });
});

/*
 * The source publishes a day's extremes in the inverse of the direction this
 * series stores prices in, so inverting them swaps which one is the high. Until
 * these existed the direction was held up by two deep-equality assertions that
 * happened to include the fields — the sort of cover that disappears the next
 * time someone updates an expectation.
 */
describe("the day's extremes, which arrive the other way up", () => {
  /** Deliberately lopsided, so a swap cannot hide behind symmetry. */
  const lopsided = (price: number) => ({
    ...dayRow(0, String(price)),
    high: String((1 / price) * 1.1),
    low: String((1 / price) * 0.95),
  });

  /* A second, ordinary day: one point alone is too short a series to normalize. */
  const firstPoint = (row: unknown) => {
    const result = normalize(payload([row, dayRow(1)], rawMeta()));
    if (result.status === "unavailable") throw new Error(result.notice);
    const point = result.data.points[0];
    if (point === undefined) throw new Error("expected a point");
    return point;
  };

  it("inverts the provider's high into our low, and its low into our high", () => {
    const point = firstPoint(lopsided(2500));

    expect(point.low).toBeCloseTo(2500 / 1.1, 10);
    expect(point.high).toBeCloseTo(2500 / 0.95, 10);
  });

  it("puts the low below the high, which a swap would not", () => {
    const point = firstPoint(lopsided(2500));

    expect(point.low).toBeLessThan(point.high ?? 0);
  });

  it("brackets the day's own price", () => {
    const point = firstPoint(lopsided(2500));

    expect(point.low).toBeLessThanOrEqual(point.price);
    expect(point.price).toBeLessThanOrEqual(point.high ?? 0);
  });

  /*
   * The check that makes the swap detectable at all: a day whose own price falls
   * outside its own range is either that mistake or a source contradicting
   * itself, and the extremes are dropped rather than carried.
   */
  it("drops extremes the day's own price does not sit between", () => {
    const contradictory = { ...dayRow(0, "2500"), high: "0.01", low: "0.005" };
    const point = firstPoint(contradictory);

    expect(point.low).toBeNull();
    expect(point.high).toBeNull();
    // The day itself survives; only what could not be trusted is absent.
    expect(point.price).toBe(2500);
  });

  it("keeps the day's volume and fees when its extremes are dropped", () => {
    const contradictory = { ...dayRow(0, "2500"), high: "0.01", low: "0.005" };
    const point = firstPoint(contradictory);

    expect(point.volumeUsd).not.toBeNull();
    expect(point.feesUsd).not.toBeNull();
  });
});

/*
 * The same adapter, reading the v4 subgraph, which publishes `PoolDayData` under
 * the same names. What has to change is the identity on the result and the shape
 * the per-row ownership proof compares against.
 */
describe("normalizeDailyPriceHistory for a v4 pool", () => {
  const POOL_ID = `0x${"ab".repeat(32)}`;
  const V4_IDENTITY = v4PoolIdentity(POOL_ID)!;

  const v4Row = (index: number) => ({ ...dayRow(index), pool: { id: POOL_ID } });
  const v4Days = () => Array.from({ length: DAILY_HISTORY_DAYS }, (_u, i) => v4Row(i));

  const normalizeV4 = (body: unknown) =>
    normalizeDailyPriceHistory({
      payload: body,
      identity: V4_IDENTITY,
      fetchedAt: FETCHED_AT,
      window: WINDOW,
    });

  it("stamps the pool and the source as v4", () => {
    const result = normalizeV4(payload(v4Days(), rawMeta(), { id: POOL_ID, lastDay: [{ date: WINDOW.rangeStartUnixSeconds }] }));

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.pool).toEqual({ protocolVersion: "v4", chainId: 1, id: POOL_ID });
    expect(result.data.source).toBe("uniswap-v4-subgraph");
  });

  /*
   * The row-level proof is the one that matters most here: a filter is a request,
   * not evidence of what came back, and a mixed-in row would otherwise be
   * republished under the requested pool's identity.
   */
  it("refuses a response with one row belonging to another v4 pool", () => {
    const rows = v4Days();
    const intruder = { ...v4Row(3), pool: { id: `0x${"cd".repeat(32)}` } };

    expect(
      normalizeV4(payload([...rows.slice(0, 3), intruder, ...rows.slice(4)], rawMeta(), {
        id: POOL_ID,
      })).status,
    ).toBe("unavailable");
  });

  it("refuses a row whose pool id is an address rather than a PoolId", () => {
    const rows = v4Days();

    expect(
      normalizeV4(
        payload([{ ...v4Row(0), pool: { id: POOL_ADDRESS } }, ...rows.slice(1)], rawMeta(), {
          id: POOL_ID,
        }),
      ).status,
    ).toBe("unavailable");
  });
});
