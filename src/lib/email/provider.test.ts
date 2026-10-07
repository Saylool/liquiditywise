import { describe, expect, it } from "vitest";

import type { FetchLike } from "../telegram/upstashKeyValue";
import { createResendProvider, DEFAULT_EMAIL_TIMEOUT_MS } from "./provider";

const answering = (payload: unknown, status = 200) => {
  const calls: { url: string; method: string | undefined; headers: Record<string, string>; body: unknown }[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({
      url,
      method: init.method,
      headers: init.headers as Record<string, string>,
      body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
    });
    return new Response(JSON.stringify(payload), { status });
  };
  return { fetchImpl, calls };
};

const MESSAGE = {
  to: "reader@example.com",
  subject: "The week",
  text: "plain",
  html: "<p>plain</p>",
  headers: { "List-Unsubscribe": "<https://liquiditywise.com/weekly/unsubscribe?token=t>" },
};

describe("sending through Resend", () => {
  it("posts the message as the provider wants it, with the key as a bearer header and the headers on the message", async () => {
    const { fetchImpl, calls } = answering({ id: "msg_1" });

    const sent = await createResendProvider({ apiKey: "re_key", from: "LiquidityWise <digest@liquiditywise.com>", fetchImpl }).sendEmail(MESSAGE);

    expect(sent).toBe(true);
    expect(calls).toEqual([
      {
        url: "https://api.resend.com/emails",
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer re_key" },
        body: {
          from: "LiquidityWise <digest@liquiditywise.com>",
          to: ["reader@example.com"],
          subject: "The week",
          text: "plain",
          html: "<p>plain</p>",
          headers: MESSAGE.headers,
        },
      },
    ]);
  });

  it("sends no headers field when the message carries none", async () => {
    const { fetchImpl, calls } = answering({ id: "msg_1" });
    const bare = { to: MESSAGE.to, subject: MESSAGE.subject, text: MESSAGE.text, html: MESSAGE.html };

    await createResendProvider({ apiKey: "k", from: "a@b.co", fetchImpl }).sendEmail(bare);

    expect(calls[0]?.body).not.toHaveProperty("headers");
  });

  it("reports a refusal, an error status, an answer with no id and a failed request all as not sent", async () => {
    const provider = (fetchImpl: FetchLike) => createResendProvider({ apiKey: "k", from: "a@b.co", fetchImpl });

    expect(await provider(answering({ message: "invalid" }, 422).fetchImpl).sendEmail(MESSAGE)).toBe(false);
    expect(await provider(answering({ id: "x" }, 401).fetchImpl).sendEmail(MESSAGE)).toBe(false);
    expect(await provider(answering({ ok: true }).fetchImpl).sendEmail(MESSAGE)).toBe(false);
    expect(
      await provider(async () => {
        throw new Error("offline");
      }).sendEmail(MESSAGE),
    ).toBe(false);
  });

  it("gives up on a provider that does not answer in time", async () => {
    const fetchImpl: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });

    const sent = await createResendProvider({ apiKey: "k", from: "a@b.co", fetchImpl, timeoutMs: 5 }).sendEmail(MESSAGE);

    expect(sent).toBe(false);
    expect(DEFAULT_EMAIL_TIMEOUT_MS).toBe(10_000);
  });

  it("never puts the key anywhere but the Authorization header", async () => {
    const { fetchImpl, calls } = answering({ id: "msg_1" });

    await createResendProvider({ apiKey: "re_secret", from: "a@b.co", fetchImpl }).sendEmail(MESSAGE);

    expect(calls[0]?.url).not.toContain("re_secret");
    expect(JSON.stringify(calls[0]?.body)).not.toContain("re_secret");
  });
});

describe("probing Resend", () => {
  it("asks for the domains with the key, and answers the status alone", async () => {
    const { fetchImpl, calls } = answering([], 200);

    expect(await createResendProvider({ apiKey: "re_key", from: "a@b.co", fetchImpl }).probe()).toBe(200);
    expect(calls).toEqual([{ url: "https://api.resend.com/domains", method: "GET", headers: { Authorization: "Bearer re_key" }, body: undefined }]);
  });

  it("passes a refusal through as its status, and a failed request as 0", async () => {
    expect(await createResendProvider({ apiKey: "k", from: "a@b.co", fetchImpl: answering({}, 401).fetchImpl }).probe()).toBe(401);
    expect(
      await createResendProvider({
        apiKey: "k",
        from: "a@b.co",
        fetchImpl: async () => {
          throw new Error("offline");
        },
      }).probe(),
    ).toBe(0);
  });
});
