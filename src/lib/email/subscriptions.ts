import { createHmac } from "node:crypto";
import { z } from "zod";

import { IsoTimestampSchema } from "../../schemas/primitives";
import { type ChainId, isSupportedChainId } from "../chains/chains";
import { isLocale, type Locale } from "../i18n/locales";
import type { KeyValueStore } from "../store/keyValueStore";
import { CONFIRM_TOKEN_TTL_MS } from "./signedToken";

/*
 * What this application keeps about a reader who asked for the Monday digest
 * by e-mail, and for how long.
 *
 * Beside the Telegram links (telegram/links.ts) it is the only other thing
 * kept about anybody, so again it is worth saying exactly: the address the
 * digest goes to, the network it is about, the language it is written in,
 * when the address was confirmed, and when the last digest went out. No name,
 * no IP address, no time of asking, nothing about which pages were read. The
 * two timestamps are what the sending needs — one to know the address is
 * confirmed at all, one to send once a week and not once a pass.
 *
 * **One record per address.** The record's id is not random, as a Telegram
 * token is, but an HMAC of the lowercased address under the server's secret
 * (EMAIL_DIGEST_SECRET), so the same address asked for twice is one record
 * and one digest a week, however many times the form is sent. The id is what
 * every link carries and what a log would show, and it says nothing about the
 * address to anyone without the secret.
 *
 * **Nothing confirmed can be changed from the form.** The form takes an
 * address anybody can type. Were it allowed to rewrite a confirmed record, a
 * stranger could switch a subscriber's network or language with one request;
 * so a request for an address that is already confirmed writes nothing and
 * sends nothing, and the form says the same thing either way. To change the
 * network a subscriber unsubscribes — the link is in every digest — and asks
 * again.
 *
 * **A pending record lives a day**, the life of the link that confirms it;
 * unconfirmed, it expires with nothing to delete. A confirmed one lives until
 * the reader unsubscribes, or for a year without a digest reaching it — each
 * send renews that year — so a deployment that stopped sending would not hold
 * addresses for ever.
 *
 * Under `liquiditywise:email:`, which the daily backup copies beside the
 * links (backup/storeBackup.ts), so the same promise holds: unsubscribing
 * deletes the record from the server at once, and it drops out of the
 * encrypted backups within seven days.
 */

export const EMAIL_PREFIX = "liquiditywise:email:";

/** The set of ids whose addresses are confirmed: what the sender walks and the weekly report counts. */
export const CONFIRMED_KEY = `${EMAIL_PREFIX}confirmed`;

export const PENDING_SUBSCRIPTION_TTL_MS = CONFIRM_TOKEN_TTL_MS;
export const CONFIRMED_SUBSCRIPTION_TTL_MS = 365 * 24 * 60 * 60 * 1_000;

/** The longest address the mail standards allow; anything longer is not one. */
const MAX_ADDRESS_LENGTH = 254;

/**
 * Whether something could be an address a digest can be sent to: one `@`,
 * something either side of it, a dot in the domain, no whitespace. The only
 * real test of an address is the confirmation that reaches it.
 */
export const isEmailAddress = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= MAX_ADDRESS_LENGTH &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** The one form an address is kept in, so the same mailbox is one record whichever way it was typed. */
export const normalizeAddress = (address: string): string => address.trim().toLowerCase();

/** The record's id for an address: 22 characters of base64url, as a Telegram token is, and as signedToken.ts expects. */
export const subscriptionIdOf = (secret: string, address: string): string =>
  createHmac("sha256", secret).update(`email:${normalizeAddress(address)}`).digest().subarray(0, 16).toString("base64url");

const subscriptionKey = (id: string): string => `${EMAIL_PREFIX}sub:${id}`;

const SubscriptionSchema = z.object({
  address: z.string().refine(isEmailAddress),
  chainId: z.number().int().refine(isSupportedChainId),
  locale: z.string().refine(isLocale),
  confirmedAt: IsoTimestampSchema.nullable(),
  lastSentAt: IsoTimestampSchema.nullable(),
});

export type Subscription = {
  readonly address: string;
  readonly chainId: ChainId;
  readonly locale: Locale;
  /** `null` until the link in the confirmation e-mail has been opened. */
  readonly confirmedAt: string | null;
  /** When the last digest went out, or `null` before the first. */
  readonly lastSentAt: string | null;
};

/** A read that could not be made, as distinct from a record that is not there. */
export type SubscriptionRead = Subscription | null | undefined;

const parseSubscription = (raw: string): Subscription | null => {
  try {
    const parsed = SubscriptionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as Subscription) : null;
  } catch {
    return null;
  }
};

export const readSubscription = async (store: KeyValueStore, id: string): Promise<SubscriptionRead> => {
  const raw = await store.get(subscriptionKey(id));
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  return parseSubscription(raw);
};

const writeSubscription = (store: KeyValueStore, id: string, subscription: Subscription): Promise<boolean> =>
  store.set(
    subscriptionKey(id),
    JSON.stringify(subscription),
    subscription.confirmedAt === null ? PENDING_SUBSCRIPTION_TTL_MS : CONFIRMED_SUBSCRIPTION_TTL_MS,
  );

export type RequestOutcome = "pending" | "already-confirmed" | "unavailable";

/**
 * What the form does: writes a pending record for the address, to be
 * confirmed from the mailbox. An address already confirmed is left exactly as
 * it is (see above), and the caller sends nothing for it.
 */
export const requestSubscription = async (
  store: KeyValueStore,
  id: string,
  input: { readonly address: string; readonly chainId: ChainId; readonly locale: Locale },
): Promise<RequestOutcome> => {
  const existing = await readSubscription(store, id);
  if (existing === undefined) return "unavailable";
  if (existing !== null && existing.confirmedAt !== null) return "already-confirmed";

  const written = await writeSubscription(store, id, {
    address: normalizeAddress(input.address),
    chainId: input.chainId,
    locale: input.locale,
    confirmedAt: null,
    lastSentAt: null,
  });
  return written ? "pending" : "unavailable";
};

export type ConfirmOutcome =
  | { readonly status: "confirmed" | "already-confirmed"; readonly subscription: Subscription }
  | { readonly status: "unknown" | "unavailable" };

/**
 * What the link in the confirmation e-mail does. `unknown` is a pending
 * record that has expired, or was never there: the link verified, but there
 * is nothing left to confirm, and the reader is asked to start again.
 */
export const confirmSubscription = async (store: KeyValueStore, id: string, now: Date): Promise<ConfirmOutcome> => {
  const existing = await readSubscription(store, id);
  if (existing === undefined) return { status: "unavailable" };
  if (existing === null) return { status: "unknown" };
  if (existing.confirmedAt !== null) return { status: "already-confirmed", subscription: existing };

  const confirmed: Subscription = { ...existing, confirmedAt: now.toISOString() };
  if (!(await writeSubscription(store, id, confirmed))) return { status: "unavailable" };
  if (!(await store.sadd(CONFIRMED_KEY, id))) return { status: "unavailable" };
  return { status: "confirmed", subscription: confirmed };
};

/**
 * Records that a digest went out, and answers the record as it now stands.
 * The write renews the record's year. Answered whether or not the write took,
 * as the Telegram pass does: the next pass reads the store again, and one
 * failed write is a second digest at worst, not a lost subscriber.
 */
export const recordDigestSent = async (
  store: KeyValueStore,
  id: string,
  subscription: Subscription,
  at: Date,
): Promise<Subscription> => {
  const next: Subscription = { ...subscription, lastSentAt: at.toISOString() };
  await writeSubscription(store, id, next);
  return next;
};

export type UnsubscribeOutcome = "removed" | "unknown" | "unavailable";

/**
 * What the link at the foot of every digest does: deletes the record and
 * takes the id out of the set, at once. `unknown` is a record already gone —
 * a link clicked twice — which the reader is told as "nothing is kept", since
 * that is what is true.
 */
export const unsubscribe = async (store: KeyValueStore, id: string): Promise<UnsubscribeOutcome> => {
  const existing = await readSubscription(store, id);
  if (existing === undefined) return "unavailable";

  /* The set first: a record that outlives its membership is never sent to; the reverse would be. */
  if (!(await store.srem(CONFIRMED_KEY, id))) return "unavailable";
  if (!(await store.del(subscriptionKey(id)))) return "unavailable";
  return existing === null ? "unknown" : "removed";
};

/**
 * Every confirmed subscription, or `null` when the set could not be read.
 *
 * An id in the set whose record has gone, or is somehow back to pending, is
 * dropped from the set as it is met, so the set counts what can be sent to
 * and nothing more.
 */
export const listConfirmed = async (
  store: KeyValueStore,
): Promise<readonly { readonly id: string; readonly subscription: Subscription }[] | null> => {
  const ids = await store.smembers(CONFIRMED_KEY);
  if (ids === null) return null;

  const confirmed: { id: string; subscription: Subscription }[] = [];
  for (const id of ids) {
    const subscription = await readSubscription(store, id);
    if (subscription === undefined) continue;
    if (subscription === null || subscription.confirmedAt === null) {
      await store.srem(CONFIRMED_KEY, id);
      continue;
    }
    confirmed.push({ id, subscription });
  }
  return confirmed;
};
