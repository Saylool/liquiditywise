import type { DataResult, PoolDailyPriceHistory, PoolMarketSnapshot, V3Pool, V4Pool } from "../../schemas";
import {
  analysePoolRange,
  DEFAULT_DEPOSIT_USD,
  DEFAULT_PRICE_BAND_PARAMETERS,
  type PoolRangeAnalysis,
} from "../advisor/poolRangeAnalysis";

/*
 * A pool worked through the real pipeline, for tests of what is built on top
 * of an analysis: a USDC/WETH pool at 3,000 USDC per WETH with a month of
 * ordinary movement, as v3 or as v4 with a given hook.
 *
 * Through `analysePoolRange` rather than a hand-made result, so a figure a
 * test reads back is one the pipeline produced — a fixture that only looked
 * like an analysis would let a test agree with itself. The same shape as the
 * fixtures in poolRangeAnalysis.test.ts, whose comments say why each number.
 */

export const FIXTURE_FETCHED_AT = "2026-08-21T09:15:00.000Z";
export const V3_POOL_ID = `0x${"c".repeat(40)}`;
export const V4_POOL_ID = `0x${"d".repeat(64)}`;

/** `beforeSwap`, `afterSwap` and `afterSwapReturnsDelta`: a hook that may change what a swap costs. */
export const SWAP_HOOK = `0x${"1".repeat(36)}00c4`;
/** `beforeAddLiquidity` alone: it never runs on a swap. */
export const LIQUIDITY_HOOK = `0x${"1".repeat(36)}0800`;

/** USDC (6 decimals) sorts before WETH (18), so the pool's own price is WETH per USDC. */
const CURRENT_PRICE = 1 / 3000;
const DAY_MS = 86_400_000;
const RANGE_START = Date.parse("2026-07-21T00:00:00.000Z");

const ok = <T,>(data: T): DataResult<T> => ({ status: "success", data });

const tokens = {
  token0: { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: "USDC", decimals: 6 },
  token1: { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: "WETH", decimals: 18 },
};

export const fixtureAnalysis = (
  protocol: "v3" | "v4" = "v3",
  hookAddress: string | null = null,
): PoolRangeAnalysis => {
  const ref =
    protocol === "v3"
      ? ({ protocolVersion: "v3", chainId: 1, id: V3_POOL_ID } as const)
      : ({ protocolVersion: "v4", chainId: 1, id: V4_POOL_ID } as const);
  const source = protocol === "v3" ? "uniswap-v3-subgraph" : "uniswap-v4-subgraph";

  const pool =
    protocol === "v3"
      ? ({ ...ref, ...tokens, feePpm: 3000, tickSpacing: 60 } as unknown as V3Pool)
      : ({
          ...ref,
          ...tokens,
          tickSpacing: 60,
          fee: { kind: "static", feePpm: 3000 },
          protocolFee: { zeroForOnePpm: 0, oneForZeroPpm: 0 },
          hookAddress,
        } as unknown as V4Pool);

  const snapshot = {
    pool: ref,
    fetchedAt: FIXTURE_FETCHED_AT,
    sourceBlockNumber: "21500000",
    sourceBlockTimestamp: "2026-08-21T09:14:48.000Z",
    token0PriceInToken1: CURRENT_PRICE,
    token1PriceInToken0: 1 / CURRENT_PRICE,
    tvlUsd: 12_500_000,
    lockedToken0: 6_250_000,
    lockedToken1: 6_250_000 * CURRENT_PRICE,
    tick: 196_256,
    liquidity: "987654321",
    source,
  } as unknown as PoolMarketSnapshot;

  const points = [];
  let price = CURRENT_PRICE;
  for (let day = 0; day < 31; day += 1) {
    if (day > 0) price *= day % 2 === 0 ? 1.01 : 1 / 1.01;
    points.push({
      timestamp: new Date(RANGE_START + day * DAY_MS).toISOString(),
      price,
      low: null,
      high: null,
      volumeUsd: null,
      feesUsd: null,
      activeLiquidity: "1000000000000000000",
    });
  }
  const history = {
    pool: ref,
    fetchedAt: FIXTURE_FETCHED_AT,
    sourceBlockNumber: "21500000",
    sourceBlockTimestamp: "2026-08-21T09:14:48.000Z",
    rangeStart: "2026-07-21T00:00:00.000Z",
    rangeEndExclusive: new Date(RANGE_START + 31 * DAY_MS).toISOString(),
    interval: "1d",
    priceDirection: "token0PriceInToken1",
    points,
    source,
  } as unknown as PoolDailyPriceHistory;

  const result = analysePoolRange({
    pool: protocol === "v3" ? ok(pool as V3Pool) : ok(pool as V4Pool),
    snapshot: ok(snapshot),
    history: ok(history),
    parameters: DEFAULT_PRICE_BAND_PARAMETERS,
    depositUsd: DEFAULT_DEPOSIT_USD,
  });
  if (result.status === "unavailable") {
    throw new Error(`the fixture should analyse, and stopped at ${result.step}: ${result.notice}`);
  }
  return result.data;
};
