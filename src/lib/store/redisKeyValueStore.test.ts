import { describe, expect, it } from "vitest";

import { INCREMENT_SCRIPT } from "./keyValueStore";
import { createRedisKeyValueStore } from "./redisKeyValueStore";
import type { RedisClient } from "./redisClient";
import type { RespReply } from "./resp";

/** A client that answers from a script and records what it was asked. */
const scripted = (...replies: (RespReply | null)[]) => {
  const asked: (readonly string[])[] = [];
  const queue = [...replies];
  const client: RedisClient = {
    command: async (args) => {
      asked.push(args);
      return queue.shift() ?? null;
    },
    close: () => {},
  };

  return { store: createRedisKeyValueStore(client), asked };
};

const string = (value: string): RespReply => ({ kind: "string", value });
const integer = (value: number): RespReply => ({ kind: "integer", value });
const array = (...values: RespReply[]): RespReply => ({ kind: "array", values });

describe("the Redis key-value store", () => {
  it("reads a value, and tells a missing key from a store that could not answer", async () => {
    expect(await scripted(string("v")).store.get("k")).toBe("v");
    expect(await scripted({ kind: "null" }).store.get("k")).toBeNull();
    expect(await scripted(null).store.get("k")).toBeUndefined();
    expect(await scripted({ kind: "error", message: "ERR" }).store.get("k")).toBeUndefined();
  });

  it("writes with and without a lifetime, in milliseconds", async () => {
    const plain = scripted(string("OK"));
    expect(await plain.store.set("k", "v")).toBe(true);
    expect(plain.asked).toEqual([["SET", "k", "v"]]);

    const expiring = scripted(string("OK"));
    expect(await expiring.store.set("k", "v", 1_800_000)).toBe(true);
    expect(expiring.asked).toEqual([["SET", "k", "v", "PX", "1800000"]]);
  });

  it("reports a write that did not answer OK as a write that did not happen", async () => {
    expect(await scripted(null).store.set("k", "v")).toBe(false);
    expect(await scripted({ kind: "null" }).store.set("k", "v")).toBe(false);
    expect(await scripted(string("QUEUED")).store.set("k", "v")).toBe(false);
    expect(await scripted(integer(1)).store.set("k", "v")).toBe(false);
  });

  it("counts a deletion of nothing as a success, because the key is gone either way", async () => {
    expect(await scripted(integer(1)).store.del("k")).toBe(true);
    expect(await scripted(integer(0)).store.del("k")).toBe(true);
    expect(await scripted(null).store.del("k")).toBe(false);
  });

  it("adds to and removes from a set", async () => {
    const adding = scripted(integer(1));
    expect(await adding.store.sadd("s", "m")).toBe(true);
    expect(adding.asked).toEqual([["SADD", "s", "m"]]);

    const removing = scripted(integer(0));
    expect(await removing.store.srem("s", "m")).toBe(true);
    expect(removing.asked).toEqual([["SREM", "s", "m"]]);

    expect(await scripted(string("OK")).store.sadd("s", "m")).toBe(false);
    expect(await scripted(null).store.srem("s", "m")).toBe(false);
  });

  it("reads a set's members, and an empty set as empty rather than missing", async () => {
    expect(await scripted(array(string("a"), string("b"))).store.smembers("s")).toEqual(["a", "b"]);
    expect(await scripted(array()).store.smembers("s")).toEqual([]);
  });

  it("refuses half a set rather than dropping the members it cannot read", async () => {
    expect(await scripted(array(string("a"), integer(2))).store.smembers("s")).toBeNull();
    expect(await scripted(string("a")).store.smembers("s")).toBeNull();
    expect(await scripted({ kind: "null" }).store.smembers("s")).toBeNull();
    expect(await scripted(null).store.smembers("s")).toBeNull();
  });

  it("counts a set's members, and a missing set as none", async () => {
    const counting = scripted(integer(3));
    expect(await counting.store.scard("s")).toBe(3);
    expect(counting.asked).toEqual([["SCARD", "s"]]);
    expect(await scripted(integer(0)).store.scard("s")).toBe(0);
    expect(await scripted(null).store.scard("s")).toBeNull();
    expect(await scripted(string("3")).store.scard("s")).toBeNull();
  });

  it("counts and gives the first count its lifetime in one script, so no count is left without one", async () => {
    const counting = scripted(integer(1));
    expect(await counting.store.increment("c", 60_000)).toBe(1);
    expect(counting.asked).toEqual([["EVAL", INCREMENT_SCRIPT, "1", "c", "60000"]]);
    expect(INCREMENT_SCRIPT).toContain("INCR");
    expect(INCREMENT_SCRIPT).toContain("PEXPIRE");
  });

  it("answers no count rather than a wrong one", async () => {
    expect(await scripted(null).store.increment("c", 1)).toBeNull();
    expect(await scripted({ kind: "error", message: "NOSCRIPT" }).store.increment("c", 1)).toBeNull();
    expect(await scripted(integer(0)).store.increment("c", 1)).toBeNull();
    expect(await scripted(string("1")).store.increment("c", 1)).toBeNull();
  });
});
