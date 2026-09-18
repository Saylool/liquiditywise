import { describe, expect, it, vi } from "vitest";

import { postAggregatedCalls } from "./ethereumAggregatedCalls";
import { AGGREGATE3_SELECTOR, MULTICALL3_ADDRESS } from "./multicall3";
import { MULTICALL3_RUNTIME_CODE } from "./multicall3RuntimeCode";
import { decodeAggregate3Calls, encodeAggregate3Results, rpcEndpoint } from "./testing/multicall3Endpoint";
import type { FetchLike } from "./v3SubgraphTransport";

const RPC_URL = "https://rpc.test.invalid/key-that-must-never-leak";
const word = (value: bigint) => `0x${value.toString(16).padStart(64, "0")}`;
const CALLS = [
  { to: `0x${"a".repeat(40)}`, data: `0x70a08231${"1".repeat(64)}` },
  { to: `0x${"b".repeat(40)}`, data: `0x70a08231${"2".repeat(64)}` },
];

type Entry = { method: string; params: [{ to: string; data: string } | string, string] };

const run = (fetchImpl: FetchLike, calls = CALLS) =>
  postAggregatedCalls({ rpcUrl: RPC_URL, calls, fetchImpl, timeoutMs: 1_000 });

const sentBy = (fetchImpl: FetchLike) =>
  JSON.parse(String(vi.mocked(fetchImpl).mock.calls[0]?.[1].body)) as Entry[];

describe("postAggregatedCalls", () => {
  /* One request, whatever the number of calls: all of them inside one to Multicall3, and its code beside them. */
  it("sends one batch: the calls inside one to Multicall3, and the code at its address beside them", async () => {
    const fetchImpl = vi.fn(rpcEndpoint());
    await run(fetchImpl);
    const [aggregate, code] = sentBy(fetchImpl);
    const call = aggregate?.params[0] as { to: string; data: string };

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(aggregate?.method).toBe("eth_call");
    expect(call.to).toBe(MULTICALL3_ADDRESS);
    expect(call.data.startsWith(AGGREGATE3_SELECTOR)).toBe(true);
    expect(decodeAggregate3Calls(call.data)).toEqual(CALLS);
    expect(code?.method).toBe("eth_getCode");
    expect(code?.params).toEqual([MULTICALL3_ADDRESS, "latest"]);
  });

  it("answers one result per call, in order, failures kept in their place", async () => {
    const fetchImpl = rpcEndpoint({
      call: (_call, index) => (index === 1 ? { success: false, data: "0x" } : { success: true, data: word(BigInt(index + 5)) }),
    });
    const result = await run(fetchImpl, [...CALLS, CALLS[0] ?? CALLS[1]!]);

    expect(result).toEqual({
      ok: true,
      results: [
        { success: true, data: word(5n) },
        { success: false, data: "0x" },
        { success: true, data: word(7n) },
      ],
      /* No extra contract was asked about, so nothing came back for one. */
      codes: [],
    });
  });

  it("sends nothing for no calls", async () => {
    const fetchImpl = vi.fn(rpcEndpoint());
    const result = await run(fetchImpl, []);

    expect(result).toEqual({ ok: true, results: [], codes: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  /*
   * For a caller that has to prove a second contract before it believes what
   * that contract said. The code travels rather than a verdict: what counts as
   * the right code is the caller's business.
   */
  it("brings back the code of any other address asked about, in order", async () => {
    const fetchImpl = rpcEndpoint({
      code: (address) => (address === MULTICALL3_ADDRESS ? MULTICALL3_RUNTIME_CODE : "0xbeef"),
    });
    const result = await postAggregatedCalls({
      rpcUrl: RPC_URL,
      calls: CALLS,
      codeOf: [`0x${"a".repeat(40)}`, `0x${"b".repeat(40)}`],
      fetchImpl,
      timeoutMs: 1_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.codes).toEqual(["0xbeef", "0xbeef"]);
  });

  /*
   * The address is not trusted; the code found there is. Anything else at that
   * address — nothing, or another contract — and the answers are not believed,
   * whatever they say.
   */
  it.each([
    ["no code at all", "0x"],
    ["another contract's code", `${MULTICALL3_RUNTIME_CODE.slice(0, -2)}00`],
  ])("refuses the answers when the code at the address is %s", async (_label, code) => {
    const result = await run(rpcEndpoint({ code }));

    expect(result).toEqual({ ok: false, reason: "configuration-error", notice: "chain-aggregator-unverified" });
  });

  it("refuses the answers when the code question itself was refused", async () => {
    const fetchImpl: FetchLike = async (_url, init) => {
      const entries = JSON.parse(String(init.body)) as { id: number }[];
      return new Response(JSON.stringify(entries.map((entry) => ({ jsonrpc: "2.0", id: entry.id, error: { code: 429 } }))), { status: 200 });
    };
    const result = await run(fetchImpl);

    expect(result.ok === false && result.notice).toBe("chain-aggregator-unverified");
  });

  it("refuses a refused aggregated call as every call unread", async () => {
    const result = await run(rpcEndpoint({ aggregate: null }));

    expect(result).toEqual({ ok: false, reason: "invalid-response", notice: "chain-data-unreadable" });
  });

  it("refuses an answer it cannot decode", async () => {
    const result = await run(rpcEndpoint({ aggregate: "0x1234" }));

    expect(result).toEqual({ ok: false, reason: "invalid-response", notice: "chain-data-malformed" });
  });

  it("refuses an answer for a different number of calls", async () => {
    const result = await run(rpcEndpoint({ aggregate: encodeAggregate3Results([{ success: true, data: word(1n) }]) }));

    expect(result.ok === false && result.notice).toBe("chain-data-malformed");
  });

  it("passes a lost batch through with its reason", async () => {
    const result = await run(vi.fn(async () => new Response("nope", { status: 429 })));

    expect(result.ok === false && result.reason).toBe("rate-limited");
  });

  it("keeps the endpoint out of a failure", async () => {
    const result = await run(vi.fn(async () => new Response("x", { status: 500 })));

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("key-that-must-never-leak");
  });
});
