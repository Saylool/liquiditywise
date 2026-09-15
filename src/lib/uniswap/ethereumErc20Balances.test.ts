import { describe, expect, it, vi } from "vitest";

import { fetchEthereumErc20Balances, MAX_UNREADABLE_SHARE } from "./ethereumErc20Balances";
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

const run = (overrides: Partial<Parameters<typeof fetchEthereumErc20Balances>[0]> = {}) =>
  fetchEthereumErc20Balances({
    holder: HOLDER,
    tokenAddresses: [token(1), token(2), token(3)],
    rpcUrl: RPC_URL,
    fetchImpl: endpoint(() => 0n),
    ...overrides,
  });

describe("fetchEthereumErc20Balances", () => {
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
