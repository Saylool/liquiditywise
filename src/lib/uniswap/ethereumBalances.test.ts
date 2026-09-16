import { describe, expect, it, vi } from "vitest";

import { fetchEthereumBalances, MAX_UNREADABLE_SHARE } from "./ethereumBalances";
import { AGGREGATE3_SELECTOR, GET_ETH_BALANCE_SELECTOR, MULTICALL3_ADDRESS } from "./multicall3";
import { MULTICALL3_RUNTIME_CODE } from "./multicall3RuntimeCode";
import type { FetchLike } from "./v3SubgraphTransport";

const RPC_URL = "https://rpc.test.invalid/key-that-must-never-leak";
const HOLDER = `0x${"a".repeat(40)}`;
const NATIVE = `0x${"0".repeat(40)}`;
const token = (index: number) => `0x${index.toString(16).padStart(40, "0")}`;

const w = (value: bigint) => value.toString(16).padStart(64, "0");
const word = (amount: bigint) => `0x${w(amount)}`;

type Entry = { id: number; method: string; params: [{ to?: string; data?: string } | string, string] };

/** The targets an `aggregate3` calldata names, in order: the element layout is fixed for 36-byte calls. */
const targetsOf = (data: string): string[] => {
  const hex = data.slice(10);
  const wordAt = (byte: number) => hex.slice(byte * 2, byte * 2 + 64);
  const count = Number(BigInt(`0x${wordAt(32)}`));

  return Array.from({ length: count }, (_u, index) => `0x${wordAt(64 + 32 * count + 192 * index).slice(24)}`);
};

/** The one selector each call carries: `balanceOf` for a token, `getEthBalance` for ether. */
const selectorsOf = (data: string): string[] => {
  const hex = data.slice(10);
  const wordAt = (byte: number) => hex.slice(byte * 2, byte * 2 + 64);
  const count = Number(BigInt(`0x${wordAt(32)}`));

  return Array.from({ length: count }, (_u, index) => `0x${wordAt(64 + 32 * count + 192 * index + 128).slice(0, 8)}`);
};

/** `Result[]` as Multicall3 returns it. */
const encodeResults = (results: readonly { success: boolean; data: string }[]) => {
  const elements = results.map(({ success, data }) => {
    const hex = data.replace(/^0x/, "");
    const length = hex.length / 2;
    return `${w(success ? 1n : 0n)}${w(64n)}${w(BigInt(length))}${hex.padEnd(Math.ceil(length / 32) * 64, "0")}`;
  });
  let offsets = "";
  let next = BigInt(results.length * 32);
  for (const element of elements) {
    offsets += w(next);
    next += BigInt(element.length / 2);
  }
  return `0x${w(32n)}${w(BigInt(results.length))}${offsets}${elements.join("")}`;
};

type Endpoint = {
  /** A token's balance, or `null` for a call that reverts. */
  readonly amountFor?: (to: string) => bigint | null;
  /** The ether balance, or `null` for a question Multicall3 could not answer. */
  readonly ether?: bigint | null;
  /** What `eth_getCode` says lives at Multicall3's address. */
  readonly code?: string;
  /** Overrides the whole aggregated answer: a refusal, or something that is not one. */
  readonly aggregate?: { error: unknown } | { result: unknown };
};

/** A batching endpoint playing Multicall3 and the node. */
const endpoint = ({ amountFor = () => 0n, ether = 0n, code = MULTICALL3_RUNTIME_CODE, aggregate }: Endpoint = {}): FetchLike =>
  vi.fn(async (_url, init) => {
    const entries = JSON.parse(String(init.body)) as Entry[];

    return new Response(
      JSON.stringify(
        entries.map((entry) => {
          if (entry.method === "eth_getCode") return { jsonrpc: "2.0", id: entry.id, result: code };
          const call = entry.params[0] as { to: string; data: string };
          if (aggregate !== undefined) return { jsonrpc: "2.0", id: entry.id, ...aggregate };
          const results = targetsOf(call.data).map((to) => {
            const amount = to === MULTICALL3_ADDRESS ? ether : amountFor(to);
            return amount === null ? { success: false, data: "0x" } : { success: true, data: word(amount) };
          });
          return { jsonrpc: "2.0", id: entry.id, result: encodeResults(results) };
        }),
      ),
      { status: 200 },
    );
  });

const run = (overrides: Partial<Parameters<typeof fetchEthereumBalances>[0]> = {}) =>
  fetchEthereumBalances({
    holder: HOLDER,
    tokenAddresses: [token(1), token(2), token(3)],
    rpcUrl: RPC_URL,
    fetchImpl: endpoint(),
    ...overrides,
  });

const sentBy = (fetchImpl: FetchLike) =>
  vi.mocked(fetchImpl).mock.calls.map(([, init]) => JSON.parse(String(init.body)) as Entry[]);

describe("fetchEthereumBalances", () => {
  it("reports only the tokens with something in them", async () => {
    const result = await run({
      fetchImpl: endpoint({ amountFor: (to) => (to === token(2) ? 5_000n : 0n) }),
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.held).toEqual([{ address: token(2), amount: "5000" }]);
    expect(result.data.checked).toBe(3);
    expect(result.data.unreadable).toBe(0);
  });

  /*
   * An eighteen-decimal balance is routinely past what a double holds exactly,
   * so the amount is a string from the wire to the formatter and never a number.
   */
  it("keeps a balance no double could hold", async () => {
    const huge = 123456789012345678901234567890n;
    const result = await run({ fetchImpl: endpoint({ amountFor: () => huge }) });

    expect(result.status === "success" && result.data.held[0]?.amount).toBe(huge.toString());
  });

  it("asks each token once, however many pools it appeared in", async () => {
    const fetchImpl = endpoint();
    const result = await run({ tokenAddresses: [token(1), token(1), token(2), token(1)], fetchImpl });
    const [batch] = sentBy(fetchImpl);
    const call = batch?.[0]?.params[0] as { data: string };

    expect(result.status === "success" && result.data.checked).toBe(2);
    expect(targetsOf(call.data)).toEqual([token(1), token(2)]);
  });

  /*
   * One request, whatever the list's length: every question inside one call to
   * Multicall3, and the code at Multicall3's address asked for beside it.
   */
  it("asks every balance in one call, with the helper's code beside it", async () => {
    const fetchImpl = endpoint();
    const many = Array.from({ length: 300 }, (_unused, index) => token(index + 1));
    const result = await run({ tokenAddresses: many, fetchImpl });
    const batches = sentBy(fetchImpl);
    const [aggregate, code] = batches[0] ?? [];

    expect(result.status === "success" && result.data.checked).toBe(300);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2);
    expect(aggregate?.method).toBe("eth_call");
    expect((aggregate?.params[0] as { to: string }).to).toBe(MULTICALL3_ADDRESS);
    expect((aggregate?.params[0] as { data: string }).data.startsWith(AGGREGATE3_SELECTOR)).toBe(true);
    expect(targetsOf((aggregate?.params[0] as { data: string }).data)).toHaveLength(300);
    expect(code?.method).toBe("eth_getCode");
    expect(code?.params).toEqual([MULTICALL3_ADDRESS, "latest"]);
  });

  /*
   * The address is not trusted; the code found there is. Anything else at that
   * address — nothing, or another contract — and the answers are not believed,
   * whatever they say.
   */
  it.each([
    ["no code at all", "0x"],
    ["another contract's code", `${MULTICALL3_RUNTIME_CODE.slice(0, -2)}00`],
  ])("refuses the sweep when the helper's code is %s", async (_label, code) => {
    const result = await run({ fetchImpl: endpoint({ code, amountFor: () => 1n }) });

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.reason).toBe("configuration-error");
    expect(result.notice).toBe("chain-aggregator-unverified");
  });

  it("refuses when the code answer never arrives", async () => {
    const fetchImpl: FetchLike = vi.fn(async (_url, init) => {
      const entries = JSON.parse(String(init.body)) as Entry[];
      return new Response(JSON.stringify(entries.map((entry) => ({ jsonrpc: "2.0", id: entry.id, error: { code: 429 } }))), { status: 200 });
    });
    const result = await run({ fetchImpl });

    expect(result.status === "unavailable" && result.notice).toBe("chain-aggregator-unverified");
  });

  /*
   * The danger this whole reader is shaped around. An unread balance is not a
   * zero balance, and a list built from failed reads renders as "you hold
   * nothing" — a definite-looking answer to a question nobody answered.
   */
  it("refuses rather than reporting an unread sweep as an empty one", async () => {
    const result = await run({ fetchImpl: endpoint({ aggregate: { error: { code: 429, message: "slow down" } } }) });

    expect(result.status).toBe("unavailable");
    expect(result.status === "unavailable" && result.notice).toBe("chain-data-unreadable");
  });

  it("refuses an aggregated answer it cannot decode", async () => {
    const result = await run({ fetchImpl: endpoint({ aggregate: { result: "0x1234" } }) });

    expect(result.status === "unavailable" && result.notice).toBe("chain-data-malformed");
  });

  it("refuses an answer for a different number of currencies", async () => {
    const result = await run({ fetchImpl: endpoint({ aggregate: { result: encodeResults([{ success: true, data: word(1n) }]) } }) });

    expect(result.status === "unavailable" && result.notice).toBe("chain-data-malformed");
  });

  it("refuses when the whole batch never arrives", async () => {
    const result = await run({
      fetchImpl: vi.fn(async () => new Response("nope", { status: 429 })),
    });

    expect(result.status === "unavailable" && result.reason).toBe("rate-limited");
  });

  /*
   * A candidate list drawn from pool data can hold an address that is not a
   * working ERC-20. One of those must not take a lookup down.
   */
  it("drops a few unreadable tokens and keeps the rest", async () => {
    const tokens = Array.from({ length: 20 }, (_unused, index) => token(index + 1));
    const result = await run({
      tokenAddresses: tokens,
      fetchImpl: endpoint({ amountFor: (to) => (to === token(7) ? null : 1n) }),
    });

    expect(1 / tokens.length).toBeLessThan(MAX_UNREADABLE_SHARE);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.unreadable).toBe(1);
    expect(result.data.held).toHaveLength(19);
  });

  it("refuses a sweep with too many unreadable tokens in it", async () => {
    const tokens = Array.from({ length: 20 }, (_unused, index) => token(index + 1));
    const result = await run({
      tokenAddresses: tokens,
      fetchImpl: endpoint({ amountFor: (to) => (Number(to.slice(-1)) % 2 === 0 ? null : 1n) }),
    });

    expect(result.status === "unavailable" && result.notice).toBe("chain-data-unreadable");
  });

  /* A balance is a word; a token answering with anything else is one unreadable token. */
  it("counts an answer that is not a word as unreadable", async () => {
    const tokens = Array.from({ length: 20 }, (_unused, index) => token(index + 1));
    const answers = tokens.map((_token, index) =>
      index === 0 ? { success: true, data: "0x01" } : { success: true, data: word(index === 1 ? 3n : 0n) },
    );
    const result = await run({ tokenAddresses: tokens, fetchImpl: endpoint({ aggregate: { result: encodeResults(answers) } }) });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.unreadable).toBe(1);
    expect(result.data.held).toEqual([{ address: token(2), amount: "3" }]);
  });

  /*
   * A call that reverted may still return thirty-two bytes — a bare error
   * word — and those bytes are not a balance. The flag decides, not the shape.
   */
  it("does not read a reverted call's answer as a balance, whatever its shape", async () => {
    const tokens = Array.from({ length: 20 }, (_unused, index) => token(index + 1));
    const answers = tokens.map((_token, index) => ({ success: index !== 0, data: word(index === 0 ? 5n : 0n) }));
    const result = await run({ tokenAddresses: tokens, fetchImpl: endpoint({ aggregate: { result: encodeResults(answers) } }) });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.unreadable).toBe(1);
    expect(result.data.held).toEqual([]);
  });

  it.each([
    ["a malformed holder", { holder: "0xnope" }],
    ["the zero address", { holder: NATIVE }],
    ["no tokens to ask about", { tokenAddresses: [] }],
  ])("refuses %s without calling the chain", async (_label, overrides) => {
    const fetchImpl = vi.fn(async () => new Response("[]", { status: 200 }));
    const result = await run({ fetchImpl, ...overrides });

    expect(result.status === "unavailable" && result.reason).toBe("invalid-input");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports a missing endpoint as configuration, and never calls out", async () => {
    const fetchImpl = vi.fn(async () => new Response("[]", { status: 200 }));
    const result = await run({ rpcUrl: undefined, fetchImpl });

    expect(result.status === "unavailable" && result.reason).toBe("configuration-error");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never puts the endpoint in anything it returns", async () => {
    const result = await run({ fetchImpl: vi.fn(async () => new Response("x", { status: 500 })) });

    expect(JSON.stringify(result)).not.toContain("key-that-must-never-leak");
  });
});

/*
 * The chain's own ether, which no token contract can be asked about. It goes
 * into the same call as a `getEthBalance` question to Multicall3 itself, comes
 * back as a word like the rest, and lands under the zero address — the key a
 * v4 pool uses for it.
 */
describe("fetchEthereumBalances and the chain's own ether", () => {
  const runWithEther = (fetchImpl: FetchLike, tokenAddresses: readonly string[] = [NATIVE, token(1)]) =>
    fetchEthereumBalances({ holder: HOLDER, tokenAddresses, rpcUrl: RPC_URL, fetchImpl });

  it("asks Multicall3 for ether and reports it under the zero address", async () => {
    const result = await runWithEther(endpoint({ ether: 1_000_000_000_000_000_000n }));

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.held).toEqual([{ address: NATIVE, amount: "1000000000000000000" }]);
    expect(result.data.checked).toBe(2);
  });

  it("sends the ether question as getEthBalance to the helper, not as a call to the zero address", async () => {
    const fetchImpl = endpoint({ ether: 1n });
    await runWithEther(fetchImpl);
    const call = sentBy(fetchImpl)[0]?.[0]?.params[0] as { data: string };

    expect(targetsOf(call.data)).toEqual([MULTICALL3_ADDRESS, token(1)]);
    expect(selectorsOf(call.data)).toEqual([GET_ETH_BALANCE_SELECTOR, "0x70a08231"]);
    expect(call.data).toContain(HOLDER.slice(2));
  });

  it("answers ether alone when it is the only currency asked about", async () => {
    const result = await runWithEther(endpoint({ ether: 5n }), [NATIVE]);

    expect(result.status === "success" && result.data.held).toEqual([{ address: NATIVE, amount: "5" }]);
    expect(result.status === "success" && result.data.checked).toBe(1);
  });

  it("leaves ether out when the address holds none", async () => {
    const result = await runWithEther(endpoint({ ether: 0n }));

    expect(result.status === "success" && result.data.held).toEqual([]);
  });

  /* An answer the chain would not give is one unreadable currency, not a failed lookup. */
  it("counts an unanswered ether question as unreadable", async () => {
    const result = await runWithEther(endpoint({ ether: null }), [NATIVE, ...Array.from({ length: 20 }, (_u, i) => token(i + 1))]);

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.unreadable).toBe(1);
    expect(result.data.held.some((held) => held.address === NATIVE)).toBe(false);
  });

  it("keeps a balance no double could hold, in wei", async () => {
    const result = await runWithEther(endpoint({ ether: 1_000_000_000_000_000_000_000_000_000n }));

    expect(result.status === "success" && result.data.held[0]?.amount).toBe("1000000000000000000000000000");
  });
});
