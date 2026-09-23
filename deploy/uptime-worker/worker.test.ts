import { describe, expect, it } from "vitest";

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

/**
 * A network with two parties: the site, which answers with `siteStatus`, and
 * Telegram, which answers with `telegramStatus` and records what it was sent.
 */
const network = (siteStatus: number | "down", telegramStatus = 200) => {
  const sent: string[] = [];
  const fetchImpl = async (input: string, init?: RequestInit): Promise<Response> => {
    if (input.startsWith("https://api.telegram.org/")) {
      sent.push(JSON.parse(String(init?.body)).text as string);
      return new Response("{}", { status: telegramStatus });
    }
    if (siteStatus === "down") throw new TypeError("fetch failed");
    return new Response("", { status: siteStatus });
  };
  return { fetchImpl, sent };
};

const envWith = (kv: ReturnType<typeof memoryKv>): Env => ({
  UPTIME: kv,
  TARGET: "https://liquiditywise.example/api/health",
  TELEGRAM_BOT_TOKEN: "test-token",
  TELEGRAM_OPERATOR_CHAT_ID: "1",
});

describe("one run of the Worker", () => {
  it("does nothing at all while the site answers", async () => {
    const kv = memoryKv();
    const { fetchImpl, sent } = network(401);

    await check(envWith(kv), fetchImpl);

    expect(sent).toEqual([]);
    expect(kv.writes()).toBe(0);
  });

  it("tells the operator once the site has failed enough times", async () => {
    const kv = memoryKv();
    const { fetchImpl, sent } = network("down");

    await check(envWith(kv), fetchImpl);
    await check(envWith(kv), fetchImpl);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain("no answer at all");
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
    const flaky = network("down", 500);

    await check(envWith(kv), flaky.fetchImpl);
    await expect(check(envWith(kv), flaky.fetchImpl)).rejects.toThrow("Telegram answered 500");

    // The failure count from the first run is stored; the step to "down" is not.
    expect(JSON.parse(kv.data.get("memory") ?? "{}")).toEqual({ state: "up", failures: 1 });

    const recovered = network("down", 200);
    await check(envWith(kv), recovered.fetchImpl);

    expect(recovered.sent).toHaveLength(1);
    expect(recovered.sent[0]).toContain("cannot be reached from outside");
  });

  it("asks the site uncached, with a query that no cache can have seen", async () => {
    const kv = memoryKv();
    const asked: { url: string; init: RequestInit | undefined }[] = [];
    const fetchImpl = async (input: string, init?: RequestInit) => {
      asked.push({ url: input, init });
      return new Response("", { status: 401 });
    };

    await check(envWith(kv), fetchImpl);

    expect(asked[0]?.url).toMatch(/^https:\/\/liquiditywise\.example\/api\/health\?uptime=\d+$/);
    expect(asked[0]?.init?.cache).toBe("no-store");
  });
});
