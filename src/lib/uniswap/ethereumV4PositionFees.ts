import type { DataFailureNotice, DataFailureReason, DataResult } from "../../schemas";
import { postAggregatedCalls } from "./ethereumAggregatedCalls";
import { feeGrowthInside, type PositionFees, uncollectedFee } from "./feeGrowth";
import type { Aggregate3Result } from "./multicall3";
import type { FetchLike } from "./v3SubgraphTransport";
import { extsloadCalldata, poolStateSlot, readStorageWord, unpackSlot0 } from "./v4PoolStateSlots";
import { tickFeeGrowthSlots, v4PositionKey, v4PositionSlots } from "./v4PositionSlots";
import { V4_POSITION_MANAGER_ADDRESS, type RawV4Position } from "./v4PositionManager";

/*
 * What each v4 position has earned and not yet taken out.
 *
 * The same arithmetic as v3 over a completely different read. A v4 pool is not
 * a contract to call but an entry in the PoolManager's storage, so every figure
 * here comes back through `extsload` one raw word at a time: three words per
 * pool, seven per position.
 *
 * **The seventh word is the check.** Six of them are the figures; the seventh is
 * the position's own liquidity, read from the slot this derivation computed and
 * compared with what the PositionManager reports for the same token. They can
 * only agree if the pool id, both ticks and the salt were all right — so a
 * position where they differ is dropped rather than shown, because a slot that
 * is off by anything holds a different position's money.
 *
 * v4 keeps nothing like v3's `tokensOwed`: fees are settled when liquidity is
 * modified and nothing is credited in between, so the amount owed at the last
 * touch is zero and the whole figure is the growth since.
 */

const UNREADABLE = "positions-unreadable";

export const DEFAULT_V4_FEES_TIMEOUT_MS = 10_000;

export type EthereumV4PositionFeesRequest = {
  readonly positions: readonly RawV4Position[];
  /** Where the pools' state lives, as the position manager itself reported it. */
  readonly poolManager: string;
  readonly rpcUrl: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
};

type PoolReading = {
  readonly tickCurrent: number;
  readonly global0: bigint;
  readonly global1: bigint;
};

/** The seven slots one position's fees are read from, in the order they are asked. */
export const v4FeeSlots = (position: RawV4Position): readonly string[] | null => {
  const lower = tickFeeGrowthSlots(position.poolId, position.tickLower);
  const upper = tickFeeGrowthSlots(position.poolId, position.tickUpper);
  const key = v4PositionKey({
    owner: V4_POSITION_MANAGER_ADDRESS,
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    salt: BigInt(position.tokenId),
  });
  if (lower === null || upper === null || key === null) return null;

  const own = v4PositionSlots(position.poolId, key);
  if (own === null) return null;

  return [lower.outside0, lower.outside1, upper.outside0, upper.outside1, own.liquidity, own.last0, own.last1];
};

const word = (result: Aggregate3Result | undefined): bigint | null =>
  result?.success === true ? readStorageWord(result.data) : null;

/**
 * Turns the words into one figure per position.
 *
 * Pure, and the whole of what this reader does with an answer. Pairing is by
 * place: seven words per position, in the order {@link v4FeeSlots} asked for
 * them.
 */
export const collectV4PositionFees = ({
  positions,
  pools,
  words: answers,
}: {
  readonly positions: readonly RawV4Position[];
  readonly pools: ReadonlyMap<string, PoolReading>;
  readonly words: readonly Aggregate3Result[];
}): ReadonlyMap<string, PositionFees> => {
  const fees = new Map<string, PositionFees>();

  for (const [index, position] of positions.entries()) {
    const pool = pools.get(position.poolId);
    const seven = Array.from({ length: 7 }, (_unused, offset) => word(answers[index * 7 + offset]));
    if (pool === undefined || seven.some((value) => value === null)) continue;
    const [lower0, lower1, upper0, upper1, storedLiquidity, last0, last1] = seven as [
      bigint, bigint, bigint, bigint, bigint, bigint, bigint,
    ];

    /* The derivation's own proof: a slot that is off holds somebody else's. */
    const liquidity = BigInt(position.liquidity);
    if ((storedLiquidity & ((1n << 128n) - 1n)) !== liquidity) continue;

    const shared = {
      tickCurrent: pool.tickCurrent,
      tickLower: position.tickLower,
      tickUpper: position.tickUpper,
    };

    const token0 = uncollectedFee({
      growthInside: feeGrowthInside({
        global: pool.global0,
        outsideLower: lower0,
        outsideUpper: upper0,
        ...shared,
      }),
      growthInsideLast: last0,
      liquidity,
      owed: 0n,
    });
    const token1 = uncollectedFee({
      growthInside: feeGrowthInside({
        global: pool.global1,
        outsideLower: lower1,
        outsideUpper: upper1,
        ...shared,
      }),
      growthInsideLast: last1,
      liquidity,
      owed: 0n,
    });
    /* One token unreadable makes the pair unreadable, as on the v3 side. */
    if (token0 === null || token1 === null) continue;

    fees.set(position.tokenId, { token0: token0.toString(), token1: token1.toString() });
  }

  return fees;
};

const unavailable = (
  reason: DataFailureReason,
  notice: DataFailureNotice,
): DataResult<ReadonlyMap<string, PositionFees>> => ({ status: "unavailable", reason, notice });

const ADDRESS = /^0x[0-9a-f]{40}$/;

export const fetchEthereumV4PositionFees = async ({
  positions,
  poolManager,
  rpcUrl,
  fetchImpl,
  timeoutMs = DEFAULT_V4_FEES_TIMEOUT_MS,
}: EthereumV4PositionFeesRequest): Promise<DataResult<ReadonlyMap<string, PositionFees>>> => {
  if (positions.length === 0) return { status: "success", data: new Map() };
  if (!ADDRESS.test(poolManager)) return unavailable("invalid-response", UNREADABLE);

  const endpoint = rpcUrl?.trim();
  if (endpoint === undefined || endpoint === "") {
    return unavailable("configuration-error", "chain-data-not-configured");
  }

  const askable = positions.filter((position) => v4FeeSlots(position) !== null);
  const distinct = [...new Set(askable.map((position) => position.poolId))];
  if (distinct.length === 0) return { status: "success", data: new Map() };

  const poolSlots = distinct.map((poolId) => [0, 1, 2].map((offset) => poolStateSlot(poolId, offset)));
  if (poolSlots.some((slots) => slots.some((slot) => slot === null))) {
    return unavailable("invalid-response", UNREADABLE);
  }

  const batch = await postAggregatedCalls({
    rpcUrl: endpoint,
    fetchImpl,
    timeoutMs,
    calls: [
      ...poolSlots.flat().map((slot) => ({ to: poolManager, data: extsloadCalldata(slot as string) })),
      ...askable.flatMap((position) =>
        (v4FeeSlots(position) as readonly string[]).map((slot) => ({
          to: poolManager,
          data: extsloadCalldata(slot),
        })),
      ),
    ],
  });
  if (!batch.ok) return unavailable(batch.reason, batch.notice);

  const pools = new Map<string, PoolReading>();
  for (const [index, poolId] of distinct.entries()) {
    const slot0 = word(batch.results[index * 3]);
    const global0 = word(batch.results[index * 3 + 1]);
    const global1 = word(batch.results[index * 3 + 2]);
    if (slot0 === null || global0 === null || global1 === null) continue;
    pools.set(poolId, { tickCurrent: unpackSlot0(slot0).tick, global0, global1 });
  }
  if (pools.size === 0) return unavailable("invalid-response", UNREADABLE);

  return {
    status: "success",
    data: collectV4PositionFees({
      positions: askable,
      pools,
      words: batch.results.slice(distinct.length * 3),
    }),
  };
};
