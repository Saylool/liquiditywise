import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The switcher, with the request around it replaced: which cookie it writes,
 * and where — if anywhere — it sends the reader afterwards.
 */

const request = vi.hoisted(() => ({
  headers: new Headers(),
  cookies: [] as { name: string; value: string }[],
  redirectedTo: null as string | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => request.headers,
  cookies: async () => ({
    get: (name: string) => request.cookies.find((cookie) => cookie.name === name),
    set: (cookie: { name: string; value: string }) => {
      request.cookies.push(cookie);
    },
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    request.redirectedTo = to;
  },
}));

const choose = async (locale: string) => {
  const { setLocale } = await import("./setLocaleAction");
  const form = new FormData();
  form.set("locale", locale);
  await setLocale(form);
};

beforeEach(() => {
  request.headers = new Headers();
  request.cookies = [];
  request.redirectedTo = null;
});

describe("choosing a language", () => {
  it("remembers it, and stays on a page whose address has no language", async () => {
    await choose("de");

    expect(request.cookies.map(({ name, value }) => [name, value])).toEqual([["locale", "de"]]);
    expect(request.redirectedTo).toBeNull();
  });

  it("moves to the new language's address on a page reached by one", async () => {
    request.headers = new Headers({ "x-lw-locale": "tr", "x-lw-path": "/hooks" });

    await choose("de");

    expect(request.redirectedTo).toBe("/de/hooks");
    expect(request.cookies.at(-1)?.value).toBe("de");
  });

  it("moves from one language's front page to another's", async () => {
    request.headers = new Headers({ "x-lw-locale": "tr", "x-lw-path": "/" });

    await choose("zh-Hant");

    expect(request.redirectedTo).toBe("/zh-Hant");
  });

  it("sends no one to a page that has no language address", async () => {
    request.headers = new Headers({ "x-lw-locale": "tr", "x-lw-path": "/pool" });

    await choose("de");

    expect(request.redirectedTo).toBeNull();
  });

  it("writes nothing and sends no one anywhere for a language that is not published", async () => {
    request.headers = new Headers({ "x-lw-locale": "tr", "x-lw-path": "/hooks" });

    await choose("xx");

    expect(request.cookies).toEqual([]);
    expect(request.redirectedTo).toBeNull();
  });
});

describe("an open page's canonical address", () => {
  it("is the language's own address when the page was reached by one", async () => {
    request.headers = new Headers({ "x-lw-locale": "de" });
    const { getOpenPageAlternates } = await import("./requestLocale");

    const alternates = await getOpenPageAlternates("/hooks");

    expect(alternates.canonical).toBe("/de/hooks");
    expect(alternates.languages.tr).toBe("https://liquiditywise.com/tr/hooks");
  });

  it("is the address without a language otherwise, whatever the reader's language", async () => {
    request.headers = new Headers({ "accept-language": "tr" });
    const { getOpenPageAlternates } = await import("./requestLocale");

    expect((await getOpenPageAlternates("/")).canonical).toBe("/");
  });

  it("takes the page's language from its address before the reader's cookie", async () => {
    request.headers = new Headers({ "x-lw-locale": "ar" });
    request.cookies = [{ name: "locale", value: "de" }];
    const { getRequestLocale } = await import("./requestLocale");

    expect(await getRequestLocale()).toBe("ar");
  });
});
