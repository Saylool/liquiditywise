import { z } from "zod";

import { IsoTimestampSchema } from "../../schemas/primitives";
import type { ProtocolVersion } from "../../schemas";
import { BACKUP_PREFIX } from "../backup/storeBackup";
import { type ChainId, isSupportedChainId } from "../chains/chains";
import { isLocale, type Locale } from "../i18n/locales";
import type { KeyValueStore } from "../store/keyValueStore";
import { CLAIMED_LINK_TTL_MS, rotation } from "./links";
import type { PoolWatchTarget } from "./poolWatchCommand";
import type { PriceRange } from "./poolRangeShift";

/*
 * What this application keeps about a chat that follows a pool, and for how long.
 *
 * A link (links.ts) is about an address, and a chat that holds no position
 * has none to link. A pool watch is the one other record the bot keeps, and
 * it is keyed by the chat itself: one record per chat, holding up to
 * `MAX_POOL_WATCHES` pools, and in it exactly what the alert needs — the
 * chain, the pool, which protocol it is, the two prices of the range the
 * chat was last told and when it was told them — and the language the chat
 * wrote in, so the next message is in it. The chat's numeric id is the key.
 * No name, no username, no message, and no address: nothing in it says who
 * the chat is, only which public pool it follows.
 *
 * Under the same prefix as the links, so the daily backup (deploy/backup.sh,
 * storeBackup.ts) copies it as it copies them, and the promise is the same
 * one: deleted from the server the moment `/unwatch` or `/stop` asks, and
 * gone from the encrypted backups within seven days. A record no pass has had
 * to write for a year lapses on its own, as a link does.
 *
 * The set of chats that watch something is what the checker walks, as the
 * set of claimed tokens is for the links — a few chats at a time, in turn
 * (`poolWatchersForPass`), never the whole set in one pass.
 *
 * Bounded twice: a chat follows at most `MAX_POOL_WATCHES` pools, in its one
 * record, and at most `MAX_POOL_WATCHERS` chats follow any, past which a chat
 * that follows nothing yet is turned away. A chat already following a pool is
 * never turned away by the second; it only ever adds to its own five.
 */

export const MAX_POOL_WATCHES = 5;

/**
 * Chats with a pool watch, over everybody: two thousand chats, ten thousand
 * pools at most, which the pass's budget (checkWatches.ts) still reaches
 * within the day.
 */
export const MAX_POOL_WATCHERS = 2_000;

/** The set of chat ids with a pool watch: what the checker walks. */
export const POOL_WATCHERS_KEY = `${BACKUP_PREFIX}poolwatchers`;

export const POOL_WATCH_TTL_MS = CLAIMED_LINK_TTL_MS;

const poolWatchKey = (chatId: number): string => `${BACKUP_PREFIX}pools:${chatId}`;

const PriceSchema = z.number().positive().refine(Number.isFinite);

const WatchSchema = z.object({
  chainId: z.number().int().refine(isSupportedChainId),
  protocol: z.enum(["v3", "v4"]),
  poolId: z.string().regex(/^0x(?:[0-9a-f]{40}|[0-9a-f]{64})$/),
  /** The range the chat was last told, in the pool's own direction, and when. */
  told: z.object({ lower: PriceSchema, upper: PriceSchema, at: IsoTimestampSchema }),
});

const RecordSchema = z.object({
  locale: z.string().refine(isLocale),
  watches: z.array(WatchSchema).max(MAX_POOL_WATCHES),
});

export type PoolWatch = {
  readonly chainId: ChainId;
  readonly protocol: ProtocolVersion;
  readonly poolId: string;
  readonly told: { readonly lower: number; readonly upper: number; readonly at: string };
};

export type PoolWatchRecord = {
  readonly locale: Locale;
  readonly watches: readonly PoolWatch[];
};

/** A read that could not be made, as distinct from a chat that watches nothing. */
export type PoolWatchRead = PoolWatchRecord | null | undefined;

const parseRecord = (raw: string): PoolWatchRecord | null => {
  try {
    const parsed = RecordSchema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as PoolWatchRecord) : null;
  } catch {
    return null;
  }
};

export const readPoolWatches = async (store: KeyValueStore, chatId: number): Promise<PoolWatchRead> => {
  const raw = await store.get(poolWatchKey(chatId));
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  return parseRecord(raw);
};

/**
 * Writes a chat's record, or removes it when the last watch has gone: a
 * record of no watches is nothing to keep, and a chat with nothing kept
 * should not be in the set the checker walks.
 */
const writeRecord = async (store: KeyValueStore, chatId: number, record: PoolWatchRecord): Promise<boolean> => {
  if (record.watches.length === 0) {
    await forgetPoolWatches(store, chatId);
    return true;
  }
  const written = await store.set(poolWatchKey(chatId), JSON.stringify(record), POOL_WATCH_TTL_MS);
  if (!written) return false;
  await store.sadd(POOL_WATCHERS_KEY, String(chatId));
  return true;
};

/** Whether two watches name the same pool: the same chain and the same id, which already carries the protocol. */
export const samePool = (a: Pick<PoolWatch, "chainId" | "poolId">, b: Pick<PoolWatch, "chainId" | "poolId">): boolean =>
  a.chainId === b.chainId && a.poolId === b.poolId;

export type AddOutcome = "added" | "full" | "crowded" | "unavailable";

/**
 * Adds a watch, with the range the chat has just been told as its baseline.
 * A pool already watched is told again rather than watched twice, and does
 * not count against the cap. The language is the one the chat wrote this
 * command in, and it moves with the latest ask. `crowded` is a chat that
 * follows nothing yet, past `MAX_POOL_WATCHERS`.
 */
export const addPoolWatch = async (
  store: KeyValueStore,
  chatId: number,
  input: { readonly target: PoolWatchTarget; readonly range: PriceRange; readonly locale: Locale; readonly now: Date },
): Promise<AddOutcome> => {
  const existing = await readPoolWatches(store, chatId);
  if (existing === undefined) return "unavailable";

  const kept = (existing?.watches ?? []).filter((watch) => !samePool(watch, input.target));
  if (kept.length >= MAX_POOL_WATCHES) return "full";
  if (existing === null) {
    const watchers = await store.scard(POOL_WATCHERS_KEY);
    if (watchers === null) return "unavailable";
    if (watchers >= MAX_POOL_WATCHERS) return "crowded";
  }

  const watch: PoolWatch = {
    chainId: input.target.chainId,
    protocol: input.target.protocol,
    poolId: input.target.poolId,
    told: { lower: input.range[0], upper: input.range[1], at: input.now.toISOString() },
  };
  return (await writeRecord(store, chatId, { locale: input.locale, watches: [...kept, watch] })) ? "added" : "unavailable";
};

export type RemoveOutcome = "removed" | "not-watched" | "unavailable";

/** Removes one watch; the record goes with it when it was the last. */
export const removePoolWatch = async (store: KeyValueStore, chatId: number, target: PoolWatchTarget): Promise<RemoveOutcome> => {
  const existing = await readPoolWatches(store, chatId);
  if (existing === undefined) return "unavailable";
  if (existing === null) return "not-watched";

  const kept = existing.watches.filter((watch) => !samePool(watch, target));
  if (kept.length === existing.watches.length) return "not-watched";

  return (await writeRecord(store, chatId, { ...existing, watches: kept })) ? "removed" : "unavailable";
};

/**
 * Replaces what one pool's watch was last told, and answers the record as it
 * now stands, so a pass that tells two of a chat's pools writes the second
 * from the first. `false` in `written` when the write did not take, which
 * leaves the chat due to be told again next pass.
 */
export const recordRangeTold = async (
  store: KeyValueStore,
  chatId: number,
  record: PoolWatchRecord,
  target: Pick<PoolWatch, "chainId" | "poolId">,
  range: PriceRange,
  at: Date,
): Promise<{ readonly record: PoolWatchRecord; readonly written: boolean }> => {
  const next: PoolWatchRecord = {
    ...record,
    watches: record.watches.map((watch) =>
      samePool(watch, target) ? { ...watch, told: { lower: range[0], upper: range[1], at: at.toISOString() } } : watch,
    ),
  };
  return { record: next, written: await writeRecord(store, chatId, next) };
};

/** Removes everything kept for a chat's pool watches, whichever command asked. */
export const forgetPoolWatches = async (store: KeyValueStore, chatId: number): Promise<void> => {
  await store.del(poolWatchKey(chatId));
  await store.srem(POOL_WATCHERS_KEY, String(chatId));
};

export type PoolWatcher = { readonly chatId: number; readonly record: PoolWatchRecord };

/**
 * The chats one pass reads, and their pools: the next in turn after `after`,
 * as many whole chats as fit in `budget` pools — a chat's pools are told
 * together, in one record, so a chat is never split — and always at least
 * one, which `MAX_POOL_WATCHES` keeps inside any budget the pass uses. Also
 * how many chats the set holds, and the last one read, for the next pass to
 * start after. `null` when the set could not be read.
 *
 * A chat in the set whose record has lapsed or gone, or whose member is not a
 * chat id, is dropped from the set as it is met, so the set cannot grow with
 * chats that watch nothing.
 */
export const poolWatchersForPass = async (
  store: KeyValueStore,
  options: { readonly budget: number; readonly after: string | null; readonly start?: number },
): Promise<{ readonly total: number; readonly watchers: readonly PoolWatcher[]; readonly last: string | null } | null> => {
  const members = await store.smembers(POOL_WATCHERS_KEY);
  if (members === null) return null;

  const watchers: PoolWatcher[] = [];
  let pools = 0;
  let last = options.after;
  /* At most one chat per pool of budget can fit, so no more are asked for. */
  for (const member of rotation(members, options.budget, options.after, options.start)) {
    const chatId = Number(member);
    if (!Number.isSafeInteger(chatId)) {
      await store.srem(POOL_WATCHERS_KEY, member);
      last = member;
      continue;
    }
    const record = await readPoolWatches(store, chatId);
    if (record === undefined) {
      last = member;
      continue;
    }
    if (record === null) {
      await store.srem(POOL_WATCHERS_KEY, member);
      last = member;
      continue;
    }
    /* Stopped before the chat that would not fit, which is where the next pass starts. */
    if (watchers.length > 0 && pools + record.watches.length > options.budget) break;
    watchers.push({ chatId, record });
    pools += record.watches.length;
    last = member;
  }

  return { total: members.length, watchers, last };
};
