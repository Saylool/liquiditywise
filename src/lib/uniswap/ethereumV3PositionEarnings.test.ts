import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const aggregated = vi.hoisted(() => ({
  batches: [] as { calls: { to: string; data: string }[]; codeOf?: string[] }[],
  answer: null as unknown as (calls: { to: string; data: string }[]) => unknown,
}));
vi.mock("./ethereumAggregatedCalls", () => ({
  postAggregatedCalls: async (request: { calls: { to: string; data: string }[]; codeOf?: string[] }) => {
    aggregated.batches.push({ calls: request.calls, ...(request.codeOf === undefined ? {} : { codeOf: request.codeOf }) });
    return aggregated.answer(request.calls);
  },
}));

import type { InRangePosition } from "./ethereumV3InRangePositions";
import {
  collectPositionEarnings,
  EARNINGS_BATCH,
  fetchEthereumV3PositionEarnings,
} from "./ethereumV3PositionEarnings";
import type { Aggregate3Result } from "./multicall3";
import { FEE_GROWTH_GLOBAL0_SELECTOR, FEE_GROWTH_GLOBAL1_SELECTOR, POOL_SLOT0_SELECTOR } from "./v3PoolFees";
import { v3PoolAddress } from "./v3PoolAddress";
import { FACTORY_SELECTOR, OWNER_OF_SELECTOR, POSITIONS_SELECTOR, V3_POSITION_MANAGERS } from "./v3PositionManager";

/** Base's manager, whose real runtime the tests keep, so the proof is the real one. */
const BASE_MANAGER_CODE = readFileSync(join(__dirname, "testing", "base-v3-position-manager.hex"), "utf8").trim();
const BASE_FACTORY = "0x33128a8fc17869897dce68ed026d694621f6fdfd";
const FACTORY = "0x1f98431c8ad98523631ae4a59f267346ea31f984";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
/** USDC/WETH at 0.05%, which the factory above derives from the pair and the fee. */
const POOL = { id: "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640", token0: { address: USDC }, token1: { address: WETH }, feePpm: 500 };
const OWNER = `0x${"d".repeat(40)}`;
const Q128 = 1n << 128n;

const word = (value: bigint | number | string): string =>
  typeof value === "string"
    ? value.replace(/^0x/, "").padStart(64, "0")
    : BigInt.asUintN(256, BigInt(value)).toString(16).padStart(64, "0");
const answer = (...values: (bigint | number | string)[]): Aggregate3Result => ({
  success: true,
  data: `0x${values.map(word).join("")}`,
});

/** What the manager records: nonce, operator, pair, fee, ticks, liquidity, growth last, owed. */
const record = ({
  token0 = USDC,
  fee = 500,
  lower = -600,
  upper = 600,
  liquidity = 1000n,
}: { token0?: string; fee?: number; lower?: number; upper?: number; liquidity?: bigint } = {}) =>
  answer(0, 0, token0, WETH, fee, lower, upper, liquidity, 5n * Q128, 1n * Q128, 999n, 999n);
const tick = (outside0: bigint, outside1: bigint) => answer(0, 0, outside0, outside1, 0, 0, 0, 1);
const listed = (tokenId: string, lower = -600, upper = 600): InRangePosition => ({
  tokenId,
  liquidity: "1",
  tickLower: lower,
  tickUpper: upper,
});

/* Inside the range: 10 - 1 - 2 = 7 and 4 - 1 - 1 = 2 per unit, against 5 and 1 last time. */
const shared = { pool: POOL, factory: FACTORY, tickCurrent: 0, global0: 10n * Q128, global1: 4n * Q128 };
const fourAnswers = (position = record()) => [position, answer(OWNER), tick(1n * Q128, 1n * Q128), tick(2n * Q128, 1n * Q128)];

describe("what each position earned since its last change", () => {
  it("is its liquidity times the growth inside its range since then, with the owed figures left out", () => {
    const [earned] = collectPositionEarnings({ ...shared, positions: [listed("7")], answers: fourAnswers() });

    expect(earned).toEqual({
      tokenId: "7",
      owner: OWNER,
      liquidity: "1000",
      tickLower: -600,
      tickUpper: 600,
      fees0: "2000",
      fees1: "1000",
    });
  });

  it("drops a position that is not the pool's, whose ticks are not the listed ones, that is closed, or that did not answer", () => {
    const answers = [
      ...fourAnswers(record({ fee: 3000 })),
      ...fourAnswers(record({ lower: -1200 })),
      ...fourAnswers(record({ liquidity: 0n })),
      { success: false, data: "0x" },
      answer(OWNER),
      tick(0n, 0n),
      tick(0n, 0n),
      ...fourAnswers(),
    ];
    const kept = collectPositionEarnings({
      ...shared,
      positions: [listed("other-pool"), listed("other-ticks"), listed("closed"), listed("reverted"), listed("good")],
      answers,
    });

    expect(kept.map(({ tokenId }) => tokenId)).toEqual(["good"]);
  });
});

describe("reading them from the chain", () => {
  beforeEach(() => {
    aggregated.batches = [];
    aggregated.answer = (calls) => ({
      ok: true,
      codes: [BASE_MANAGER_CODE],
      results: calls.map(({ data }) =>
        data === FACTORY_SELECTOR
          ? answer(BASE_FACTORY)
          : data === POOL_SLOT0_SELECTOR
            ? answer(0, 0, 0, 0, 0, 0, 1)
            : data === FEE_GROWTH_GLOBAL0_SELECTOR
              ? answer(10n * Q128)
              : data === FEE_GROWTH_GLOBAL1_SELECTOR
                ? answer(4n * Q128)
                : data.startsWith(POSITIONS_SELECTOR)
                  ? record()
                  : data.startsWith(OWNER_OF_SELECTOR)
                    ? answer(OWNER)
                    : data.endsWith(word(-600))
                      ? tick(1n * Q128, 1n * Q128)
                      : tick(2n * Q128, 1n * Q128),
      ),
    });
  });

  /* The same pair on Base, at the pool Base's factory derives for it. */
  const onBase = {
    ...POOL,
    id: v3PoolAddress({ factory: BASE_FACTORY, token0: USDC, token1: WETH, feePpm: 500 }) as string,
  };
  const request = (count: number) => ({
    chainId: 8453 as const,
    pool: onBase,
    positions: Array.from({ length: count }, (_unused, index) => listed(String(index + 1))),
    rpcUrl: "https://rpc.example",
    fetchImpl: fetch,
  });

  it("proves the manager, reads the pool once, then four answers per position in batches", async () => {
    const result = await fetchEthereumV3PositionEarnings(request(EARNINGS_BATCH + 1));

    expect(aggregated.batches[0]?.codeOf).toEqual([V3_POSITION_MANAGERS[8453].address]);
    expect(aggregated.batches.map(({ calls }) => calls.length)).toEqual([4, EARNINGS_BATCH * 4, 4]);
    expect(result.status === "success" && result.data.positions).toHaveLength(EARNINGS_BATCH + 1);
    expect(result.status === "success" && result.data.positions[0]?.fees0).toBe("2000");
    expect(result.status === "success" && result.data.tick).toBe(0);
  });

  it("believes nothing from a manager whose code is not the one it should be", async () => {
    const answered = aggregated.answer;
    aggregated.answer = (calls) => ({ ...(answered(calls) as object), codes: ["0x6080"] });

    expect(await fetchEthereumV3PositionEarnings(request(1))).toMatchObject({
      status: "unavailable",
      notice: "positions-manager-unverified",
    });
    expect(aggregated.batches).toHaveLength(1);
  });

  it("asks nothing without an endpoint", async () => {
    expect(await fetchEthereumV3PositionEarnings({ ...request(1), rpcUrl: " " })).toMatchObject({
      reason: "configuration-error",
    });
    expect(aggregated.batches).toHaveLength(0);
  });
});
