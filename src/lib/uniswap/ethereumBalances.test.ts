import { describe, expect, it, vi } from "vitest";

import { fetchEthereumBalances, MAX_UNREADABLE_SHARE } from "./ethereumBalances";
import { ETH_CALL_BATCH_SIZE } from "./ethereumRpcTransport";
import type { FetchLike } from "./v3SubgraphTransport";

const RPC_URL = "https://rpc.test.invalid/key-that-must-never-leak";
const HOLDER = `0x${"a".repeat(40)}`;
const token = (index: number) => `0x${index.toString(16).padStart(40, "0")}`;

const word = (amount: bigint) => `0x${amount.toString(16).padStart(64, "0")}`;

/** A batching endpoint that answers every call with `amountFor`. */
const endpoint = (amountFor: (to: string) => bigint | null): FetchLike =>
  vi.fn(async (_url, init) => {
    const calls = JSON.parse(String(init.body)) as {
      id: number;
      params: [{ to: string }, string];
    }[];

    return new Response(
      JSON.stringify(
        calls.map((call) => {
          const amount = amountFor(call.params[0].to);

          return amount === null
            ? { jsonrpc: "2.0", id: call.id, error: { code: 429, message: "slow down" } }
            : { jsonrpc: "2.0", id: call.id, result: word(amount) };
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
    fetchImpl: endpoint(() => 0n),
    ...overrides,
  });

describe("fetchEthereumBalances", () => {
  it("reports only the tokens with something in them", async () => {
    const result = await run({
      fetchImpl: endpoint((to) => (to === token(2) ? 5_000n : 0n)),
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.held).toEqual([{ address: token(2), amount: "5000" }]);
    expect(result.data.checked).toBe(3);
  });

  /*
   * An eighteen-decimal balance is routinely past what a double holds exactly,
   * so the amount is a string from the wire to the formatter and never a number.
   */
  it("keeps a balance no double could hold", async () => {
    const huge = 123456789012345678901234567890n;
    const result = await run({ fetchImpl: endpoint(() => huge) });

    expect(result.status === "success" && result.data.held[0]?.amount).toBe(huge.toString());
  });

  it("asks each token once, however many pools it appeared in", async () => {
    const fetchImpl = endpoint(() => 0n);
    const result = await run({
      tokenAddresses: [token(1), token(1), token(2), token(1)],
      fetchImpl,
    });

    expect(result.status === "success" && result.data.checked).toBe(2);
  });

  it("sends one request per batch, not one per token", async () => {
    const fetchImpl = endpoint(() => 0n);
    const many = Array.from({ length: ETH_CALL_BATCH_SIZE * 2 }, (_unused, index) =>
      token(index + 1),
    );
    await run({ tokenAddresses: many, fetchImpl, timeoutMs: 1_000 });

    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(2);
  });

  /*
   * The danger this whole reader is shaped around. An unread balance is not a
   * zero balance, and a list built from failed reads renders as "you hold
   * nothing" — a definite-looking answer to a question nobody answered.
   */
  it("refuses rather than reporting an unread sweep as an empty one", async () => {
    const result = await run({
      tokenAddresses: Array.from({ length: 20 }, (_unused, index) => token(index + 1)),
      fetchImpl: endpoint(() => null),
    });

    expect(result.status).toBe("unavailable");
    expect(result.status === "unavailable" && result.notice).toBe("chain-data-unreadable");
  });

  it("refuses when a whole batch never arrives", async () => {
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
      fetchImpl: endpoint((to) => (to === token(7) ? null : 1n)),
    });

    expect(1 / tokens.length).toBeLessThan(MAX_UNREADABLE_SHARE);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.unreadable).toBe(1);
    expect(result.data.held).toHaveLength(19);
  });

  it.each([
    ["a malformed holder", { holder: "0xnope" }],
    ["the zero address", { holder: `0x${"0".repeat(40)}` }],
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
 * out as one `eth_getBalance` beside the batches, comes back as a quantity
 * rather than an ABI word, and lands under the zero address — the key a v4 pool
 * uses for it.
 */
describe("fetchEthereumBalances and the chain's own ether", () => {
  const NATIVE = `0x${"0".repeat(40)}`;

  /** An endpoint that answers batches with `amountFor`, and the ether question with `ether`. */
  const withEther = (ether: string | null, amountFor: (to: string) => bigint = () => 0n): FetchLike =>
    vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init.body)) as unknown;
      if (!Array.isArray(body)) {
        const single = body as { id: number; method: string; params: unknown[] };
        return new Response(
          JSON.stringify(
            ether === null
              ? { jsonrpc: "2.0", id: single.id, error: { code: 429, message: "slow down" } }
              : { jsonrpc: "2.0", id: single.id, result: ether },
          ),
          { status: 200 },
        );
      }
      const calls = body as { id: number; params: [{ to: string }, string] }[];
      return new Response(
        JSON.stringify(calls.map((call) => ({ jsonrpc: "2.0", id: call.id, result: word(amountFor(call.params[0].to)) }))),
        { status: 200 },
      );
    });

  const runWithEther = (fetchImpl: FetchLike, tokenAddresses: readonly string[] = [NATIVE, token(1)]) =>
    fetchEthereumBalances({ holder: HOLDER, tokenAddresses, rpcUrl: RPC_URL, fetchImpl });

  it("asks the chain directly for ether and reports it under the zero address", async () => {
    const result = await runWithEther(withEther("0xde0b6b3a7640000"));

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.held).toEqual([{ address: NATIVE, amount: "1000000000000000000" }]);
    expect(result.data.checked).toBe(2);
  });

  it("sends the ether question as eth_getBalance, not as a contract call", async () => {
    const fetchImpl = withEther("0x1");
    await runWithEther(fetchImpl);

    const bodies = vi.mocked(fetchImpl).mock.calls.map(([, init]) => JSON.parse(String(init.body)) as unknown);
    const single = bodies.find((body) => !Array.isArray(body)) as { method: string; params: unknown[] };
    expect(single.method).toBe("eth_getBalance");
    expect(single.params).toEqual([HOLDER, "latest"]);
    const batch = bodies.find((body) => Array.isArray(body)) as { params: [{ to: string }] }[];
    expect(batch.every((call) => call.params[0].to !== NATIVE)).toBe(true);
  });

  it("answers ether alone when it is the only currency asked about", async () => {
    const result = await runWithEther(withEther("0x5"), [NATIVE]);

    expect(result.status === "success" && result.data.held).toEqual([{ address: NATIVE, amount: "5" }]);
    expect(result.status === "success" && result.data.checked).toBe(1);
  });

  it("leaves ether out when the address holds none", async () => {
    const result = await runWithEther(withEther("0x0"));

    expect(result.status === "success" && result.data.held).toEqual([]);
  });

  /* An answer the chain would not give is one unreadable currency, not a failed lookup. */
  it("counts an unanswered ether question as unreadable", async () => {
    const result = await runWithEther(withEther(null), [NATIVE, ...Array.from({ length: 20 }, (_u, i) => token(i + 1))]);

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.unreadable).toBe(1);
    expect(result.data.held.some((held) => held.address === NATIVE)).toBe(false);
  });

  /* A quantity has no leading zeros; a padded word in its place is not the answer asked for. */
  it("refuses an ether balance that is not a JSON-RPC quantity", async () => {
    const result = await runWithEther(withEther(word(5n)), [NATIVE, ...Array.from({ length: 20 }, (_u, i) => token(i + 1))]);

    expect(result.status === "success" && result.data.unreadable).toBe(1);
  });

  it("keeps a balance no double could hold, in wei", async () => {
    const result = await runWithEther(withEther("0x33b2e3c9fd0803ce8000000"));

    expect(result.status === "success" && result.data.held[0]?.amount).toBe("1000000000000000000000000000");
  });
});
