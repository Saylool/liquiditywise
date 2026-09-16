import { describe, expect, it, vi } from "vitest";

import { fetchEthereumV4PoolFees, fetchEthereumV4PoolStates } from "./ethereumV4PoolState";
import { MULTICALL3_ADDRESS } from "./multicall3";
import { MULTICALL3_RUNTIME_CODE } from "./multicall3RuntimeCode";
import { decodeAggregate3Calls, rpcEndpoint } from "./testing/multicall3Endpoint";
import type { FetchLike } from "./v3SubgraphTransport";
import { EXTSLOAD_SELECTOR, LIQUIDITY_OFFSET, poolStateSlot, SLOT0_OFFSET } from "./v4PoolStateSlots";

const RPC_URL = "https://rpc.test.invalid/key-that-must-never-leak";
const POOL_MANAGER = "0x000000000004444c5dc75cb358380d2e3de08a90";
const poolId = (index: number) => `0x${index.toString(16).padStart(64, "0")}`;

const word = (value: bigint) => `0x${value.toString(16).padStart(64, "0")}`;

const SQRT_PRICE = 3916044149203074036022610n;
const packedSlot0 = (sqrtPrice: bigint, { tick = -198322, lpFee = 0n, protocolFee = 0n } = {}) =>
  (lpFee << 208n) | (protocolFee << 184n) | (BigInt(tick + 0x1000000) << 160n) | sqrtPrice;

/**
 * A PoolManager that answers `extsload` by slot, inside the aggregate. `answer`
 * maps a slot to the word stored there, or to `null` for a question that
 * reverts.
 */
const endpoint = (answer: (slot: string, to: string) => bigint | null, code = MULTICALL3_RUNTIME_CODE): FetchLike =>
  vi.fn(
    rpcEndpoint({
      code,
      call: (question) => {
        const stored = answer(`0x${question.data.slice(EXTSLOAD_SELECTOR.length)}`, question.to);
        return stored === null ? { success: false, data: "0x" } : { success: true, data: word(stored) };
      },
    }),
  );

/** A manager holding every requested pool at one liquidity and one price. */
const holding = (liquidity: bigint, sqrtPrice = SQRT_PRICE) =>
  endpoint((slot) => {
    for (let index = 0; index < 100; index += 1) {
      if (slot === poolStateSlot(poolId(index), SLOT0_OFFSET)) return packedSlot0(sqrtPrice);
      if (slot === poolStateSlot(poolId(index), LIQUIDITY_OFFSET)) return liquidity;
    }
    return 0n;
  });

const questionsSent = (fetchImpl: FetchLike) => {
  const entries = JSON.parse(String(vi.mocked(fetchImpl).mock.calls[0]?.[1].body)) as {
    method: string;
    params: [{ to: string; data: string } | string];
  }[];
  const aggregate = entries.find((entry) => entry.method === "eth_call")?.params[0] as { to: string; data: string };
  return { outer: aggregate, questions: decodeAggregate3Calls(aggregate.data) };
};

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

  /* Every question inside one call to Multicall3, each asked of the manager the source named. */
  it("asks the PoolManager the source named, and nothing else, inside one aggregated call", async () => {
    const fetchImpl = holding(1n);
    await run({ fetchImpl });
    const { outer, questions } = questionsSent(fetchImpl);

    expect(outer.to).toBe(MULTICALL3_ADDRESS);
    expect(questions).toHaveLength(4);
    expect(questions.every((question) => question.to === POOL_MANAGER)).toBe(true);
    expect(questions.every((question) => question.data.startsWith(EXTSLOAD_SELECTOR))).toBe(true);
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

  /* A question that reverted may still return thirty-two bytes; those bytes are not a word of state. */
  it("does not read a reverted question's bytes as a word, whatever their shape", async () => {
    const fetchImpl: FetchLike = rpcEndpoint({
      call: (question) =>
        question.data.endsWith(poolStateSlot(poolId(2), LIQUIDITY_OFFSET)?.slice(2) ?? "")
          ? { success: false, data: word(5n) }
          : { success: true, data: word(packedSlot0(SQRT_PRICE)) },
    });
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

  it.each([undefined, "", "   "])("answers with nothing, not a failure, when the endpoint is %j", async (rpcUrl) => {
    const fetchImpl = holding(1n);
    const states = await run({ rpcUrl, fetchImpl });

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

  it("skips an id that is not a pool id rather than refusing the call", async () => {
    const states = await run({ poolIds: [`0x${"a".repeat(40)}`, poolId(1)] });

    expect(states.size).toBe(1);
    expect(states.has(poolId(1))).toBe(true);
  });

  /* Two words per pool, all in one request, however many pools. */
  it("asks for every pool in one request", async () => {
    const fetchImpl = holding(1n);
    const poolIds = Array.from({ length: 50 }, (_u, index) => poolId(index + 1));
    const states = await run({ poolIds, fetchImpl });

    expect(states.size).toBe(50);
    expect(vi.mocked(fetchImpl).mock.calls).toHaveLength(1);
    expect(questionsSent(fetchImpl).questions).toHaveLength(100);
  });

  /* One call carries every question, so a refused call is every pool unread — and unread is not empty. */
  it("answers with nothing when the aggregated call is refused", async () => {
    const states = await run({ fetchImpl: vi.fn(rpcEndpoint({ aggregate: null })) });

    expect(states.size).toBe(0);
  });

  it("answers with nothing when the helper's code is not Multicall3's", async () => {
    const states = await run({ fetchImpl: endpoint(() => packedSlot0(SQRT_PRICE), "0x") });

    expect(states.size).toBe(0);
  });

  it("answers with nothing when the request fails", async () => {
    const states = await run({
      fetchImpl: vi.fn(async () => new Response("nope", { status: 500 })),
    });

    expect(states.size).toBe(0);
  });
});

/*
 * The fees alone, for pools a page shows without ordering them: one word per
 * pool, the same word the state read unpacks, through the same aggregate.
 */
describe("fetchEthereumV4PoolFees", () => {
  const charging = endpoint((slot) => {
    for (let index = 0; index < 100; index += 1) {
      if (slot === poolStateSlot(poolId(index), SLOT0_OFFSET)) {
        return packedSlot0(SQRT_PRICE, { lpFee: 500n, protocolFee: 125n | (125n << 12n) });
      }
    }
    return 0n;
  });

  const runFees = (overrides: Partial<Parameters<typeof fetchEthereumV4PoolFees>[0]> = {}) =>
    fetchEthereumV4PoolFees({
      poolIds: [poolId(1), poolId(2)],
      poolManager: POOL_MANAGER,
      rpcUrl: RPC_URL,
      fetchImpl: charging,
      ...overrides,
    });

  it("reads each pool's fees out of its price word, one question per pool", async () => {
    const fetchImpl = charging;
    const fees = await runFees({ fetchImpl });

    expect(fees.get(poolId(1))).toEqual({ lpFeePpm: 500, protocolFee: { zeroForOnePpm: 125, oneForZeroPpm: 125 } });
    expect(fees.size).toBe(2);
    expect(questionsSent(fetchImpl).questions).toHaveLength(2);
  });

  it("leaves a pool out when its price word is zero", async () => {
    const fees = await runFees({ fetchImpl: holding(1n, 0n) });

    expect(fees.size).toBe(0);
  });

  it("answers with nothing when the aggregated call is refused", async () => {
    const fees = await runFees({ fetchImpl: vi.fn(rpcEndpoint({ aggregate: null })) });

    expect(fees.size).toBe(0);
  });

  it("reads nothing without an endpoint or a manager", async () => {
    expect((await runFees({ rpcUrl: undefined })).size).toBe(0);
    expect((await runFees({ poolManager: null })).size).toBe(0);
  });
});
