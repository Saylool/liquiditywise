import { describe, expect, it } from "vitest";

import { chooseStore } from "./chooseStore";

const UPSTASH = {
  UPSTASH_REDIS_REST_URL: "https://db.example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "tok",
};

describe("chooseStore", () => {
  it("takes a Redis when one is named", () => {
    expect(chooseStore({ REDIS_URL: "redis://127.0.0.1:6379/1" })).toEqual({
      kind: "redis",
      address: { host: "127.0.0.1", port: 6379, password: undefined, database: 1 },
    });
  });

  it("prefers the Redis over a REST database configured beside it", () => {
    expect(chooseStore({ REDIS_URL: "redis://127.0.0.1", ...UPSTASH })?.kind).toBe("redis");
  });

  it("takes the REST database when there is no Redis", () => {
    expect(chooseStore(UPSTASH)).toEqual({
      kind: "upstash",
      url: "https://db.example.upstash.io",
      token: "tok",
    });
  });

  it("wants both halves of the REST configuration or neither", () => {
    expect(chooseStore({ UPSTASH_REDIS_REST_URL: UPSTASH.UPSTASH_REDIS_REST_URL })).toBeNull();
    expect(chooseStore({ UPSTASH_REDIS_REST_TOKEN: "tok" })).toBeNull();
  });

  it("has no store when nothing is configured", () => {
    expect(chooseStore({})).toBeNull();
    expect(chooseStore({ REDIS_URL: "", UPSTASH_REDIS_REST_URL: "  " })).toBeNull();
  });

  /*
   * The one that matters. A typo in REDIS_URL is somebody configuring a
   * Redis, and quietly using a REST database instead would hide the mistake
   * behind a store that works — until the day the REST database is gone too.
   */
  it("has no store when the Redis URL is set and unreadable, even with a REST one beside it", () => {
    expect(chooseStore({ REDIS_URL: "redis//127.0.0.1", ...UPSTASH })).toBeNull();
    expect(chooseStore({ REDIS_URL: "rediss://127.0.0.1", ...UPSTASH })).toBeNull();
  });

  it("ignores surrounding whitespace", () => {
    expect(chooseStore({ REDIS_URL: "  redis://127.0.0.1  " })?.kind).toBe("redis");
  });
});
