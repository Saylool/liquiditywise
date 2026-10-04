import { describe, expect, it, vi } from "vitest";

import { V4_CHAINS } from "../chains/chains";
import type { FetchLike } from "../uniswap/v3SubgraphTransport";
import {
  BLOCKSCOUT_HOSTS,
  BLOCKSCOUT_TIMEOUT_MS,
  blockscoutAddressUrl,
  blockscoutPage,
  fetchBlockscoutAnswer,
  readBlockscoutAnswer,
} from "./blockscout";

/* The fields read from `/api/v2/addresses/…`, as answered on 2026-10-04 for hooks the live directory listed. */
const address = (overrides: Record<string, unknown> = {}) => ({
  creation_status: "success",
  hash: "0x322dcEc4958C14e021A9F1cD49DF11b9457968cC",
  is_contract: true,
  is_scam: false,
  is_verified: true,
  name: "LaunchHook",
  proxy_type: null,
  implementations: [],
  public_tags: [],
  ...overrides,
});
const HOOK = "0x322dcec4958c14e021a9f1cd49df11b9457968cc";

const answered = (status: number, body: unknown) => ({ answered: true as const, status, body });

describe("reading what Blockscout says", () => {
  it("reads a verified contract as verified, with the name in its source", () => {
    expect(readBlockscoutAnswer(answered(200, address()))).toEqual({ kind: "verified", name: "LaunchHook", proxy: null });
  });

  it("reads an unverified contract, or an address it has never seen, as not verified", () => {
    expect(readBlockscoutAnswer(answered(200, address({ is_verified: false, name: null })))).toEqual({ kind: "unverified", proxy: null });
    expect(readBlockscoutAnswer(answered(200, address({ is_contract: false, is_verified: false, name: null })))).toEqual({
      kind: "unverified",
      proxy: null,
    });
  });

  it("reads an address Blockscout cannot say is verified as not verified, never as verified", () => {
    expect(readBlockscoutAnswer(answered(200, address({ is_verified: null })))).toEqual({ kind: "unverified", proxy: null });
  });

  /* Measured on a Steer hook on Unichain: a name with no verified source behind it is a label. */
  it("takes no name from an address whose source it has not verified", () => {
    const answer = readBlockscoutAnswer(answered(200, address({ is_verified: false, name: "STEER_UNIV4_HOOK_6" })));

    expect(answer).toEqual({ kind: "unverified", proxy: null });
  });

  it("shows no name that is not a contract name, whatever the field holds", () => {
    for (const name of ["Uniswap Labs: Official", "", "x".repeat(65), "Ünïcode", 42]) {
      expect(readBlockscoutAnswer(answered(200, address({ name }))), String(name)).toEqual({ kind: "verified", name: null, proxy: null });
    }
  });

  it("says when it reads the address as a proxy, and names the code behind it where it can", () => {
    const proxy = address({
      name: "ERC1967Proxy",
      proxy_type: "eip1967",
      implementations: [{ address_hash: "0x5f216d21b1C81346938EDDc1Df7e0111A0F64000", name: "StablePairHook" }],
    });
    const nameless = address({ is_verified: false, name: null, proxy_type: "eip1967_beacon", implementations: [] });

    expect(readBlockscoutAnswer(answered(200, proxy))).toEqual({
      kind: "verified",
      name: "ERC1967Proxy",
      proxy: { implementation: "StablePairHook" },
    });
    expect(readBlockscoutAnswer(answered(200, nameless))).toEqual({ kind: "unverified", proxy: { implementation: null } });
  });

  it("reads a 404 as not verified only in Blockscout's own words", () => {
    expect(readBlockscoutAnswer(answered(404, { message: "Not found" }))).toEqual({ kind: "unverified", proxy: null });
    expect(readBlockscoutAnswer(answered(404, "<html>404</html>"))).toEqual({ kind: "unanswered", why: "unreadable" });
  });

  it("does not guess from a body it cannot read", () => {
    for (const body of [{}, { is_verified: "yes" }, [], undefined, null]) {
      expect(readBlockscoutAnswer(answered(200, body)), JSON.stringify(body)).toEqual({ kind: "unanswered", why: "unreadable" });
    }
  });

  it("tells a busy service from one refusing this server", () => {
    expect(readBlockscoutAnswer(answered(429, {}))).toEqual({ kind: "unanswered", why: "busy" });
    expect(readBlockscoutAnswer(answered(502, {}))).toEqual({ kind: "unanswered", why: "busy" });
    expect(readBlockscoutAnswer(answered(403, {}))).toEqual({ kind: "unanswered", why: "refused" });
    expect(readBlockscoutAnswer(answered(422, { errors: [] }))).toEqual({ kind: "unanswered", why: "unreadable" });
  });
});

describe("asking Blockscout", () => {
  const json = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

  it("has an instance for every network a v4 pool is read on", () => {
    expect(Object.keys(BLOCKSCOUT_HOSTS).map(Number).sort()).toEqual(V4_CHAINS.map(({ id }) => id).sort());
  });

  /* optimism.blockscout.com answers 301 to explorer.optimism.io, so OP Mainnet's is asked there directly. */
  it("asks each network's own instance about the address, OP Mainnet's at its own explorer", async () => {
    const fetchImpl = vi.fn<FetchLike>(json(200, address()));

    await fetchBlockscoutAnswer({ chainId: 8453, address: HOOK, fetchImpl });
    await fetchBlockscoutAnswer({ chainId: 10, address: HOOK, fetchImpl });

    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      `https://base.blockscout.com/api/v2/addresses/${HOOK}`,
      `https://explorer.optimism.io/api/v2/addresses/${HOOK}`,
    ]);
    expect(blockscoutAddressUrl(130, HOOK)).toBe(`https://unichain.blockscout.com/api/v2/addresses/${HOOK}`);
  });

  it("answers verified, not verified, unreadable and timed out as each happens", async () => {
    expect(await fetchBlockscoutAnswer({ chainId: 1, address: HOOK, fetchImpl: json(200, address()) })).toMatchObject({ kind: "verified" });
    expect(await fetchBlockscoutAnswer({ chainId: 1, address: HOOK, fetchImpl: json(404, { message: "Not found" }) })).toEqual({
      kind: "unverified",
      proxy: null,
    });
    expect(
      await fetchBlockscoutAnswer({ chainId: 1, address: HOOK, fetchImpl: async () => new Response("not json", { status: 200 }) }),
    ).toEqual({ kind: "unanswered", why: "unreadable" });

    const silent: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    expect(await fetchBlockscoutAnswer({ chainId: 1, address: HOOK, fetchImpl: silent, timeoutMs: 5 })).toEqual({
      kind: "unanswered",
      why: "timeout",
    });
  });

  it("keeps a deadline of its own when the caller gives none", async () => {
    vi.useFakeTimers();
    try {
      const silent: FetchLike = (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        });
      let settled = false;
      const answer = fetchBlockscoutAnswer({ chainId: 130, address: HOOK, fetchImpl: silent }).finally(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(BLOCKSCOUT_TIMEOUT_MS - 1);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(settled).toBe(true);
      expect(await answer).toEqual({ kind: "unanswered", why: "timeout" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("links a reader to the contract's source on the network's own instance", () => {
    expect(blockscoutPage(42161, HOOK)).toBe(`https://arbitrum.blockscout.com/address/${HOOK}?tab=contract`);
  });
});
