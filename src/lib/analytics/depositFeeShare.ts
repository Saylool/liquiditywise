import {
  type DataFailureNotice,
  type DepositFeeShare,
  DepositFeeShareSchema,
  type HistoricalPricePoint,
  type PoolMarketSnapshot,
  type TickRange,
} from "../../schemas";
import { liquidityPerUnitValue } from "./rangeConcentration";
import { countOccupancy } from "./rangeOccupancy";

/*
 * What a deposit of a stated size would have taken of the fees the pool charged.
 *
 * Pure: no clock, no network, no environment. Every day it reads was fetched for
 * the volatility figure and every other input is already on the page, so this
 * costs no request.
 *
 * It is one division per day, and all of the care is in the units. A position's
 * share of what a pool charges at a price is its share of the liquidity active
 * there — `L / (A + L)`, where the `+ L` is the deposit diluting itself — and
 * the whole difficulty is that `L` and `A` have to be the same kind of thing.
 * `A` is the protocol's own figure, in the protocol's own units. `L` starts life
 * as a number of dollars.
 *
 * Getting from one to the other is two conversions, and both are exact:
 *
 *   **Dollars into token1.** The source says what the pool holds, in each token
 *   and in dollars. Those three figures name a rate — see {@link usdPerToken1} —
 *   and it is the source's *own* rate, the one its `feesUSD` is denominated in.
 *   A price fetched from anywhere else would divide one pool's fees by another
 *   market's money.
 *
 *   **Token1 into liquidity.** For a position of liquidity `L` in `[pa, pb]`
 *   with the price `P` inside it, the two amounts come to `L · (2√P − √pa −
 *   P/√pb)` measured in token1 — which is what {@link liquidityPerUnitValue}
 *   inverts. The catch is that the protocol's `L` is defined over *raw* token
 *   amounts, where a price is `P · 10^(d1−d0)`; substituting that scales the
 *   bracket by `10^((d1−d0)/2)`, and a value of `V` whole token1 is `V · 10^d1`
 *   raw ones, so the two powers collapse into a single factor:
 *
 *       L = V · 10^((d0+d1)/2) / (2√P − √pa − P/√pb)
 *
 *   Get that factor wrong and nothing looks wrong: the figure stays positive and
 *   finite and is out by a power of ten. It is pinned by a test that derives a
 *   stablecoin's price back out of a real pool's published figures and expects a
 *   dollar.
 *
 * **Days are counted whole or not at all.** Only days the price never left the
 * range are counted, because a day that crossed an edge charged some of its fees
 * while the position was earning and some while it was not, and a daily high and
 * low cannot say how much of each. That is the same rule the occupancy panel
 * counts by, through the same function, so the two cannot disagree about what
 * "inside" means.
 *
 * **It is the past, and it is only the fees.** What this deposit would have
 * taken had it been open is not what the next month pays: the range is centred
 * on today's price and nobody could have opened it a month ago. And a position
 * that collects fees also ends up holding more of whichever token fell — the
 * divergence figure on the same page — so the two have to be read together.
 */

/** How many days could not be shared out, and why, before there is a figure. */
const UNPRICEABLE = "deposit-share-unpriceable";
const NO_DAYS = "deposit-share-no-days";
const UNVERIFIABLE = "deposit-share-unverifiable";

export type DepositFeeShareResult =
  | { readonly status: "success"; readonly data: DepositFeeShare }
  | { readonly status: "unavailable"; readonly notice: DataFailureNotice };

export type DepositFeeShareInput = {
  /** The days to measure over. The caller decides the window. */
  readonly points: readonly HistoricalPricePoint[];
  /** The range being suggested, which is also what the deposit is sized into. */
  readonly range: TickRange;
  /** Where the dollar figures come from: the pool's own holdings. */
  readonly snapshot: PoolMarketSnapshot;
  /** ERC-20 decimals, which are what separate a human price from the protocol's. */
  readonly token0Decimals: number;
  readonly token1Decimals: number;
  /** The size being asked about, in US dollars. */
  readonly depositUsd: number;
};

/**
 * What the source thinks one whole token1 is worth in dollars.
 *
 * Derived from the pool's own published holdings rather than fetched: `tvlUsd`
 * is the dollar value of `lockedToken0` token0 and `lockedToken1` token1, and
 * pricing the first of those in the second — at the pool's own price — puts the
 * whole balance in one unit. The quotient is then dollars per token1.
 *
 * `null` when any figure is missing, and when the pool holds nothing the source
 * can price. That second case is not an error: a pool of two tokens the source
 * does not track reports zero for all three figures, and it reports zero fees
 * for the same reason — so there is nothing to divide and nothing to divide it
 * into.
 */
export const usdPerToken1 = (snapshot: PoolMarketSnapshot): number | null => {
  const { tvlUsd, lockedToken0, lockedToken1, token0PriceInToken1 } = snapshot;
  if (tvlUsd === null || lockedToken0 === null || lockedToken1 === null) return null;
  if (token0PriceInToken1 === null) return null;

  /*
   * One check, on the quotient, rather than three on what goes into it.
   *
   * A pool holding tokens the source does not price publishes real balances and
   * zero dollars, and the quotient is then zero. A pool holding nothing divides
   * by zero, and the quotient is then infinite or `NaN`. Guards against those
   * inputs were written first and removed: mutation testing showed that none of
   * them could fail on its own, because every input that trips one produces a
   * rate this line refuses anyway.
   */
  const rate = tvlUsd / (lockedToken1 + lockedToken0 * token0PriceInToken1);

  return Number.isFinite(rate) && rate > 0 ? rate : null;
};

/**
 * The protocol's liquidity a deposit of `valueInToken1` whole token1 buys in
 * `range`, at the price `range` was drawn around.
 *
 * `null` only when the range cannot be valued at that price, which
 * {@link liquidityPerUnitValue} decides. Through this application's own pipeline
 * that never happens — a `TickRange` is refused by its own schema unless it
 * contains the price it was drawn around — so it guards a direct caller rather
 * than a reader.
 *
 * There is deliberately no second guard on the product. A deposit the schema
 * accepts, at a rate that is finite and positive, cannot make this zero, and an
 * overflow to infinity makes the share `NaN` — which the published schema
 * refuses. A guard no input can trip is a line nothing can check.
 */
const positionLiquidity = (
  range: TickRange,
  valueInToken1: number,
  token0Decimals: number,
  token1Decimals: number,
): number | null => {
  const perUnitValue = liquidityPerUnitValue(range, range.band.currentPrice);
  if (perUnitValue === null) return null;

  return valueInToken1 * 10 ** ((token0Decimals + token1Decimals) / 2) * perUnitValue;
};

/**
 * Shares out every day the price spent wholly inside the range.
 *
 * Reports absence rather than a zero when no day can answer. A range the price
 * left on every day of the month collected nothing, and "$0" would read as a
 * pool that charged nothing rather than as a position that was never open.
 */
export const calculateDepositFeeShare = ({
  points,
  range,
  snapshot,
  token0Decimals,
  token1Decimals,
  depositUsd,
}: DepositFeeShareInput): DepositFeeShareResult => {
  const rate = usdPerToken1(snapshot);
  if (rate === null) return { status: "unavailable", notice: UNPRICEABLE };

  const liquidity = positionLiquidity(range, depositUsd / rate, token0Decimals, token1Decimals);
  if (liquidity === null) return { status: "unavailable", notice: UNPRICEABLE };

  const { placements } = countOccupancy(points, range.lowerPrice, range.upperPrice);

  let daysCounted = 0;
  let daysUnmeasurable = 0;
  let poolFeesUsd = 0;
  let depositFeesUsd = 0;

  for (const [index, point] of points.entries()) {
    if (placements[index] !== "inside") continue;

    /*
     * A day inside the range that cannot be shared out is counted as such rather
     * than skipped, because the two are different things to tell a reader: one
     * is a range the price left, the other is a figure the source did not
     * publish.
     *
     * Zero active liquidity belongs here rather than in the arithmetic below it.
     * The share is `L / (A + L)`, so `A = 0` awards the position every cent the
     * pool charged that day — on the strength of a figure snapshotted when the
     * day closed, for a day on which the pool evidently did have liquidity,
     * since it charged fees at a price inside this range. The source is
     * contradicting itself and the generous reading is the wrong one.
     */
    const active = point.activeLiquidity === null ? 0 : Number(point.activeLiquidity);
    if (point.feesUsd === null || active <= 0) {
      daysUnmeasurable += 1;
      continue;
    }

    daysCounted += 1;
    poolFeesUsd += point.feesUsd;
    depositFeesUsd += point.feesUsd * (liquidity / (active + liquidity));
  }

  if (daysCounted === 0) return { status: "unavailable", notice: NO_DAYS };

  const candidate = {
    depositUsd,
    daysCounted,
    daysUnmeasurable,
    poolFeesUsd,
    depositFeesUsd,
    shareOfDeposit: depositFeesUsd / depositUsd,
  };

  /*
   * The schema is the last authority, and the only one on the size: a deposit
   * outside the range it will publish is refused here rather than at the top,
   * because checking it twice would put a second bound on a figure that already
   * has one. It is also what catches an arithmetic that left the numbers — an
   * overflowing liquidity makes every share `NaN`, and a `NaN` sum is not a
   * dollar figure this may print.
   */
  const verified = DepositFeeShareSchema.safeParse(candidate);
  if (!verified.success) return { status: "unavailable", notice: UNVERIFIABLE };

  return { status: "success", data: verified.data };
};
