import { describe, expect, it } from "vitest";

import { BACKUP_PREFIXES } from "../backup/storeBackup";
import type { KeyValueStore } from "../store/keyValueStore";
import { fakeStore } from "../telegram/fakeStore";
import { CONFIRM_TOKEN_TTL_MS } from "./signedToken";
import {
  CONFIRMED_KEY,
  CONFIRMED_SUBSCRIPTION_TTL_MS,
  confirmSubscription,
  EMAIL_PREFIX,
  isEmailAddress,
  listConfirmed,
  normalizeAddress,
  PENDING_SUBSCRIPTION_TTL_MS,
  readSubscription,
  recordDigestSent,
  requestSubscription,
  subscriptionIdOf,
  unsubscribe,
} from "./subscriptions";

const SECRET = "server-secret";
const ADDRESS = "Reader@Example.com";
const ID = subscriptionIdOf(SECRET, ADDRESS);
const NOW = new Date("2026-10-07T12:00:00.000Z");

type Store = ReturnType<typeof fakeStore> & { readonly ttls: Map<string, number | undefined> };

/** The fake store, remembering the lifetime each write asked for. */
const storeWithTtls = (): Store => {
  const inner = fakeStore();
  const ttls = new Map<string, number | undefined>();
  const write = inner.set;
  const set: KeyValueStore["set"] = async (key, value, ttlMs) => {
    ttls.set(key, ttlMs);
    return write(key, value, ttlMs);
  };
  return Object.assign(inner, { ttls, set });
};

const asked = async (store: Store = storeWithTtls()): Promise<Store> => {
  await requestSubscription(store, ID, { address: ADDRESS, chainId: 8453, locale: "tr" });
  return store;
};

describe("what an address is", () => {
  it("has something either side of one @ and a dot after it, and no whitespace", () => {
    for (const good of ["reader@example.com", "a.b+c@sub.example.co", "x@y.zz"]) expect(isEmailAddress(good), good).toBe(true);
    for (const bad of ["", "reader", "reader@", "@example.com", "reader@example", "two@@example.com", "a b@example.com", 42, null]) {
      expect(isEmailAddress(bad), String(bad)).toBe(false);
    }
    expect(isEmailAddress(`${"a".repeat(250)}@example.com`)).toBe(false);
  });

  it("is kept in one spelling", () => {
    expect(normalizeAddress("  Reader@Example.COM ")).toBe("reader@example.com");
  });
});

describe("a subscription's id", () => {
  it("is the same for the same mailbox however it was typed, and different for another", () => {
    expect(subscriptionIdOf(SECRET, "reader@example.com")).toBe(ID);
    expect(subscriptionIdOf(SECRET, " READER@example.com ")).toBe(ID);
    expect(subscriptionIdOf(SECRET, "other@example.com")).not.toBe(ID);
  });

  it("depends on the secret, so an id says nothing about an address without it", () => {
    expect(subscriptionIdOf("another-secret", ADDRESS)).not.toBe(ID);
  });

  it("looks like a Telegram token: 22 characters a link can carry", () => {
    expect(ID).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });
});

describe("asking for the digest", () => {
  it("writes a pending record of exactly five things, the address lowercased, for a day", async () => {
    const store = storeWithTtls();

    expect(await requestSubscription(store, ID, { address: ADDRESS, chainId: 8453, locale: "tr" })).toBe("pending");

    const raw = store.data.get(`${EMAIL_PREFIX}sub:${ID}`);
    expect(JSON.parse(raw ?? "{}")).toEqual({
      address: "reader@example.com",
      chainId: 8453,
      locale: "tr",
      confirmedAt: null,
      lastSentAt: null,
    });
    expect(store.ttls.get(`${EMAIL_PREFIX}sub:${ID}`)).toBe(PENDING_SUBSCRIPTION_TTL_MS);
    expect(PENDING_SUBSCRIPTION_TTL_MS).toBe(CONFIRM_TOKEN_TTL_MS);
  });

  it("is not yet in the set the sender walks", async () => {
    const store = await asked();

    expect(await listConfirmed(store)).toEqual([]);
    expect(store.sets.get(CONFIRMED_KEY) ?? new Set()).toEqual(new Set());
  });

  it("replaces a pending record asked for again, with the new network and language", async () => {
    const store = await asked();

    expect(await requestSubscription(store, ID, { address: ADDRESS, chainId: 1, locale: "de" })).toBe("pending");
    expect(await readSubscription(store, ID)).toMatchObject({ chainId: 1, locale: "de", confirmedAt: null });
  });

  it("leaves a confirmed record exactly as it was, whatever the form says", async () => {
    const store = await asked();
    await confirmSubscription(store, ID, NOW);

    expect(await requestSubscription(store, ID, { address: ADDRESS, chainId: 1, locale: "de" })).toBe("already-confirmed");
    expect(await readSubscription(store, ID)).toMatchObject({ chainId: 8453, locale: "tr", confirmedAt: NOW.toISOString() });
  });

  it("says when the store did not answer, rather than that the record is pending", async () => {
    const store = storeWithTtls();
    store.down = true;

    expect(await requestSubscription(store, ID, { address: ADDRESS, chainId: 8453, locale: "tr" })).toBe("unavailable");
  });
});

describe("confirming", () => {
  it("dates the record, keeps it a year, and adds it to the set", async () => {
    const store = await asked();

    const outcome = await confirmSubscription(store, ID, NOW);

    expect(outcome).toEqual({
      status: "confirmed",
      subscription: { address: "reader@example.com", chainId: 8453, locale: "tr", confirmedAt: NOW.toISOString(), lastSentAt: null },
    });
    expect(store.ttls.get(`${EMAIL_PREFIX}sub:${ID}`)).toBe(CONFIRMED_SUBSCRIPTION_TTL_MS);
    expect(await listConfirmed(store)).toEqual([{ id: ID, subscription: outcome.status === "confirmed" ? outcome.subscription : null }]);
  });

  it("confirms once: a second click finds it already confirmed and changes nothing", async () => {
    const store = await asked();
    await confirmSubscription(store, ID, NOW);

    const again = await confirmSubscription(store, ID, new Date(NOW.getTime() + 60_000));

    expect(again.status).toBe("already-confirmed");
    expect((await readSubscription(store, ID))?.confirmedAt).toBe(NOW.toISOString());
  });

  it("has nothing to confirm once the pending record has gone", async () => {
    const store = storeWithTtls();

    expect(await confirmSubscription(store, ID, NOW)).toEqual({ status: "unknown" });
    expect(await listConfirmed(store)).toEqual([]);
  });

  it("tells a store that is down from a record that is not there", async () => {
    const store = await asked();
    store.down = true;

    expect(await confirmSubscription(store, ID, NOW)).toEqual({ status: "unavailable" });
  });
});

describe("recording a digest sent", () => {
  it("keeps the time and renews the year, and answers the record as it now stands", async () => {
    const store = await asked();
    const confirmed = await confirmSubscription(store, ID, NOW);
    if (confirmed.status !== "confirmed") throw new Error(confirmed.status);
    const { subscription } = confirmed;
    const monday = new Date("2026-10-12T08:05:00.000Z");

    const next = await recordDigestSent(store, ID, subscription, monday);

    expect(next.lastSentAt).toBe(monday.toISOString());
    expect(await readSubscription(store, ID)).toEqual(next);
    expect(store.ttls.get(`${EMAIL_PREFIX}sub:${ID}`)).toBe(CONFIRMED_SUBSCRIPTION_TTL_MS);
  });
});

describe("unsubscribing", () => {
  it("deletes the record and takes it out of the set at once", async () => {
    const store = await asked();
    await confirmSubscription(store, ID, NOW);

    expect(await unsubscribe(store, ID)).toBe("removed");

    expect(await readSubscription(store, ID)).toBeNull();
    expect(store.data.size).toBe(0);
    /* The set itself, not the listing — the listing prunes a gone record as it is met, and would hide a set left as it was. */
    expect(store.sets.get(CONFIRMED_KEY)).toEqual(new Set());
    expect(await listConfirmed(store)).toEqual([]);
  });

  it("says nothing was kept when the link is used a second time", async () => {
    const store = await asked();
    await confirmSubscription(store, ID, NOW);
    await unsubscribe(store, ID);

    expect(await unsubscribe(store, ID)).toBe("unknown");
  });

  it("removes a pending record too, for a reader who changed their mind before confirming", async () => {
    const store = await asked();

    expect(await unsubscribe(store, ID)).toBe("removed");
    expect(store.data.size).toBe(0);
  });

  it("reports a store that is down rather than claiming a deletion it could not make", async () => {
    const store = await asked();
    store.down = true;

    expect(await unsubscribe(store, ID)).toBe("unavailable");
  });
});

describe("the confirmed set", () => {
  it("drops an id whose record has expired as it is met, and is null when it cannot be read", async () => {
    const store = await asked();
    await confirmSubscription(store, ID, NOW);
    store.data.clear();

    expect(await listConfirmed(store)).toEqual([]);
    expect(store.sets.get(CONFIRMED_KEY)).toEqual(new Set());

    store.down = true;
    expect(await listConfirmed(store)).toBeNull();
  });
});

describe("where the records live", () => {
  /*
   * The same promise the site makes about a Telegram link — deleted from the
   * server at once, from the backups within seven days — is only true of an
   * e-mail address while the daily backup copies these keys too.
   */
  it("is a prefix the daily backup copies", () => {
    expect(BACKUP_PREFIXES).toContain(EMAIL_PREFIX);
    expect(CONFIRMED_KEY.startsWith(EMAIL_PREFIX)).toBe(true);
  });
});
