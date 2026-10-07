import { describe, expect, it } from "vitest";

import { CONFIRM_TOKEN_TTL_MS, signToken, verifyToken } from "./signedToken";

const SECRET = "a-long-random-server-secret";
const ID = "abcDEF123456789012_-xy";
const NOW = new Date("2026-10-07T12:00:00.000Z");
const LATER = new Date(NOW.getTime() + CONFIRM_TOKEN_TTL_MS);

const confirm = { purpose: "confirm", id: ID, expiresAtMs: LATER.getTime() } as const;
const unsubscribe = { purpose: "unsubscribe", id: ID, expiresAtMs: null } as const;

describe("a signed link", () => {
  it("verifies as what it was signed as, and hands back its claims", () => {
    expect(verifyToken(SECRET, signToken(SECRET, confirm), "confirm", NOW)).toEqual(confirm);
    expect(verifyToken(SECRET, signToken(SECRET, unsubscribe), "unsubscribe", NOW)).toEqual(unsubscribe);
  });

  it("survives a URL: nothing in it needs escaping", () => {
    const token = signToken(SECRET, confirm);

    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(token)).toBe(token);
  });

  it("is the same token for the same claims, so a reader who asks twice holds one link", () => {
    expect(signToken(SECRET, confirm)).toBe(signToken(SECRET, confirm));
  });

  it("does not verify for the other purpose", () => {
    expect(verifyToken(SECRET, signToken(SECRET, confirm), "unsubscribe", NOW)).toBeNull();
    expect(verifyToken(SECRET, signToken(SECRET, unsubscribe), "confirm", NOW)).toBeNull();
  });

  it("does not verify under another secret, or under none", () => {
    const token = signToken(SECRET, confirm);

    expect(verifyToken("another-secret", token, "confirm", NOW)).toBeNull();
    expect(verifyToken("", token, "confirm", NOW)).toBeNull();
  });

  it("does not verify once anything in it has been changed", () => {
    const token = signToken(SECRET, confirm);
    const [payload, signature] = token.split(".") as [string, string];
    const otherId = signToken(SECRET, { ...confirm, id: "zzzDEF123456789012_-xy" }).split(".")[0];

    /* The payload swapped for another valid one, keeping this signature. */
    expect(verifyToken(SECRET, `${otherId}.${signature}`, "confirm", NOW)).toBeNull();
    /* The signature's last character changed. */
    const flipped = signature.endsWith("A") ? `${signature.slice(0, -1)}B` : `${signature.slice(0, -1)}A`;
    expect(verifyToken(SECRET, `${payload}.${flipped}`, "confirm", NOW)).toBeNull();
    /* A payload that reads the same once decoded but is spelled differently cannot pass on its own spelling. */
    expect(verifyToken(SECRET, `${payload}=.${signature}`, "confirm", NOW)).toBeNull();
    /* An expiry edited to a later day. */
    const later = Buffer.from(`confirm:${ID}:${LATER.getTime() + 86_400_000}`, "utf8").toString("base64url");
    expect(verifyToken(SECRET, `${later}.${signature}`, "confirm", NOW)).toBeNull();
  });

  it("refuses what is not a token at all", () => {
    for (const bad of [undefined, null, 42, "", "nodot", "a.b.c", "...", `${signToken(SECRET, confirm)}.`]) {
      expect(verifyToken(SECRET, bad, "confirm", NOW), String(bad)).toBeNull();
    }
    /* A payload with the right shape but an id that is not one. */
    const payload = Buffer.from("confirm:short:-", "utf8").toString("base64url");
    const signature = signToken(SECRET, confirm).split(".")[1];
    expect(verifyToken(SECRET, `${payload}.${signature}`, "confirm", NOW)).toBeNull();
  });

  it("expires at the moment it says, and not before", () => {
    const token = signToken(SECRET, confirm);

    expect(verifyToken(SECRET, token, "confirm", new Date(LATER.getTime() - 1))).not.toBeNull();
    expect(verifyToken(SECRET, token, "confirm", LATER)).toBeNull();
    expect(verifyToken(SECRET, token, "confirm", new Date(LATER.getTime() + 1))).toBeNull();
  });

  it("never expires when signed without an expiry: the unsubscribe link in an old digest still works", () => {
    const token = signToken(SECRET, unsubscribe);

    expect(verifyToken(SECRET, token, "unsubscribe", new Date("2031-01-01T00:00:00.000Z"))).toEqual(unsubscribe);
  });

  it("gives a confirmation a day", () => {
    expect(CONFIRM_TOKEN_TTL_MS).toBe(24 * 60 * 60 * 1_000);
  });
});
