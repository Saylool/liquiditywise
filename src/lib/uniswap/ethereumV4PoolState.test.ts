import { describe, expect, it, vi } from "vitest";

import { fetchEthereumV4PoolStates } from "./ethereumV4PoolState";
import { ETH_CALL_BATCH_SIZE } from "./ethereumRpcTransport";
import type { FetchLike } from "./v3SubgraphTransport";
import { EXTSLOAD_SELECTOR, LIQUIDITY_OFFSET, poolStateSlot, SLOT0_OFFSET } from "./v4PoolStateSlots";

const RPC_URL = "https://rpc.test.invalid/key-that-must-never-leak";
const POOL_MANAGER = "0x000000000004444c5dc75cb358380d2e3de08a90";
const poolId = (index: number) => `0x${index.toString(16).padStart(64, "0")}`;

const word = (value: bigint) => `0x${value.toString(16).padStart(64, "0")}`;

const SQRT_PRICE = 3916044149203074036022610n;
const packedSlot0 = (sqrtPrice: bigint, tick = -198322) =>
  (BigInt(tick + 0x1000000) << 160n) | sqrtPrice;

/**
 * A PoolManager that answers `extsload` by slot. `answer` maps a slot to the
 * word stored there, or to `null` for a call the endpoint refuses.
 */
const endpoint = (answer: (slot: string, to: string) => bigint | null): FetchLike =>
  vi.fn(async (_url, init) => {
    const calls = JSON.parse(String(init.body)) as {
      id: number;
      params: [{ to: string; data: string }, string];
    }[];

    return new Response(
      JSON.stringify(
        calls.map((call) => {
          const slot = `0x${call.params[0].data.slice(EXTSLOAD_SELECTOR.length)}`;
          const stored = answer(slot, call.params[0].to);

          return stored === null
            ? { jsonrpc: "2.0", id: call.id, error: { code: 429, message: "slow down" } }
            : { jsonrpc: "2.0", id: call.id, result: word(stored) };
        }),
      ),
      { status: 200 },
    );
  });

/** A manager holding every requested pool at one liquidity and one price. */
const holding = (liquidity: bigint, sqrtPrice = SQRT_PRICE) =>
  endpoint((slot) => {
    for (let index = 0; index < 100; index += 1) {
      if (slot === poolStateSlot(poolId(index), SLOT0_OFFSET)) return packedSlot0(sqrtPrice);
      if (slot === poolStateSlot(poolId(index), LIQUIDITY_OFFSET)) return liquidity;
    }
    return 0n;
  });

const run = (overrides: Partial<Parameters<typeof fetchEthereumV4PoolStates>[0]> = {}) =>
  fetchEthereumV4PoolStates({
    poolIds: [poolId(1), poolId(2)],
    poolManager: POOL_MANAGER,
    rpcUrl: RPC_URL,
    fetchImpl: holding(871_594_992_723_282_798n),
    ...overrides,
  });

describe("fetchEthereumV4PoolStates", () => {
  it("reads each pool's liquidity and price out of the PoolManager's storage", async () => {
    const states = await run();

    expect(states.get(poolId(1))).toMatchObject({
      liquidity: "871594992723282798",
      sqrtPriceX96: SQRT_PRICE.toString(),
    });
    expect(states.size).toBe(2);
  });

  it("asks the PoolManager the source named, and nothing else", async () => {
    const fetchImpl = holding(1n);
    await run({ fetchImpl });

    const calls = JSON.parse(String(vi.mocked(fetchImpl).mock.calls[0]?.[1].body)) as {
      params: [{ to: string; data: string }];
    }[];
    expect(calls.every((call) => call.params[0].to === POOL_MANAGER)).toBe(true);
    expect(calls.every((call) => call.params[0].data.startsWith(EXTSLOAD_SELECTOR))).toBe(true);
  });

  /*
   * An unread pool must stay unread. Zeros here would order it as an empty pool,
   * which is a claim about the pool the chain never made.
   */
  it("leaves a pool out when either of its words was refused", async () => {
    const fetchImpl = endpoint((slot) =>
      slot === poolStateSlot(poolId(2), LIQUIDITY_OFFSET) ? null : packedSlot0(SQRT_PRICE),
    );
    const states = await run({ fetchImpl });

    expect(states.has(poolId(1))).toBe(true);
    expect(states.has(poolId(2))).toBe(false);
  });

  /* A zero price is a slot nobody wrote: a pool the manager does not have. */
  it("leaves a pool out when its price word is zero", async () => {
    const states = await run({ fetchImpl: holding(5n, 0n) });

    expect(states.size).toBe(0);
  });

  it("keeps a pool whose liquidity is genuinely zero", async () => {
    const states = await run({ fetchImpl: holding(0n) });

    expect(states.get(poolId(1))?.liquidity).toBe("0");
  });

  it("answers with nothing, not a failure, when no endpoint is configured", async () => {
    const fetchImpl = holding(1n);
    const states = await run({ rpcUrl: undefined, fetchImpl });

    expect(states.size).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([null, "", `0x${"0".repeat(40)}`, "not-an-address"])(
    "reads nothing when the manager address is %j",
    async (poolManager) => {
      const fetchImpl = holding(1n);
      const states = await run({ poolManager, fetchImpl });

      expect(states.size).toBe(0);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it("skips an id that is not a pool id rather than refusing the batch", async () => {
    const states = await run({ poolIds: [`0x${"a".repeat(40)}`, poolId(1)] });

    expect(states.size).toBe(1);
    expect(states.has(poolId(1))).toBe(true);
  });

  /* Two words per pool, split into the batches the endpoint will compute at once. */
  it("splits a large sweep into batches", async () => {
    const fetchImpl = holding(1n);
    const poolIds = Array.from({ length: ETH_CALL_BATCH_SIZE }, (_u, index) => poolId(index + 1));
    const states = await run({ poolIds, fetchImpl });

    expect(states.size).toBe(ETH_CALL_BATCH_SIZE);
    expect(vi.mocked(fetchImpl).mock.calls.length).toBe(2);
  });

  /* A refused batch costs its pools their state, and the other batches stand. */
  it("keeps what the other batches answered when one is refused", async () => {
    const answering = holding(1n);
    let call = 0;
    const flaky: FetchLike = async (url, init) => {
      call += 1;
      return call === 1 ? new Response("nope", { status: 429 }) : answering(url, init);
    };
    const poolIds = Array.from({ length: ETH_CALL_BATCH_SIZE }, (_u, index) => poolId(index + 1));
    const states = await run({ poolIds, fetchImpl: flaky });

    // Two words per pool: the first batch held the first twelve pools and half of the thirteenth.
    expect(states.size).toBe(ETH_CALL_BATCH_SIZE - Math.ceil(ETH_CALL_BATCH_SIZE / 2));
    expect(states.has(poolId(1))).toBe(false);
    expect(states.has(poolId(ETH_CALL_BATCH_SIZE))).toBe(true);
  });

  it("answers with nothing when every batch fails", async () => {
    const states = await run({
      fetchImpl: vi.fn(async () => new Response("nope", { status: 500 })),
    });

    expect(states.size).toBe(0);
  });
});
