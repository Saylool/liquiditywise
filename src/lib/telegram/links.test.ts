import { describe, expect, it } from "vitest";

import { fakeStore } from "./fakeStore";
import {
  claimLink,
  createPendingLink,
  findByChat,
  forgetLink,
  listWatches,
  readLink,
  recordDigestSent,
  recordSnapshot,
  setSmartAlerts,
  setWeeklyDigest,
  WATCHES_KEY,
} from "./links";

const TOKEN = "abcDEF123456789012_-xy";
const OTHER = "zyxWVU987654321098_-ab";
const ADDRESS = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";
const NOW = new Date("2026-09-21T10:00:00.000Z");

const pending = async (store = fakeStore(), token = TOKEN) => {
  expect(await createPendingLink(store, token, { address: ADDRESS, locale: "tr", now: NOW })).toBe(true);
  return store;
};

describe("Telegram links", () => {
  it("mints a pending link that reads back with no chat and no snapshot", async () => {
    const store = await pending();
    expect(await readLink(store, TOKEN)).toEqual({
      address: ADDRESS,
      locale: "tr",
      chatId: null,
      createdAt: NOW.toISOString(),
      snapshot: null,
    });
  });

  it("tells a missing link from a store that could not answer", async () => {
    const store = fakeStore();
    expect(await readLink(store, TOKEN)).toBeNull();
    store.down = true;
    expect(await readLink(store, TOKEN)).toBeUndefined();
  });

  it("refuses to look up something that is not a token", async () => {
    const store = await pending();
    expect(await readLink(store, "../anything")).toBeNull();
    expect(store.data.size).toBe(1);
  });

  it("claims a pending link for the first chat and puts it in the watch set", async () => {
    const store = await pending();
    expect(await claimLink(store, TOKEN, 42)).toBe("claimed");
    expect((await readLink(store, TOKEN))?.chatId).toBe(42);
    expect(await store.smembers(WATCHES_KEY)).toEqual([TOKEN]);
  });

  it("lets the same chat present its token twice, and refuses a second chat", async () => {
    const store = await pending();
    await claimLink(store, TOKEN, 42);
    expect(await claimLink(store, TOKEN, 42)).toBe("claimed");
    expect(await claimLink(store, TOKEN, 43)).toBe("already-claimed");
    expect((await readLink(store, TOKEN))?.chatId).toBe(42);
  });

  it("reports an unknown token, and a store that is down", async () => {
    const store = fakeStore();
    expect(await claimLink(store, TOKEN, 42)).toBe("unknown");
    store.down = true;
    expect(await claimLink(store, TOKEN, 42)).toBe("unavailable");
  });

  it("lists only claimed links, and drops a pending or vanished token from the set", async () => {
    const store = await pending();
    await pending(store, OTHER);
    await claimLink(store, TOKEN, 42);
    await store.sadd(WATCHES_KEY, OTHER);
    await store.sadd(WATCHES_KEY, "gone_gone_gone_gone_gg");

    const watches = await listWatches(store);
    expect(watches?.map((watch) => watch.token)).toEqual([TOKEN]);
    expect(await store.smembers(WATCHES_KEY)).toEqual([TOKEN]);
  });

  it("finds a link by its chat, and answers null for a chat that has none", async () => {
    const store = await pending();
    await claimLink(store, TOKEN, 42);
    expect((await findByChat(store, 42))?.token).toBe(TOKEN);
    expect(await findByChat(store, 7)).toBeNull();
  });

  it("records a snapshot without losing the rest of the link", async () => {
    const store = await pending();
    await claimLink(store, TOKEN, 42);
    const link = await readLink(store, TOKEN);
    if (link === null || link === undefined) throw new Error("link");

    await recordSnapshot(store, TOKEN, link, { "v3:1": true });
    expect(await readLink(store, TOKEN)).toEqual({ ...link, snapshot: { "v3:1": true } });
  });

  it("forgets a link from both the record and the set", async () => {
    const store = await pending();
    await claimLink(store, TOKEN, 42);
    await forgetLink(store, TOKEN);
    expect(await readLink(store, TOKEN)).toBeNull();
    expect(await store.smembers(WATCHES_KEY)).toEqual([]);
  });

  it("throws away a record it cannot read as a link", async () => {
    const store = fakeStore();
    store.data.set(`liquiditywise:telegram:link:${TOKEN}`, "{not json");
    expect(await readLink(store, TOKEN)).toBeNull();
    store.data.set(`liquiditywise:telegram:link:${TOKEN}`, JSON.stringify({ address: "nope" }));
    expect(await readLink(store, TOKEN)).toBeNull();
  });
});

describe("a link on a chain", () => {
  const key = `liquiditywise:telegram:link:${TOKEN}`;

  it("reads a link stored before chains existed as a mainnet link, unchanged", async () => {
    const store = fakeStore();
    store.data.set(
      key,
      JSON.stringify({ address: ADDRESS, locale: "tr", chatId: 42, createdAt: NOW.toISOString(), snapshot: { "v3:1": true } }),
    );

    const link = await readLink(store, TOKEN);

    expect(link?.chatId).toBe(42);
    expect(link?.chainId).toBeUndefined();
    expect(link?.snapshot).toEqual({ "v3:1": true });
  });

  it("writes the chain off mainnet, and nothing new for mainnet", async () => {
    const store = fakeStore();
    await createPendingLink(store, TOKEN, { address: ADDRESS, locale: "tr", now: NOW, chainId: 8453 });
    await createPendingLink(store, OTHER, { address: ADDRESS, locale: "tr", now: NOW, chainId: 1 });

    expect((await readLink(store, TOKEN))?.chainId).toBe(8453);
    expect(JSON.parse(store.data.get(`liquiditywise:telegram:link:${OTHER}`) ?? "{}")).not.toHaveProperty("chainId");
  });

  it("keeps the chain when the checker records what it saw", async () => {
    const store = fakeStore();
    await createPendingLink(store, TOKEN, { address: ADDRESS, locale: "tr", now: NOW, chainId: 42161 });
    await claimLink(store, TOKEN, 7);
    const link = await readLink(store, TOKEN);
    await recordSnapshot(store, TOKEN, link!, { "v3:9": false });

    expect((await readLink(store, TOKEN))?.chainId).toBe(42161);
  });

  it("refuses a stored link naming a chain nobody reads, rather than following it on mainnet", async () => {
    const store = fakeStore();
    store.data.set(
      key,
      JSON.stringify({ address: ADDRESS, locale: "tr", chatId: 42, createdAt: NOW.toISOString(), chainId: 56, snapshot: null }),
    );

    expect(await readLink(store, TOKEN)).toBeNull();
  });
});

describe("smart-money alerts on a link", () => {
  const claimed = async () => {
    const store = await pending();
    await claimLink(store, TOKEN, 42);
    return store;
  };
  const link = async (store: ReturnType<typeof fakeStore>) => (await readLink(store, TOKEN)) as NonNullable<Awaited<ReturnType<typeof readLink>>>;

  it("are off on a link that never asked, and store nothing about them, whatever the checker passes", async () => {
    const store = await claimed();
    await recordSnapshot(store, TOKEN, await link(store), { "v3:1": true }, { "0xpool": [1, 2] });

    const read = await link(store);
    expect(read.smart).toBeUndefined();
    expect(JSON.parse(store.data.get(`liquiditywise:telegram:link:${TOKEN}`) ?? "{}")).not.toHaveProperty("smart");
  });

  it("turn on with nothing told yet, keep what the checker records, and keep the record through a snapshot that passes none", async () => {
    const store = await claimed();
    expect(await setSmartAlerts(store, TOKEN, await link(store), true)).toBe(true);
    expect((await link(store)).smart).toEqual({ ranges: {} });

    await recordSnapshot(store, TOKEN, await link(store), { "v3:1": true }, { "0xpool": [100, 200] });
    expect((await link(store)).smart).toEqual({ ranges: { "0xpool": [100, 200] } });

    await recordSnapshot(store, TOKEN, await link(store), { "v3:1": false });
    expect((await link(store)).smart).toEqual({ ranges: { "0xpool": [100, 200] } });
    expect((await link(store)).snapshot).toEqual({ "v3:1": false });
  });

  it("turn off by deleting what was kept for them, and leave the rest of the link alone", async () => {
    const store = await claimed();
    await setSmartAlerts(store, TOKEN, await link(store), true);
    await recordSnapshot(store, TOKEN, await link(store), { "v3:1": true }, { "0xpool": [100, 200] });
    await setSmartAlerts(store, TOKEN, await link(store), false);

    const read = await link(store);
    expect(read.smart).toBeUndefined();
    expect(read).toMatchObject({ address: ADDRESS, chatId: 42, snapshot: { "v3:1": true } });
    expect(store.data.get(`liquiditywise:telegram:link:${TOKEN}`)).not.toContain("0xpool");
  });

  it("say whether the write took", async () => {
    const store = await claimed();
    const before = await link(store);
    store.down = true;

    expect(await setSmartAlerts(store, TOKEN, before, true)).toBe(false);
  });

  it("are read as not asked for, rather than losing the link, when what is kept for them cannot be read", async () => {
    const store = await claimed();
    const raw = JSON.parse(store.data.get(`liquiditywise:telegram:link:${TOKEN}`) ?? "{}");
    store.data.set(`liquiditywise:telegram:link:${TOKEN}`, JSON.stringify({ ...raw, smart: { ranges: { "0xpool": "nope" } } }));

    expect(await readLink(store, TOKEN)).toMatchObject({ address: ADDRESS, chatId: 42 });
    expect((await link(store)).smart).toBeUndefined();
  });
});

describe("the weekly digest on a link", () => {
  const SENT = new Date("2026-10-05T08:00:00.000Z");
  const KEY = `liquiditywise:telegram:link:${TOKEN}`;
  const claimed = async () => {
    const store = await pending();
    await claimLink(store, TOKEN, 42);
    return store;
  };
  const link = async (store: ReturnType<typeof fakeStore>) => (await readLink(store, TOKEN)) as NonNullable<Awaited<ReturnType<typeof readLink>>>;

  it("is off on a link that never asked, and nothing about it is stored", async () => {
    const store = await claimed();
    await recordSnapshot(store, TOKEN, await link(store), { "v3:1": true });

    expect((await link(store)).weekly).toBeUndefined();
    expect(JSON.parse(store.data.get(KEY) ?? "{}")).not.toHaveProperty("weekly");
  });

  it("turns on with none sent yet, and keeps the time of the last one through the checker's snapshot", async () => {
    const store = await claimed();
    expect(await setWeeklyDigest(store, TOKEN, await link(store), true)).toBe(true);
    expect((await link(store)).weekly).toEqual({ sentAt: null });

    const sent = await recordDigestSent(store, TOKEN, await link(store), NOW);
    expect(sent.weekly).toEqual({ sentAt: NOW.toISOString() });
    expect((await link(store)).weekly).toEqual({ sentAt: NOW.toISOString() });

    await recordSnapshot(store, TOKEN, sent, { "v3:1": true });
    expect(await link(store)).toMatchObject({ weekly: { sentAt: NOW.toISOString() }, snapshot: { "v3:1": true } });
  });

  it("answers the link with the new time even when the store did not take it, for the pass to write again", async () => {
    const store = await claimed();
    await setWeeklyDigest(store, TOKEN, await link(store), true);
    const before = await link(store);
    store.down = true;

    expect((await recordDigestSent(store, TOKEN, before, NOW)).weekly).toEqual({ sentAt: NOW.toISOString() });
    store.down = false;
    expect((await link(store)).weekly).toEqual({ sentAt: null });
  });

  it("turns off by deleting the time kept for it, and leaves /smart and the rest of the link alone", async () => {
    const store = await claimed();
    await setSmartAlerts(store, TOKEN, await link(store), true);
    await setWeeklyDigest(store, TOKEN, await link(store), true);
    await recordDigestSent(store, TOKEN, await link(store), SENT);
    expect(await setWeeklyDigest(store, TOKEN, await link(store), false)).toBe(true);

    const read = await link(store);
    expect(read.weekly).toBeUndefined();
    expect(read).toMatchObject({ address: ADDRESS, chatId: 42, smart: { ranges: {} } });
    expect(JSON.parse(store.data.get(KEY) ?? "{}")).not.toHaveProperty("weekly");
    expect(store.data.get(KEY)).not.toContain(SENT.toISOString());
  });

  it("is kept through /smart turning on and off", async () => {
    const store = await claimed();
    await setWeeklyDigest(store, TOKEN, await link(store), true);
    await setSmartAlerts(store, TOKEN, await link(store), true);
    await setSmartAlerts(store, TOKEN, await link(store), false);

    expect((await link(store)).weekly).toEqual({ sentAt: null });
  });

  it("says whether the write took", async () => {
    const store = await claimed();
    const before = await link(store);
    store.down = true;

    expect(await setWeeklyDigest(store, TOKEN, before, true)).toBe(false);
  });

  it("is read as not asked for, rather than losing the link, when what is kept for it cannot be read", async () => {
    const store = await claimed();
    const raw = JSON.parse(store.data.get(KEY) ?? "{}");
    store.data.set(KEY, JSON.stringify({ ...raw, weekly: { sentAt: "last monday" } }));

    expect(await readLink(store, TOKEN)).toMatchObject({ address: ADDRESS, chatId: 42 });
    expect((await link(store)).weekly).toBeUndefined();
  });
});
