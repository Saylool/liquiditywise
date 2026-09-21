/*
 * The one-time token that ties a browser to a Telegram chat.
 *
 * The site cannot message a person; only the bot can, and only after that
 * person has opened a chat with it. So the link runs the other way: the site
 * mints a token, the reader carries it to the bot inside a `t.me/…?start=`
 * link, and the bot hands it back with the chat it arrived from. Whoever
 * presents the token is whoever clicked the button.
 *
 * Sixteen random bytes, base64url: 22 characters, none of which Telegram's
 * `start` parameter refuses (it allows `[A-Za-z0-9_-]`, at most 64).
 */

export const LINK_TOKEN_BYTES = 16;

/** What a token looks like on the way back in, before the store is asked. */
const LINK_TOKEN = /^[A-Za-z0-9_-]{22}$/;

export const isLinkToken = (value: unknown): value is string =>
  typeof value === "string" && LINK_TOKEN.test(value);

/** Fills a buffer with randomness. Injected so a test can make the token predictable. */
export type RandomBytes = (length: number) => Uint8Array;

const webCryptoRandom: RandomBytes = (length) =>
  globalThis.crypto.getRandomValues(new Uint8Array(length));

export const newLinkToken = (randomBytes: RandomBytes = webCryptoRandom): string => {
  const bytes = randomBytes(LINK_TOKEN_BYTES);
  const base64 = btoa(String.fromCharCode(...bytes));

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
