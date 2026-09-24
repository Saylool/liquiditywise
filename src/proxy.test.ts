import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { POOL_ANALYSIS_REQUEST_LIMIT } from "./lib/ratelimit/poolAnalysisRateLimiter";
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

    expect(lines()).toEqual([`[visit] page=/pool pool=v3:${POOL} locale=tr bot=0 outcome=served`]);
  });

  it("counts a request the limit turned away as turned away", async () => {
    const client = "198.51.100.202";
    for (let index = 0; index < POOL_ANALYSIS_REQUEST_LIMIT; index += 1) {
      await proxy(browsing(`/pool?address=${POOL}`, client));
    }
    const lines = visits();

    const response = await proxy(browsing(`/pool?address=${POOL}`, client));

    expect(response.status).toBe(429);
    expect(lines()).toEqual([`[visit] page=/pool pool=v3:${POOL} locale=tr bot=0 outcome=refused`]);
  });

  it("never writes down the wallet a holdings page was opened for", async () => {
    const lines = visits();

    await proxy(browsing(`/holdings?address=${POOL}`, "198.51.100.203"));

    expect(lines()).toEqual(["[visit] page=/holdings pool=- locale=tr bot=0 outcome=served"]);
  });

  it("counts a page that spends nothing upstream, too", async () => {
    const lines = visits();

    await proxy(browsing("/", "198.51.100.205"));
    await proxy(browsing("/hooks", "198.51.100.205", { "user-agent": "Googlebot/2.1" }));

    expect(lines()).toEqual([
      "[visit] page=/ pool=- locale=tr bot=0 outcome=served",
      "[visit] page=/hooks pool=- locale=tr bot=1 outcome=served",
    ]);
  });

  it("counts a page reached by its language's address as that page, in that language", async () => {
    const lines = visits();

    await proxy(browsing("/de/hooks", "198.51.100.206"));
    await proxy(browsing("/zh-Hant", "198.51.100.206"));

    expect(lines()).toEqual([
      "[visit] page=/hooks pool=- locale=de bot=0 outcome=served",
      "[visit] page=/ pool=- locale=zh-Hant bot=0 outcome=served",
    ]);
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
