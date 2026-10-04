import type { DataResult } from "../../schemas";
import { amountsAt } from "../analytics/divergenceLoss";
import type { V3PositionHistories, V3PositionSnapshot } from "../uniswap/ethereumV3PositionSnapshots";
import { type PositionFees, uncollectedFee } from "../uniswap/feeGrowth";
import { sqrtRatioAtTick } from "../uniswap/v3TickMath";
import type { RawV3Position } from "../uniswap/v3PositionManager";

/*
 * How an open v3 position has done since it was opened, at today's price.
 *
 * Pure — no clock, no network, no environment — like every other composition
 * here. It takes the position as the manager holds it now, the pool's price
 * from the same chain read, the fees that read worked out, and the position's
 * history from its chain's positions subgraph, and it produces a record or the
 * reason there is none.
 *
 * **Fees over the whole life, as the manager itself counted them.** Between
 * two consecutive changes a position's liquidity does not move, so what it
 * earned in that stretch is its liquidity times the growth of fees inside its
 * range across it — and the manager wrote that growth down at both ends, as
 * its `feeGrowthInside{0,1}LastX128` snapshot. The sum of those stretches is
 * every fee the position earned up to its last change, collected or not, with
 * the same uint256 wrap-around and the same floor at each change the contract
 * applies (see uniswap/feeGrowth.ts, whose arithmetic this calls). The stretch
 * since the last change is the one the holdings page already reads from the
 * chain. Measured on 2026-10-04, on mainnet position 998651 in USDC/WETH at
 * 0.05%: the stretch between its first two changes came to 956.15 USDC, and
 * the position had collected 956.148775.
 *
 * **Shown only when the history provably reaches the present.** Its newest
 * snapshot must carry the liquidity the manager holds now and the fee-growth
 * snapshot the manager holds now, both to the unit; it must record a deposit;
 * and no row of it may be missing or unreadable. A subgraph behind the chain
 * fails the first two, a history with a change dropped from its end fails
 * them too, and an unread row is reported by the reader. Anything else is
 * shown as unverified, with no figures — never a partial sum.
 *
 * What the comparison cannot prove is that nothing is missing from the
 * *middle*. A source that skipped a change which moved liquidity would leave
 * one stretch counted at the wrong liquidity; this trusts the subgraph to
 * write a row at every change, which is what it is built to do. And a row
 * holds the end of its block, so two changes to one position inside one
 * block are one row: the fees earned between those two transactions are
 * counted at the liquidity from before both, an error the size of one
 * block's fees on the difference.
 *
 * **Everything at today's price.** Deposits and withdrawals are valued at the
 * price now, not on their day, and gas is not counted; the page says both. The
 * result is what the position holds now, plus what was taken out of it, plus
 * its fees, less what holding the deposits would be worth today. The part
 * before fees is what is usually called impermanent loss.
 */

/** Two amounts in whole tokens, the pool's token0 and token1. */
export type TokenAmounts = {
  readonly token0: number;
  readonly token1: number;
};

export type PositionRecord = {
  /** When its first change was recorded, as an ISO instant. */
  readonly openedAt: string;
  /** Everything put in over its life, from the subgraph's running totals. */
  readonly deposited: TokenAmounts;
  /** Everything taken out of it as principal — not fees. */
  readonly withdrawn: TokenAmounts;
  /** What its liquidity holds at the price now. */
  readonly now: TokenAmounts;
  /** Every fee it earned, collected and not. */
  readonly fees: TokenAmounts;
  /** Whole token1 per whole token0, from the pool's square-root price as the chain holds it. */
  readonly price: number;
};

/** Why a history was read and still does not stand as a record. */
export type UnverifiedReason =
  /** The subgraph has no row for it. */
  | "no-history"
  /** A row could not be read, or the history ran past what one read takes. */
  | "unreadable-history"
  /** Two rows for one block, whose order nothing says. */
  | "same-block"
  /** No deposit in the running totals the record would use. */
  | "no-deposit"
  /** The newest row's liquidity is not the manager's. */
  | "liquidity-differs"
  /** The newest row's fee-growth snapshot is not the manager's. */
  | "fee-growth-differs"
  /** A stretch earned past the uint128 the protocol keeps fees in: a junk-token pool's accounting. */
  | "fees-overflow";

export type PositionRecordResult =
  | { readonly status: "verified"; readonly record: PositionRecord }
  | { readonly status: "unverified"; readonly reason: UnverifiedReason }
  /** Something this needs could not be read: the history, the fees or the price. */
  | { readonly status: "unread" };

/** What a history read said about one position. */
export type PositionHistory =
  | { readonly kind: "read"; readonly snapshots: readonly V3PositionSnapshot[] }
  | { readonly kind: "unreadable" }
  | { readonly kind: "unread" };

/** The manager's own record of the position, as `positions(tokenId)` returned it. */
export type ManagerPosition = Pick<
  RawV3Position,
  | "tickLower"
  | "tickUpper"
  | "liquidity"
  | "feeGrowthInside0Last"
  | "feeGrowthInside1Last"
  | "tokensOwed0"
  | "tokensOwed1"
>;

export type PositionRecordInput = {
  readonly position: ManagerPosition;
  readonly decimals: { readonly token0: number; readonly token1: number };
  readonly history: PositionHistory;
  /** What the position has earned and not yet taken out, from the chain; `null` when unread. */
  readonly uncollected: PositionFees | null;
  /** The pool's `slot0` price, read in the same answer; `null` when unread. */
  readonly sqrtPriceX96: bigint | null;
};

/**
 * One position's history out of a read of several. Not asked, or asked of a
 * read that failed, is unread; asked and reported unreadable is unreadable;
 * asked and answered with no rows is a history with none in it.
 */
export const historyOf = (
  read: DataResult<V3PositionHistories> | undefined,
  tokenId: string,
): PositionHistory => {
  if (read === undefined || read.status === "unavailable" || !read.data.asked.has(tokenId)) return { kind: "unread" };
  if (read.data.unreadable.has(tokenId)) return { kind: "unreadable" };

  return { kind: "read", snapshots: read.data.snapshots.get(tokenId) ?? [] };
};

export type VerifiedHistory =
  | { readonly ok: true; readonly ordered: readonly V3PositionSnapshot[] }
  | { readonly ok: false; readonly reason: UnverifiedReason };

/**
 * Whether a history reaches the chain's present, and its rows oldest first.
 *
 * Ordered here, not trusted to arrive ordered: the newest row is the one the
 * chain is compared with, and the order is what pairs each stretch with the
 * liquidity that earned it.
 */
export const verifyHistory = (
  snapshots: readonly V3PositionSnapshot[],
  position: ManagerPosition,
): VerifiedHistory => {
  if (snapshots.length === 0) return { ok: false, reason: "no-history" };

  const ordered = [...snapshots].sort((left, right) =>
    left.blockNumber < right.blockNumber ? -1 : left.blockNumber > right.blockNumber ? 1 : 0,
  );
  if (ordered.some((snapshot, index) => index > 0 && snapshot.blockNumber === ordered[index - 1]?.blockNumber)) {
    return { ok: false, reason: "same-block" };
  }

  const newest = ordered[ordered.length - 1] as V3PositionSnapshot;
  /* The running totals are cumulative, so the newest row is the one the record's deposits come from. */
  if (!(newest.deposited0 > 0 || newest.deposited1 > 0)) return { ok: false, reason: "no-deposit" };
  if (newest.liquidity !== BigInt(position.liquidity)) return { ok: false, reason: "liquidity-differs" };
  if (
    newest.feeGrowthInside0 !== position.feeGrowthInside0Last ||
    newest.feeGrowthInside1 !== position.feeGrowthInside1Last
  ) {
    return { ok: false, reason: "fee-growth-differs" };
  }

  return { ok: true, ordered };
};

/**
 * What a position earned up to its last change, in each token's smallest unit:
 * for each stretch between two rows, the liquidity the earlier row left it
 * with times the fee growth inside its range across the stretch.
 *
 * The liquidity is the earlier row's because that is the liquidity the
 * stretch was earned with; the later row's is what the change at its end left
 * behind. `null` when a stretch does not fit the protocol's uint128.
 */
export const feesBetweenChanges = (
  ordered: readonly V3PositionSnapshot[],
): { readonly token0: bigint; readonly token1: bigint } | null => {
  let token0 = 0n;
  let token1 = 0n;

  for (let index = 0; index + 1 < ordered.length; index += 1) {
    const earlier = ordered[index] as V3PositionSnapshot;
    const later = ordered[index + 1] as V3PositionSnapshot;
    const stretch = (growthInside: bigint, growthInsideLast: bigint) =>
      uncollectedFee({ growthInside, growthInsideLast, liquidity: earlier.liquidity, owed: 0n });

    const earned0 = stretch(later.feeGrowthInside0, earlier.feeGrowthInside0);
    const earned1 = stretch(later.feeGrowthInside1, earlier.feeGrowthInside1);
    if (earned0 === null || earned1 === null) return null;

    token0 += earned0;
    token1 += earned1;
  }

  return { token0, token1 };
};

const Q96 = 2 ** 96;

/** An exact amount in a token's smallest unit, in whole tokens. */
const whole = (amount: bigint, decimals: number): number => Number(amount) / 10 ** decimals;

/** Whole token1 per whole token0 at a `slot0` price, or `null` past what a double holds. */
export const priceAtSqrt = (
  sqrtPriceX96: bigint,
  decimals: { readonly token0: number; readonly token1: number },
): number | null => {
  const root = Number(sqrtPriceX96) / Q96;
  const price = root * root * 10 ** (decimals.token0 - decimals.token1);

  return Number.isFinite(price) && price > 0 ? price : null;
};

/**
 * What a liquidity holds between two ticks at a `slot0` price, in whole tokens:
 * the protocol's position formulas (see analytics/divergenceLoss.ts), scaled
 * by the liquidity and then by each token's decimals.
 */
export const amountsHeld = ({
  liquidity,
  tickLower,
  tickUpper,
  sqrtPriceX96,
  decimals,
}: {
  readonly liquidity: bigint;
  readonly tickLower: number;
  readonly tickUpper: number;
  readonly sqrtPriceX96: bigint;
  readonly decimals: { readonly token0: number; readonly token1: number };
}): TokenAmounts | null => {
  const lowerRoot = sqrtRatioAtTick(tickLower);
  const upperRoot = sqrtRatioAtTick(tickUpper);
  if (lowerRoot === null || upperRoot === null || !(lowerRoot < upperRoot)) return null;

  const root = Number(sqrtPriceX96) / Q96;
  const perUnit = amountsAt(root * root, lowerRoot, upperRoot);
  const units = Number(liquidity);
  const held = {
    token0: (perUnit.amount0 * units) / 10 ** decimals.token0,
    token1: (perUnit.amount1 * units) / 10 ** decimals.token1,
  };

  return Number.isFinite(held.token0) && Number.isFinite(held.token1) ? held : null;
};

/** Builds one position's record, or says why there is none. */
export const composePositionRecord = ({
  position,
  decimals,
  history,
  uncollected,
  sqrtPriceX96,
}: PositionRecordInput): PositionRecordResult => {
  if (history.kind === "unread" || uncollected === null || sqrtPriceX96 === null) return { status: "unread" };
  if (history.kind === "unreadable") return { status: "unverified", reason: "unreadable-history" };

  const verified = verifyHistory(history.snapshots, position);
  if (!verified.ok) return { status: "unverified", reason: verified.reason };
  const { ordered } = verified;

  const closed = feesBetweenChanges(ordered);
  if (closed === null) return { status: "unverified", reason: "fees-overflow" };

  /*
   * The stretch since the last change: what the chain says is uncollected,
   * less what the manager had already credited by then. That credit is fees
   * from the stretches above — already counted — and, after a withdrawal, the
   * withdrawn principal not yet collected, which is in `withdrawn`. Counting
   * it again would count both twice.
   */
  const open0 = BigInt(uncollected.token0) - position.tokensOwed0;
  const open1 = BigInt(uncollected.token1) - position.tokensOwed1;
  if (open0 < 0n || open1 < 0n) return { status: "unread" };

  const now = amountsHeld({
    liquidity: BigInt(position.liquidity),
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    sqrtPriceX96,
    decimals,
  });
  const price = priceAtSqrt(sqrtPriceX96, decimals);
  if (now === null || price === null) return { status: "unread" };

  const first = ordered[0] as V3PositionSnapshot;
  const newest = ordered[ordered.length - 1] as V3PositionSnapshot;

  return {
    status: "verified",
    record: {
      openedAt: first.at,
      deposited: { token0: newest.deposited0, token1: newest.deposited1 },
      withdrawn: { token0: newest.withdrawn0, token1: newest.withdrawn1 },
      now,
      fees: {
        token0: whole(closed.token0 + open0, decimals.token0),
        token1: whole(closed.token1 + open1, decimals.token1),
      },
      price,
    },
  };
};

/** A record's figures valued in one of its two tokens, at the price it was read at. */
export type RecordValues = {
  /** What the deposits would be worth had they simply been held. */
  readonly held: number;
  readonly now: number;
  readonly withdrawn: number;
  readonly fees: number;
  /** The position against holding, before fees: now and withdrawn, less held. */
  readonly rangeEffect: number;
  /** And with fees: now, withdrawn and fees, less held. */
  readonly result: number;
};

/**
 * The smallest difference, as a share of what the deposits would be worth
 * held, that this arithmetic resolves.
 *
 * What a position holds now is worked out in doubles — square roots of tick
 * prices from `exp`, reciprocals subtracted — and what was deposited is the
 * subgraph's decimal. Each is good to about fourteen figures, so their
 * difference is noise below that: measured on 2026-10-04, an untouched
 * position holding 3.8 * 10^25 of a token came out 6 * 10^10 of it ahead of
 * holding, a part in 10^15 — the doubles disagreeing, not the position
 * earning. A billionth is well clear of that noise and far below anything a
 * price move does, so a range effect inside it is reported as none.
 */
export const RESOLVED_SHARE = 1e-9;

/**
 * Values a record in the token a page quotes the pool in. Every figure is at
 * the same price — the one read with it — so the parts add up to the result
 * exactly as the page writes them.
 */
export const valueRecord = (record: PositionRecord, quote: "token0" | "token1"): RecordValues => {
  const worth = ({ token0, token1 }: TokenAmounts): number =>
    quote === "token1" ? token0 * record.price + token1 : token0 + token1 / record.price;

  const held = worth(record.deposited);
  const now = worth(record.now);
  const withdrawn = worth(record.withdrawn);
  const fees = worth(record.fees);
  const difference = now + withdrawn - held;
  /* Held is never nothing here: a record exists only where the history records a deposit. */
  const rangeEffect = Math.abs(difference) < RESOLVED_SHARE * held ? 0 : difference;

  return { held, now, withdrawn, fees, rangeEffect, result: rangeEffect + fees };
};
