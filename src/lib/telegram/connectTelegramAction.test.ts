import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeStore } from "./fakeStore";
import { readLink } from "./links";

/*
 * The button that starts following an address: which chain the new link
 * follows it on, taken from the form the page rendered.
 */

const state = vi.hoisted(() => ({ store: null as unknown, cookies: [] as { name: string; value: string }[], redirected: null as string | null }));

vi.mock("server-only", () => ({}));
vi.mock("./environment", () => ({ telegramSetup: () => ({ store: state.store, username: "samet_test_bot" }) }));
vi.mock("../i18n/requestLocale", () => ({ getRequestLocale: async () => "tr" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (cookie: { name: string; value: string }) => state.cookies.push(cookie),
    get: () => undefined,
    delete: () => undefined,
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    state.redirected = to;
  },
}));

const ADDRESS = `0x${"a".repeat(40)}`;

const connect = async (fields: Record<string, string>) => {
  const { connectTelegram } = await import("./connectTelegramAction");
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  await connectTelegram(form);
  const token = state.cookies.at(-1)?.value;
  return token === undefined ? null : readLink(state.store as ReturnType<typeof fakeStore>, token);
};

beforeEach(() => {
  state.store = fakeStore();
  state.cookies = [];
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
