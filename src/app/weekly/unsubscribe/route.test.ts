import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { signToken } from "@/lib/email/signedToken";
import { confirmSubscription, listConfirmed, readSubscription, requestSubscription, subscriptionIdOf } from "@/lib/email/subscriptions";
import { getEmailDigestCopy } from "@/lib/i18n/emailDigestCopy";
import { fakeStore } from "@/lib/telegram/fakeStore";

const SECRET = "server-secret";
const state = vi.hoisted(() => ({ store: null as unknown, configured: true }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email/environment", () => ({
  emailDigestSetup: () => (state.configured ? { store: state.store, secret: "server-secret", provider: {} } : null),
}));

import { GET, POST } from "./route";

const store = () => state.store as ReturnType<typeof fakeStore>;
const ADDRESS = "reader@example.com";
const ID = subscriptionIdOf(SECRET, ADDRESS);
const TOKEN = signToken(SECRET, { purpose: "unsubscribe", id: ID, expiresAtMs: null });

const request = (method: "GET" | "POST", token?: string, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost/weekly/unsubscribe${token === undefined ? "" : `?token=${token}`}`, { method, headers });

beforeEach(async () => {
  state.store = fakeStore();
  state.configured = true;
  await requestSubscription(store(), ID, { address: ADDRESS, chainId: 8453, locale: "tr" });
  await confirmSubscription(store(), ID, new Date());
});

describe("opening the unsubscribe link", () => {
  it("shows the question and a button that posts to the same address, in the language the reader subscribed in, and deletes nothing", async () => {
    const response = await GET(request("GET", TOKEN));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(html).toContain('<html lang="tr" dir="ltr">');
    expect(html).toContain(getEmailDigestCopy("tr").unsubscribe.ask);
    expect(html).toContain(`<form method="post" action="/weekly/unsubscribe?token=${TOKEN}">`);
    expect(html).toContain(getEmailDigestCopy("tr").unsubscribe.button);
    expect(await readSubscription(store(), ID)).not.toBeNull();
  });

  it("tells a crawler not to index it", async () => {
    expect(await (await GET(request("GET", TOKEN))).text()).toContain('<meta name="robots" content="noindex" />');
  });
});

describe("pressing the button, or a mail client's one-click unsubscribe", () => {
  it("deletes the record and takes it off the list at once, and says so", async () => {
    const response = await POST(request("POST", TOKEN));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain(getEmailDigestCopy("tr").unsubscribe.removed);
    expect(html).not.toContain("<form");
    expect(await readSubscription(store(), ID)).toBeNull();
    expect(await listConfirmed(store())).toEqual([]);
    expect(store().data.size).toBe(0);
  });

  it("says nothing is kept any more when the link is used twice, in the browser's language since the record is gone", async () => {
    await POST(request("POST", TOKEN));

    const html = await (await POST(request("POST", TOKEN, { "accept-language": "de" }))).text();

    expect(html).toContain('<html lang="de"');
    expect(html).toContain(getEmailDigestCopy("de").unsubscribe.unknown);
  });

  it("says the store did not answer, and does not claim a deletion", async () => {
    store().down = true;

    const response = await POST(request("POST", TOKEN));

    expect(response.status).toBe(503);
    expect(await response.text()).toContain(getEmailDigestCopy("en").unsubscribe.unavailable);
  });
});

describe("a link that does not verify", () => {
  it.each([
    ["none", undefined],
    ["a confirmation token", signToken(SECRET, { purpose: "confirm", id: ID, expiresAtMs: Date.now() + 60_000 })],
    ["another secret's", signToken("another-secret", { purpose: "unsubscribe", id: ID, expiresAtMs: null })],
    ["tampered", `${TOKEN.slice(0, -1)}${TOKEN.endsWith("A") ? "B" : "A"}`],
  ])("is refused on GET and on POST without touching the store: %s", async (_name, token) => {
    for (const handle of [GET, POST]) {
      const response = await handle(request(handle === GET ? "GET" : "POST", token));

      expect(response.status).toBe(400);
      expect(await response.text()).toContain(getEmailDigestCopy("en").unsubscribe.invalid);
    }
    expect(await readSubscription(store(), ID)).not.toBeNull();
  });
});

describe("where the digest by e-mail is not set up", () => {
  it("is not there", async () => {
    state.configured = false;

    expect((await GET(request("GET", TOKEN))).status).toBe(404);
    expect((await POST(request("POST", TOKEN))).status).toBe(404);
    expect(await readSubscription(store(), ID)).not.toBeNull();
  });
});
