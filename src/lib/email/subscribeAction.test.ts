import { beforeEach, describe, expect, it, vi } from "vitest";

import { spendActionBudget } from "../ratelimit/actionBudget";
import { fakeStore } from "../telegram/fakeStore";
import type { EmailMessage } from "./provider";
import { verifyToken } from "./signedToken";
import { confirmSubscription, readSubscription, subscriptionIdOf } from "./subscriptions";
import { SUBSCRIBE_BUDGET } from "./subscribeLimiter";

/*
 * The form, with the request around it replaced: what it writes, what it
 * sends, and the one word it sends the reader back with.
 */

const SECRET = "server-secret";

const state = vi.hoisted(() => ({
  store: null as unknown,
  sent: [] as EmailMessage[],
  taking: true,
  configured: true,
  headers: new Headers(),
  redirectedTo: null as string | null,
}));

class Redirected extends Error {}

vi.mock("server-only", () => ({}));
vi.mock("./environment", () => ({
  emailDigestSetup: () =>
    state.configured
      ? {
          store: state.store,
          secret: "server-secret",
          provider: {
            sendEmail: async (message: EmailMessage) => {
              state.sent.push(message);
              return state.taking;
            },
            probe: async () => 200,
          },
        }
      : null,
}));
vi.mock("../i18n/requestLocale", () => ({ getRequestLocale: async () => "tr" }));
vi.mock("next/headers", () => ({ headers: async () => state.headers }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    state.redirectedTo = to;
    throw new Redirected(to);
  },
}));

const submit = async (fields: Record<string, string>, client = "198.51.100.1") => {
  const { subscribeToDigest } = await import("./subscribeAction");
  state.headers = new Headers({ "x-real-ip": client });
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  try {
    await subscribeToDigest(form);
  } catch (error) {
    if (!(error instanceof Redirected)) throw error;
  }
  return state.redirectedTo;
};

const store = () => state.store as ReturnType<typeof fakeStore>;

beforeEach(() => {
  state.store = fakeStore();
  state.sent = [];
  state.taking = true;
  state.configured = true;
  state.redirectedTo = null;
});

describe("asking for the digest by e-mail", () => {
  it("writes a pending record for the address on the chain and in the language of the page, and sends one confirmation", async () => {
    const back = await submit({ email: " Reader@Example.com ", chain: "base" }, "198.51.100.2");

    expect(back).toBe("/tr/weekly?chain=base&email=sent#email");
    const id = subscriptionIdOf(SECRET, "reader@example.com");
    expect(await readSubscription(store(), id)).toEqual({ address: "reader@example.com", chainId: 8453, locale: "tr", confirmedAt: null, lastSentAt: null });
    expect(state.sent).toHaveLength(1);
    expect(state.sent[0]?.to).toBe("reader@example.com");
    expect(state.sent[0]?.subject).toContain("Base");
  });

  it("sends a link that confirms that record and no other, for a day", async () => {
    await submit({ email: "reader@example.com", chain: "ethereum" }, "198.51.100.3");

    const token = new URL(/https:\/\/\S+/.exec(state.sent[0]?.text ?? "")?.[0] ?? "").searchParams.get("token");
    const claims = verifyToken(SECRET, token, "confirm", new Date());

    expect(claims?.id).toBe(subscriptionIdOf(SECRET, "reader@example.com"));
    expect((claims?.expiresAtMs ?? 0) - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1_000);
    expect((claims?.expiresAtMs ?? 0) - Date.now()).toBeLessThanOrEqual(24 * 60 * 60 * 1_000);
  });

  it("goes back to the page without a chain for mainnet, as every mainnet link does", async () => {
    expect(await submit({ email: "reader@example.com", chain: "ethereum" }, "198.51.100.4")).toBe("/tr/weekly?email=sent#email");
  });

  it("refuses what is not an address, writing and sending nothing", async () => {
    expect(await submit({ email: "reader", chain: "base" }, "198.51.100.5")).toBe("/tr/weekly?chain=base&email=invalid#email");
    expect(await submit({ chain: "base" }, "198.51.100.5")).toBe("/tr/weekly?chain=base&email=invalid#email");

    expect(store().data.size).toBe(0);
    expect(state.sent).toEqual([]);
  });

  it("refuses a chain the form does not offer: one nobody reads, or one where no smart money is measured", async () => {
    expect(await submit({ email: "reader@example.com", chain: "solana" }, "198.51.100.6")).toBe("/tr/weekly?email=invalid#email");
    expect(await submit({ email: "reader@example.com", chain: "unichain" }, "198.51.100.6")).toBe("/tr/weekly?email=invalid#email");
    expect(await submit({ email: "reader@example.com" }, "198.51.100.6")).toBe("/tr/weekly?email=invalid#email");

    expect(store().data.size).toBe(0);
    expect(state.sent).toEqual([]);
  });

  it("answers the same way, and sends nothing, for an address already confirmed", async () => {
    await submit({ email: "reader@example.com", chain: "base" }, "198.51.100.7");
    const id = subscriptionIdOf(SECRET, "reader@example.com");
    await confirmSubscription(store(), id, new Date());
    state.sent = [];

    const back = await submit({ email: "reader@example.com", chain: "ethereum" }, "198.51.100.7");

    expect(back).toBe("/tr/weekly?email=sent#email");
    expect(state.sent).toEqual([]);
    expect(await readSubscription(store(), id)).toMatchObject({ chainId: 8453, locale: "tr" });
  });

  it("turns a client away after a few in a quarter of an hour, writing nothing more", async () => {
    const client = "198.51.100.8";
    for (let i = 0; i < 5; i += 1) await submit({ email: `reader${i}@example.com`, chain: "base" }, client);

    const back = await submit({ email: "reader9@example.com", chain: "base" }, client);

    expect(back).toBe("/tr/weekly?chain=base&email=busy#email");
    expect(state.sent).toHaveLength(5);
    expect(await readSubscription(store(), subscriptionIdOf(SECRET, "reader9@example.com"))).toBeNull();
  });

  it("says so when the store did not take the record, and sends nothing", async () => {
    store().down = true;

    expect(await submit({ email: "reader@example.com", chain: "base" }, "198.51.100.9")).toBe("/tr/weekly?chain=base&email=unavailable#email");
    expect(state.sent).toEqual([]);
  });

  it("says so when the provider did not take the confirmation", async () => {
    state.taking = false;

    expect(await submit({ email: "reader@example.com", chain: "base" }, "198.51.100.10")).toBe("/tr/weekly?chain=base&email=unavailable#email");
  });

  it("does nothing but go back where the digest by e-mail is not set up", async () => {
    state.configured = false;

    expect(await submit({ email: "reader@example.com", chain: "base" }, "198.51.100.11")).toBe("/tr/weekly?chain=base&email=unavailable#email");
    expect(store().data.size).toBe(0);
  });

  it("never puts the address in the address it goes back to", async () => {
    const back = await submit({ email: "reader@example.com", chain: "base" }, "198.51.100.12");

    expect(back).not.toContain("reader");
    expect(back).not.toContain("example.com");
  });
});

describe("what the form can send, over every process and every client", () => {
  it("turns a client away that other processes have already counted, though this one has seen nothing of it", async () => {
    const client = "198.51.100.40";
    for (let i = 0; i < SUBSCRIBE_BUDGET.perClient; i += 1) {
      await spendActionBudget(store(), SUBSCRIBE_BUDGET, { clientKey: client, secret: SECRET, now: Date.now() });
    }

    expect(await submit({ email: "reader@example.com", chain: "base" }, client)).toBe("/tr/weekly?chain=base&email=busy#email");
    expect(state.sent).toEqual([]);
    expect(await readSubscription(store(), subscriptionIdOf(SECRET, "reader@example.com"))).toBeNull();
  });

  it("holds everybody together to the hour's ceiling of confirmations, however many clients they are", async () => {
    for (let i = 0; i < SUBSCRIBE_BUDGET.global; i += 1) {
      expect(await submit({ email: `reader${i}@example.com`, chain: "base" }, `203.0.113.${i + 1}`)).toBe("/tr/weekly?chain=base&email=sent#email");
    }

    expect(await submit({ email: "one-more@example.com", chain: "base" }, "203.0.113.200")).toBe("/tr/weekly?chain=base&email=busy#email");
    expect(state.sent).toHaveLength(SUBSCRIBE_BUDGET.global);
    expect(await readSubscription(store(), subscriptionIdOf(SECRET, "one-more@example.com"))).toBeNull();
  });
});
