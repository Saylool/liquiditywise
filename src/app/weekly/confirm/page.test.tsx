import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONFIRM_TOKEN_TTL_MS, signToken } from "@/lib/email/signedToken";
import { readSubscription, requestSubscription, subscriptionIdOf } from "@/lib/email/subscriptions";
import { getEmailDigestCopy } from "@/lib/i18n/emailDigestCopy";
import { getWeeklyCopy } from "@/lib/i18n/weeklyCopy";
import { fakeStore } from "@/lib/telegram/fakeStore";

const SECRET = "server-secret";
const state = vi.hoisted(() => ({ store: null as unknown, configured: true }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/i18n/requestLocale", async () => {
  const { getDictionary } = await import("@/lib/i18n/dictionaries");
  return { getRequestDictionary: async () => ({ locale: "en", t: getDictionary("en") }) };
});
vi.mock("@/lib/email/environment", () => ({
  emailDigestSetup: () => (state.configured ? { store: state.store, secret: "server-secret", provider: {} } : null),
}));

import ConfirmPage, { generateMetadata } from "./page";

const store = () => state.store as ReturnType<typeof fakeStore>;
const ADDRESS = "reader@example.com";
const ID = subscriptionIdOf(SECRET, ADDRESS);

const page = async (token?: string) => renderToStaticMarkup(await ConfirmPage({ searchParams: Promise.resolve(token === undefined ? {} : { token }) }));
const confirmToken = (id = ID, expiresAtMs = Date.now() + CONFIRM_TOKEN_TTL_MS) => signToken(SECRET, { purpose: "confirm", id, expiresAtMs });

beforeEach(async () => {
  state.store = fakeStore();
  state.configured = true;
  await requestSubscription(store(), ID, { address: ADDRESS, chainId: 8453, locale: "tr" });
});

describe("the confirmation page's metadata", () => {
  it("is closed to crawlers", async () => {
    expect((await generateMetadata()).robots).toEqual({ index: false, follow: false });
    expect((await generateMetadata()).title).toContain(getEmailDigestCopy("en").confirm.title);
  });
});

describe("the confirmation page", () => {
  it("confirms the record the link names and says so in the language the reader asked in, naming the chain", async () => {
    const html = await page(confirmToken());

    expect(html).toContain(getEmailDigestCopy("tr").confirm.confirmed("Base"));
    expect(html).toContain('href="/tr/weekly?chain=base"');
    expect(html).toContain(getWeeklyCopy("tr").link);
    expect((await readSubscription(store(), ID))?.confirmedAt).not.toBeNull();
  });

  it("says a second click finds it already confirmed", async () => {
    await page(confirmToken());

    expect(await page(confirmToken())).toContain(getEmailDigestCopy("tr").confirm.already);
  });

  it("confirms nothing for a link that has expired, was signed for something else, or was not made here", async () => {
    const expired = await page(confirmToken(ID, Date.now() - 1));
    const other = await page(signToken(SECRET, { purpose: "unsubscribe", id: ID, expiresAtMs: null }));
    const forged = await page(signToken("another-secret", { purpose: "confirm", id: ID, expiresAtMs: Date.now() + 60_000 }));
    const none = await page();

    for (const html of [expired, other, forged, none]) expect(html).toContain(getEmailDigestCopy("en").confirm.invalid);
    expect((await readSubscription(store(), ID))?.confirmedAt).toBeNull();
  });

  it("asks the reader to start again when the link verifies but the pending record has gone", async () => {
    store().data.clear();

    expect(await page(confirmToken())).toContain(getEmailDigestCopy("en").confirm.unknown);
  });

  it("says the store did not answer rather than that the link is bad", async () => {
    store().down = true;

    expect(await page(confirmToken())).toContain(getEmailDigestCopy("en").confirm.unavailable);
  });

  it("says the digest by e-mail is not set up where it is not, and reads nothing", async () => {
    state.configured = false;

    expect(await page(confirmToken())).toContain(getEmailDigestCopy("en").notConfigured);
    expect((await readSubscription(store(), ID))?.confirmedAt).toBeNull();
  });
});
