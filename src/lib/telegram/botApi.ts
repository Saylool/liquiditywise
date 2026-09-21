import type { FetchLike } from "./upstashKeyValue";

/*
 * The two calls this application makes to Telegram's Bot API.
 *
 * The bot token is part of the URL — that is how the API is shaped — so the
 * URL is a credential and is never logged. Both calls return a boolean rather
 * than throwing: a message that could not be sent is a message that could not
 * be sent, and the checker moves on to the next.
 */

export const TELEGRAM_API_BASE_URL = "https://api.telegram.org";

export const DEFAULT_BOT_TIMEOUT_MS = 5_000;

export type BotClient = {
  readonly sendMessage: (chatId: number, text: string) => Promise<boolean>;
};

export type BotClientOptions = {
  readonly token: string;
  readonly fetchImpl?: FetchLike;
  readonly timeoutMs?: number;
  readonly baseUrl?: string;
};

const call = async (
  { token, fetchImpl = fetch, timeoutMs = DEFAULT_BOT_TIMEOUT_MS, baseUrl = TELEGRAM_API_BASE_URL }: BotClientOptions,
  method: string,
  body: Record<string, unknown>,
): Promise<boolean> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) return false;

    const payload: unknown = await response.json();
    return typeof payload === "object" && payload !== null && (payload as { ok?: unknown }).ok === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

export const createBotClient = (options: BotClientOptions): BotClient => ({
  /*
   * Plain text, no parse mode. A token symbol can contain the characters
   * Markdown reads as formatting, and a message refused for a stray
   * underscore would be an alert that never arrived.
   */
  sendMessage: (chatId, text) =>
    call(options, "sendMessage", { chat_id: chatId, text, disable_web_page_preview: true }),
});

/** Points Telegram at this deployment's webhook, with the secret it must present. */
export const setWebhook = (
  options: BotClientOptions,
  input: { readonly url: string; readonly secret: string },
): Promise<boolean> =>
  call(options, "setWebhook", {
    url: input.url,
    secret_token: input.secret,
    allowed_updates: ["message"],
  });
