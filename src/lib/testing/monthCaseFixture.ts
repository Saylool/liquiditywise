import type { DataResult, PoolDailyPriceHistory, PoolMarketSnapshot, V3Pool, V4Pool } from "../../schemas";
import {
  analysePoolRange,
  DEFAULT_DEPOSIT_USD,
  DEFAULT_PRICE_BAND_PARAMETERS,
  type PoolRangeAnalysisResult,
} from "../advisor/poolRangeAnalysis";
import { caseOf, type MonthCase } from "../advisor/monthCases";

/*
 * A pool with a whole month to replay, worked through the real pipeline, for
 * tests of the cases built on top of an analysis.
 *
 * Unlike poolAnalysisFixture.ts — thirty-one days, no fees, no dollar rate —
 * this one has what "opened thirty days ago" and the re-centring replay need:
 * sixty-one daily closes, so a range can be drawn from the thirty-one before
 * the window; fees and active liquidity on every day, so the deposit's share
 * can be sized; and a snapshot that prices the pool in dollars. Through
 * `analysePoolRange` rather than hand-made, so a figure a test reads off a
 * case is one the pipeline produced.
 *
 * `path` draws the window's thirty closes as multiples of the opening price,
 * oldest first: a flat path keeps every day inside, a step to 1.5 leaves the
 * range and re-centres. Each option that makes a month *not* whole is
 * reachable too, for the gate tests.
 */

const DAY_MS = 86_400_000;
const END = Date.parse("2026-10-01T00:00:00.000Z");
/** USDC (6 decimals) sorts before WETH (18), so the pool's own price is WETH per USDC. */
const OPENING_PRICE = 1 / 3000;

export const CASE_V3_ID = `0x${"c".repeat(40)}`;
export const CASE_V4_ID = `0x${"d".repeat(64)}`;
/** `beforeSwap`, `afterSwap` and `afterSwapReturnsDelta`: a hook that may change what a swap costs. */
export const CASE_SWAP_HOOK = `0x${"1".repeat(36)}00c4`;
/** `beforeAddLiquidity` alone: it never runs on a swap. */
export const CASE_LIQUIDITY_HOOK = `0x${"1".repeat(36)}0800`;

const TOKENS = {
  token0: { chainId: 1, address: `0x${"a".repeat(40)}`, symbol: "USDC", decimals: 6 },
  token1: { chainId: 1, address: `0x${"b".repeat(40)}`, symbol: "WETH", decimals: 18 },
};

const ok = <T,>(data: T): DataResult<T> => ({ status: "success", data });

export type CaseFixtureOptions = {
  readonly protocol?: "v3" | "v4";
  readonly hookAddress?: string | null;
  /** The window's thirty closes, as multiples of the opening price, oldest first; flat when not said. */
  readonly path?: readonly number[];
  /** How many daily closes the history holds; sixty-one when not said, which is the fewest a month needs. */
  readonly days?: number;
  /** Days, counted back from the last, whose fees the source did not publish. */
  readonly feesMissingOn?: readonly number[];
  /** `null` prices nothing in dollars, so no deposit can be sized. */
  readonly tvlUsd?: number | null;
  readonly id?: string;
};

export const caseAnalysis = ({
  protocol = "v3",
  hookAddress = null,
  path = [],
  days = 61,
  feesMissingOn = [],
  tvlUsd = 12_500_000,
  id,
}: CaseFixtureOptions = {}): PoolRangeAnalysisResult => {
  const poolId = id ?? (protocol === "v3" ? CASE_V3_ID : CASE_V4_ID);
  const ref =
    protocol === "v3"
      ? ({ protocolVersion: "v3", chainId: 1, id: poolId } as const)
      : ({ protocolVersion: "v4", chainId: 1, id: poolId } as const);
  const source = protocol === "v3" ? "uniswap-v3-subgraph" : "uniswap-v4-subgraph";

  const pool =
    protocol === "v3"
      ? ({ ...ref, ...TOKENS, feePpm: 3000, tickSpacing: 60 } as unknown as V3Pool)
      : ({
          ...ref,
          ...TOKENS,
          tickSpacing: 60,
          fee: { kind: "static", feePpm: 3000 },
          protocolFee: { zeroForOnePpm: 0, oneForZeroPpm: 0 },
          hookAddress,
        } as unknown as V4Pool);

  /* The last close is where the window ends; the price now is that close. */
  const lastMultiple = path[path.length - 1] ?? 1;
  const currentPrice = OPENING_PRICE * lastMultiple;
  const snapshot = {
    pool: ref,
    fetchedAt: "2026-10-01T09:15:00.000Z",
    sourceBlockNumber: "21500000",
    sourceBlockTimestamp: "2026-10-01T09:14:48.000Z",
    token0PriceInToken1: currentPrice,
    token1PriceInToken0: 1 / currentPrice,
    tvlUsd,
    lockedToken0: 6_250_000,
    lockedToken1: 6_250_000 * currentPrice,
    /* The tick that prices this close in raw units (six and eighteen decimals apart), so the range agrees with it. */
    tick: Math.floor(Math.log(currentPrice * 1e12) / Math.log(1.0001)),
    liquidity: "987654321",
    source,
  } as unknown as PoolMarketSnapshot;

  const points = Array.from({ length: days }, (_, index) => {
    const before = days - index;
    /* Before the window: a gentle alternation around the opening, so a band can be fitted. Inside it: the path. */
    const multiple = before > 30 ? (before % 2 === 0 ? 1.004 : 1 / 1.004) : (path[30 - before] ?? lastMultiple);
    const price = OPENING_PRICE * multiple;
    return {
      timestamp: new Date(END - before * DAY_MS).toISOString(),
      price,
      low: price * 0.999,
      high: price * 1.001,
      volumeUsd: 50_000_000,
      feesUsd: feesMissingOn.includes(before) ? null : 150_000,
      activeLiquidity: "100000000000000000000",
    };
  });
  const history = {
    pool: ref,
    fetchedAt: "2026-10-01T09:15:00.000Z",
    sourceBlockNumber: "21500000",
    sourceBlockTimestamp: "2026-10-01T09:14:48.000Z",
    rangeStart: new Date(END - days * DAY_MS).toISOString(),
    rangeEndExclusive: new Date(END).toISOString(),
    interval: "1d",
    priceDirection: "token0PriceInToken1",
    points,
    source,
  } as unknown as PoolDailyPriceHistory;

  return analysePoolRange({
    pool: protocol === "v3" ? ok(pool as V3Pool) : ok(pool as V4Pool),
    snapshot: ok(snapshot),
    history: ok(history),
    parameters: DEFAULT_PRICE_BAND_PARAMETERS,
    depositUsd: DEFAULT_DEPOSIT_USD,
  });
};

/** A whole case from the fixture above, or a thrown error where a test expected one and the gate refused. */
export const fixtureCase = (options: CaseFixtureOptions = {}): MonthCase => {
  const made = caseOf(caseAnalysis(options), 1);
  if (made === null) throw new Error("the fixture should make a whole case");
  return made;
};
