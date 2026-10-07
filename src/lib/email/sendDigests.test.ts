import { describe, expect, it } from "vitest";

import type { SmartSnapshot, SnapshotPair } from "../analytics/smartHistory";
import type { ChainId } from "../chains/chains";
import { getDictionary } from "../i18n/dictionaries";
import { getWeeklyCopy } from "../i18n/weeklyCopy";
import { fakeStore } from "../telegram/fakeStore";
import type { EmailMessage } from "./provider";
import { sendDigestEmails } from "./sendDigests";
import { verifyToken } from "./signedToken";
import { confirmSubscription, readSubscription, requestSubscription, subscriptionIdOf } from "./subscriptions";

const SECRET = "server-secret";

/* 2026-10-05 is a Monday. */
const MONDAY_MORNING = new Date("2026-10-05T08:05:00.000Z");

const pair = (pool: string, valueUsd: number, lower = 1, upper = 2): SnapshotPair => ({
  pool,
  pair: "USDC / WETH",
  feePpm: 500,
  positions: 6,
  valueUsd,
  lowerPrice: lower,
  upperPrice: upper,
  currentPrice: (lower + upper) / 2,
  yearlyYield: 0.2,
});

const snapshot = (at: string, pairs: readonly SnapshotPair[]): SmartSnapshot => ({ at, measured: 100, smart: 20, medianYearlyYield: 0.1, smartFrom: 0.2, pairs: [...pairs] });

/** A week in which the share moved: what the bot would send. */
const MOVED: readonly SmartSnapshot[] = [
  snapshot("2026-09-28T09:00:00.000Z", [pair("0xa", 60), pair("0xb", 40)]),
  snapshot("2026-10-05T06:00:00.000Z", [pair("0xa", 30), pair("0xb", 70)]),
];

/** A week in which nothing moved: nothing to send. */
const QUIET: readonly SmartSnapshot[] = [
  snapshot("2026-09-28T09:00:00.000Z", [pair("0xa", 50), pair("0xb", 50)]),
  snapshot("2026-10-05T06:00:00.000Z", [pair("0xa", 50.5), pair("0xb", 49.5)]),
];

const subscribed = async (store = fakeStore(), address = "reader@example.com", chainId: ChainId = 8453, locale: "tr" | "en" = "tr") => {
  const id = subscriptionIdOf(SECRET, address);
  await requestSubscription(store, id, { address, chainId, locale });
  await confirmSubscription(store, id, new Date("2026-10-01T12:00:00.000Z"));
  return { store, id };
};

const provider = (taking = true) => {
  const sent: EmailMessage[] = [];
  return {
    sent,
    sendEmail: async (message: EmailMessage) => {
      sent.push(message);
      return taking;
    },
  };
};

const pass = (store: ReturnType<typeof fakeStore>, mail: ReturnType<typeof provider>, series: readonly SmartSnapshot[] | null, now = MONDAY_MORNING) => {
  const asked: ChainId[] = [];
  const logged: string[] = [];
  const run = sendDigestEmails({
    store,
    sendEmail: mail.sendEmail,
    secret: SECRET,
    dictionary: getDictionary,
    readSmartSeries: async (chainId) => {
      asked.push(chainId);
      return series;
    },
    now: () => now,
    log: (line) => logged.push(line),
  });
  return { run, asked, logged };
};

describe("sending the week's digests", () => {
  it("sends each confirmed address its chain's digest in its language on Monday morning, and records the time", async () => {
    const { store, id } = await subscribed();
    const mail = provider();

    const { run, asked } = pass(store, mail, MOVED);
    const summary = await run;

    expect(summary).toEqual({ subscribers: 1, due: 1, sent: 1, failed: 0, storeUnavailable: false });
    expect(asked).toEqual([8453]);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]?.to).toBe("reader@example.com");
    expect(mail.sent[0]?.subject).toBe(getWeeklyCopy("tr").titleOn("Base"));
    expect(mail.sent[0]?.text).toContain(getDictionary("tr").telegram.weeklyGaining);
    expect((await readSubscription(store, id))?.lastSentAt).toBe(MONDAY_MORNING.toISOString());
  });

  it("signs the unsubscribe link in the mail for that address alone", async () => {
    const { store, id } = await subscribed();
    const mail = provider();

    await pass(store, mail, MOVED).run;

    const token = new URL(mail.sent[0]?.headers?.["List-Unsubscribe"]?.slice(1, -1) ?? "").searchParams.get("token");
    expect(verifyToken(SECRET, token, "unsubscribe", MONDAY_MORNING)?.id).toBe(id);
  });

  it("sends once a week: a second pass the same Monday finds it sent, the next Monday finds it due", async () => {
    const { store } = await subscribed();
    const mail = provider();

    await pass(store, mail, MOVED).run;
    const later = await pass(store, mail, MOVED, new Date("2026-10-05T20:00:00.000Z")).run;
    const tuesday = await pass(store, mail, MOVED, new Date("2026-10-06T09:00:00.000Z")).run;
    const nextMonday = await pass(store, mail, MOVED, new Date("2026-10-12T08:00:00.000Z")).run;

    expect(later).toMatchObject({ due: 0, sent: 0 });
    expect(tuesday).toMatchObject({ due: 0, sent: 0 });
    expect(nextMonday).toMatchObject({ due: 1, sent: 1 });
    expect(mail.sent).toHaveLength(2);
  });

  it("sends nothing before eight on Monday, or on any other day", async () => {
    const { store } = await subscribed();
    const mail = provider();

    expect(await pass(store, mail, MOVED, new Date("2026-10-05T07:59:00.000Z")).run).toMatchObject({ due: 0, sent: 0 });
    expect(await pass(store, mail, MOVED, new Date("2026-10-07T12:00:00.000Z")).run).toMatchObject({ due: 0, sent: 0 });
    expect(mail.sent).toEqual([]);
  });

  it("sends nothing, and records nothing, for a week the series has nothing to say about", async () => {
    const { store, id } = await subscribed();
    const mail = provider();

    const quiet = await pass(store, mail, QUIET).run;
    const unread = await pass(store, mail, null).run;
    const young = await pass(store, mail, [MOVED[1]!]).run;

    expect(quiet).toMatchObject({ due: 1, sent: 0, failed: 0 });
    expect(unread).toMatchObject({ due: 1, sent: 0, failed: 0 });
    expect(young).toMatchObject({ due: 1, sent: 0, failed: 0 });
    expect(mail.sent).toEqual([]);
    expect((await readSubscription(store, id))?.lastSentAt).toBeNull();
  });

  it("leaves an address due when the provider does not take the mail, logs it by id and not by address, and does not retry in the pass", async () => {
    const { store, id } = await subscribed();
    const mail = provider(false);

    const { run, logged } = pass(store, mail, MOVED);
    const summary = await run;

    expect(summary).toMatchObject({ due: 1, sent: 0, failed: 1 });
    expect(mail.sent).toHaveLength(1);
    expect((await readSubscription(store, id))?.lastSentAt).toBeNull();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain(id);
    expect(logged[0]).not.toContain("reader@example.com");

    /* The next pass tries again. */
    const next = provider();
    expect(await pass(store, next, MOVED).run).toMatchObject({ due: 1, sent: 1 });
  });

  it("reads each chain's series once, however many addresses are on it", async () => {
    const { store } = await subscribed();
    await subscribed(store, "second@example.com", 8453, "en");
    await subscribed(store, "third@example.com", 1, "en");
    const mail = provider();

    const { run, asked } = pass(store, mail, MOVED);
    const summary = await run;

    expect(summary).toMatchObject({ subscribers: 3, due: 3, sent: 3 });
    expect([...asked].sort()).toEqual([1, 8453]);
    expect(mail.sent.map(({ to }) => to).sort()).toEqual(["reader@example.com", "second@example.com", "third@example.com"]);
  });

  it("sends to nobody who has not confirmed", async () => {
    const store = fakeStore();
    await requestSubscription(store, subscriptionIdOf(SECRET, "pending@example.com"), { address: "pending@example.com", chainId: 1, locale: "en" });
    const mail = provider();

    expect(await pass(store, mail, MOVED).run).toEqual({ subscribers: 0, due: 0, sent: 0, failed: 0, storeUnavailable: false });
    expect(mail.sent).toEqual([]);
  });

  it("says when the list could not be read, and sends nothing", async () => {
    const { store } = await subscribed();
    store.down = true;
    const mail = provider();

    expect(await pass(store, mail, MOVED).run).toEqual({ subscribers: 0, due: 0, sent: 0, failed: 0, storeUnavailable: true });
    expect(mail.sent).toEqual([]);
  });
});
