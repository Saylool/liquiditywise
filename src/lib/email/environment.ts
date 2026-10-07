import "server-only";

import type { KeyValueStore } from "../store/keyValueStore";
import { openStore } from "../store/openStore";
import { createResendProvider, type EmailProvider } from "./provider";

/*
 * What a deployment needs to send the Monday digest by e-mail, read from the
 * environment.
 *
 * Optional as a whole, like Telegram: with nothing configured the form says
 * the digest by e-mail is not set up here, and nothing else differs. Read per
 * call rather than captured at module load, and named one by one, so a
 * misspelled variable is a compile error rather than a feature that silently
 * never exists.
 *
 * Three things, and all three or none: the provider's key, the sender it
 * sends as, and the secret the links are signed under. A key without a
 * secret could send a confirmation whose link nothing could verify; a secret
 * without a key could verify a link no mail ever carried. And the store the
 * records live in, which is the same store as the Telegram links'.
 */

export type EmailEnvironment = {
  readonly RESEND_API_KEY?: string | undefined;
  readonly EMAIL_FROM?: string | undefined;
  readonly EMAIL_DIGEST_SECRET?: string | undefined;
  readonly REDIS_URL?: string | undefined;
  readonly UPSTASH_REDIS_REST_URL?: string | undefined;
  readonly UPSTASH_REDIS_REST_TOKEN?: string | undefined;
};

export type EmailDigestSetup = {
  readonly store: KeyValueStore;
  readonly provider: EmailProvider;
  /** What every confirmation and unsubscribe link is signed under. Never leaves the server. */
  readonly secret: string;
};

const present = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === "" ? null : trimmed;
};

/** Every piece, or `null`: a half-configured setup must not look like a working one. */
export const emailDigestSetupFrom = (environment: EmailEnvironment): EmailDigestSetup | null => {
  const apiKey = present(environment.RESEND_API_KEY);
  const from = present(environment.EMAIL_FROM);
  const secret = present(environment.EMAIL_DIGEST_SECRET);
  const store = openStore(environment);

  if (!apiKey || !from || !secret || store === null) return null;

  return { store, provider: createResendProvider({ apiKey, from }), secret };
};

const fromProcess = (): EmailEnvironment => ({
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_DIGEST_SECRET: process.env.EMAIL_DIGEST_SECRET,
  REDIS_URL: process.env.REDIS_URL,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export const emailDigestSetup = (): EmailDigestSetup | null => emailDigestSetupFrom(fromProcess());

/**
 * Whether the form is worth showing: the pages ask this and nothing more, so
 * no page holds a provider or a secret it has no use for.
 */
export const emailDigestOffered = (): boolean => emailDigestSetup() !== null;
