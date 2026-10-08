import { z } from "zod";

import { EvmAddressSchema, IsoTimestampSchema } from "../../schemas/primitives";
import { isLocale, type Locale } from "../i18n/locales";
import { isLinkToken } from "./linkToken";
import type { PositionSnapshot } from "./positionChanges";
import type { SmartRangeBaselines } from "./smartShift";
import type { KeyValueStore } from "../store/keyValueStore";
import { type ChainId, isSupportedChainId } from "../chains/chains";

/*
 * What this application keeps about a Telegram link, and for how long.
 *
 * It is the one thing this application stores about a reader (the smart-money
 * measurements beside it are public chain data, and say nothing of who reads
 * a page), so it is worth saying exactly: an Ethereum address the reader typed, the language they
 * were reading in, the numeric id of the Telegram chat that presented the
 * token, and — once the checker has run — whether each of the address's
 * positions was inside its range last time. No name, no username, no message.
 * A chat that asked for more (/smart, /weekly) adds only what that needs, in
 * the same record, so `/stop` and the backup's seven days cover it too.
 *
 * A pending link — minted, not yet presented to the bot — lives half an hour.
 * A claimed one lives until `/stop`, or until the reader forgets it from the
 * site, or for a year without the checker touching it.
 *
 * The daily backup (deploy/backup.sh) holds a copy for seven days more,
 * encrypted to a key that is not on the server. That is what readers are told:
 * deleted from the server at once, and from the backups within seven days.
 *
 * **One link per chat, and the chat's link found by the chat.** Beside each
 * claimed link is a second key, the chat's numeric id naming its token —
 * nothing a link does not already hold, the other way round, under the same
 * prefix and so in the same backups and gone with the same `/stop`. It is what
 * a command reads: a chat's `/stop`, `/smart` or `/weekly` costs one read of
 * it and one of the link, where it used to walk every link anybody had made,
 * and a chat that has none costs the one read. It is also what holds a chat
 * to one link: a chat that claims a second token gives up the first, as one
 * browser following one address always did on the site. A chat could
 * otherwise claim as many tokens as it could mint, and every one of them
 * would be another address read on every pass. Over every chat together
 * there is a ceiling, `MAX_LINKED_CHATS`, past which a new chat is turned away.
 *
 * The store runs no transaction here, so every change that touches both keys
 * is ordered so that a crash between two steps leaves something the next pass
 * puts right, never a record nothing can find: the pass (checkWatches.ts) sets
 * each link it meets against its chat's key — writes the key when it is
 * missing or names a link that is not the chat's, and settles two links of
 * one chat by keeping the newer — and a link is only ever deleted key first.
 *
 * **Made before the key existed**, a link has none, and nothing was migrated
 * for it. The first pass after the key arrived writes one for every link —
 * one walk, the walk every pass used to make — and leaves a mark that it has.
 * Until the mark is there, a chat with no key is looked for the old way, so a
 * `/stop` sent the minute after a deploy finds its link all the same; once it
 * is, never. A chat that had claimed several links before is left with the
 * newest, as claiming them one after another today would have left it.
 */

const PREFIX = "liquiditywise:telegram:";

/** The cookie that remembers which link this browser minted, so the page can say how it stands. */
export const TELEGRAM_LINK_COOKIE = "telegram";

/** The set of tokens whose links have been claimed: what the checker walks. */
export const WATCHES_KEY = `${PREFIX}watches`;

export const PENDING_LINK_TTL_MS = 30 * 60 * 1_000;
export const CLAIMED_LINK_TTL_MS = 365 * 24 * 60 * 60 * 1_000;

const linkKey = (token: string): string => `${PREFIX}link:${token}`;

/** The token a chat has claimed, by the chat's numeric id. */
const chatKey = (chatId: number): string => `${PREFIX}chat:${chatId}`;

/** Written once a pass has given every link made before the chat keys one of its own. */
export const CHAT_INDEX_BUILT_KEY = `${PREFIX}chat-index-built`;

/**
 * Chats with a link, over everybody. Ten thousand is far past what the site
 * has, and a bound on what a pass can be asked to rotate through: at the pass's
 * budget (checkWatches.ts) every link is still read within the day.
 */
export const MAX_LINKED_CHATS = 10_000;

const LinkSchema = z.object({
  address: EvmAddressSchema,
  locale: z.string().refine(isLocale),
  chatId: z.number().int().nullable(),
  createdAt: IsoTimestampSchema,
  /*
   * Absent on every link made before other chains, and on every mainnet link
   * since: such a link reads as mainnet, so the links already stored keep
   * working exactly as they did, and nothing had to be migrated.
   */
  chainId: z.number().int().refine(isSupportedChainId).optional(),
  snapshot: z.record(z.string(), z.union([z.boolean(), z.literal("near")]).nullable()).nullable(),
  /*
   * Present only for a chat that asked for smart-money alerts with /smart, and
   * holding only where the best-earning liquidity of each pool the address
   * holds a position in sat when the chat was last told. Absent on every link
   * made before, and on every link that never asked, so those store exactly
   * what they always did.
   */
  smart: z
    .object({ ranges: z.record(z.string(), z.tuple([z.number(), z.number()])) })
    .optional()
    /* A record this cannot read is a chat that has not asked, not a link that has gone. */
    .catch(undefined),
  /*
   * Present only for a chat that asked for the Monday digest with /weekly, and
   * holding only when the last one went out — `null` until the first has. The
   * digest is about public measurements, so nothing of the chat's own
   * positions is kept for it.
   */
  weekly: z
    .object({ sentAt: IsoTimestampSchema.nullable() })
    .optional()
    /* As with `smart`: unreadable is "did not ask", never "the link is gone". */
    .catch(undefined),
});

export type TelegramLink = {
  readonly address: string;
  readonly locale: Locale;
  /** `null` until the bot has been handed the token from a chat. */
  readonly chatId: number | null;
  readonly createdAt: string;
  /** The chain the address is followed on; absent means mainnet. */
  readonly chainId?: ChainId;
  /** What the checker saw last time, or `null` before its first run. */
  readonly snapshot: PositionSnapshot | null;
  /** Set once the chat has asked for smart-money alerts; `ranges` is what it was last told, by pool. */
  readonly smart?: { readonly ranges: SmartRangeBaselines };
  /** Set once the chat has asked for the Monday digest; `sentAt` is when the last one went out. */
  readonly weekly?: { readonly sentAt: string | null };
};

/** A read that could not be made, as distinct from a link that is not there. */
export type LinkRead = TelegramLink | null | undefined;

const parseLink = (raw: string): TelegramLink | null => {
  try {
    const parsed = LinkSchema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as TelegramLink) : null;
  } catch {
    return null;
  }
};

export const readLink = async (store: KeyValueStore, token: string): Promise<LinkRead> => {
  if (!isLinkToken(token)) return null;

  const raw = await store.get(linkKey(token));
  if (raw === undefined) return undefined;
  if (raw === null) return null;

  return parseLink(raw);
};

const writeLink = (store: KeyValueStore, token: string, link: TelegramLink): Promise<boolean> =>
  store.set(
    linkKey(token),
    JSON.stringify(link),
    link.chatId === null ? PENDING_LINK_TTL_MS : CLAIMED_LINK_TTL_MS,
  );

/** Mints the record a token points at. The token itself is the caller's to make. */
export const createPendingLink = (
  store: KeyValueStore,
  token: string,
  input: { readonly address: string; readonly locale: Locale; readonly now: Date; readonly chainId?: ChainId },
): Promise<boolean> =>
  writeLink(store, token, {
    address: input.address,
    locale: input.locale,
    chatId: null,
    createdAt: input.now.toISOString(),
    /* Written only off mainnet, so a mainnet link is stored exactly as it always was. */
    ...(input.chainId === undefined || input.chainId === 1 ? {} : { chainId: input.chainId }),
    snapshot: null,
  });

export type ClaimOutcome = "claimed" | "unknown" | "already-claimed" | "crowded" | "unavailable";

/**
 * Ties a chat to the link its token names, in place of any link it had.
 *
 * A token that has already been claimed is refused: the first chat to present
 * it is the one that clicked the button, and a second is somebody else who
 * saw the link. `crowded` is a new chat past `MAX_LINKED_CHATS`; a chat that
 * already has a link only swaps it, and is never turned away. `unavailable`
 * is the store not answering, which the caller should say differently from
 * "no such link".
 *
 * The steps are ordered for a crash between any two. The chat's key is
 * written first: cut off there, it names a link that is not yet the chat's,
 * which a command answers as no link and the pass writes back to the old one.
 * The link next, then the set the pass walks, and the old link is let go
 * last, so nothing is ever claimed that neither the chat's key nor the set
 * can find. The key is written once more at the end, because a pass that met
 * the old link in between may have pointed it back there.
 */
export const claimLink = async (
  store: KeyValueStore,
  token: string,
  chatId: number,
): Promise<ClaimOutcome> => {
  const link = await readLink(store, token);
  if (link === undefined) return "unavailable";
  if (link === null) return "unknown";
  if (link.chatId !== null && link.chatId !== chatId) return "already-claimed";

  const previous = await store.get(chatKey(chatId));
  if (previous === undefined) return "unavailable";

  if (link.chatId === null && previous === null) {
    const linked = await store.scard(WATCHES_KEY);
    if (linked === null) return "unavailable";
    if (linked >= MAX_LINKED_CHATS) return "crowded";
  }

  if (!(await store.set(chatKey(chatId), token, CLAIMED_LINK_TTL_MS))) return "unavailable";
  /* Presented again by the chat that has it: nothing to write but what a claim cut off halfway may have missed. */
  if (link.chatId === null && !(await writeLink(store, token, { ...link, chatId }))) return "unavailable";
  if (!(await store.sadd(WATCHES_KEY, token))) return "unavailable";

  if (previous !== null && previous !== token) {
    await forgetLink(store, previous);
    await store.set(chatKey(chatId), token, CLAIMED_LINK_TTL_MS);
  }
  return "claimed";
};

/**
 * Records what the checker saw, so the next run has something to compare with.
 * `smartRanges` replaces what a chat that asked for smart-money alerts was last
 * told; a chat that did not ask has none, whatever is passed.
 */
export const recordSnapshot = async (
  store: KeyValueStore,
  token: string,
  link: TelegramLink,
  snapshot: PositionSnapshot,
  smartRanges?: SmartRangeBaselines,
): Promise<boolean> =>
  writeLink(store, token, {
    ...link,
    snapshot,
    ...(link.smart === undefined ? {} : { smart: { ranges: smartRanges ?? link.smart.ranges } }),
  });

/**
 * Turns smart-money alerts on for a link, with nothing told yet, or off, which
 * deletes what was kept for them. `false` when the write did not take.
 */
export const setSmartAlerts = async (
  store: KeyValueStore,
  token: string,
  link: TelegramLink,
  on: boolean,
): Promise<boolean> => {
  /* Rebuilt without the field rather than set to nothing, so what was kept is not written back. */
  const rest: Record<string, unknown> = { ...link };
  delete rest.smart;
  const base = rest as unknown as TelegramLink;
  return writeLink(store, token, on ? { ...base, smart: { ranges: {} } } : base);
};

/**
 * Turns the Monday digest on for a link, with none sent yet, or off, which
 * deletes the one thing kept for it: when the last went out. `false` when the
 * write did not take.
 */
export const setWeeklyDigest = async (
  store: KeyValueStore,
  token: string,
  link: TelegramLink,
  on: boolean,
): Promise<boolean> => {
  /* Rebuilt without the field, as with /smart, so turning it off leaves nothing of it behind. */
  const rest: Record<string, unknown> = { ...link };
  delete rest.weekly;
  const base = rest as unknown as TelegramLink;
  return writeLink(store, token, on ? { ...base, weekly: { sentAt: null } } : base);
};

/**
 * Records that a digest went out, and answers the link as it now stands —
 * what the rest of the pass writes from, so its own write does not put the
 * old time back. Answered whether or not this write took: the snapshot the
 * pass writes next carries the time too, so one failed write is a second
 * chance to keep it rather than a second digest.
 */
export const recordDigestSent = async (
  store: KeyValueStore,
  token: string,
  link: TelegramLink,
  at: Date,
): Promise<TelegramLink> => {
  const next: TelegramLink = { ...link, weekly: { sentAt: at.toISOString() } };
  await writeLink(store, token, next);
  return next;
};

/**
 * Removes a link and takes it out of the checker's set, whichever side asked —
 * and its chat's key, when the key still names it. The key goes first: a crash
 * after it leaves a link the pass still walks and gives its key back, where
 * the other order could leave a key naming nothing for a year.
 */
export const forgetLink = async (store: KeyValueStore, token: string): Promise<void> => {
  if (!isLinkToken(token)) return;
  const link = await readLink(store, token);
  if (link !== null && link !== undefined && link.chatId !== null) {
    if ((await store.get(chatKey(link.chatId))) === token) await store.del(chatKey(link.chatId));
  }
  await store.del(linkKey(token));
  await store.srem(WATCHES_KEY, token);
};

/**
 * What `/stop` does to a chat's link: the link, its place in the set, and the
 * chat's key whatever it names — the chat asked for everything to go, and a
 * key left behind would be its id kept after it was told nothing is.
 */
export const forgetChatLink = async (store: KeyValueStore, chatId: number, token: string): Promise<void> => {
  await store.del(chatKey(chatId));
  await forgetLink(store, token);
};

export type Watch = { readonly token: string; readonly link: TelegramLink };

/**
 * Sets one claimed link against its chat's key, and answers the token it let
 * go, if any: this one or the other, whichever was the older of two links one
 * chat holds. `null` when both, or the one, are still to be followed.
 *
 * The key is written when it is missing — a link made before keys existed, or
 * a key that lapsed — or when it names something that is not this chat's link,
 * which is what a claim cut off halfway, or a forget that could not read its
 * link, leaves. Where it names another link of the same chat, the newer one
 * stays: the one the chat claimed last, and the one claiming it today would
 * have left.
 */
export const indexLink = async (store: KeyValueStore, token: string, link: TelegramLink): Promise<string | null> => {
  const chatId = link.chatId;
  if (chatId === null) return null;

  const indexed = await store.get(chatKey(chatId));
  /* Not answering is no reason to stop following anybody; the next pass asks again. */
  if (indexed === undefined) return null;

  if (indexed !== null && indexed !== token) {
    const other = await readLink(store, indexed);
    if (other === undefined) return null;
    if (other !== null && other.chatId === chatId) {
      const otherIsNewer = other.createdAt > link.createdAt || (other.createdAt === link.createdAt && indexed > token);
      if (otherIsNewer) {
        await forgetLink(store, token);
        return token;
      }
      await store.set(chatKey(chatId), token, CLAIMED_LINK_TTL_MS);
      await forgetLink(store, indexed);
      return indexed;
    }
  }

  /* Written on every visit, so the key lives as long as the link the pass keeps renewing. */
  await store.set(chatKey(chatId), token, CLAIMED_LINK_TTL_MS);
  return null;
};

/**
 * Reads the links a list of tokens names, dropping from the set any whose
 * record has expired or gone, so the set cannot grow with links that no
 * longer exist. A token whose read did not answer is passed over and kept.
 */
const readWatches = async (store: KeyValueStore, tokens: readonly string[]): Promise<Watch[]> => {
  const watches: Watch[] = [];
  for (const token of tokens) {
    const link = await readLink(store, token);
    if (link === undefined) continue;
    if (link === null || link.chatId === null) {
      await store.srem(WATCHES_KEY, token);
      continue;
    }
    watches.push({ token, link });
  }
  return watches;
};

/**
 * Up to `budget` members of a set, in a fixed order, starting after `after`
 * and coming round again from the start: what a pass takes so that every
 * member is reached within as many passes as the set is budgets long, however
 * the set changes meanwhile. `after` is the last member the previous pass
 * took — gone or not, its place in the order is still a place — and `null`
 * starts at `start`, a position the caller picks.
 */
export const rotation = (members: readonly string[], budget: number, after: string | null, start = 0): string[] => {
  const ordered = [...members].sort();
  if (ordered.length === 0) return [];
  const next = after === null ? start % ordered.length : ordered.findIndex((member) => member > after);
  const first = next === -1 ? 0 : next;
  const taken: string[] = [];
  for (let i = 0; i < Math.min(budget, ordered.length); i += 1) {
    taken.push(ordered[(first + i) % ordered.length] as string);
  }
  return taken;
};

/**
 * The links one pass reads: at most `budget` of them, the next in turn after
 * `after`, each set against its chat's key on the way (see `indexLink`). Also
 * how many tokens the set holds, and the last one taken, for the next pass to
 * start after. `null` when the set could not be read.
 */
export const watchesForPass = async (
  store: KeyValueStore,
  options: { readonly budget: number; readonly after: string | null; readonly start?: number },
): Promise<{ readonly total: number; readonly watches: readonly Watch[]; readonly last: string | null } | null> => {
  const tokens = await store.smembers(WATCHES_KEY);
  if (tokens === null) return null;

  const taken = rotation(tokens, options.budget, options.after, options.start);
  const read = await readWatches(store, taken);
  /* A link let go may be one already read this pass, as the older of two met in either order. */
  const letGo = new Set<string>();
  for (const watch of read) {
    if (letGo.has(watch.token)) continue;
    const dropped = await indexLink(store, watch.token, watch.link);
    if (dropped !== null) letGo.add(dropped);
  }
  return { total: tokens.length, watches: read.filter((watch) => !letGo.has(watch.token)), last: taken.at(-1) ?? options.after };
};

/**
 * Gives every link made before the chat keys one, once: walks the whole set —
 * the walk every pass made before there were keys — and leaves the mark that
 * ends the commands' fallback. Not marked when any link could not be read, so
 * the next pass tries again. `true` once the mark is there.
 */
export const buildChatIndex = async (store: KeyValueStore): Promise<boolean> => {
  const built = await store.get(CHAT_INDEX_BUILT_KEY);
  if (built === undefined) return false;
  if (built !== null) return true;

  const tokens = await store.smembers(WATCHES_KEY);
  if (tokens === null) return false;

  let complete = true;
  for (const token of tokens) {
    const link = await readLink(store, token);
    if (link === undefined) {
      complete = false;
      continue;
    }
    if (link === null || link.chatId === null) {
      await store.srem(WATCHES_KEY, token);
      continue;
    }
    await indexLink(store, token, link);
  }

  return complete && (await store.set(CHAT_INDEX_BUILT_KEY, "1"));
};

/**
 * The link a chat has claimed: its key, then the link the key names.
 *
 * Until a pass has given the links made before keys one of their own
 * (`buildChatIndex`), a chat with no key may still be one of them, and is
 * looked for the old way, by walking the set — and given its key when found.
 * After that, a chat with no key has no link, and costs one read to say so.
 *
 * A key naming something that is not this chat's link is deleted as it is
 * met: whatever it named is gone, or is a claim cut off halfway, which writes
 * the key again as it finishes.
 */
export const findByChat = async (store: KeyValueStore, chatId: number): Promise<Watch | null | undefined> => {
  const indexed = await store.get(chatKey(chatId));
  if (indexed === undefined) return undefined;

  if (indexed !== null) {
    const link = await readLink(store, indexed);
    if (link === undefined) return undefined;
    if (link !== null && link.chatId === chatId) return { token: indexed, link };
    await store.del(chatKey(chatId));
  }

  const built = await store.get(CHAT_INDEX_BUILT_KEY);
  if (built === undefined) return undefined;
  if (built !== null) return null;

  const tokens = await store.smembers(WATCHES_KEY);
  if (tokens === null) return undefined;
  const found = (await readWatches(store, tokens)).find((watch) => watch.link.chatId === chatId) ?? null;
  if (found !== null) await store.set(chatKey(chatId), found.token, CLAIMED_LINK_TTL_MS);
  return found;
};
