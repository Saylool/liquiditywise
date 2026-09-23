import { z } from "zod";

import { EvmAddressSchema, IsoTimestampSchema } from "../../schemas/primitives";
import { isLocale, type Locale } from "../i18n/locales";
import { isLinkToken } from "./linkToken";
import type { PositionSnapshot } from "./positionChanges";
import type { KeyValueStore } from "../store/keyValueStore";

/*
 * What this application keeps about a Telegram link, and for how long.
 *
 * It is the one thing this application stores about anybody, so it is worth
 * saying exactly: an Ethereum address the reader typed, the language they
 * were reading in, the numeric id of the Telegram chat that presented the
 * token, and — once the checker has run — whether each of the address's
 * positions was inside its range last time. No name, no username, no message.
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
  snapshot: z.record(z.string(), z.boolean().nullable()).nullable(),
});

export type TelegramLink = {
  readonly address: string;
  readonly locale: Locale;
  /** `null` until the bot has been handed the token from a chat. */
  readonly chatId: number | null;
  readonly createdAt: string;
  /** What the checker saw last time, or `null` before its first run. */
  readonly snapshot: PositionSnapshot | null;
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
  input: { readonly address: string; readonly locale: Locale; readonly now: Date },
): Promise<boolean> =>
  writeLink(store, token, {
    address: input.address,
    locale: input.locale,
    chatId: null,
    createdAt: input.now.toISOString(),
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

/** Records what the checker saw, so the next run has something to compare with. */
export const recordSnapshot = async (
  store: KeyValueStore,
  token: string,
  link: TelegramLink,
  snapshot: PositionSnapshot,
): Promise<boolean> => writeLink(store, token, { ...link, snapshot });

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
