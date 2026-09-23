/*
 * The Telegram links, taken out of Redis and put back.
 *
 * They are the one thing this application keeps about anybody, and they live
 * on one disk. The append-only log protects them from a crash; nothing
 * protected them from losing the machine. This is what a daily backup takes
 * and what a restore puts back — the links and the set the checker walks,
 * under `liquiditywise:telegram:`, and nothing else. The health keys are not
 * worth keeping, and whatever else a shared Redis holds is not ours to copy.
 *
 * A logical copy rather than Redis's own dump: it reads as JSON, it restores
 * into any Redis or into the REST store, and a restore can check every entry
 * before writing one.
 *
 * It speaks through a `Command` function rather than a socket, so everything
 * here is a test. `deploy/store-backup.mts` gives it the socket. Imports are
 * type-only for the same reason: that entry runs under plain Node, which
 * resolves no extensionless path.
 */

import type { RespReply } from "../store/resp";

export const BACKUP_PREFIX = "liquiditywise:telegram:";

/** One Redis command, answered. */
export type Command = (args: readonly string[]) => Promise<RespReply>;

export type SnapshotEntry =
  | {
      readonly key: string;
      readonly type: "string";
      readonly value: string;
      /** When Redis would have expired it, in milliseconds since the epoch; `null` for never. */
      readonly expiresAtMs: number | null;
    }
  | {
      readonly key: string;
      readonly type: "set";
      readonly members: readonly string[];
      readonly expiresAtMs: number | null;
    };

export type Snapshot = {
  readonly version: 1;
  readonly takenAt: string;
  readonly entries: readonly SnapshotEntry[];
};

const fail = (what: string): never => {
  throw new Error(what);
};

const expectString = (reply: RespReply, what: string): string =>
  reply.kind === "string" ? reply.value : fail(`${what}: unexpected reply ${reply.kind}`);

const expectInteger = (reply: RespReply, what: string): number =>
  reply.kind === "integer" ? reply.value : fail(`${what}: unexpected reply ${reply.kind}`);

const expectStrings = (reply: RespReply, what: string): string[] =>
  reply.kind === "array"
    ? reply.values.map((item) => expectString(item, what))
    : fail(`${what}: unexpected reply ${reply.kind}`);

/** Every key under the prefix. SCAN may return a key twice; each is kept once. */
const keysUnderPrefix = async (command: Command): Promise<string[]> => {
  const keys = new Set<string>();
  let cursor = "0";
  do {
    const reply = await command(["SCAN", cursor, "MATCH", `${BACKUP_PREFIX}*`, "COUNT", "500"]);
    const [next, batch] = reply.kind === "array" ? reply.values : [];
    if (next === undefined || batch === undefined) throw new Error(`SCAN: unexpected reply ${reply.kind}`);
    cursor = expectString(next, "SCAN cursor");
    for (const key of expectStrings(batch, "SCAN keys")) keys.add(key);
  } while (cursor !== "0");
  return [...keys].sort();
};

/**
 * Everything under the prefix, as it stands.
 *
 * A key that disappears between being listed and being read has expired or
 * been removed by `/stop`, and is left out, which is what a copy taken a
 * moment later would show. A key of a type this application never writes
 * stops the backup instead: a copy that quietly left something out is one
 * nobody would find out about until they needed it.
 */
export const exportStore = async (command: Command, nowMs: number): Promise<Snapshot> => {
  const entries: SnapshotEntry[] = [];

  for (const key of await keysUnderPrefix(command)) {
    const type = expectString(await command(["TYPE", key]), `TYPE ${key}`);
    if (type === "none") continue;
    if (type !== "string" && type !== "set") throw new Error(`${key} is a ${type}, which this application never writes`);

    const read = await command(type === "string" ? ["GET", key] : ["SMEMBERS", key]);
    const ttl = expectInteger(await command(["PTTL", key]), `PTTL ${key}`);
    // -2: gone since it was listed, which is also the only way a read comes back empty. -1: no expiry.
    if (ttl === -2) continue;
    const expiresAtMs = ttl === -1 ? null : nowMs + ttl;

    if (type === "string") {
      entries.push({ key, type, value: expectString(read, `GET ${key}`), expiresAtMs });
    } else {
      const members = expectStrings(read, `SMEMBERS ${key}`).sort();
      if (members.length > 0) entries.push({ key, type, members, expiresAtMs });
    }
  }

  return { version: 1, takenAt: new Date(nowMs).toISOString(), entries };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readExpiry = (value: unknown, key: string): number | null => {
  if (value === null) return null;
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  return fail(`${key}: expiresAtMs must be a positive integer or null`);
};

const readEntry = (value: unknown): SnapshotEntry => {
  if (!isRecord(value)) return fail("an entry is not an object");
  const { key, type } = value;
  if (typeof key !== "string" || !key.startsWith(BACKUP_PREFIX) || key.length === BACKUP_PREFIX.length) {
    return fail(`an entry's key is not under ${BACKUP_PREFIX}`);
  }
  const expiresAtMs = readExpiry(value.expiresAtMs, key);

  if (type === "string" && typeof value.value === "string") {
    return { key, type, value: value.value, expiresAtMs };
  }
  if (
    type === "set" &&
    Array.isArray(value.members) &&
    value.members.length > 0 &&
    value.members.every((member) => typeof member === "string")
  ) {
    return { key, type, members: value.members as string[], expiresAtMs };
  }
  return fail(`${key}: not a string or a non-empty set`);
};

/**
 * A snapshot read back, all of it checked before any of it is used.
 *
 * Anyone who can write to where the backups are kept can put a file there,
 * and a restore writes into the store readers' links live in. So a file that
 * is not exactly what `exportStore` produces is refused whole: a key outside
 * the prefix could overwrite something that is not ours, and a half-read file
 * restored as if it were complete loses links without saying so.
 */
export const readSnapshot = (raw: string): Snapshot => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail("not JSON");
  }
  if (!isRecord(parsed) || parsed.version !== 1) return fail("not a version 1 snapshot");
  if (typeof parsed.takenAt !== "string" || Number.isNaN(Date.parse(parsed.takenAt))) {
    return fail("takenAt is not a date");
  }
  if (!Array.isArray(parsed.entries)) return fail("entries is not a list");

  const entries = parsed.entries.map(readEntry);
  if (new Set(entries.map((entry) => entry.key)).size !== entries.length) return fail("a key appears twice");

  return { version: 1, takenAt: parsed.takenAt, entries };
};

/**
 * The commands that put a snapshot back, as of `nowMs`.
 *
 * Expiry is restored as the moment it was due, not as time left: a pending
 * link taken half an hour before the machine died must not come back with a
 * fresh half hour. Anything already past its moment is not restored at all.
 */
export const restoreCommands = (snapshot: Snapshot, nowMs: number): string[][] => {
  const commands: string[][] = [];

  for (const entry of snapshot.entries) {
    if (entry.expiresAtMs !== null && entry.expiresAtMs <= nowMs) continue;

    if (entry.type === "string") {
      commands.push(
        entry.expiresAtMs === null
          ? ["SET", entry.key, entry.value]
          : ["SET", entry.key, entry.value, "PXAT", String(entry.expiresAtMs)],
      );
    } else {
      // Replaced, not merged: a member removed before the backup must not survive through one left over.
      commands.push(["DEL", entry.key], ["SADD", entry.key, ...entry.members]);
      if (entry.expiresAtMs !== null) commands.push(["PEXPIREAT", entry.key, String(entry.expiresAtMs)]);
    }
  }

  return commands;
};

/**
 * Puts a snapshot back into the store `command` speaks to.
 *
 * Into an empty prefix only, unless told to replace. A restore is the step
 * after something went wrong; one run against the live store by mistake
 * would put back every link a reader had since removed with `/stop`.
 */
export const restoreStore = async (
  command: Command,
  snapshot: Snapshot,
  nowMs: number,
  options: { readonly replace: boolean },
): Promise<number> => {
  const existing = await keysUnderPrefix(command);
  if (existing.length > 0 && !options.replace) {
    throw new Error(`the store already holds ${existing.length} keys under ${BACKUP_PREFIX}; pass --replace to overwrite them`);
  }
  if (options.replace) {
    for (const key of existing) await command(["DEL", key]);
  }

  const commands = restoreCommands(snapshot, nowMs);
  for (const args of commands) {
    const reply = await command(args);
    if (reply.kind === "error") throw new Error(`${args[0]} ${args[1]}: ${reply.message}`);
  }
  return new Set(commands.map((args) => args[1])).size;
};

/** What a snapshot holds, in counts — for a person to read without seeing an address or a chat id. */
export const describeSnapshot = (snapshot: Snapshot): string => {
  const links = snapshot.entries.filter((entry) => entry.key.startsWith(`${BACKUP_PREFIX}link:`)).length;
  const watches = snapshot.entries.find((entry) => entry.key === `${BACKUP_PREFIX}watches`);
  const watched = watches?.type === "set" ? watches.members.length : 0;
  return `taken ${snapshot.takenAt}: ${links} links, ${watched} being watched, ${snapshot.entries.length} keys in all`;
};
