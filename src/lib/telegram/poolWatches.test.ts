import { describe, expect, it } from "vitest";

import { BACKUP_PREFIX } from "../backup/storeBackup";
import type { KeyValueStore } from "../store/keyValueStore";
import { fakeStore } from "./fakeStore";
import type { PoolWatchTarget } from "./poolWatchCommand";
import {
  addPoolWatch,
  forgetPoolWatches,
  MAX_POOL_WATCHERS,
  MAX_POOL_WATCHES,
  POOL_WATCH_TTL_MS,
  POOL_WATCHERS_KEY,
  poolWatchersForPass,
  readPoolWatches,
  recordRangeTold,
  removePoolWatch,
} from "./poolWatches";

const NOW = new Date("2026-10-07T12:00:00.000Z");
const LATER = new Date("2026-10-08T12:30:00.000Z");
const RANGE = [0.0003, 0.0005] as const;

const pool = (n: number, chainId: PoolWatchTarget["chainId"] = 1): PoolWatchTarget => ({
  protocol: "v3",
  chainId,
  poolId: `0x${String(n).padStart(40, "0")}`,
});

/** The fake store, remembering the lifetime each write asked for. */
const storeWithTtls = () => {
  const inner = fakeStore();
  const ttls = new Map<string, number | undefined>();
  const write = inner.set;
  const set: KeyValueStore["set"] = async (key, value, ttlMs) => {
    ttls.set(key, ttlMs);
    return write(key, value, ttlMs);
  };
  return Object.assign(inner, { ttls, set });
};

const watching = async (store = fakeStore(), chatId = 42, target = pool(1)) => {
  expect(await addPoolWatch(store, chatId, { target, range: RANGE, locale: "tr", now: NOW })).toBe("added");
  return store;
};

describe("pool watches", () => {
  it("keeps a chat's watches under the backed-up prefix, keyed by the chat, with the set the checker walks beside them", async () => {
    const store = storeWithTtls();
    await watching(store);

    const keys = [...store.data.keys()];
    expect(keys).toEqual([`${BACKUP_PREFIX}pools:42`]);
    expect(POOL_WATCHERS_KEY.startsWith(BACKUP_PREFIX)).toBe(true);
    expect(await store.smembers(POOL_WATCHERS_KEY)).toEqual(["42"]);
    expect(store.ttls.get(`${BACKUP_PREFIX}pools:42`)).toBe(POOL_WATCH_TTL_MS);
  });

  it("stores the chain, the pool, the protocol, the range told and when, the chat's language — and nothing else", async () => {
    const store = await watching();
    const raw = JSON.parse(store.data.get(`${BACKUP_PREFIX}pools:42`) ?? "");

    expect(raw).toEqual({
      locale: "tr",
      watches: [{ chainId: 1, protocol: "v3", poolId: pool(1).poolId, told: { lower: 0.0003, upper: 0.0005, at: NOW.toISOString() } }],
    });
    expect(await readPoolWatches(store, 42)).toEqual(raw);
  });

  it("tells a chat that watches nothing from a store that could not answer", async () => {
    const store = fakeStore();
    expect(await readPoolWatches(store, 42)).toBeNull();
    store.down = true;
    expect(await readPoolWatches(store, 42)).toBeUndefined();
    expect(await addPoolWatch(store, 42, { target: pool(1), range: RANGE, locale: "en", now: NOW })).toBe("unavailable");
    expect(await removePoolWatch(store, 42, pool(1))).toBe("unavailable");
  });

  it("holds at most five pools per chat, and says when the chat is full", async () => {
    const store = fakeStore();
    for (let n = 1; n <= MAX_POOL_WATCHES; n += 1) await watching(store, 42, pool(n));

    expect(MAX_POOL_WATCHES).toBe(5);
    expect(await addPoolWatch(store, 42, { target: pool(6), range: RANGE, locale: "tr", now: NOW })).toBe("full");
    expect((await readPoolWatches(store, 42))?.watches).toHaveLength(5);
  });

  it("watches a pool already watched again rather than twice, with the new range as its baseline, and it does not count against the cap", async () => {
    const store = fakeStore();
    for (let n = 1; n <= MAX_POOL_WATCHES; n += 1) await watching(store, 42, pool(n));

    expect(await addPoolWatch(store, 42, { target: pool(3), range: [0.0004, 0.0006], locale: "en", now: LATER })).toBe("added");
    const record = await readPoolWatches(store, 42);
    expect(record?.watches).toHaveLength(5);
    expect(record?.watches.filter((watch) => watch.poolId === pool(3).poolId)).toEqual([
      { chainId: 1, protocol: "v3", poolId: pool(3).poolId, told: { lower: 0.0004, upper: 0.0006, at: LATER.toISOString() } },
    ]);
    /* The language moves with the latest ask. */
    expect(record?.locale).toBe("en");
  });

  it("tells the same pool on two chains apart", async () => {
    const store = await watching();
    await watching(store, 42, pool(1, 8453));
    expect((await readPoolWatches(store, 42))?.watches.map((watch) => watch.chainId)).toEqual([1, 8453]);
    expect(await removePoolWatch(store, 42, pool(1, 8453))).toBe("removed");
    expect((await readPoolWatches(store, 42))?.watches.map((watch) => watch.chainId)).toEqual([1]);
  });

  it("removes one watch and leaves the rest, and says when the pool was not watched", async () => {
    const store = await watching();
    await watching(store, 42, pool(2));

    expect(await removePoolWatch(store, 42, pool(1))).toBe("removed");
    expect((await readPoolWatches(store, 42))?.watches.map((watch) => watch.poolId)).toEqual([pool(2).poolId]);
    expect(await removePoolWatch(store, 42, pool(1))).toBe("not-watched");
    expect(await removePoolWatch(store, 7, pool(2))).toBe("not-watched");
  });

  it("deletes the record and leaves the set when the last watch goes", async () => {
    const store = await watching();
    expect(await removePoolWatch(store, 42, pool(1))).toBe("removed");

    expect(store.data.size).toBe(0);
    expect(await store.smembers(POOL_WATCHERS_KEY)).toEqual([]);
    expect(await readPoolWatches(store, 42)).toBeNull();
  });

  it("forgets everything a chat had at once, whichever command asked", async () => {
    const store = await watching();
    await watching(store, 42, pool(2));
    await watching(store, 7, pool(1));

    await forgetPoolWatches(store, 42);
    expect(await readPoolWatches(store, 42)).toBeNull();
    expect(await store.smembers(POOL_WATCHERS_KEY)).toEqual(["7"]);
    expect(await readPoolWatches(store, 7)).not.toBeNull();
  });

  it("records the range told for one pool, leaves the others, and answers the record to write the next from", async () => {
    const store = await watching();
    await watching(store, 42, pool(2));
    const record = await readPoolWatches(store, 42);
    if (record === null || record === undefined) throw new Error("record");

    const { record: next, written } = await recordRangeTold(store, 42, record, pool(2), [0.0004, 0.0006], LATER);
    expect(written).toBe(true);
    expect(next.watches[0]?.told).toEqual({ lower: 0.0003, upper: 0.0005, at: NOW.toISOString() });
    expect(next.watches[1]?.told).toEqual({ lower: 0.0004, upper: 0.0006, at: LATER.toISOString() });
    expect(await readPoolWatches(store, 42)).toEqual(next);

    store.down = true;
    expect((await recordRangeTold(store, 42, next, pool(1), [0.0004, 0.0006], LATER)).written).toBe(false);
  });

  it("reads every chat with a watch in a pass that has room, and drops from the set a chat whose record has gone or is no chat", async () => {
    const store = await watching();
    await watching(store, 7, pool(2));
    await store.sadd(POOL_WATCHERS_KEY, "99");
    await store.sadd(POOL_WATCHERS_KEY, "not-a-chat");

    const pass = await poolWatchersForPass(store, { budget: 100, after: null });
    expect(pass?.watchers.map(({ chatId }) => chatId).sort()).toEqual([42, 7].sort());
    expect(pass?.total).toBe(4);
    expect([...((await store.smembers(POOL_WATCHERS_KEY)) ?? [])].sort()).toEqual(["42", "7"]);

    store.down = true;
    expect(await poolWatchersForPass(store, { budget: 100, after: null })).toBeNull();
  });

  it("turns a new chat away past the ceiling over every chat, and never one that already watches", async () => {
    const store = await watching(fakeStore(), 1, pool(1));
    for (let chat = 2; chat <= MAX_POOL_WATCHERS; chat += 1) await store.sadd(POOL_WATCHERS_KEY, String(chat));

    expect(await addPoolWatch(store, 5_000, { target: pool(1), range: RANGE, locale: "tr", now: NOW })).toBe("crowded");
    expect(await readPoolWatches(store, 5_000)).toBeNull();
    expect(await addPoolWatch(store, 1, { target: pool(2), range: RANGE, locale: "tr", now: NOW })).toBe("added");

    await store.srem(POOL_WATCHERS_KEY, "2");
    expect(await addPoolWatch(store, 5_000, { target: pool(1), range: RANGE, locale: "tr", now: NOW })).toBe("added");
  });

  it("throws away a record it cannot read as watches", async () => {
    const store = fakeStore();
    store.data.set(`${BACKUP_PREFIX}pools:42`, "{not json");
    expect(await readPoolWatches(store, 42)).toBeNull();
    store.data.set(`${BACKUP_PREFIX}pools:42`, JSON.stringify({ locale: "tr", watches: [{ chainId: 1, protocol: "v3", poolId: "0x1", told: null }] }));
    expect(await readPoolWatches(store, 42)).toBeNull();
    store.data.set(`${BACKUP_PREFIX}pools:42`, JSON.stringify({ locale: "xx", watches: [] }));
    expect(await readPoolWatches(store, 42)).toBeNull();
  });
});

describe("the pool watches one pass reads", () => {
  /** Chats 10 to 19, chat n following n - 9 pools, up to five: forty pools in all. */
  const crowd = async () => {
    const store = fakeStore();
    for (let chat = 10; chat < 20; chat += 1) {
      for (let n = 1; n <= Math.min(chat - 9, MAX_POOL_WATCHES); n += 1) await watching(store, chat, pool(n));
    }
    return store;
  };

  it("reads whole chats until the next would pass the budget of pools, and never more", async () => {
    const store = await crowd();
    const pass = await poolWatchersForPass(store, { budget: 6, after: null });

    /* 10 has one pool, 11 two, 12 three: six. 13's four would make ten. */
    expect(pass?.watchers.map(({ chatId }) => chatId)).toEqual([10, 11, 12]);
    expect(pass?.last).toBe("12");
  });

  it("starts after where the last pass stopped, comes round again, and reaches every chat", async () => {
    const store = await crowd();
    const seen: number[] = [];
    let after: string | null = null;
    for (let run = 0; run < 8; run += 1) {
      const pass = await poolWatchersForPass(store, { budget: 10, after });
      const pools = (pass?.watchers ?? []).reduce((sum, { record }) => sum + record.watches.length, 0);
      expect(pools).toBeLessThanOrEqual(10);
      seen.push(...(pass?.watchers ?? []).map(({ chatId }) => chatId));
      after = pass?.last ?? null;
    }

    /* Eight passes of at most ten pools over forty: every chat reached, and none twice before all once. */
    expect(new Set(seen)).toEqual(new Set([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]));
    expect(new Set(seen.slice(0, 10)).size).toBe(10);
  });

  it("always reads one chat, even when the budget is smaller than its pools", async () => {
    const store = await crowd();
    const pass = await poolWatchersForPass(store, { budget: 1, after: "18" });
    expect(pass?.watchers.map(({ chatId }) => chatId)).toEqual([19]);
  });
});
