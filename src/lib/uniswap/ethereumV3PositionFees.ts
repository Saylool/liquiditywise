import type { DataFailureNotice, DataFailureReason, DataResult } from "../../schemas";
import { postAggregatedCalls } from "./ethereumAggregatedCalls";
import { feeGrowthInside, type PositionFees, uncollectedFee } from "./feeGrowth";
import type { Aggregate3Result } from "./multicall3";
import {
  decodeFeeGrowthGlobal,
  decodePoolTick,
  decodeTickFeeGrowth,
  FEE_GROWTH_GLOBAL0_SELECTOR,
  FEE_GROWTH_GLOBAL1_SELECTOR,
  POOL_SLOT0_SELECTOR,
  ticksCalldata,
} from "./v3PoolFees";
import { v3PoolAddress } from "./v3PoolAddress";
import type { RawV3Position } from "./v3PositionManager";
import type { FetchLike } from "./v3SubgraphTransport";

/*
 * What each v3 position has earned and not yet taken out.
 *
 * **A second read, and it cannot be folded into the first.** The pool a
 * position belongs to is derived from the pair and the fee the position names,
 * so there is nothing to ask a pool until the positions are already in hand.
 * One aggregated call carries the lot: three questions per distinct pool, two
 * per position.
 *
 * **A position whose pool would not answer is left out rather than shown as
 * zero.** Nothing earned and nothing read are different facts, and this is the
 * panel where a reader might act on the difference.
 */

const UNREADABLE = "positions-unreadable";

export const DEFAULT_FEES_TIMEOUT_MS = 10_000;

export type EthereumV3PositionFeesRequest = {
  /** The open positions to price. Their pools are derived here. */
  readonly positions: readonly RawV3Position[];
  /** The factory the manager reported for itself, which is where pools come from. */
  readonly factory: string;
  readonly rpcUrl: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
};

/** What one pool had to say about itself, before any position is applied to it. */
type PoolReading = {
  readonly tickCurrent: number;
  readonly global0: bigint;
  readonly global1: bigint;
};

const readPool = (results: readonly Aggregate3Result[], index: number): PoolReading | null => {
  const [slot0, global0, global1] = [
    results[index],
    results[index + 1],
    results[index + 2],
  ];
  if (slot0?.success !== true || global0?.success !== true || global1?.success !== true) return null;

  const tickCurrent = decodePoolTick(slot0.data);
  const first = decodeFeeGrowthGlobal(global0.data);
  const second = decodeFeeGrowthGlobal(global1.data);
  if (tickCurrent === null || first === null || second === null) return null;

  return { tickCurrent, global0: first, global1: second };
};

/**
 * Pairs each position with its pool's reading and its two ticks.
 *
 * Pure, and the whole of what this reader does with an answer. Pairing is by
 * place: the calls went out in the order of `positions` and come back in it.
 */
export const collectV3PositionFees = ({
  positions,
  pools,
  poolResults,
  tickResults,
}: {
  readonly positions: readonly RawV3Position[];
  /** Each position's pool address, in the same order. */
  readonly pools: readonly string[];
  /** One reading per distinct pool, by address. */
  readonly poolResults: ReadonlyMap<string, PoolReading>;
  /** Two answers per position, in order: the lower tick then the upper. */
  readonly tickResults: readonly Aggregate3Result[];
}): ReadonlyMap<string, PositionFees> => {
  const fees = new Map<string, PositionFees>();

  for (const [index, position] of positions.entries()) {
    const pool = pools[index];
    const reading = pool === undefined ? undefined : poolResults.get(pool);
    const lower = tickResults[index * 2];
    const upper = tickResults[index * 2 + 1];
    if (reading === undefined || lower?.success !== true || upper?.success !== true) continue;

    const outsideLower = decodeTickFeeGrowth(lower.data);
    const outsideUpper = decodeTickFeeGrowth(upper.data);
    if (outsideLower === null || outsideUpper === null) continue;

    const shared = {
      tickCurrent: reading.tickCurrent,
      tickLower: position.tickLower,
      tickUpper: position.tickUpper,
    };
    const liquidity = BigInt(position.liquidity);

    const token0 = uncollectedFee({
      growthInside: feeGrowthInside({
        global: reading.global0,
        outsideLower: outsideLower.outside0,
        outsideUpper: outsideUpper.outside0,
        ...shared,
      }),
      growthInsideLast: position.feeGrowthInside0Last,
      liquidity,
      owed: position.tokensOwed0,
    });
    const token1 = uncollectedFee({
      growthInside: feeGrowthInside({
        global: reading.global1,
        outsideLower: outsideLower.outside1,
        outsideUpper: outsideUpper.outside1,
        ...shared,
      }),
      growthInsideLast: position.feeGrowthInside1Last,
      liquidity,
      owed: position.tokensOwed1,
    });
    /*
     * One token unreadable makes the pair unreadable. Half an answer about
     * somebody's own money reads as the whole of it, and the half that is
     * missing is the one that would have said something was wrong.
     */
    if (token0 === null || token1 === null) continue;

    fees.set(position.tokenId, { token0: token0.toString(), token1: token1.toString() });
  }

  return fees;
};

const unavailable = (
  reason: DataFailureReason,
  notice: DataFailureNotice,
): DataResult<ReadonlyMap<string, PositionFees>> => ({ status: "unavailable", reason, notice });

export const fetchEthereumV3PositionFees = async ({
  positions,
  factory,
  rpcUrl,
  fetchImpl,
  timeoutMs = DEFAULT_FEES_TIMEOUT_MS,
}: EthereumV3PositionFeesRequest): Promise<DataResult<ReadonlyMap<string, PositionFees>>> => {
  if (positions.length === 0) return { status: "success", data: new Map() };

  const endpoint = rpcUrl?.trim();
  if (endpoint === undefined || endpoint === "") {
    return unavailable("configuration-error", "chain-data-not-configured");
  }

  /*
   * A position whose pool cannot be derived, or whose ticks cannot be asked
   * for, is dropped here — so the calls that do go out stay lined up with the
   * positions that produced them.
   */
  const askable = positions.filter(
    (position) =>
      v3PoolAddress({
        factory,
        token0: position.token0,
        token1: position.token1,
        feePpm: position.feePpm,
      }) !== null &&
      ticksCalldata(position.tickLower) !== null &&
      ticksCalldata(position.tickUpper) !== null,
  );
  const pools = askable.map(
    (position) =>
      v3PoolAddress({
        factory,
        token0: position.token0,
        token1: position.token1,
        feePpm: position.feePpm,
      }) as string,
  );
  const distinct = [...new Set(pools)];
  if (distinct.length === 0) return { status: "success", data: new Map() };

  const batch = await postAggregatedCalls({
    rpcUrl: endpoint,
    fetchImpl,
    timeoutMs,
    calls: [
      ...distinct.flatMap((pool) => [
        { to: pool, data: POOL_SLOT0_SELECTOR },
        { to: pool, data: FEE_GROWTH_GLOBAL0_SELECTOR },
        { to: pool, data: FEE_GROWTH_GLOBAL1_SELECTOR },
      ]),
      ...askable.flatMap((position, index) => [
        { to: pools[index] as string, data: ticksCalldata(position.tickLower) as string },
        { to: pools[index] as string, data: ticksCalldata(position.tickUpper) as string },
      ]),
    ],
  });
  if (!batch.ok) return unavailable(batch.reason, batch.notice);

  const poolResults = new Map<string, PoolReading>();
  for (const [index, pool] of distinct.entries()) {
    const reading = readPool(batch.results, index * 3);
    if (reading !== null) poolResults.set(pool, reading);
  }
  if (poolResults.size === 0) return unavailable("invalid-response", UNREADABLE);

  return {
    status: "success",
    data: collectV3PositionFees({
      positions: askable,
      pools,
      poolResults,
      tickResults: batch.results.slice(distinct.length * 3),
    }),
  };
};
