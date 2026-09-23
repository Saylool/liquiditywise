import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { readSites } from "../../src/lib/health/uptime";
import { check, type Env } from "./worker";

/** A KV namespace in memory, counting writes. */
const memoryKv = () => {
  const data = new Map<string, string>();
  let writes = 0;
  return {
    data,
    writes: () => writes,
    get: async (key: string) => data.get(key) ?? null,
    put: async (key: string, value: string) => {
      writes += 1;
      data.set(key, value);
    },
  };
};

const SITES = [
  { name: "a.example", url: "https://a.example/api/health" },
  { name: "b.example", url: "https://b.example/" },
  { name: "c.example", url: "https://c.example/?lang=en" },
];

/**
 * A network with the watched sites, each answering with its status in
 * `sites` ("down" for no answer at all), and Telegram, which answers with
 * `telegramStatus` and records what it was sent.
 */
const network = (sites: Record<string, number | "down">, telegramStatus = 200) => {
  const sent: string[] = [];
  const bots: string[] = [];
  const asked: { url: string; init: RequestInit | undefined }[] = [];
  const fetchImpl = async (input: string, init?: RequestInit): Promise<Response> => {
    if (input.startsWith("https://api.telegram.org/")) {
      bots.push(input.split("/")[3] ?? "");
      sent.push(JSON.parse(String(init?.body)).text as string);
      return new Response("{}", { status: telegramStatus });
    }
    asked.push({ url: input, init });
    const host = new URL(input).host;
    const status = sites[host];
    if (status === undefined || status === "down") throw new TypeError("fetch failed");
    return new Response("", { status });
  };
  return { fetchImpl, sent, bots, asked };
};

const allAt = (status: number | "down") =>
  Object.fromEntries(SITES.map((site) => [site.name, status]));

const envWith = (kv: ReturnType<typeof memoryKv>): Env => ({
  UPTIME: kv,
  SITES: JSON.stringify(SITES),
  SERVER_WATCH_BOT_TOKEN: "watch-token",
  TELEGRAM_OPERATOR_CHAT_ID: "1",
});

describe("one run of the Worker", () => {
  it("does nothing at all while every site answers", async () => {
    const kv = memoryKv();
    const { fetchImpl, sent } = network(allAt(200));

    await check(envWith(kv), fetchImpl);

    expect(sent).toEqual([]);
    expect(kv.writes()).toBe(0);
  });

  it("tells the operator once the server has been unreachable enough times", async () => {
    const kv = memoryKv();
    const { fetchImpl, sent } = network(allAt("down"));

    await check(envWith(kv), fetchImpl);
    await check(envWith(kv), fetchImpl);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain("the server itself");
  });

  /*
   * Server Watch, never the product bot. The product bot's token can message
   * every reader who linked a chat, and the copy of the token kept on
   * Cloudflare should be one that can do nothing but report.
   */
  it("writes as Server Watch", async () => {
    const kv = memoryKv();
    const { fetchImpl, bots } = network(allAt("down"));

    await check(envWith(kv), fetchImpl);
    await check(envWith(kv), fetchImpl);

    expect(bots).toEqual(["botwatch-token"]);
  });

  it("names the one site that went down, and not the server", async () => {
    const kv = memoryKv();
    const { fetchImpl, sent } = network({ ...allAt(200), "b.example": 502 });

    await check(envWith(kv), fetchImpl);
    await check(envWith(kv), fetchImpl);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain("b.example (HTTP 502)");
    expect(sent[0]).toContain("the server is up");
  });

  /*
   * The order this file was corrected to before it was ever run. Written the
   * other way round — record, then send — a Telegram failure at the moment of
   * an outage would leave "down" stored, the next run would see nothing new,
   * and the operator would never hear. Sent first, a failed send records
   * nothing, and the next run tries again.
   */
  it("records nothing when the message could not be sent, so the next run retries", async () => {
    const kv = memoryKv();
    const flaky = network(allAt("down"), 500);

    await check(envWith(kv), flaky.fetchImpl);
    await expect(check(envWith(kv), flaky.fetchImpl)).rejects.toThrow("Telegram answered 500");

    // The failure counts from the first run are stored; the step to "down" is not.
    const stored = JSON.parse(kv.data.get("fleet") ?? "{}") as Record<string, unknown>;
    expect(stored["a.example"]).toEqual({ state: "up", failures: 1 });

    const recovered = network(allAt("down"), 200);
    await check(envWith(kv), recovered.fetchImpl);

    expect(recovered.sent).toHaveLength(1);
    expect(recovered.sent[0]).toContain("None of the 3 sites");
  });

  it("asks every site uncached, with a query no cache can have seen", async () => {
    const kv = memoryKv();
    const { fetchImpl, asked } = network(allAt(200));

    await check(envWith(kv), fetchImpl);

    expect(asked.map((request) => new URL(request.url).host).sort()).toEqual([
      "a.example",
      "b.example",
      "c.example",
    ]);
    for (const request of asked) {
      expect(request.init?.cache).toBe("no-store");
      expect(new URL(request.url).searchParams.get("uptime")).toMatch(/^\d+$/);
    }
    // An address that already has a query keeps it, and gains the cache-buster beside it.
    const withQuery = asked.find((request) => request.url.startsWith("https://c.example/"));
    expect(new URL(withQuery?.url ?? "").searchParams.get("lang")).toBe("en");
  });

  it("refuses to run on a site list it cannot read, rather than watching fewer", async () => {
    const kv = memoryKv();
    const { fetchImpl } = network(allAt(200));

    await expect(check({ ...envWith(kv), SITES: "[]" }, fetchImpl)).rejects.toThrow();
  });
});

/*
 * The configuration this Worker is deployed with, read the way the Worker
 * reads it. A list with a typo in it would not fail at deploy: it would make
 * every run throw, which is a monitor that never sends anything — silent in
 * exactly the way it exists to prevent.
 */
describe("the sites it is deployed to watch", () => {
  const toml = readFileSync(new URL("./wrangler.toml", import.meta.url), "utf8");
  const raw = /SITES = """([\s\S]*?)"""/.exec(toml)?.[1] ?? "";

  it("is a list the Worker can read", () => {
    expect(() => readSites(raw)).not.toThrow();
  });

  it("watches every site on the server, liquiditywise at its uncached health route", () => {
    const sites = readSites(raw);

    expect(sites.map((site) => site.name)).toEqual([
      "liquiditywise.com",
      "ensdesk.com",
      "splitstable.com",
    ]);
    expect(sites[0]?.url).toBe("https://liquiditywise.com/api/health");
  });
});
