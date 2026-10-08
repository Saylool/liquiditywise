import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeStore } from "./fakeStore";
import { claimLink, readLink } from "./links";

/*
 * The button that starts following an address: which chain the new link
 * follows it on, taken from the form the page rendered — and what one caller,
 * and everybody together, can make it write.
 */

const state = vi.hoisted(() => ({
  store: null as unknown,
  cookies: [] as { name: string; value: string }[],
  sentCookie: undefined as string | undefined,
  client: "198.51.100.1",
  redirected: null as string | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("./environment", () => ({
  telegramSetup: () => ({ store: state.store, username: "samet_test_bot", webhookSecret: "webhook-secret" }),
}));
vi.mock("../i18n/requestLocale", () => ({ getRequestLocale: async () => "tr" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (cookie: { name: string; value: string }) => state.cookies.push(cookie),
    get: () => (state.sentCookie === undefined ? undefined : { value: state.sentCookie }),
    delete: () => undefined,
  }),
  headers: async () => new Headers({ "x-real-ip": state.client }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    state.redirected = to;
  },
}));

const ADDRESS = `0x${"a".repeat(40)}`;
const store = () => state.store as ReturnType<typeof fakeStore>;

const connect = async (fields: Record<string, string> = { address: ADDRESS }) => {
  const { connectTelegram } = await import("./connectTelegramAction");
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  const before = state.cookies.length;
  await connectTelegram(form);
  const token = state.cookies.length > before ? state.cookies.at(-1)?.value : undefined;
  return token === undefined ? null : readLink(store(), token);
};

/** The pending links in the store: what a loop of requests would have filled it with. */
const pendingLinks = () => [...store().data.keys()].filter((key) => key.startsWith("liquiditywise:telegram:link:")).length;

beforeEach(() => {
  state.store = fakeStore();
  state.cookies = [];
  state.sentCookie = undefined;
  state.client = "198.51.100.1";
  state.redirected = null;
});

describe("starting to follow an address", () => {
  it("follows it on the chain the page was reading", async () => {
    const link = await connect({ address: ADDRESS, chain: "base" });

    expect(link?.chainId).toBe(8453);
    expect(state.redirected).toMatch(/^https:\/\/t\.me\/samet_test_bot\?start=/);
  });

  it("follows it on mainnet when the form names no chain, stored as mainnet links always were", async () => {
    const link = await connect({ address: ADDRESS });

    expect(link?.address).toBe(ADDRESS);
    expect(link?.chainId).toBeUndefined();
  });

  it("follows nothing for a chain nobody reads", async () => {
    expect(await connect({ address: ADDRESS, chain: "solana" })).toBeNull();
    expect(state.redirected).toBeNull();
  });
});

describe("what asking can write", () => {
  it("holds one client to its budget, posting straight to the action with no cookie and no page", async () => {
    const { TELEGRAM_LINK_BUDGET } = await import("./telegramLinkBudget");
    for (let n = 0; n < TELEGRAM_LINK_BUDGET.perClient; n += 1) expect(await connect()).not.toBeNull();

    state.redirected = null;
    expect(await connect()).toBeNull();
    expect(state.redirected).toBeNull();
    expect(pendingLinks()).toBe(TELEGRAM_LINK_BUDGET.perClient);
  });

  it("holds everybody together to the ceiling, however many clients they are", async () => {
    const { TELEGRAM_LINK_BUDGET } = await import("./telegramLinkBudget");
    for (let n = 0; n < TELEGRAM_LINK_BUDGET.global; n += 1) {
      state.client = `10.0.${Math.floor(n / 250)}.${n % 250}`;
      await connect();
    }
    expect(pendingLinks()).toBe(TELEGRAM_LINK_BUDGET.global);

    state.client = "203.0.113.9";
    expect(await connect()).toBeNull();
    expect(pendingLinks()).toBe(TELEGRAM_LINK_BUDGET.global);
  });

  it("writes nothing when the store cannot count", async () => {
    store().down = true;
    expect(await connect()).toBeNull();
    expect(state.redirected).toBeNull();
  });

  it("gives up the browser's pending link before handing it another, so pressing again leaves one", async () => {
    await connect();
    state.sentCookie = state.cookies.at(-1)?.value;
    await connect();
    state.sentCookie = state.cookies.at(-1)?.value;
    await connect();

    expect(pendingLinks()).toBe(1);
    expect(await readLink(store(), state.cookies.at(-1)?.value ?? "")).not.toBeNull();
  });

  it("leaves a link a chat has claimed alone: it belongs to the chat now", async () => {
    await connect();
    const claimed = state.cookies.at(-1)?.value ?? "";
    await claimLink(store(), claimed, 42);
    state.sentCookie = claimed;
    await connect();

    expect((await readLink(store(), claimed))?.chatId).toBe(42);
  });
});
