import { describe, expect, it } from "vitest";

import { createBotClient, setWebhook } from "./botApi";
import type { FetchLike } from "./upstashKeyValue";

const answering = (payload: unknown, status = 200) => {
  const calls: { url: string; body: unknown }[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(payload), { status });
  };
  return { fetchImpl, calls };
};

describe("the bot client", () => {
  it("sends plain text to the chat, with previews off", async () => {
    const { fetchImpl, calls } = answering({ ok: true });
    const sent = await createBotClient({ token: "123:abc", fetchImpl }).sendMessage(42, "hello_there");

    expect(sent).toBe(true);
    expect(calls).toEqual([
      {
        url: "https://api.telegram.org/bot123:abc/sendMessage",
        body: { chat_id: 42, text: "hello_there", disable_web_page_preview: true },
      },
    ]);
    expect(JSON.stringify(calls[0]?.body)).not.toContain("parse_mode");
  });

  it("reports a refusal, an error status and a failed request all as not sent", async () => {
    expect(await createBotClient({ token: "t", fetchImpl: answering({ ok: false }).fetchImpl }).sendMessage(1, "x")).toBe(false);
    expect(await createBotClient({ token: "t", fetchImpl: answering({ ok: true }, 403).fetchImpl }).sendMessage(1, "x")).toBe(false);
    expect(
      await createBotClient({
        token: "t",
        fetchImpl: async () => {
          throw new Error("offline");
        },
      }).sendMessage(1, "x"),
    ).toBe(false);
  });

  it("registers the webhook with the secret and only message updates", async () => {
    const { fetchImpl, calls } = answering({ ok: true });
    expect(await setWebhook({ token: "t", fetchImpl }, { url: "https://example.test/api/telegram/webhook", secret: "s" })).toBe(true);
    expect(calls[0]).toEqual({
      url: "https://api.telegram.org/bott/setWebhook",
      body: { url: "https://example.test/api/telegram/webhook", secret_token: "s", allowed_updates: ["message"] },
    });
  });
});
