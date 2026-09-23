import { describe, expect, it } from "vitest";

import { handle, KEEP_SECONDS, MAX_BYTES, type Env } from "./worker";

const SECRET = "s".repeat(64);
const NOW = Date.parse("2026-09-24T03:17:00Z");
const BASE = "https://liquiditywise.com/__backup";

/** A KV namespace in memory, remembering what each value was told to expire after. */
const memoryKv = () => {
  const data = new Map<string, { value: ArrayBuffer; ttl: number }>();
  return {
    data,
    get: async (key: string) => data.get(key)?.value ?? null,
    put: async (key: string, value: ArrayBuffer, options: { expirationTtl: number }) => {
      data.set(key, { value, ttl: options.expirationTtl });
    },
    list: async ({ prefix }: { prefix: string }) => ({
      keys: [...data.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })),
    }),
  };
};

const envWith = (kv = memoryKv(), secret: string | undefined = SECRET): Env =>
  secret === undefined ? { BACKUPS: kv } : { BACKUPS: kv, BACKUP_SECRET: secret };

const ask = (
  env: Env,
  path: string,
  init: { method?: string; body?: string; secret?: string | null; headers?: Record<string, string> } = {},
  nowMs = NOW,
) => {
  const headers: Record<string, string> = { ...init.headers };
  if (init.secret !== null) headers.authorization = `Bearer ${init.secret ?? SECRET}`;
  const request = new Request(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers,
    ...(init.body === undefined ? {} : { body: init.body }),
  });
  return handle(request, env, nowMs);
};

const text = async (response: Response) => new TextDecoder().decode(await response.arrayBuffer());

describe("the backup store", () => {
  it("keeps today's copy for exactly seven days, and hands it back byte for byte", async () => {
    const kv = memoryKv();
    const env = envWith(kv);

    const put = await ask(env, "/backup/2026-09-24", { method: "PUT", body: "encrypted bytes" });
    expect(put.status).toBe(204);
    expect(kv.data.get("backup/2026-09-24")?.ttl).toBe(KEEP_SECONDS);
    expect(KEEP_SECONDS).toBe(7 * 24 * 60 * 60);

    const get = await ask(env, "/backup/2026-09-24");
    expect(get.status).toBe(200);
    expect(await text(get)).toBe("encrypted bytes");
  });

  it("lists the days it holds under one name, and only that name", async () => {
    const env = envWith();
    await ask(env, "/backup/2026-09-24", { method: "PUT", body: "a" });
    await ask(env, "/backup/2026-09-23", { method: "PUT", body: "b" });
    await ask(env, "/proof/2026-09-24", { method: "PUT", body: "c" });

    expect(await (await ask(env, "/backup/")).json()).toEqual(["2026-09-23", "2026-09-24"]);
    expect(await (await ask(env, "/proof/")).json()).toEqual(["2026-09-24"]);
  });

  it("says a day it does not hold is not there", async () => {
    expect((await ask(envWith(), "/backup/2026-09-20")).status).toBe(404);
  });
});

describe("what it refuses", () => {
  /*
   * The property that makes a stolen secret worth less. Whoever has the
   * server has the secret, and could send anything — but only as today's
   * copy. The days before stay as they were.
   */
  it("refuses to write any day but today, or yesterday for a run that crossed midnight", async () => {
    const env = envWith();

    expect((await ask(env, "/backup/2026-09-23", { method: "PUT", body: "x" })).status).toBe(204);
    expect((await ask(env, "/backup/2026-09-22", { method: "PUT", body: "x" })).status).toBe(403);
    expect((await ask(env, "/backup/2026-09-25", { method: "PUT", body: "x" })).status).toBe(403);
  });

  it.each([
    ["no secret", { secret: null }],
    ["a wrong secret", { secret: "t".repeat(64) }],
    ["the secret without Bearer", { secret: null, headers: { authorization: SECRET } }],
  ])("answers %s exactly as it answers an address that does not exist", async (_name, init) => {
    const kv = memoryKv();
    const env = envWith(kv);

    const put = await ask(env, "/backup/2026-09-24", { method: "PUT", body: "x", ...init });
    const list = await ask(env, "/backup/", init);

    expect([put.status, list.status]).toEqual([404, 404]);
    expect(await text(put)).toBe("Not found");
    expect(kv.data.size).toBe(0);
  });

  /*
   * A Worker deployed before its secret was set holds an empty one, and
   * "Bearer " would then be the password. It has to refuse everything instead.
   */
  it.each([
    ["no secret at all", undefined],
    ["an empty one", ""],
    ["a short one", "short"],
  ])("accepts nothing while it has %s", async (_name, secret) => {
    const env = envWith(memoryKv(), secret);

    const response = await ask(env, "/backup/", { secret: secret ?? "" });

    expect(response.status).toBe(404);
  });

  it("refuses names other than the two it keeps, and paths that are not a day", async () => {
    const env = envWith();

    for (const path of ["/other/2026-09-24", "/backup/latest", "/backup/2026-09-24/x", "/backup", "/"]) {
      expect((await ask(env, path, { method: "PUT", body: "x" })).status).toBe(404);
    }
  });

  it("has no delete, and lists only with GET", async () => {
    const kv = memoryKv();
    const env = envWith(kv);
    await ask(env, "/backup/2026-09-24", { method: "PUT", body: "x" });

    expect((await ask(env, "/backup/2026-09-24", { method: "DELETE" })).status).toBe(404);
    expect((await ask(env, "/backup/", { method: "PUT", body: "x" })).status).toBe(404);
    expect([...kv.data.keys()]).toEqual(["backup/2026-09-24"]);
  });

  it("refuses an empty body, which would be a backup of nothing", async () => {
    expect((await ask(envWith(), "/backup/2026-09-24", { method: "PUT", body: "" })).status).toBe(400);
  });

  it("refuses a body larger than it keeps, by what it says and by what it is", async () => {
    const env = envWith();
    const declared = await ask(env, "/backup/2026-09-24", {
      method: "PUT",
      body: "x",
      headers: { "content-length": String(MAX_BYTES + 1) },
    });
    const actual = await ask(env, "/backup/2026-09-24", { method: "PUT", body: "x".repeat(MAX_BYTES + 1) });

    expect([declared.status, actual.status]).toEqual([413, 413]);
  });
});
