import { describe, expect, it } from "vitest";

import { readCommand, TelegramUpdateSchema } from "./update";

describe("readCommand", () => {
  it("reads /start with its token", () => {
    expect(readCommand("/start abcDEF123456789012_-xy")).toEqual({
      kind: "start",
      argument: "abcDEF123456789012_-xy",
    });
  });

  it("reads /start without one", () => {
    expect(readCommand("/start")).toEqual({ kind: "start", argument: null });
    expect(readCommand("  /start  ")).toEqual({ kind: "start", argument: null });
  });

  it("reads /stop, with or without the bot's name", () => {
    expect(readCommand("/stop")).toEqual({ kind: "stop" });
    expect(readCommand("/stop@SomeBot")).toEqual({ kind: "stop" });
    expect(readCommand("/STOP")).toEqual({ kind: "stop" });
  });

  it("calls any other command other, and plain text no command", () => {
    expect(readCommand("/help")).toEqual({ kind: "other" });
    expect(readCommand("hello")).toBeNull();
    expect(readCommand(undefined)).toBeNull();
    expect(readCommand("/start too many words")).toBeNull();
  });
});

describe("TelegramUpdateSchema", () => {
  it("reads a private text message and ignores what it does not need", () => {
    const parsed = TelegramUpdateSchema.safeParse({
      update_id: 1,
      message: {
        message_id: 5,
        date: 1,
        chat: { id: 42, type: "private", first_name: "x" },
        from: { id: 42, is_bot: false, language_code: "tr" },
        text: "/start abc",
        entities: [{ type: "bot_command" }],
      },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.message?.chat.id).toBe(42);
      expect(parsed.data.message?.from?.language_code).toBe("tr");
    }
  });

  it("accepts an update that is not a message at all", () => {
    expect(TelegramUpdateSchema.safeParse({ update_id: 2, edited_message: {} }).success).toBe(true);
  });

  it("refuses an update without an id", () => {
    expect(TelegramUpdateSchema.safeParse({ message: {} }).success).toBe(false);
  });
});
