import { describe, expect, it } from "vitest";

import { chainById } from "../chains/chains";
import { parsePoolWatch, poolWatchWords } from "./poolWatchCommand";

const V3 = `0x${"c".repeat(40)}`;
const V4 = `0x${"d".repeat(64)}`;

describe("what /watch was asked for", () => {
  it("reads a v3 pool by its address and a v4 pool by its id, on mainnet when no chain is said", () => {
    expect(parsePoolWatch(V3)).toEqual({ ok: true, target: { protocol: "v3", chainId: 1, poolId: V3 } });
    expect(parsePoolWatch(V4)).toEqual({ ok: true, target: { protocol: "v4", chainId: 1, poolId: V4 } });
  });

  it("takes the chain's slug before or after the pool, and lower-cases both", () => {
    const expected = { ok: true, target: { protocol: "v3", chainId: 8453, poolId: V3 } };
    expect(parsePoolWatch(`base ${V3}`)).toEqual(expected);
    expect(parsePoolWatch(`${V3} base`)).toEqual(expected);
    expect(parsePoolWatch(`  Base   ${V3.toUpperCase().replace("0X", "0x")} `)).toEqual(expected);
    expect(parsePoolWatch(`${V4} unichain`)).toEqual({ ok: true, target: { protocol: "v4", chainId: 130, poolId: V4 } });
  });

  it("refuses nothing, a word that is no pool, and more words than a pool and a chain", () => {
    expect(parsePoolWatch(null)).toEqual({ ok: false, reason: "no-pool" });
    expect(parsePoolWatch("")).toEqual({ ok: false, reason: "no-pool" });
    expect(parsePoolWatch("base")).toEqual({ ok: false, reason: "no-pool" });
    expect(parsePoolWatch(`base ${V3} extra`)).toEqual({ ok: false, reason: "no-pool" });
  });

  it("refuses a hex word of neither length, and says so differently from no pool at all", () => {
    expect(parsePoolWatch("0x1234")).toEqual({ ok: false, reason: "bad-pool" });
    expect(parsePoolWatch(`0x${"c".repeat(41)}`)).toEqual({ ok: false, reason: "bad-pool" });
    expect(parsePoolWatch(`0x${"g".repeat(40)}`)).toEqual({ ok: false, reason: "bad-pool" });
  });

  it("refuses a chain this site does not read, naming the word, rather than reading it as mainnet", () => {
    expect(parsePoolWatch(`solana ${V3}`)).toEqual({ ok: false, reason: "unknown-chain", word: "solana" });
    expect(parsePoolWatch(`${V3} mainnet`)).toEqual({ ok: false, reason: "unknown-chain", word: "mainnet" });
  });

  it("refuses a protocol the chain is not read for: v3 on Unichain, v4 on Celo", () => {
    expect(parsePoolWatch(`unichain ${V3}`)).toEqual({ ok: false, reason: "not-on-chain", protocol: "v3", chain: chainById(130) });
    expect(parsePoolWatch(`${V4} celo`)).toEqual({ ok: false, reason: "not-on-chain", protocol: "v4", chain: chainById(42220) });
  });

  it("writes a watch back the way /unwatch takes it: the slug first, and unsaid on mainnet", () => {
    expect(poolWatchWords({ protocol: "v3", chainId: 1, poolId: V3 }, chainById(1))).toBe(V3);
    expect(poolWatchWords({ protocol: "v3", chainId: 8453, poolId: V3 }, chainById(8453))).toBe(`base ${V3}`);
    const written = poolWatchWords({ protocol: "v4", chainId: 130, poolId: V4 }, chainById(130));
    expect(parsePoolWatch(written)).toEqual({ ok: true, target: { protocol: "v4", chainId: 130, poolId: V4 } });
  });
});
