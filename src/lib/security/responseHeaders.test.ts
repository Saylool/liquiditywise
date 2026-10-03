import { modifyRouteRegex } from "next/dist/lib/redirect-status";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config";
import { EMBED_PAGES } from "../site/indexing";
import { PAGES } from "../usage/usageLines";
import {
  EMBED_CARD_HEADERS,
  EMBED_CARD_PATH,
  HEADER_RULES,
  NO_FRAMING_HEADERS,
  SECURITY_HEADERS,
} from "./responseHeaders";

const header = (key: string) => SECURITY_HEADERS.find((entry) => entry.key === key)?.value;

/*
 * Which headers a path is answered with, worked out the way the server works
 * it out: each rule's source compiled by Next's own matcher, with the options
 * its router builds header rules with (router-utils/filesystem.js) — strict,
 * not case-sensitive, a trailing slash allowed — and a later rule's value
 * replacing an earlier one's. Not a regular expression of this test's own,
 * which would only agree with itself.
 */
const headersFor = async (path: string): Promise<Map<string, string>> => {
  const rules = (await nextConfig.headers?.()) ?? [];
  const answered = new Map<string, string>();
  for (const rule of rules) {
    const match = getPathMatch(rule.source, {
      strict: true,
      removeUnnamedParams: true,
      sensitive: false,
      regexModifier: (regex: string) => modifyRouteRegex(regex),
    });
    if (match(path) === false) continue;
    for (const { key, value } of rule.headers) answered.set(key.toLowerCase(), value);
  }
  return answered;
};

describe("the headers every response carries", () => {
  it("forbids framing in both spellings", () => {
    expect(header("Content-Security-Policy")).toBe("frame-ancestors 'none'");
    expect(NO_FRAMING_HEADERS).toEqual([{ key: "X-Frame-Options", value: "DENY" }]);
  });

  /*
   * A script policy without a nonce would break the page: the framework
   * writes inline scripts. Until one is threaded through rendering, the
   * policy says nothing about scripts rather than something wrong.
   */
  it("sets no script policy it cannot keep", () => {
    expect(header("Content-Security-Policy")).not.toMatch(/script-src|default-src/);
  });

  it("asks for HTTPS on this host only, and nothing that cannot be taken back", () => {
    expect(header("Strict-Transport-Security")).toBe("max-age=31536000");
  });

  it("turns off sniffing, and leaves only the origin behind on the way out", () => {
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(header("Permissions-Policy")).toContain("camera=()");
  });

  it("is applied from next.config, and the framework's name is not announced", async () => {
    const rules = await nextConfig.headers?.();

    expect(rules).toEqual(HEADER_RULES.map(({ source, headers }) => ({ source, headers: [...headers] })));
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});

describe("framing", () => {
  it("is refused, in both spellings, on every page but the card", async () => {
    const elsewhere = [
      ...PAGES.filter((page) => page !== EMBED_CARD_PATH),
      "/tr/hooks",
      "/zh-Hant",
      "/og/pool",
      "/api/health",
      "/_next/static/chunks/app.js",
      "/no-such-page",
    ];

    for (const path of elsewhere) {
      const answered = await headersFor(path);
      expect(answered.get("x-frame-options"), path).toBe("DENY");
      expect(answered.get("content-security-policy"), path).toBe("frame-ancestors 'none'");
      expect(answered.get("strict-transport-security"), path).toBe("max-age=31536000");
    }
  });

  /* Near misses: the exception is one address, not a prefix or a pattern. */
  it("is refused on every address that only looks like the card's", async () => {
    for (const path of ["/embed", "/embed/", "/embed/pool/", "/embed/pool/x", "/embed/poolx", "/xembed/pool", "/api/embed/pool"]) {
      expect((await headersFor(path)).get("x-frame-options"), path).toBe("DENY");
    }
  });

  it("is not refused by X-Frame-Options on the card, which keeps every other header", async () => {
    const answered = await headersFor(EMBED_CARD_PATH);

    expect(answered.has("x-frame-options")).toBe(false);
    expect(answered.get("x-content-type-options")).toBe("nosniff");
    expect(answered.get("strict-transport-security")).toBe("max-age=31536000");
  });

  /*
   * Next matches a source without regard to case, so `/EMBED/POOL` is spared
   * X-Frame-Options too. It is the not-found page there, not the card — and
   * it keeps `frame-ancestors 'none'`, which only the proxy replaces, and only
   * on the card's exact address.
   */
  it("still refuses an address that is the card's only in another case, through the CSP", async () => {
    expect((await headersFor("/EMBED/POOL")).get("content-security-policy")).toBe("frame-ancestors 'none'");
  });

  it("is opened for the card by a policy that lets any site frame it and nothing load into it", () => {
    expect(EMBED_CARD_PATH).toBe(EMBED_PAGES[0]);
    const policy = EMBED_CARD_HEADERS.find(({ key }) => key === "Content-Security-Policy")?.value ?? "";

    expect(policy).toContain("frame-ancestors *");
    expect(policy).toContain("default-src 'none'");
    expect(policy).not.toMatch(/script-src/);
  });
});
