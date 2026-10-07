import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * The link a reader clicks to confirm a subscription, or to end one.
 *
 * E-mail has no equivalent of the Telegram button: the site cannot be handed
 * anything back by the reader's mail client. So the link carries proof by
 * itself — the subscription's id, what the link is for, how long it is good
 * for, and a signature over all three under a secret only the server holds.
 * A link that was not made here does not verify; one made for confirming
 * does not unsubscribe; one past its hour does nothing. Nothing is looked up
 * to decide any of that, so a forged link costs the store no read.
 *
 * A confirmation lasts a day: long enough for a mail delivered to the wrong
 * folder, short enough that an address nobody confirmed is forgotten with the
 * pending record (subscriptions.ts). An unsubscribe link never expires — it
 * sits at the foot of every digest, and the one in a digest from last spring
 * has to work as well as the one from this morning.
 *
 * Base64url throughout, so the token survives a URL, a mail client and a
 * copy-paste without being re-encoded into something that no longer verifies.
 * The signature is compared in constant time: its sixteen bytes are not a
 * secret, but a comparison that stopped at the first wrong byte would let a
 * caller build a valid one by timing.
 */

export type TokenPurpose = "confirm" | "unsubscribe";

/** A day. What the confirmation link, and the pending record it points at, are good for. */
export const CONFIRM_TOKEN_TTL_MS = 24 * 60 * 60 * 1_000;

export type TokenClaims = {
  readonly purpose: TokenPurpose;
  readonly id: string;
  /** Milliseconds since the epoch, or `null` for a link that never expires. */
  readonly expiresAtMs: number | null;
};

/** Half of SHA-256, as base64url: 22 characters, and far more than a link can be guessed in. */
const SIGNATURE_BYTES = 16;

const base64url = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64url");

/** What is signed: the three claims, in an order the verifier rebuilds exactly. */
const payloadOf = ({ purpose, id, expiresAtMs }: TokenClaims): string =>
  `${purpose}:${id}:${expiresAtMs === null ? "-" : String(expiresAtMs)}`;

const signatureOf = (secret: string, payload: string): Uint8Array =>
  new Uint8Array(createHmac("sha256", secret).update(payload).digest().subarray(0, SIGNATURE_BYTES));

/** A token for `claims`, under `secret`. The id is the caller's; see subscriptions.ts for what it is. */
export const signToken = (secret: string, claims: TokenClaims): string => {
  const payload = payloadOf(claims);
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${base64url(signatureOf(secret, payload))}`;
};

/** What the subscription's id looks like, before anything is signed or looked up (see subscriptions.ts). */
const ID = /^[A-Za-z0-9_-]{22}$/;

const BASE64URL = /^[A-Za-z0-9_-]+$/;

/**
 * The claims a token carries, when it verifies for `purpose` under `secret`
 * at `now`; `null` for anything else — malformed, tampered with, signed for
 * the other purpose, under another secret, or expired. One answer for every
 * failure on purpose: a caller has nothing to say to a bad link but that it
 * is bad, and telling a forger *which* check failed would only help.
 */
export const verifyToken = (secret: string, token: unknown, purpose: TokenPurpose, now: Date): TokenClaims | null => {
  if (typeof token !== "string" || secret.length === 0) return null;
  const [encoded, signature, ...rest] = token.split(".");
  if (encoded === undefined || signature === undefined || rest.length > 0) return null;
  /* One spelling per token: a decoder that forgave padding or stray characters would make several. */
  if (!BASE64URL.test(encoded) || !BASE64URL.test(signature)) return null;

  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const [, id, expiry, ...more] = payload.split(":");
  if (id === undefined || expiry === undefined || more.length > 0) return null;
  if (!ID.test(id)) return null;

  const expiresAtMs = expiry === "-" ? null : /^\d{1,15}$/.test(expiry) ? Number(expiry) : NaN;
  if (Number.isNaN(expiresAtMs)) return null;

  /*
   * Rebuilt from the purpose asked for and what was read, never from the
   * payload as sent: the signature is over the rebuilt payload, so a token
   * signed for the other purpose, or spelled differently, has the wrong
   * signature — which is why the purpose it claims is not compared at all.
   */
  const claims: TokenClaims = { purpose, id, expiresAtMs };
  const expected = signatureOf(secret, payloadOf(claims));
  const presented = new Uint8Array(Buffer.from(signature, "base64url"));
  if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) return null;

  if (expiresAtMs !== null && now.getTime() >= expiresAtMs) return null;
  return claims;
};
