import { describe, expect, it } from "vitest";

import { INCREMENT_SCRIPT } from "../store/keyValueStore";
import { createUpstashKeyValueStore, type FetchLike } from "./upstashKeyValue";

const answering = (result: unknown, status = 200) => {
  const calls: { url: string; body: unknown; auth: string | null }[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({
      url,
      body: JSON.parse(String(init.body)),
      auth: new Headers(init.headers).get("authorization"),
    });
    return new Response(JSON.stringify({ result }), { status });
  };
  return { fetchImpl, calls };
};

const store = (fetchImpl: FetchLike) =>
  createUpstashKeyValueStore({ url: "https://db.example.upstash.io/", token: "tok", fetchImpl });

describe("Upstash key-value store", () => {
  it("posts each command to the root with the bearer token", async () => {
    const { fetchImpl, calls } = answering("OK");
    await store(fetchImpl).set("k", "v");
    expect(calls).toEqual([{ url: "https://db.example.upstash.io", body: ["SET", "k", "v"], auth: "Bearer tok" }]);
  });

  it("sets with a lifetime in milliseconds when given one", async () => {
    const { fetchImpl, calls } = answering("OK");
    expect(await store(fetchImpl).set("k", "v", 1500)).toBe(true);
    expect(calls[0]?.body).toEqual(["SET", "k", "v", "PX", "1500"]);
  });

  it("reads a string, a null for a missing key, and undefined when it could not ask", async () => {
    expect(await store(answering("value").fetchImpl).get("k")).toBe("value");
    expect(await store(answering(null).fetchImpl).get("k")).toBeNull();
    expect(await store(answering("value", 500).fetchImpl).get("k")).toBeUndefined();
    expect(
      await store(async () => {
        throw new Error("boom");
      }).get("k"),
    ).toBeUndefined();
  });

  it("reads set members only when every one is a string", async () => {
    expect(await store(answering(["a", "b"]).fetchImpl).smembers("s")).toEqual(["a", "b"]);
    expect(await store(answering(["a", 1]).fetchImpl).smembers("s")).toBeNull();
    expect(await store(answering("nope").fetchImpl).smembers("s")).toBeNull();
  });

  it("treats a numeric answer as success for the counting commands", async () => {
    expect(await store(answering(1).fetchImpl).del("k")).toBe(true);
    expect(await store(answering(0).fetchImpl).sadd("s", "m")).toBe(true);
    expect(await store(answering("x").fetchImpl).srem("s", "m")).toBe(false);
  });

  it("gives up on a body that is not the shape it expects", async () => {
    const fetchImpl: FetchLike = async () => new Response("not json", { status: 200 });
    expect(await store(fetchImpl).get("k")).toBeUndefined();
    expect(await store(fetchImpl).set("k", "v")).toBe(false);
  });

  it("counts a set's members, and only from a whole number", async () => {
    const { fetchImpl, calls } = answering(4);
    expect(await store(fetchImpl).scard("s")).toBe(4);
    expect(calls[0]?.body).toEqual(["SCARD", "s"]);
    expect(await store(answering("4").fetchImpl).scard("s")).toBeNull();
    expect(await store(answering(4, 500).fetchImpl).scard("s")).toBeNull();
  });

  it("counts with the same one-step script as the Redis store, and answers no count rather than a wrong one", async () => {
    const { fetchImpl, calls } = answering(2);
    expect(await store(fetchImpl).increment("c", 900)).toBe(2);
    expect(calls[0]?.body).toEqual(["EVAL", INCREMENT_SCRIPT, "1", "c", "900"]);
    expect(await store(answering(0).fetchImpl).increment("c", 900)).toBeNull();
    expect(await store(answering(null).fetchImpl).increment("c", 900)).toBeNull();
    expect(await store(answering(2, 500).fetchImpl).increment("c", 900)).toBeNull();
  });
});
