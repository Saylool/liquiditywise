import { type PoolDailyPriceHistory, type PoolMarketSnapshot, type Pool, swapFeePpm } from "../../schemas";
import { usdPerToken1 } from "./depositFeeShare";
import { amountsAt, valueInToken1 } from "./divergenceLoss";
import { dayFeeShare, type RangeBacktest, replayLiquidity, replayWindow } from "./rangeBacktest";
import { liquidityPerUnitValue } from "./rangeConcentration";
import { type Placement, placeDay } from "./rangeOccupancy";
import type { RealizedFeeRateResult } from "./realizedFeeRate";

/*
 * One simple active strategy, replayed over the month the suggested range was
 * replayed over: re-centre the range whenever the price leaves it.
 *
 * It opens exactly where "opened thirty days ago" opens — the same close, the
 * same range, drawn the same way from the thirty-one closes before it — so on
 * its first day the two are one position. They part only when a day closes
 * outside the range. The static replay then sits it out, holding one token and
 * earning nothing until the price comes back; this one takes what it holds at
 * that close, swaps the part a range of the same width centred on the close
 * needs, pays the pool's fee on the swap, and carries on in the new range.
 *
 * The rules, in full:
 *
 *   - **The trigger is the close, strictly outside.** A close below the lower
 *     edge or above the upper one re-centres; a close exactly on an edge does
 *     not, because a position's edges are inclusive. A day's high and low play
 *     no part in it: a day that left and came back is not a re-centre, and a
 *     re-centre happens at the close, usually past the edge rather than on it.
 *   - **The width is the opening range's, as multiples of its centre.** The
 *     suggested band is symmetric in logarithms around its close, so the same
 *     band drawn around another close is the first one scaled by the ratio of
 *     the two closes: `[C · lower/P0, C · upper/P0]`. Nothing is refitted —
 *     a re-centre moves the range, it does not redraw it.
 *   - **The swap is the exact one that fills the new range.** At a close
 *     outside the range the position holds a single token; the share of it
 *     sold is the one that leaves the two amounts in the ratio the new range
 *     holds at that close, with the fee taken from what goes in, as the pool
 *     takes it. See {@link rebalanceInto}. Price impact is not modelled: the
 *     swap is priced at the close, as if the pool were deep enough for it.
 *   - **Fees are the month replayed's, day by day, for the range held that
 *     day.** A day counts only if it sat wholly inside the range held through
 *     it — before any re-centre at its close — and its share is the deposit
 *     panel's `L / (A + L)`, through the same function the static replay uses,
 *     with `L` the liquidity the position holds that day. They are collected
 *     aside, not reinvested, exactly as in the static replay.
 *   - **Gas is a cost per re-centre, paid from outside the position**, like
 *     the fees are collected outside it, and only if the reader sets one. The
 *     opening is paid by both strategies and counted in neither.
 *
 * Everything about the position is kept in units of the deposit's own worth at
 * the opening close, in token1: one unit is the whole deposit. A ratio of two
 * such figures needs no dollar rate, and a figure in dollars is that ratio
 * times the deposit — the deposit panel's own convention, under which the
 * deposit is so many dollars of token1 at today's rate. Only the fees need the
 * rate itself, to size the deposit against the pool's active liquidity, and
 * they are absent without it, as the static replay's are.
 *
 * Pure: no clock, no network, no environment. `null` when the month cannot be
 * replayed, when it would not open where the static replay opened, or when the
 * arithmetic leaves the numbers.
 */

/** What a swap pays, per direction, and where that figure came from. */
export type RecentreSwapFee = {
  /** Selling token0 for token1. */
  readonly zeroForOnePpm: number;
  /** Selling token1 for token0. */
  readonly oneForZeroPpm: number;
  /**
   * `stated` when the pool's own terms fix the fee; `measured` when they do
   * not — a v4 hook that sets the fee per swap, or a v4 state that was not
   * read — and the rate is what the month's swaps paid on average.
   */
  readonly basis: "stated" | "measured";
};

/**
 * The fee a re-centre's swap is charged on this pool, or `null` when nothing
 * can say.
 *
 * What the pool's own terms say first, in the swap's own direction: a v3 tier,
 * or a v4 key's fee with the protocol's cut combined the way the PoolManager
 * combines them. Where nothing fixed says, the rate the month's swaps actually
 * paid — the realised-fee panel's whole-window figure, fees over volume, from
 * the same days. Never `currentFeePpm`, one moment's reading of a dynamic fee,
 * for the reason `lpFeePpm` gives for never returning it.
 */
export const recentreSwapFee = (pool: Pool, realized: RealizedFeeRateResult): RecentreSwapFee | null => {
  if (pool.protocolVersion === "v3") {
    return { zeroForOnePpm: pool.feePpm, oneForZeroPpm: pool.feePpm, basis: "stated" };
  }
  if (pool.fee.kind === "static" && pool.protocolFee !== null) {
    return {
      zeroForOnePpm: swapFeePpm(pool.fee.feePpm, pool.protocolFee.zeroForOnePpm),
      oneForZeroPpm: swapFeePpm(pool.fee.feePpm, pool.protocolFee.oneForZeroPpm),
      basis: "stated",
    };
  }
  if (realized.status === "success") {
    const { aggregatePpm } = realized.rate;
    return { zeroForOnePpm: aggregatePpm, oneForZeroPpm: aggregatePpm, basis: "measured" };
  }
  return null;
};

type Amounts = { readonly amount0: number; readonly amount1: number };
type Edges = { readonly lowerPrice: number; readonly upperPrice: number };

/** One swap that fills a range, and what it left. */
export type Rebalance = {
  /** The token sold, or `null` when the holding already had the range's mix. */
  readonly sold: "token0" | "token1" | null;
  /** How much of it went in, in whole units of that token. */
  readonly amountIn: number;
  /** What went in, priced in token1 at the swap's price. */
  readonly valueIn: number;
  /** The fee it paid, priced in token1 at the swap's price. */
  readonly fee: number;
  /** The holding after the swap, in whole units of each token. */
  readonly amount0: number;
  readonly amount1: number;
};

/**
 * The one swap that turns a holding into the mix a range holds at a price.
 *
 * A range holds `u0` token0 for every `u1` token1 at a price inside it, per
 * unit of liquidity (`amountsAt`). A holding of `x0` and `x1` has too much
 * token0 when `x0 · u1 > x1 · u0`; selling `Δ` of it, the pool takes the fee
 * `f` from what goes in and pays `(1 − f) · Δ · P` token1 for the rest, and
 * the ratio is right when
 *
 *     (x0 − Δ) / (x1 + (1 − f) · Δ · P) = u0 / u1
 *
 *     Δ = (x0 · u1 − x1 · u0) / (u1 + (1 − f) · P · u0)
 *
 * and the other way round, selling token1 at `1/P`,
 *
 *     Δ = (x1 · u0 − x0 · u1) / (u0 + (1 − f) · u1 / P)
 *
 * The fee is `f · Δ`, priced in token1: the only thing the swap costs, since
 * price impact is not modelled — every unit trades at `P`. What is left is
 * worth the holding's worth less that fee, and it is exactly the range's mix,
 * so all of it becomes liquidity.
 *
 * The price must sit inside the range, which a range centred on it always
 * does; a range wholly to one side has a single token in its mix and needs no
 * formula.
 */
export const rebalanceInto = (
  holding: Amounts,
  price: number,
  range: Edges,
  swapFee: Pick<RecentreSwapFee, "zeroForOnePpm" | "oneForZeroPpm">,
): Rebalance => {
  const target = amountsAt(price, Math.sqrt(range.lowerPrice), Math.sqrt(range.upperPrice));
  const surplus0 = holding.amount0 * target.amount1 - holding.amount1 * target.amount0;

  if (surplus0 > 0) {
    const fee = swapFee.zeroForOnePpm / 1_000_000;
    const amountIn = surplus0 / (target.amount1 + (1 - fee) * price * target.amount0);
    return {
      sold: "token0",
      amountIn,
      valueIn: amountIn * price,
      fee: fee * amountIn * price,
      amount0: holding.amount0 - amountIn,
      amount1: holding.amount1 + (1 - fee) * amountIn * price,
    };
  }
  if (surplus0 < 0) {
    const fee = swapFee.oneForZeroPpm / 1_000_000;
    const amountIn = -surplus0 / (target.amount0 + ((1 - fee) * target.amount1) / price);
    return {
      sold: "token1",
      amountIn,
      valueIn: amountIn,
      fee: fee * amountIn,
      amount0: holding.amount0 + ((1 - fee) * amountIn) / price,
      amount1: holding.amount1 - amountIn,
    };
  }
  return { sold: null, amountIn: 0, valueIn: 0, fee: 0, amount0: holding.amount0, amount1: holding.amount1 };
};

export type RecentringDay = {
  readonly timestamp: string;
  /** The day's close, in the pool's direction. */
  readonly price: number;
  /** The range held through the day, before any re-centre at its close. */
  readonly lowerPrice: number;
  readonly upperPrice: number;
  /** Where the day sat against that range. */
  readonly placement: Placement;
  /**
   * The deposit's share of the day's fees, or `null` when it took none to
   * count: a day not wholly inside, a day the source gave too little for, or
   * a pool whose dollar rate could not be read.
   */
  readonly feesUsd: number | null;
  readonly recentred: boolean;
  /** The position's worth at the close, after any re-centre, over the worth of holding what the deposit opened as. */
  readonly valueVsHold: number;
};

export type Recentre = {
  readonly timestamp: string;
  /** The close it happened at. */
  readonly price: number;
  /** The range opened, centred on that close. */
  readonly lowerPrice: number;
  readonly upperPrice: number;
  readonly sold: "token0" | "token1";
  /**
   * What was swapped and the fee it paid, each over the deposit's worth at the
   * opening, in token1 at the close it happened at.
   */
  readonly swappedOfDeposit: number;
  readonly swapFeeOfDeposit: number;
  /** The same two in dollars of the deposit, at today's rate. */
  readonly swappedUsd: number;
  readonly swapFeeUsd: number;
};

/**
 * One way of ending the month, against holding: the re-centred position and
 * the one never re-centred, each as what it ends up worth in dollars, and the
 * two set against each other.
 */
export type RecentringOutcome = {
  readonly recentredUsd: number;
  readonly neverUsd: number;
  /** Each against what holding the deposit's opening tokens is worth at the last close. */
  readonly recentredVsHeldUsd: number;
  readonly neverVsHeldUsd: number;
  /** Re-centred less never re-centred. */
  readonly differenceUsd: number;
};

export type RecentringReplay = {
  readonly openedAt: string;
  readonly openingPrice: number;
  /** The range it opened in: the static replay's own. */
  readonly lowerPrice: number;
  readonly upperPrice: number;
  readonly swapFee: RecentreSwapFee;
  readonly days: readonly RecentringDay[];
  readonly recentres: readonly Recentre[];
  /** The days against the range held through each. */
  readonly inside: number;
  readonly outside: number;
  readonly crossed: number;
  /** Worth against holding at the last close, after every swap fee, before fees earned and gas. */
  readonly endValueVsHold: number;
  /** What holding the deposit's opening tokens is worth at the last close, in dollars. */
  readonly heldUsd: number;
  readonly swapFees: { readonly ofDeposit: number; readonly usd: number };
  /** `perRecentreUsd` is zero when the reader set none, and then nothing is counted. */
  readonly gas: { readonly perRecentreUsd: number; readonly usd: number };
  /** As the static replay's: `null` when the pool's dollar rate cannot be read. */
  readonly fees: {
    readonly usd: number;
    readonly ofDeposit: number;
    readonly daysCounted: number;
    readonly daysUnmeasurable: number;
  } | null;
  /** With the fees earned left out: worth and gas only. */
  readonly beforeFees: RecentringOutcome;
  /** With them in; `null` when either strategy's fees could not be sized. */
  readonly afterFees: RecentringOutcome | null;
};

export type RecentringReplayInput = {
  readonly history: PoolDailyPriceHistory;
  readonly snapshot: PoolMarketSnapshot;
  /**
   * The month replayed in the suggested range, never re-centred: where this
   * one opens, the range it opens in, and the figures it is set beside.
   */
  readonly suggested: RangeBacktest;
  readonly swapFee: RecentreSwapFee;
  readonly depositUsd: number;
  /** What one re-centre costs in gas, in dollars; zero counts none. */
  readonly gasUsdPerRecentre: number;
  readonly token0Decimals: number;
  readonly token1Decimals: number;
};

const outcome = (
  heldUsd: number,
  recentredUsd: number,
  neverUsd: number,
): RecentringOutcome => ({
  recentredUsd,
  neverUsd,
  recentredVsHeldUsd: recentredUsd - heldUsd,
  neverVsHeldUsd: neverUsd - heldUsd,
  differenceUsd: recentredUsd - neverUsd,
});

export const calculateRecentringReplay = ({
  history,
  snapshot,
  suggested,
  swapFee,
  depositUsd,
  gasUsdPerRecentre,
  token0Decimals,
  token1Decimals,
}: RecentringReplayInput): RecentringReplay | null => {
  if (!Number.isFinite(gasUsdPerRecentre) || gasUsdPerRecentre < 0) return null;

  const window = replayWindow(history);
  if (window === null) return null;
  const { measured, opening } = window;
  /* Opened anywhere but where the static replay opened, the two columns would not differ by the strategy alone. */
  if (opening.timestamp !== suggested.openedAt || opening.price !== suggested.openingPrice) return null;

  const lowerFactor = suggested.lowerPrice / suggested.openingPrice;
  const upperFactor = suggested.upperPrice / suggested.openingPrice;
  let range: Edges = { lowerPrice: suggested.lowerPrice, upperPrice: suggested.upperPrice };

  /*
   * Liquidity in whole-token terms per unit of the deposit's opening worth.
   * At the opening it is exactly the liquidity the static replay holds, so a
   * month with no re-centre is that replay to the last bit.
   *
   * A range with no width buys none and holds nothing, and is refused by the
   * one check at the end that refuses every arithmetic that left the numbers:
   * what holding is worth is zero there, and every ratio over it is not a
   * number. A second refusal here was written first and removed, because
   * mutation testing showed nothing could reach it that the end did not.
   */
  const opened = liquidityPerUnitValue(range, opening.price) ?? Number.NaN;
  let liquidity = opened;
  /* What holding means here: the opening's own two amounts, per unit of liquidity, as the static replay holds them. */
  const started = amountsAt(opening.price, Math.sqrt(range.lowerPrice), Math.sqrt(range.upperPrice));

  const rate = usdPerToken1(snapshot);
  const sized = rate === null ? null : depositUsd / rate;

  const days: RecentringDay[] = [];
  const recentres: Recentre[] = [];
  let feesUsd = 0;
  let daysCounted = 0;
  let daysUnmeasurable = 0;

  for (const point of measured.points) {
    const held = range;
    const placement = placeDay(point, held.lowerPrice, held.upperPrice);

    /* The fees first, for the range held through the day: a re-centre happens at its close, after them. */
    let dayFees: number | null = null;
    if (placement === "inside" && sized !== null) {
      dayFees = dayFeeShare(point, replayLiquidity(sized, liquidity, token0Decimals, token1Decimals));
      if (dayFees === null) daysUnmeasurable += 1;
      else {
        feesUsd += dayFees;
        daysCounted += 1;
      }
    }

    const below = point.price < held.lowerPrice;
    const recentred = below || point.price > held.upperPrice;
    if (recentred) {
      /* Past an edge the position is one token: all token0 below the range, all token1 above it. */
      const unit = amountsAt(point.price, Math.sqrt(held.lowerPrice), Math.sqrt(held.upperPrice));
      const holding = { amount0: unit.amount0 * liquidity, amount1: unit.amount1 * liquidity };
      const next = { lowerPrice: point.price * lowerFactor, upperPrice: point.price * upperFactor };
      const swap = rebalanceInto(holding, point.price, next, swapFee);

      recentres.push({
        timestamp: point.timestamp,
        price: point.price,
        lowerPrice: next.lowerPrice,
        upperPrice: next.upperPrice,
        sold: below ? "token0" : "token1",
        swappedOfDeposit: swap.valueIn,
        swapFeeOfDeposit: swap.fee,
        swappedUsd: depositUsd * swap.valueIn,
        swapFeeUsd: depositUsd * swap.fee,
      });
      range = next;
      /*
       * What is left after the swap is exactly the new range's mix, so its
       * worth over what one unit of liquidity holds there is the liquidity.
       */
      liquidity =
        valueInToken1(swap, point.price) /
        valueInToken1(amountsAt(point.price, Math.sqrt(next.lowerPrice), Math.sqrt(next.upperPrice)), point.price);
    }

    const worth = valueInToken1(amountsAt(point.price, Math.sqrt(range.lowerPrice), Math.sqrt(range.upperPrice)), point.price);
    days.push({
      timestamp: point.timestamp,
      price: point.price,
      lowerPrice: held.lowerPrice,
      upperPrice: held.upperPrice,
      placement,
      feesUsd: dayFees,
      recentred,
      valueVsHold: (worth / valueInToken1(started, point.price)) * (liquidity / opened),
    });
  }

  const last = days.at(-1);
  if (last === undefined || !Number.isFinite(last.valueVsHold)) return null;

  const heldUsd = (depositUsd * valueInToken1(started, last.price)) / valueInToken1(started, opening.price);
  const swapFeesOfDeposit = recentres.reduce((sum, { swapFeeOfDeposit }) => sum + swapFeeOfDeposit, 0);
  const gasUsd = recentres.length * gasUsdPerRecentre;
  const fees = sized === null ? null : { usd: feesUsd, ofDeposit: feesUsd / depositUsd, daysCounted, daysUnmeasurable };

  const recentredWorthUsd = heldUsd * last.valueVsHold;
  const neverWorthUsd = heldUsd * suggested.endValueVsHold;

  return {
    openedAt: opening.timestamp,
    openingPrice: opening.price,
    lowerPrice: suggested.lowerPrice,
    upperPrice: suggested.upperPrice,
    swapFee,
    days,
    recentres,
    inside: days.filter(({ placement }) => placement === "inside").length,
    outside: days.filter(({ placement }) => placement === "outside").length,
    crossed: days.filter(({ placement }) => placement === "undetermined").length,
    endValueVsHold: last.valueVsHold,
    heldUsd,
    swapFees: { ofDeposit: swapFeesOfDeposit, usd: depositUsd * swapFeesOfDeposit },
    gas: { perRecentreUsd: gasUsdPerRecentre, usd: gasUsd },
    fees,
    beforeFees: outcome(heldUsd, recentredWorthUsd - gasUsd, neverWorthUsd),
    afterFees:
      fees === null || suggested.fees === null
        ? null
        : outcome(heldUsd, recentredWorthUsd + fees.usd - gasUsd, neverWorthUsd + suggested.fees.usd),
  };
};
