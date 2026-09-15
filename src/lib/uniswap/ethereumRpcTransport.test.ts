import { describe, expect, it, vi } from "vitest";

import { ETH_CALL_BATCH_PAUSE_MS, postEthCallBatch } from "./ethereumRpcTransport";
import type { FetchLike } from "./v3SubgraphTransport";

const RPC_URL = "https://rpc.test.invalid/key-that-must-never-leak";
const CALL = { to: `0x${"a".repeat(40)}`, data: "0x70a08231" };

/** An endpoint that answers every call, and records the instant each request arrived. */
const recording = (arrivals: number[], status = 200): FetchLike =>
  vi.fn(async (_url, init) => {
    arrivals.push(performance.now());
    const calls = JSON.parse(String(init.body)) as { id: number }[];

    return new Response(
      JSON.stringify(calls.map((call) => ({ jsonrpc: "2.0", id: call.id, result: `0x${"0".repeat(64)}` }))),
      { status },
    );
  });

const send = (fetchImpl: FetchLike) =>
  postEthCallBatch({ rpcUrl: RPC_URL, calls: [CALL], fetchImpl, timeoutMs: 1_000 });

/*
 * The pacing is the transport's, so two callers that know nothing of each other
 * still send a sequence rather than a burst. Real time passes here — a quarter
 * of a second — because the thing under test is the interval itself.
 */
describe("postEthCallBatch pacing", () => {
  it("spaces batches from concurrent callers by the pause", async () => {
    const arrivals: number[] = [];
    const fetchImpl = recording(arrivals);

    await Promise.all([send(fetchImpl), send(fetchImpl), send(fetchImpl)]);

    expect(arrivals).toHaveLength(3);
    const gaps = arrivals.slice(1).map((at, index) => at - (arrivals[index] ?? 0));
    // Timers can fire a few milliseconds early or late; a burst would be near zero.
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(ETH_CALL_BATCH_PAUSE_MS - 20);
  });

  /* A batch the endpoint refused must not stall every batch behind it. */
  it("lets the next batch through after a failed one", async () => {
    const arrivals: number[] = [];
    const failing = recording(arrivals, 500);
    const answering = recording(arrivals);

    const [first, second] = await Promise.all([send(failing), send(answering)]);

    expect(first.ok).toBe(false);
    expect(second.ok).toBe(true);
    expect(arrivals).toHaveLength(2);
  });

  it("answers each caller with its own batch's results", async () => {
    const one = vi.fn<FetchLike>(async () =>
      new Response(JSON.stringify([{ jsonrpc: "2.0", id: 0, result: `0x${"1".padStart(64, "0")}` }])),
    );
    const two = vi.fn<FetchLike>(async () =>
      new Response(JSON.stringify([{ jsonrpc: "2.0", id: 0, result: `0x${"2".padStart(64, "0")}` }])),
    );

    const [first, second] = await Promise.all([send(one), send(two)]);

    expect(first.ok && first.results[0]?.ok && first.results[0].result).toBe(`0x${"1".padStart(64, "0")}`);
    expect(second.ok && second.results[0]?.ok && second.results[0].result).toBe(`0x${"2".padStart(64, "0")}`);
  });
});
