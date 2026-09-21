import { describe, expect, it } from "vitest";

import { isLinkToken, LINK_TOKEN_BYTES, newLinkToken } from "./linkToken";

describe("link tokens", () => {
  it("are 22 characters Telegram's start parameter accepts", () => {
    for (let i = 0; i < 50; i += 1) {
      const token = newLinkToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(isLinkToken(token)).toBe(true);
    }
  });

  it("use every byte of randomness they ask for", () => {
    let asked = 0;
    newLinkToken((length) => {
      asked = length;
      return new Uint8Array(length);
    });
    expect(asked).toBe(LINK_TOKEN_BYTES);
  });

  it("write the URL-safe alphabet, never + or /", () => {
    /* 0xfb 0xff 0xbf … encodes to +/ in standard base64. */
    const token = newLinkToken((length) => new Uint8Array(length).fill(0xfb));
    expect(token).not.toMatch(/[+/=]/);
    expect(token).toBe("-_v7-_v7-_v7-_v7-_v7-w");
  });

  it("refuse anything that is not one", () => {
    expect(isLinkToken(undefined)).toBe(false);
    expect(isLinkToken("")).toBe(false);
    expect(isLinkToken("a".repeat(21))).toBe(false);
    expect(isLinkToken("a".repeat(23))).toBe(false);
    expect(isLinkToken(`${"a".repeat(21)}+`)).toBe(false);
  });
});
