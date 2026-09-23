import { describe, expect, it } from "vitest";

import type { RespReply } from "../store/resp";
import {
  BACKUP_PREFIX,
  describeSnapshot,
  exportStore,
  readSnapshot,
  restoreCommands,
  restoreStore,
  type Command,
  type Snapshot,
} from "./storeBackup";

const NOW = Date.parse("2026-09-24T03:17:00Z");
const LINK = `${BACKUP_PREFIX}link:abc`;
const PENDING = `${BACKUP_PREFIX}link:def`;
const WATCHES = `${BACKUP_PREFIX}watches`;

const text = (value: string): RespReply => ({ kind: "string", value });
const int = (value: number): RespReply => ({ kind: "integer", value });
const list = (values: readonly string[]): RespReply => ({ kind: "array", values: values.map(text) });
const OK = text("OK");

/**
 * Enough of a Redis for these commands, on a clock the test sets. SCAN hands
 * its keys out two at a time and repeats the last one, the way a real SCAN
 * may when the table is rehashed under it.
 */
const fakeRedis = (clock = { now: NOW }) => {
  const strings = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const others = new Map<string, string>();
  const expiry = new Map<string, number>();
  const log: string[][] = [];

  const alive = (key: string): boolean => {
    const at = expiry.get(key);
    if (at !== undefined && at <= clock.now) {
      strings.delete(key);
      sets.delete(key);
      expiry.delete(key);
    }
    return strings.has(key) || sets.has(key) || others.has(key);
  };

  const command: Command = async (args) => {
    log.push([...args]);
    const [name = "", key = "", ...rest] = args;
    switch (name) {
      case "SCAN": {
        const all = [...strings.keys(), ...sets.keys(), ...others.keys()]
          .filter((k) => k.startsWith(BACKUP_PREFIX) && alive(k))
          .sort();
        const start = Number(key);
        const page = all.slice(start, start + 2);
        const next = start + 2 >= all.length ? "0" : String(start + 2);
        const repeated = page.length > 0 && next !== "0" ? [...page, page[page.length - 1] as string] : page;
        return { kind: "array", values: [text(next), list(repeated)] };
      }
      case "TYPE":
        if (!alive(key)) return text("none");
        return text(strings.has(key) ? "string" : sets.has(key) ? "set" : (others.get(key) as string));
      case "GET":
        return alive(key) && strings.has(key) ? text(strings.get(key) as string) : { kind: "null" };
      case "SMEMBERS":
        return list(alive(key) ? [...(sets.get(key) ?? [])] : []);
      case "PEXPIRETIME": {
        if (!alive(key)) return int(-2);
        return int(expiry.get(key) ?? -1);
      }
      case "SET":
        strings.set(key, rest[0] as string);
        if (rest[1] === "PXAT") expiry.set(key, Number(rest[2]));
        else expiry.delete(key);
        return OK;
      case "DEL": {
        const had = alive(key);
        strings.delete(key);
        sets.delete(key);
        expiry.delete(key);
        return int(had ? 1 : 0);
      }
      case "SADD": {
        const set = sets.get(key) ?? new Set<string>();
        for (const member of rest) set.add(member);
        sets.set(key, set);
        return int(rest.length);
      }
      case "PEXPIREAT":
        expiry.set(key, Number(rest[0]));
        return int(1);
      default:
        return { kind: "error", message: `ERR unknown command '${name}'` };
    }
  };

  return { command, strings, sets, others, expiry, log, clock };
};

/** A store as the application leaves it: one claimed link, one pending, the set the checker walks. */
const populated = () => {
  const redis = fakeRedis();
  redis.strings.set(LINK, '{"address":"0x1","chatId":5}');
  redis.expiry.set(LINK, NOW + 300 * 86_400_000);
  redis.strings.set(PENDING, '{"address":"0x2","chatId":null}');
  redis.expiry.set(PENDING, NOW + 20 * 60_000);
  redis.sets.set(WATCHES, new Set(["abc"]));
  // Not ours to copy, and not worth keeping.
  redis.strings.set("liquiditywise:health:probe", "1");
  redis.strings.set("otherapp:session", "secret");
  return redis;
};

describe("exportStore", () => {
  it("copies every link and the watched set, with the moment each expires", async () => {
    const snapshot = await exportStore(populated().command, NOW);

    expect(snapshot).toEqual({
      version: 1,
      takenAt: "2026-09-24T03:17:00.000Z",
      entries: [
        { key: LINK, type: "string", value: '{"address":"0x1","chatId":5}', expiresAtMs: NOW + 300 * 86_400_000 },
        { key: PENDING, type: "string", value: '{"address":"0x2","chatId":null}', expiresAtMs: NOW + 20 * 60_000 },
        { key: WATCHES, type: "set", members: ["abc"], expiresAtMs: null },
      ],
    });
  });

  it("asks only for keys under the prefix", async () => {
    const redis = populated();
    await exportStore(redis.command, NOW);

    const scans = redis.log.filter(([name]) => name === "SCAN");
    expect(scans.length).toBeGreaterThan(1);
    for (const scan of scans) expect(scan.slice(2, 4)).toEqual(["MATCH", `${BACKUP_PREFIX}*`]);
    expect(redis.log.some((args) => args[1] === "otherapp:session")).toBe(false);
  });

  it("follows the cursor to the end, and keeps a key SCAN returned twice once", async () => {
    const redis = fakeRedis();
    for (const name of ["a", "b", "c", "d", "e"]) redis.strings.set(`${BACKUP_PREFIX}link:${name}`, name);

    const snapshot = await exportStore(redis.command, NOW);

    expect(snapshot.entries.map((entry) => entry.key)).toEqual(
      ["a", "b", "c", "d", "e"].map((name) => `${BACKUP_PREFIX}link:${name}`),
    );
  });

  it("leaves out a key that expired between being listed and being read", async () => {
    const redis = populated();
    const listed: Command = async (args) => {
      if (args[0] === "TYPE" && args[1] === PENDING) redis.clock.now = NOW + 21 * 60_000;
      return redis.command(args);
    };

    const snapshot = await exportStore(listed, NOW);

    expect(snapshot.entries.map((entry) => entry.key)).toEqual([LINK, WATCHES]);
  });

  it("leaves out a key removed between its read and its expiry check", async () => {
    const redis = populated();
    const racing: Command = async (args) => {
      if (args[0] === "PEXPIRETIME" && args[1] === LINK) redis.strings.delete(LINK);
      return redis.command(args);
    };

    const snapshot = await exportStore(racing, NOW);

    expect(snapshot.entries.map((entry) => entry.key)).toEqual([PENDING, WATCHES]);
  });

  /*
   * Redis removes a set when its last member goes, so an empty one is not
   * something it holds. A copy has to be one a restore accepts even so: an
   * export that wrote an empty set would be refused whole on the day it was
   * needed.
   */
  it("never writes what a restore would refuse, even an empty set", async () => {
    const redis = populated();
    const emptied: Command = async (args) =>
      args[0] === "SMEMBERS" ? { kind: "array", values: [] } : redis.command(args);

    const snapshot = await exportStore(emptied, NOW);

    expect(() => readSnapshot(JSON.stringify(snapshot))).not.toThrow();
    expect(snapshot.entries.map((entry) => entry.key)).toEqual([LINK, PENDING]);
  });

  it("stops rather than skip a type the application never writes", async () => {
    const redis = populated();
    redis.others.set(`${BACKUP_PREFIX}queue`, "list");

    await expect(exportStore(redis.command, NOW)).rejects.toThrow("is a list");
  });

  it("stops on a reply it did not expect", async () => {
    const redis = populated();
    const broken: Command = async (args) =>
      args[0] === "PEXPIRETIME" ? { kind: "error", message: "ERR busy" } : redis.command(args);

    await expect(exportStore(broken, NOW)).rejects.toThrow("PEXPIRETIME");
  });

  it("stops when SCAN does not answer with a cursor and a batch", async () => {
    await expect(exportStore(async () => ({ kind: "null" }), NOW)).rejects.toThrow("SCAN");
  });

  it("is an empty snapshot for an empty store, not a failure", async () => {
    expect((await exportStore(fakeRedis().command, NOW)).entries).toEqual([]);
  });
});

const valid: Snapshot = {
  version: 1,
  takenAt: "2026-09-24T03:17:00.000Z",
  entries: [
    { key: LINK, type: "string", value: "{}", expiresAtMs: NOW + 1_000 },
    { key: WATCHES, type: "set", members: ["abc"], expiresAtMs: null },
  ],
};

const tampered = (change: (entry: Record<string, unknown>) => void, index = 0): string => {
  const copy = JSON.parse(JSON.stringify(valid)) as { entries: Record<string, unknown>[] };
  change(copy.entries[index] as Record<string, unknown>);
  return JSON.stringify(copy);
};

describe("readSnapshot", () => {
  it("reads back exactly what was written", () => {
    expect(readSnapshot(JSON.stringify(valid))).toEqual(valid);
  });

  it.each([
    ["not JSON", "{", "not JSON"],
    ["another version", JSON.stringify({ ...valid, version: 2 }), "version 1"],
    ["no date", JSON.stringify({ ...valid, takenAt: "yesterday" }), "takenAt"],
    ["no list", JSON.stringify({ ...valid, entries: {} }), "entries"],
    ["a key outside the prefix", tampered((entry) => (entry.key = "otherapp:session")), "not under"],
    ["the bare prefix as a key", tampered((entry) => (entry.key = BACKUP_PREFIX)), "not under"],
    ["a string with no value", tampered((entry) => delete entry.value), "not a string"],
    ["an empty set", tampered((entry) => (entry.members = []), 1), "non-empty set"],
    ["a set with a number in it", tampered((entry) => (entry.members = [1]), 1), "non-empty set"],
    ["an unknown type", tampered((entry) => (entry.type = "hash")), "not a string"],
    ["an expiry that is text", tampered((entry) => (entry.expiresAtMs = "soon")), "expiresAtMs"],
    ["an expiry of zero", tampered((entry) => (entry.expiresAtMs = 0)), "expiresAtMs"],
    ["an expiry with a fraction", tampered((entry) => (entry.expiresAtMs = 1.5)), "expiresAtMs"],
    ["a missing expiry", tampered((entry) => delete entry.expiresAtMs), "expiresAtMs"],
    ["an entry that is not an object", JSON.stringify({ ...valid, entries: ["x"] }), "not an object"],
    ["a key twice", JSON.stringify({ ...valid, entries: [valid.entries[0], valid.entries[0]] }), "twice"],
  ])("refuses the whole file for %s", (_name, raw, message) => {
    expect(() => readSnapshot(raw)).toThrow(message);
  });
});

describe("restoreCommands", () => {
  it("puts each expiry back as the moment it was due, not as time left", () => {
    expect(restoreCommands(valid, NOW)).toEqual([
      ["SET", LINK, "{}", "PXAT", String(NOW + 1_000)],
      ["DEL", WATCHES],
      ["SADD", WATCHES, "abc"],
    ]);
  });

  it("restores nothing that would already have expired", () => {
    expect(restoreCommands(valid, NOW + 1_000)).toEqual([
      ["DEL", WATCHES],
      ["SADD", WATCHES, "abc"],
    ]);
  });

  it("keeps a set's expiry, and a string with none has none", () => {
    const snapshot: Snapshot = {
      ...valid,
      entries: [
        { key: LINK, type: "string", value: "v", expiresAtMs: null },
        { key: WATCHES, type: "set", members: ["a", "b"], expiresAtMs: NOW + 5 },
      ],
    };
    expect(restoreCommands(snapshot, NOW)).toEqual([
      ["SET", LINK, "v"],
      ["DEL", WATCHES],
      ["SADD", WATCHES, "a", "b"],
      ["PEXPIREAT", WATCHES, String(NOW + 5)],
    ]);
  });
});

describe("restoreStore", () => {
  /*
   * The property the first live proof failed on: an expiry read as time left
   * and added to a clock taken earlier drifts by however long the reads took,
   * so the copy and the original disagreed by milliseconds. Read as the
   * moment itself, two exports taken at different times agree exactly.
   */
  it("gives the same expiry moments however long after the clock was read", async () => {
    const redis = populated();

    const early = await exportStore(redis.command, NOW);
    const late = await exportStore(redis.command, NOW + 5_000);

    expect(late.entries).toEqual(early.entries);
  });

  it("round-trips: what is exported is what comes back", async () => {
    const snapshot = await exportStore(populated().command, NOW);
    const target = fakeRedis();

    expect(await restoreStore(target.command, snapshot, NOW, { replace: false })).toBe(3);
    expect(await exportStore(target.command, NOW)).toEqual(snapshot);
  });

  it("refuses to write over links that are already there", async () => {
    const target = populated();

    await expect(restoreStore(target.command, valid, NOW, { replace: false })).rejects.toThrow("--replace");
    expect(target.log.some(([name]) => name === "SET" || name === "SADD")).toBe(false);
  });

  it("with --replace, leaves exactly the snapshot: nothing removed since comes back, nothing extra stays", async () => {
    const target = populated();

    await restoreStore(target.command, valid, NOW, { replace: true });

    const after = await exportStore(target.command, NOW);
    expect(after.entries.map((entry) => entry.key)).toEqual([LINK, WATCHES]);
    expect(target.strings.get("otherapp:session")).toBe("secret");
  });

  it("stops at the first command the store refuses", async () => {
    const target = fakeRedis();
    const refusing: Command = async (args) =>
      args[0] === "SADD" ? { kind: "error", message: "OOM" } : target.command(args);

    await expect(restoreStore(refusing, valid, NOW, { replace: false })).rejects.toThrow("SADD");
  });
});

describe("describeSnapshot", () => {
  it("counts without naming anybody", async () => {
    const line = describeSnapshot(await exportStore(populated().command, NOW));

    expect(line).toBe("taken 2026-09-24T03:17:00.000Z: 2 links, 1 being watched, 3 keys in all");
    expect(line).not.toContain("0x1");
  });

  it("says nothing is watched when there is no set", () => {
    expect(describeSnapshot({ ...valid, entries: [valid.entries[0] as never] })).toContain("0 being watched");
  });
});
