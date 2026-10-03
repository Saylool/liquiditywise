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
 */

const PREFIX = "liquiditywise:telegram:";

/** The cookie that remembers which link this browser minted, so the page can say how it stands. */
export const TELEGRAM_LINK_COOKIE = "telegram";

/** The set of tokens whose links have been claimed: what the checker walks. */
export const WATCHES_KEY = `${PREFIX}watches`;

export const PENDING_LINK_TTL_MS = 30 * 60 * 1_000;
export const CLAIMED_LINK_TTL_MS = 365 * 24 * 60 * 60 * 1_000;

const linkKey = (token: string): string => `${PREFIX}link:${token}`;

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

export type ClaimOutcome = "claimed" | "unknown" | "already-claimed" | "unavailable";

/**
 * Ties a chat to the link its token names.
 *
 * A token that has already been claimed is refused: the first chat to present
 * it is the one that clicked the button, and a second is somebody else who
 * saw the link. `unavailable` is the store not answering, which the caller
 * should say differently from "no such link".
 */
export const claimLink = async (
  store: KeyValueStore,
  token: string,
  chatId: number,
): Promise<ClaimOutcome> => {
  const link = await readLink(store, token);
  if (link === undefined) return "unavailable";
  if (link === null) return "unknown";
  if (link.chatId !== null) return link.chatId === chatId ? "claimed" : "already-claimed";

  const written = await writeLink(store, token, { ...link, chatId });
  if (!written) return "unavailable";

  await store.sadd(WATCHES_KEY, token);
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

/** Removes a link and takes it out of the checker's set, whichever side asked. */
export const forgetLink = async (store: KeyValueStore, token: string): Promise<void> => {
  if (!isLinkToken(token)) return;
  await store.del(linkKey(token));
  await store.srem(WATCHES_KEY, token);
};

/**
 * Every claimed link, or `null` when the set could not be read.
 *
 * A token in the set whose record has expired or gone is dropped from the set
 * as it is met, so the set cannot grow with links that no longer exist.
 */
export const listWatches = async (
  store: KeyValueStore,
): Promise<readonly { readonly token: string; readonly link: TelegramLink }[] | null> => {
  const tokens = await store.smembers(WATCHES_KEY);
  if (tokens === null) return null;

  const watches: { token: string; link: TelegramLink }[] = [];
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
 * The chat that has claimed a token, found by walking the set.
 *
 * Only `/stop` needs this — a chat has no token of its own — and the set is
 * the size of the number of people who linked, so a walk is the honest cost.
 */
export const findByChat = async (
  store: KeyValueStore,
  chatId: number,
): Promise<{ readonly token: string; readonly link: TelegramLink } | null | undefined> => {
  const watches = await listWatches(store);
  if (watches === null) return undefined;

  return watches.find((watch) => watch.link.chatId === chatId) ?? null;
};
