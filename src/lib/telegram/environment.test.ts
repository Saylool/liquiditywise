import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { publicBotFrom, type TelegramEnvironment } from "./environment";

const WORKING: TelegramEnvironment = {
  TELEGRAM_BOT_TOKEN: "token",
  TELEGRAM_BOT_USERNAME: "@LiquidityWiseBot",
  TELEGRAM_WEBHOOK_SECRET: "secret",
  CRON_SECRET: "cron",
  REDIS_URL: "redis://127.0.0.1:6379/1",
};

describe("the bot the site may point at", () => {
  it("is the handle, without the @, and its t.me link, where alerts are fully set up", () => {
    expect(publicBotFrom(WORKING)).toEqual({ username: "LiquidityWiseBot", url: "https://t.me/LiquidityWiseBot" });
  });

  it("is none for any half-configured setup, so the site never advertises a bot that cannot answer", () => {
    for (const missing of ["TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_USERNAME", "TELEGRAM_WEBHOOK_SECRET", "CRON_SECRET", "REDIS_URL"] as const) {
      expect(publicBotFrom({ ...WORKING, [missing]: "" }), missing).toBeNull();
    }
    expect(publicBotFrom({})).toBeNull();
  });

  it("works with the REST store as well as a Redis of its own", () => {
    expect(publicBotFrom({ ...WORKING, REDIS_URL: undefined, UPSTASH_REDIS_REST_URL: "https://x.example", UPSTASH_REDIS_REST_TOKEN: "t" })?.username).toBe("LiquidityWiseBot");
  });
});
