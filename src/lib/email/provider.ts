import type { FetchLike } from "../telegram/upstashKeyValue";

/*
 * The one call this application makes to send an e-mail, and the one question
 * it asks to see whether it still can.
 *
 * Resend's HTTP API, because it is one POST with a bearer key and nothing to
 * install. The key is the credential and is never logged, and nothing but a
 * boolean leaves `sendEmail`: a message that could not be sent is a message
 * that could not be sent, and the sender moves on to the next address — the
 * same contract the Telegram client keeps (telegram/botApi.ts), for the same
 * reason. Every send carries a timeout, so one slow provider cannot hold the
 * scheduled pass that sends on Monday.
 *
 * Both halves are written against the provider's documented shape rather than
 * its SDK: the SDK would be a dependency for two requests, and a version of it
 * that changed what it logs would be a version that might log the key.
 */

export const RESEND_API_BASE_URL = "https://api.resend.com";

/** Ten seconds. A provider that has not taken a message by then is not going to. */
export const DEFAULT_EMAIL_TIMEOUT_MS = 10_000;

export type EmailMessage = {
  readonly to: string;
  readonly subject: string;
  /** The plain-text body: what a reader without HTML, or a screen reader, gets. */
  readonly text: string;
  readonly html: string;
  /** Headers on the message itself, such as `List-Unsubscribe`. */
  readonly headers?: Readonly<Record<string, string>>;
};

/** True when the provider accepted the message; false for anything else, said nowhere else. */
export type SendEmail = (message: EmailMessage) => Promise<boolean>;

export type EmailProvider = {
  readonly sendEmail: SendEmail;
  /**
   * Whether the key still works, as the HTTP status of the cheapest request
   * that proves it — for the health check, which reads 401 and 403 as the
   * credential and everything else as the provider (health/upstreamProbe.ts).
   */
  readonly probe: () => Promise<number>;
};

export type ResendOptions = {
  readonly apiKey: string;
  /** The sender, as the provider wants it: `Name <digest@example.com>` or a bare address, on a domain verified there. */
  readonly from: string;
  readonly fetchImpl?: FetchLike;
  readonly timeoutMs?: number;
  readonly baseUrl?: string;
};

const withTimeout = async <T>(timeoutMs: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
};

export const createResendProvider = ({
  apiKey,
  from,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_EMAIL_TIMEOUT_MS,
  baseUrl = RESEND_API_BASE_URL,
}: ResendOptions): EmailProvider => ({
  sendEmail: async (message) => {
    try {
      const response = await withTimeout(timeoutMs, (signal) =>
        fetchImpl(`${baseUrl}/emails`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          cache: "no-store",
          body: JSON.stringify({
            from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            html: message.html,
            ...(message.headers === undefined ? {} : { headers: message.headers }),
          }),
          signal,
        }),
      );
      if (!response.ok) return false;

      /* Accepted means an id came back; a 200 with anything else is not a message on its way. */
      const payload: unknown = await response.json().catch(() => null);
      return typeof payload === "object" && payload !== null && typeof (payload as { id?: unknown }).id === "string";
    } catch {
      return false;
    }
  },
  /* The domain list: the smallest read the key authorises, and one that asks nothing of any mailbox. */
  probe: async () => {
    try {
      const response = await withTimeout(timeoutMs, (signal) =>
        fetchImpl(`${baseUrl}/domains`, {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}` },
          cache: "no-store",
          signal,
        }),
      );
      return response.status;
    } catch {
      return 0;
    }
  },
});
