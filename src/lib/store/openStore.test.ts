import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { openStore } from "./openStore";

describe("opening the store a deployment names", () => {
  it("opens nothing when it names none, or when the one it names cannot be read", () => {
    expect(openStore({})).toBeNull();
    expect(openStore({ REDIS_URL: "not a url" })).toBeNull();
    expect(openStore({ UPSTASH_REDIS_REST_URL: "https://x.example" })).toBeNull();
  });

  it("opens a Redis store without connecting to it, and a REST one the same way", () => {
    for (const store of [
      openStore({ REDIS_URL: "redis://127.0.0.1:6379/1" }),
      openStore({ UPSTASH_REDIS_REST_URL: "https://x.example", UPSTASH_REDIS_REST_TOKEN: "t" }),
    ]) {
      expect(store).not.toBeNull();
      expect(Object.keys(store ?? {}).sort()).toEqual(["del", "get", "increment", "sadd", "scard", "set", "smembers", "srem"]);
    }
  });
});
