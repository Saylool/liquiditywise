import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { isIP } from "node:net";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * The deploy scripts have to parse. CI runs `bash -n` over every one of them,
 * and a stray apostrophe in a single-quoted description once broke the
 * bot-profile script there and nowhere earlier: this is the same check, run
 * with the rest of the tests, so it fails before a push and not after.
 */

const directory = join(__dirname, "..", "deploy");
const scripts = readdirSync(directory).filter((name) => name.endsWith(".sh"));

describe("the deploy scripts", () => {
  it("are there to be checked", () => {
    expect(scripts.length).toBeGreaterThan(5);
  });

  it.each(scripts)("%s parses under bash", (name) => {
    const result = spawnSync("bash", ["-n", join(directory, name)], { encoding: "utf8" });

    expect(result.stderr, name).toBe("");
    expect(result.status, name).toBe(0);
  });
});

/*
 * The Caddy site block. It hands the application CF-Connecting-IP as the
 * address the rate limit counts, which is only safe while nothing but
 * Cloudflare can connect — so the block must refuse everything else, and it
 * must do so in the block that proxies, not in a guide beside it. nginx gets
 * the same from cloudflare-only.sh; Caddy has only this file.
 */
describe("the Caddy site block", () => {
  const caddyfile = readFileSync(join(directory, "Caddyfile"), "utf8");
  const code = caddyfile
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");

  /** Each top-level block, by the name it opens with. */
  const blocks = (() => {
    const found = new Map<string, string>();
    const opening = /^(\S[^{\n]*?)\s*\{\s*$/gm;
    for (const match of code.matchAll(opening)) {
      let depth = 0;
      let end = match.index;
      for (; end < code.length; end += 1) {
        if (code[end] === "{") depth += 1;
        if (code[end] === "}" && --depth === 0) break;
      }
      found.set(match[1] ?? "", code.slice(match.index, end + 1));
    }
    return found;
  })();

  const snippet = blocks.get("(cloudflare_only)") ?? "";
  const ranges = /@outside_cloudflare\s+not\s+remote_ip\s+([^\n]+)/.exec(snippet)?.[1]?.trim().split(/\s+/) ?? [];

  const isRange = (cidr: string): boolean => {
    const [address = "", prefix = "", ...rest] = cidr.split("/");
    const family = isIP(address);
    const bits = Number(prefix);
    return rest.length === 0 && family !== 0 && /^\d+$/.test(prefix) && bits >= 8 && bits <= (family === 4 ? 32 : 128);
  };

  it("drops every connection that is not from one of Cloudflare's ranges", () => {
    expect(snippet).toMatch(/^\s*abort @outside_cloudflare\s*$/m);
    /* Cloudflare publishes about fifteen IPv4 and seven IPv6 ranges; much fewer is a truncated list. */
    expect(ranges.filter((cidr) => isIP(cidr.split("/")[0] ?? "") === 4).length).toBeGreaterThanOrEqual(10);
    expect(ranges.filter((cidr) => isIP(cidr.split("/")[0] ?? "") === 6).length).toBeGreaterThanOrEqual(5);
    for (const cidr of ranges) expect(isRange(cidr), cidr).toBe(true);
  });

  it("refuses outsiders in every block that believes CF-Connecting-IP, and only there is it believed", () => {
    const believing = [...blocks].filter(([, block]) => block.includes("CF-Connecting-IP"));

    expect(believing.map(([name]) => name)).toEqual(["liquiditywise.com"]);
    for (const [name, block] of believing) {
      expect(block, name).toMatch(/^\s*import cloudflare_only\s*$/m);
      expect(block, name).toMatch(/header_up X-Real-IP \{header\.CF-Connecting-IP\}/);
      /* A single address, never a list a client could have started. */
      expect(block, name).toMatch(/header_up X-Forwarded-For \{header\.CF-Connecting-IP\}/);
    }
  });

  it("proxies to the application from no block that does not refuse outsiders", () => {
    for (const [name, block] of blocks) {
      if (block.includes("reverse_proxy")) expect(block, name).toMatch(/^\s*import cloudflare_only\s*$/m);
    }
  });
});
