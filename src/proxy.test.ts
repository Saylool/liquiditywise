import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { POOL_ANALYSIS_REQUEST_LIMIT } from "./lib/ratelimit/poolAnalysisRateLimiter";
import { SERVER_ACTION_REQUEST_LIMIT } from "./lib/ratelimit/serverActionRateLimiter";
import { proxy } from "./proxy";

/*
 * The wiring, which is the part neither the limiter's tests nor a run against
 * the real application can reach: the limiter is tested without a request, and
 * the shared counter cannot be exercised live without a database.
 *
 * The local limiter is a module-level singleton whose count outlives a test, so
 * every case here uses a client address of its own.
 */

const POOL = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";

const request = (path: string, client: string, cookie?: string) =>
  new NextRequest(`http://localhost${path}`, {
    headers: {
      "x-forwarded-for": client,
      ...(cookie === undefined ? {} : { cookie }),
    },
  });

const upstashAnswering = (count: number | null) => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example-db.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "upstash-token");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      count === null
        ? new Response("nope", { status: 500 })
        : new Response(JSON.stringify([{ result: count }, { result: 1 }]), { status: 200 }),
    ),
  );
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("proxy", () => {
  it("lets a request that spends nothing upstream through", async () => {
    const response = await proxy(request("/pool", "198.51.100.1"));

    expect(response.status).toBe(200);
  });

  it("lets a request inside the limit through", async () => {
    const response = await proxy(request(`/pool?address=${POOL}`, "198.51.100.2"));

    expect(response.status).toBe(200);
  });

  it("refuses one past the limit, and says how long to wait", async () => {
    const client = "198.51.100.3";
    for (let i = 0; i < POOL_ANALYSIS_REQUEST_LIMIT; i += 1) {
      await proxy(request(`/pool?address=${POOL}`, client));
    }

    const refused = await proxy(request(`/pool?address=${POOL}`, client));

    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(refused.headers.get("cache-control")).toBe("no-store");
  });

  it("answers a refused visitor in their own language", async () => {
    const client = "198.51.100.4";
    for (let i = 0; i < POOL_ANALYSIS_REQUEST_LIMIT; i += 1) {
      await proxy(request(`/pool?q=weth+usdc`, client));
    }

    const refused = await proxy(request(`/pool?q=weth+usdc`, client, "locale=tr"));

    expect(await refused.text()).toContain("Çok fazla istek");
  });

  /*
   * The reason the shared counter exists. One instance's memory says this client
   * has spent one request; the counter every instance shares says it has spent
   * far more, and that is the answer that counts.
   */
  it("refuses on the shared count even when this instance has seen almost nothing", async () => {
    upstashAnswering(POOL_ANALYSIS_REQUEST_LIMIT + 1);

    const refused = await proxy(request(`/pool?address=${POOL}`, "198.51.100.5"));

    expect(refused.status).toBe(429);
  });

  it("allows when the shared count is inside the limit", async () => {
    upstashAnswering(2);

    const response = await proxy(request(`/pool?address=${POOL}`, "198.51.100.6"));

    expect(response.status).toBe(200);
  });

  /*
   * A store that cannot answer must not refuse anyone. The local limiter is
   * still counting, so the ceiling falls back to what it was before a shared
   * store was possible.
   */
  it("lets the request through when the shared counter cannot answer", async () => {
    upstashAnswering(null);

    const response = await proxy(request(`/pool?address=${POOL}`, "198.51.100.7"));

    expect(response.status).toBe(200);
  });

  it("never asks the shared counter about a request it has already refused", async () => {
    const client = "198.51.100.8";
    for (let i = 0; i < POOL_ANALYSIS_REQUEST_LIMIT; i += 1) {
      await proxy(request(`/pool?address=${POOL}`, client));
    }

    upstashAnswering(1);
    const refused = await proxy(request(`/pool?address=${POOL}`, client));

    expect(refused.status).toBe(429);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("asks the shared counter nothing when this deployment has none", async () => {
    vi.stubGlobal("fetch", vi.fn());

    await proxy(request(`/pool?address=${POOL}`, "198.51.100.9"));

    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("counting visits for the weekly report", () => {
  const BROWSER = "Mozilla/5.0 (Macintosh) Safari/605.1.15";
  const visits = () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    return () => log.mock.calls.map(([line]) => String(line)).filter((line) => line.startsWith("[visit]"));
  };
  const browsing = (path: string, client: string, extra: Record<string, string> = {}) =>
    new NextRequest(`http://localhost${path}`, {
      headers: { "x-forwarded-for": client, "user-agent": BROWSER, "accept-language": "tr-TR,tr;q=0.9", ...extra },
    });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("watches every page the report names", async () => {
    const { PAGES } = await import("./lib/usage/usageLines");
    const { config } = await import("./proxy");
    const { localeMatchers } = await import("./lib/i18n/localePath");

    expect([...config.matcher].sort()).toEqual([...PAGES, ...localeMatchers()].sort());
  });

  it("counts a page once, with its pool and the reader's language", async () => {
    const lines = visits();

    await proxy(browsing(`/pool?address=${POOL}`, "198.51.100.201"));

    expect(lines()).toEqual([`[visit] page=/pool pool=v3:${POOL} locale=tr bot=0 outcome=served chain=ethereum`]);
  });

  it("counts a request the limit turned away as turned away", async () => {
    const client = "198.51.100.202";
    for (let index = 0; index < POOL_ANALYSIS_REQUEST_LIMIT; index += 1) {
      await proxy(browsing(`/pool?address=${POOL}`, client));
    }
    const lines = visits();

    const response = await proxy(browsing(`/pool?address=${POOL}`, client));

    expect(response.status).toBe(429);
    expect(lines()).toEqual([`[visit] page=/pool pool=v3:${POOL} locale=tr bot=0 outcome=refused chain=ethereum`]);
  });

  it("never writes down the wallet a holdings page was opened for", async () => {
    const lines = visits();

    await proxy(browsing(`/holdings?address=${POOL}`, "198.51.100.203"));

    expect(lines()).toEqual(["[visit] page=/holdings pool=- locale=tr bot=0 outcome=served chain=ethereum"]);
  });

  it("counts a page that spends nothing upstream, too", async () => {
    const lines = visits();

    await proxy(browsing("/", "198.51.100.205"));
    await proxy(browsing("/hooks", "198.51.100.205", { "user-agent": "Googlebot/2.1" }));

    expect(lines()).toEqual([
      "[visit] page=/ pool=- locale=tr bot=0 outcome=served",
      "[visit] page=/hooks pool=- locale=tr bot=1 outcome=served chain=ethereum",
    ]);
  });

  it("counts a page reached by its language's address as that page, in that language", async () => {
    const lines = visits();

    await proxy(browsing("/de/hooks", "198.51.100.206"));
    await proxy(browsing("/zh-Hant", "198.51.100.206"));

    expect(lines()).toEqual([
      "[visit] page=/hooks pool=- locale=de bot=0 outcome=served chain=ethereum",
      "[visit] page=/ pool=- locale=zh-Hant bot=0 outcome=served",
    ]);
  });

  /*
   * The pair page reads every network for one request, so it is charged like
   * the search it is — and counted as one, never with what was searched for.
   */
  it("counts the pair page as a search, and charges a pair against the limit", async () => {
    const client = "198.51.100.207";
    const lines = visits();

    await proxy(browsing("/pair?q=USDC%2FWETH", client));
    expect(lines()).toEqual(["[visit] page=/pair pool=search locale=tr bot=0 outcome=served"]);

    for (let index = 1; index < POOL_ANALYSIS_REQUEST_LIMIT; index += 1) {
      await proxy(browsing("/pair?q=USDC%2FWETH", client));
    }
    const refused = await proxy(browsing("/pair?q=USDC%2FWETH", client));
    expect(refused.status).toBe(429);
    /* The empty page — the box alone — spends nothing and is never refused. */
    expect((await proxy(browsing("/pair", client))).status).toBe(200);
  });

  it("does not count a page the browser loaded ahead of a click", async () => {
    const lines = visits();

    await proxy(browsing("/", "198.51.100.204", { "sec-purpose": "prefetch" }));

    expect(lines()).toEqual([]);
  });
});

describe("a page reached by its language's own address", () => {
  const arriving = (path: string, extra: Record<string, string> = {}) =>
    new NextRequest(`http://localhost${path}`, {
      headers: { "x-forwarded-for": "198.51.100.230", "accept-language": "tr-TR,tr;q=0.9", ...extra },
    });
  const handedOn = (response: Response, name: string) => response.headers.get(`x-middleware-request-${name}`);

  it("goes on with the language and the page handed to it", async () => {
    const response = await proxy(arriving("/de/hooks?x=1"));

    expect(handedOn(response, "x-lw-locale")).toBe("de");
    expect(handedOn(response, "x-lw-path")).toBe("/hooks");
  });

  it("hands the front page its language from the language alone", async () => {
    const response = await proxy(arriving("/zh-Hant"));

    expect(handedOn(response, "x-lw-locale")).toBe("zh-Hant");
    expect(handedOn(response, "x-lw-path")).toBe("/");
  });

  /*
   * A rewrite here is an absolute URL on the host the request arrived at, and
   * behind nginx that is not the host the server knows itself by: Next took
   * it for another site and every language address was a 500 in production.
   * next.config's rewrites serve these instead.
   */
  it("never rewrites, leaving that to next.config", async () => {
    for (const path of ["/de", "/de/hooks", "/hooks", "/"]) {
      const response = await proxy(arriving(path));
      expect(response.headers.get("x-middleware-rewrite"), path).toBeNull();
    }
  });

  it("lets no one outside choose the language by sending the header themselves", async () => {
    const response = await proxy(arriving("/hooks", { "x-lw-locale": "de", "x-lw-path": "/" }));
    const handed = (response.headers.get("x-middleware-override-headers") ?? "").split(",");

    expect(handed).not.toContain("x-lw-locale");
    expect(handed).not.toContain("x-lw-path");
    expect(handed).toContain("accept-language");
  });

  it("replaces a header sent from outside with the address's own language", async () => {
    const response = await proxy(arriving("/es", { "x-lw-locale": "ru" }));

    expect(handedOn(response, "x-lw-locale")).toBe("es");
  });

  it("remembers the language for the pool pages when it is not what the reader would get anyway", async () => {
    const german = await proxy(arriving("/de"));
    const turkish = await proxy(arriving("/tr"));
    const chosen = await proxy(arriving("/en", { cookie: "locale=en" }));

    expect(german.cookies.get("locale")?.value).toBe("de");
    expect(german.cookies.get("locale")?.httpOnly).toBe(true);
    expect(german.cookies.get("locale")?.path).toBe("/");
    expect(turkish.cookies.get("locale")).toBeUndefined();
    expect(chosen.cookies.get("locale")).toBeUndefined();
  });

  it("writes no language cookie for an address without a language", async () => {
    const response = await proxy(arriving("/hooks", { cookie: "locale=de" }));

    expect(response.cookies.get("locale")).toBeUndefined();
  });

  it("turns a refused visitor away in the address's language", async () => {
    const client = "198.51.100.231";
    const asking = () =>
      new NextRequest(`http://localhost/de?address=${POOL}`, {
        headers: { "x-forwarded-for": client, "accept-language": "tr-TR" },
      });
    for (let i = 0; i < POOL_ANALYSIS_REQUEST_LIMIT; i += 1) await proxy(asking());

    const refused = await proxy(asking());

    expect(refused.status).toBe(429);
    expect(await refused.text()).toContain('lang="de"');
  });
});

/*
 * The embeddable card and its JSON: charged like the pool pages they stand
 * for, counted in the card's own language, and the card — only the card —
 * opened to framing by any site.
 */
describe("the embeddable pool card", () => {
  const ID = `0x${"cd".repeat(32)}`;
  const BROWSER = "Mozilla/5.0 (Macintosh) Safari/605.1.15";
  const loading = (path: string, client: string) =>
    new NextRequest(`http://localhost${path}`, {
      headers: { "x-forwarded-for": client, "user-agent": BROWSER, "accept-language": "tr-TR,tr;q=0.9", cookie: "locale=de" },
    });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is charged against the reader's allowance, and refused past it", async () => {
    const client = "198.51.100.240";
    for (let i = 0; i < POOL_ANALYSIS_REQUEST_LIMIT; i += 1) {
      expect((await proxy(loading(`/embed/pool?address=${POOL}`, client))).status).toBe(200);
    }

    const refused = await proxy(loading(`/embed/pool?address=${POOL}`, client));

    expect(refused.status).toBe(429);
    expect(refused.headers.get("cache-control")).toBe("no-store");
    /* In the card's own language, and still framable, so the site it sits on shows the refusal. */
    expect(await refused.text()).toContain('lang="en"');
    expect(refused.headers.get("content-security-policy")).toContain("frame-ancestors *");
  });

  it("answers its JSON's refusal in JSON, readable from any site", async () => {
    const client = "198.51.100.241";
    for (let i = 0; i < POOL_ANALYSIS_REQUEST_LIMIT; i += 1) await proxy(loading(`/api/embed/pool?chain=base&id=${ID}`, client));

    const refused = await proxy(loading(`/api/embed/pool?chain=base&id=${ID}`, client));

    expect(refused.status).toBe(429);
    expect(refused.headers.get("access-control-allow-origin")).toBe("*");
    expect(refused.headers.get("cache-control")).toBe("no-store");
    expect(await refused.json()).toMatchObject({ error: "rate-limited", retryAfterSeconds: expect.any(Number) });
  });

  it("charges nothing for an address that names no pool", async () => {
    const client = "198.51.100.242";
    for (let i = 0; i < POOL_ANALYSIS_REQUEST_LIMIT + 2; i += 1) {
      expect((await proxy(loading("/embed/pool?address=nope", client))).status).toBe(200);
    }
  });

  it("is opened to framing by any site, and nothing else is", async () => {
    const card = await proxy(loading(`/embed/pool?address=${POOL}`, "198.51.100.243"));
    expect(card.headers.get("content-security-policy")).toContain("frame-ancestors *");
    expect(card.headers.get("content-security-policy")).toContain("default-src 'none'");

    for (const path of ["/", "/pool", `/pool?address=${POOL}`, "/v4", "/hooks", "/tr/hooks", `/api/embed/pool?address=${POOL}`]) {
      const response = await proxy(loading(path, "198.51.100.244"));
      expect(response.headers.get("content-security-policy"), path).toBeNull();
    }
  });

  it("is counted with its pool, in the language its address names rather than the reader's", async () => {
    const lines = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await proxy(loading(`/embed/pool?chain=base&address=${POOL}&lang=ru`, "198.51.100.245"));
    await proxy(loading(`/api/embed/pool?chain=unichain&id=${ID}`, "198.51.100.245"));

    expect(lines.mock.calls.map(([line]) => String(line)).filter((line) => line.startsWith("[visit]"))).toEqual([
      `[visit] page=/embed/pool pool=v3@base:${POOL} locale=ru bot=0 outcome=served chain=base`,
      `[visit] page=/api/embed/pool pool=v4@unichain:${ID} locale=en bot=0 outcome=served chain=unichain`,
    ]);
  });
});

/*
 * The share card: charged like the holdings page it was offered on, refused
 * in JSON a script can test, counted in the language its address names, and
 * never opened to framing.
 */
describe("the share card", () => {
  const BROWSER = "Mozilla/5.0 (Macintosh) Safari/605.1.15";
  const loading = (path: string, client: string) =>
    new NextRequest(`http://localhost${path}`, {
      headers: { "x-forwarded-for": client, "user-agent": BROWSER, "accept-language": "tr-TR,tr;q=0.9", cookie: "locale=de" },
    });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is charged against the reader's allowance, and refused past it in JSON, without the embed API's opening", async () => {
    const client = "198.51.100.250";
    for (let i = 0; i < POOL_ANALYSIS_REQUEST_LIMIT; i += 1) {
      expect((await proxy(loading("/api/share/position?chain=base&id=998651", client))).status).toBe(200);
    }

    const refused = await proxy(loading("/api/share/position?chain=base&id=998651", client));

    expect(refused.status).toBe(429);
    expect(refused.headers.get("cache-control")).toBe("no-store");
    expect(refused.headers.get("access-control-allow-origin")).toBeNull();
    expect(refused.headers.get("content-security-policy")).toBeNull();
    expect(await refused.json()).toMatchObject({ error: "rate-limited", retryAfterSeconds: expect.any(Number) });
  });

  it("charges nothing for an address that names no position", async () => {
    const client = "198.51.100.251";
    for (let i = 0; i < POOL_ANALYSIS_REQUEST_LIMIT + 2; i += 1) {
      expect((await proxy(loading("/api/share/position?id=0x12", client))).status).toBe(200);
    }
  });

  it("is counted on its chain, in the language its address names, naming no pool and no id", async () => {
    const lines = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await proxy(loading("/api/share/position?chain=base&id=998651&lang=ru", "198.51.100.252"));

    expect(lines.mock.calls.map(([line]) => String(line)).filter((line) => line.startsWith("[visit]"))).toEqual([
      "[visit] page=/api/share/position pool=- locale=ru bot=0 outcome=served chain=base",
    ]);
  });
});

describe("a Server Action", () => {
  /* An action as a script would send it: a POST with the action's id, straight to a page, with no query. */
  const action = (path: string, client: string, cookie?: string) =>
    new NextRequest(`http://localhost${path}`, {
      method: "POST",
      headers: { "x-forwarded-for": client, "next-action": "7f00deadbeef", ...(cookie === undefined ? {} : { cookie }) },
      body: "[]",
    });

  it("is counted as an action whatever page it is sent to, with no query to charge, and refused past the limit", async () => {
    const client = "198.51.100.60";
    for (let i = 0; i < SERVER_ACTION_REQUEST_LIMIT; i += 1) {
      expect((await proxy(action(i % 2 === 0 ? "/holdings" : "/weekly", client))).status).toBe(200);
    }

    const refused = await proxy(action("/holdings", client, "locale=tr"));
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    const page = await refused.text();
    expect(page).toContain("Çok fazla istek");
    /* Not told it ran too many analyses: it ran none. */
    expect(page).not.toContain("Uniswap");
  });

  it("is refused at a language's address too, which reaches the same action", async () => {
    const client = "198.51.100.61";
    for (let i = 0; i < SERVER_ACTION_REQUEST_LIMIT; i += 1) await proxy(action("/tr/weekly", client));

    expect((await proxy(action("/de/weekly", client))).status).toBe(429);
  });

  it("does not spend a reader's allowance of actions on pages they only read", async () => {
    const client = "198.51.100.62";
    for (let i = 0; i < SERVER_ACTION_REQUEST_LIMIT + 5; i += 1) await proxy(request("/weekly", client));

    expect((await proxy(action("/weekly", client))).status).toBe(200);
  });

  it("is still charged as an analysis when it is sent to a page that reads a pool", async () => {
    const client = "198.51.100.63";
    for (let i = 0; i < POOL_ANALYSIS_REQUEST_LIMIT; i += 1) await proxy(request(`/pool?address=${POOL}`, client));

    expect((await proxy(action(`/pool?address=${POOL}`, client))).status).toBe(429);
  });
});
