import { describe, expect, it } from "vitest";

import { fakeStore } from "./fakeStore";
import {
  claimLink,
  createPendingLink,
  findByChat,
  forgetLink,
  listWatches,
  readLink,
  recordSnapshot,
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
      JSON.stringify({ address: ADDRESS, locale: "tr", chatId: 42, createdAt: NOW.toISOString(), chainId: 10, snapshot: null }),
    );

    expect(await readLink(store, TOKEN)).toBeNull();
  });
});
