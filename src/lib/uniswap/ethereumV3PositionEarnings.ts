import type { DataFailureNotice, DataFailureReason, DataResult } from "../../schemas";
import type { V3ChainId } from "../chains/chains";
import { keccak256Hex } from "../crypto/keccak256";
import { decodeAddress } from "./abiWords";
import { postAggregatedCalls } from "./ethereumAggregatedCalls";
import { collectV3PositionFees } from "./ethereumV3PositionFees";
import type { InRangePosition } from "./ethereumV3InRangePositions";
import type { Aggregate3Result } from "./multicall3";
import {
  decodeFeeGrowthGlobal,
  decodePoolTick,
  FEE_GROWTH_GLOBAL0_SELECTOR,
  FEE_GROWTH_GLOBAL1_SELECTOR,
  POOL_SLOT0_SELECTOR,
  ticksCalldata,
} from "./v3PoolFees";
import { v3PoolAddress } from "./v3PoolAddress";
import {
  decodePosition,
  FACTORY_SELECTOR,
  isPositionManagerCode,
  ownerOfCalldata,
  positionsCalldata,
  type RawV3Position,
  V3_POSITION_MANAGERS,
} from "./v3PositionManager";
import type { FetchLike } from "./v3SubgraphTransport";

/*
 * What each listed position has earned since it was last changed, read from
 * the chain — with who holds it and how much liquidity it has.
 *
 * **Since the last change, and nothing from before it.** The manager keeps
 * `tokensOwed`, but after a withdrawal that figure holds the withdrawn
 * principal until it is collected, so it is not fees. It is left out: what
 * is counted is the liquidity times the fee growth inside the range since the
 * manager last wrote its snapshot — exactly the fees accrued since the last
 * change, which is the window the subgraph's snapshot dates.
 *
 * **Every position is checked against the pool it was listed in.** Its pair
 * and fee must derive, through the manager's own factory, to that pool's
 * address, and its ticks must be the ones listed. One that does not match is
 * dropped: a listing that named the wrong position cannot put someone else's
 * earnings on this pool.
 */

const NOT_CONFIGURED = "chain-data-not-configured";
const MANAGER_UNVERIFIED = "positions-manager-unverified";
const UNREADABLE = "positions-unreadable";

/** Positions per aggregated call: four questions each, well inside what an endpoint answers at once. */
export const EARNINGS_BATCH = 100;

const DEFAULT_TIMEOUT_MS = 15_000;

/** One position as the chain has it, with its fees since the last change in each token's smallest unit. */
export type PositionEarnings = {
  readonly tokenId: string;
  readonly owner: string;
  readonly liquidity: string;
  readonly tickLower: number;
  readonly tickUpper: number;
  readonly fees0: string;
  readonly fees1: string;
};

export type PoolPositionEarnings = {
  /** The pool's tick as the chain reports it, which the fees were worked out at. */
  readonly tick: number;
  readonly positions: readonly PositionEarnings[];
};

export type PositionEarningsRequest = {
  readonly chainId: V3ChainId;
  readonly pool: {
    readonly id: string;
    readonly token0: { readonly address: string };
    readonly token1: { readonly address: string };
    readonly feePpm: number;
  };
  readonly positions: readonly InRangePosition[];
  readonly rpcUrl: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
};

const unavailable = (
  reason: DataFailureReason,
  notice: DataFailureNotice,
): DataResult<PoolPositionEarnings> => ({ status: "unavailable", reason, notice });

/**
 * Pairs each position's answers with the pool's reading. Pure: the calls went
 * out in the order of `positions`, four each, and come back in it.
 */
export const collectPositionEarnings = ({
  pool,
  factory,
  positions,
  tickCurrent,
  global0,
  global1,
  answers,
}: {
  readonly pool: PositionEarningsRequest["pool"];
  readonly factory: string;
  readonly positions: readonly InRangePosition[];
  readonly tickCurrent: number;
  readonly global0: bigint;
  readonly global1: bigint;
  /** Four per position: positions(), ownerOf(), the lower tick, the upper tick. */
  readonly answers: readonly Aggregate3Result[];
}): readonly PositionEarnings[] => {
  const kept: { position: RawV3Position; owner: string; lower: Aggregate3Result; upper: Aggregate3Result }[] = [];

  for (const [index, listed] of positions.entries()) {
    const [record, holder, lower, upper] = answers.slice(index * 4, index * 4 + 4);
    if (record?.success !== true || holder?.success !== true || lower === undefined || upper === undefined) continue;

    const decoded = decodePosition(listed.tokenId, record.data);
    const owner = decodeAddress(holder.data, 0);
    if (decoded === null || owner === null || decoded.liquidity === "0") continue;
    if (decoded.tickLower !== listed.tickLower || decoded.tickUpper !== listed.tickUpper) continue;
    const derived = v3PoolAddress({ factory, token0: decoded.token0, token1: decoded.token1, feePpm: decoded.feePpm });
    if (derived !== pool.id.toLowerCase()) continue;

    /* The owed figures carry withdrawn principal until collected, so they are not counted. */
    kept.push({ position: { ...decoded, tokensOwed0: 0n, tokensOwed1: 0n }, owner, lower, upper });
  }

  const fees = collectV3PositionFees({
    positions: kept.map(({ position }) => position),
    pools: kept.map(() => pool.id.toLowerCase()),
    poolResults: new Map([[pool.id.toLowerCase(), { tickCurrent, global0, global1 }]]),
    tickResults: kept.flatMap(({ lower, upper }) => [lower, upper]),
  });

  return kept.flatMap(({ position, owner }) => {
    const earned = fees.get(position.tokenId);
    return earned === undefined
      ? []
      : [
          {
            tokenId: position.tokenId,
            owner,
            liquidity: position.liquidity,
            tickLower: position.tickLower,
            tickUpper: position.tickUpper,
            fees0: earned.token0,
            fees1: earned.token1,
          },
        ];
  });
};

export const fetchEthereumV3PositionEarnings = async ({
  chainId,
  pool,
  positions,
  rpcUrl,
  fetchImpl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: PositionEarningsRequest): Promise<DataResult<PoolPositionEarnings>> => {
  const endpoint = rpcUrl?.trim();
  if (endpoint === undefined || endpoint === "") return unavailable("configuration-error", NOT_CONFIGURED);

  const manager = V3_POSITION_MANAGERS[chainId].address;
  const shared = { rpcUrl: endpoint, fetchImpl, timeoutMs };
  const askable = positions.filter(
    (position) =>
      positionsCalldata(position.tokenId) !== null &&
      ticksCalldata(position.tickLower) !== null &&
      ticksCalldata(position.tickUpper) !== null,
  );

  const first = await postAggregatedCalls({
    ...shared,
    calls: [
      { to: manager, data: FACTORY_SELECTOR },
      { to: pool.id, data: POOL_SLOT0_SELECTOR },
      { to: pool.id, data: FEE_GROWTH_GLOBAL0_SELECTOR },
      { to: pool.id, data: FEE_GROWTH_GLOBAL1_SELECTOR },
    ],
    codeOf: [manager],
  });
  if (!first.ok) return unavailable(first.reason, first.notice);
  if (!isPositionManagerCode(first.codes[0], keccak256Hex, chainId)) {
    return unavailable("configuration-error", MANAGER_UNVERIFIED);
  }

  const [factoryResult, slot0, g0, g1] = first.results;
  const factory = factoryResult?.success === true ? decodeAddress(factoryResult.data, 0) : null;
  const tickCurrent = slot0?.success === true ? decodePoolTick(slot0.data) : null;
  const global0 = g0?.success === true ? decodeFeeGrowthGlobal(g0.data) : null;
  const global1 = g1?.success === true ? decodeFeeGrowthGlobal(g1.data) : null;
  if (factory === null || tickCurrent === null || global0 === null || global1 === null) {
    return unavailable("invalid-response", UNREADABLE);
  }

  const earned: PositionEarnings[] = [];
  for (let start = 0; start < askable.length; start += EARNINGS_BATCH) {
    const batch = askable.slice(start, start + EARNINGS_BATCH);
    const answered = await postAggregatedCalls({
      ...shared,
      calls: batch.flatMap((position) => [
        { to: manager, data: positionsCalldata(position.tokenId) as string },
        { to: manager, data: ownerOfCalldata(position.tokenId) as string },
        { to: pool.id, data: ticksCalldata(position.tickLower) as string },
        { to: pool.id, data: ticksCalldata(position.tickUpper) as string },
      ]),
    });
    if (!answered.ok) return unavailable(answered.reason, answered.notice);
    earned.push(
      ...collectPositionEarnings({ pool, factory, positions: batch, tickCurrent, global0, global1, answers: answered.results }),
    );
  }

  return { status: "success", data: { tick: tickCurrent, positions: earned } };
};
