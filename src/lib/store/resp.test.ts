import { describe, expect, it } from "vitest";

import { decodeReply, encodeCommand, type RespReply } from "./resp";

const decode = (text: string) => decodeReply(Buffer.from(text, "utf8"));
const reply = (text: string): RespReply => {
  const decoded = decode(text);
  if (decoded === "incomplete" || decoded === "invalid") throw new Error(decoded);
  return decoded.reply;
};

describe("encodeCommand", () => {
  it("writes an array of bulk strings", () => {
    expect(encodeCommand(["GET", "k"]).toString()).toBe("*2\r\n$3\r\nGET\r\n$1\r\nk\r\n");
  });

  it("counts bytes rather than characters", () => {
    /* One character, three bytes: a length of 1 would desynchronise the stream. */
    expect(encodeCommand(["SET", "k", "☃"]).toString()).toContain("$3\r\n☃\r\n");
  });

  it("writes an empty argument as a zero-length bulk string", () => {
    expect(encodeCommand(["ECHO", ""]).toString()).toBe("*2\r\n$4\r\nECHO\r\n$0\r\n\r\n");
  });
});

describe("decodeReply", () => {
  it("reads each of the five kinds", () => {
    expect(reply("+OK\r\n")).toEqual({ kind: "string", value: "OK" });
    expect(reply("-ERR no\r\n")).toEqual({ kind: "error", message: "ERR no" });
    expect(reply(":42\r\n")).toEqual({ kind: "integer", value: 42 });
    expect(reply("$5\r\nhello\r\n")).toEqual({ kind: "string", value: "hello" });
    expect(reply("*1\r\n:7\r\n")).toEqual({ kind: "array", values: [{ kind: "integer", value: 7 }] });
  });

  it("reads both nulls as the same absence", () => {
    expect(reply("$-1\r\n")).toEqual({ kind: "null" });
    expect(reply("*-1\r\n")).toEqual({ kind: "null" });
  });

  it("reads an empty bulk string and an empty array", () => {
    expect(reply("$0\r\n\r\n")).toEqual({ kind: "string", value: "" });
    expect(reply("*0\r\n")).toEqual({ kind: "array", values: [] });
  });

  it("reads a bulk string that contains a CRLF of its own", () => {
    expect(reply("$4\r\na\r\nb\r\n")).toEqual({ kind: "string", value: "a\r\nb" });
  });

  it("reports how many bytes it used, so the next reply can be found", () => {
    const decoded = decodeReply(Buffer.from("+OK\r\n:1\r\n"));
    if (decoded === "incomplete" || decoded === "invalid") throw new Error(decoded);

    expect(decoded.next).toBe(5);
    expect(decodeReply(Buffer.from("+OK\r\n:1\r\n"), decoded.next)).toMatchObject({
      reply: { kind: "integer", value: 1 },
    });
  });

  it("waits for more bytes rather than guessing", () => {
    expect(decode("")).toBe("incomplete");
    expect(decode("+OK")).toBe("incomplete");
    expect(decode("$5\r\nhel")).toBe("incomplete");
    /* The body has arrived but its trailing CRLF has not. */
    expect(decode("$5\r\nhello")).toBe("incomplete");
    expect(decode("*2\r\n:1\r\n")).toBe("incomplete");
  });

  it("calls a stream that is not RESP invalid rather than reading past it", () => {
    expect(decode("hello\r\n")).toBe("invalid");
    expect(decode("$abc\r\n")).toBe("invalid");
    expect(decode("*abc\r\n")).toBe("invalid");
    expect(decode(":abc\r\n")).toBe("invalid");
  });

  it("refuses an integer it cannot hold exactly", () => {
    expect(decode(":9007199254740993\r\n")).toBe("invalid");
    expect(reply(":9007199254740991\r\n")).toEqual({ kind: "integer", value: 9_007_199_254_740_991 });
  });

  it("reads a nested array, as SMEMBERS of a set of sets would answer", () => {
    expect(reply("*2\r\n$1\r\na\r\n*1\r\n:2\r\n")).toEqual({
      kind: "array",
      values: [
        { kind: "string", value: "a" },
        { kind: "array", values: [{ kind: "integer", value: 2 }] },
      ],
    });
  });
});
