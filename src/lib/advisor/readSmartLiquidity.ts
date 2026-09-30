import type { DataFailureNotice, DataResult, V3PoolMetadata } from "../../schemas";
import { choosePositions, composeSmartLiquidity, MIN_WINDOW_DAYS, type PoolReading, type SmartLiquidity } from "../analytics/smartLiquidity";
import type { InRangePool, InRangePosition } from "../uniswap/ethereumV3InRangePositions";
import type { PoolPositionEarnings } from "../uniswap/ethereumV3PositionEarnings";
import type { MostTraded } from "./readMostTraded";

/*
 * The smart-money page's reads, with every source handed in: the week's most
 * traded v3 pools, then per pool its positions in range, when each was last
 * changed, and what the chain says each has earned since.
 *
 * **Per pool, a failure costs that pool and nothing else.** Eleven pools
 * measured and one unread is a true, smaller answer, and the page says how many
 * were read. A page with no pool read at all is unavailable.
 */

/** How many of the week's most traded v3 pools are looked into. */
export const SMART_POOLS = 12;

/** Pools read at once; each is several subgraph questions and a chain read. */
const CONCURRENCY = 3;

const DAY_SECONDS = 86_400;

export type SmartLiquidityRead =
  | {
      readonly status: "measured";
      readonly data: SmartLiquidity;
      readonly poolsAsked: number;
      readonly poolsRead: number;
      readonly measuredAt: string;
    }
  | { readonly status: "unavailable"; readonly notice: DataFailureNotice };

export type SmartLiquiditySources = {
  readonly listPools: () => Promise<MostTraded>;
  readonly readPool: (poolId: string) => Promise<DataResult<InRangePool>>;
  readonly readLastChanges: (tokenIds: readonly string[]) => Promise<DataResult<ReadonlyMap<string, number>>>;
  readonly readEarnings: (
    pool: V3PoolMetadata,
    positions: readonly InRangePosition[],
  ) => Promise<DataResult<PoolPositionEarnings>>;
  readonly now: () => Date;
};

const readOnePool = async (poolId: string, sources: SmartLiquiditySources, nowSeconds: number): Promise<PoolReading | null> => {
  const listed = await sources.readPool(poolId);
  if (listed.status === "unavailable") return null;
  const { pool, tick, usdPerToken0, usdPerToken1, positions } = listed.data;

  const chosen = choosePositions(pool, usdPerToken0, usdPerToken1, tick, positions);
  if (chosen.length === 0) return { pool, usdPerToken0, usdPerToken1, earnings: { tick, positions: [] }, lastChanges: new Map() };

  const changes = await sources.readLastChanges(chosen.map((position) => position.tokenId));
  if (changes.status === "unavailable") return null;

  /* Only a position with a long enough window is worth a chain read. */
  const windowed = chosen.filter((position) => {
    const since = changes.data.get(position.tokenId);
    return since !== undefined && (nowSeconds - since) / DAY_SECONDS >= MIN_WINDOW_DAYS;
  });
  if (windowed.length === 0) return { pool, usdPerToken0, usdPerToken1, earnings: { tick, positions: [] }, lastChanges: changes.data };

  const earnings = await sources.readEarnings(pool, windowed);
  if (earnings.status === "unavailable") return null;

  return { pool, usdPerToken0, usdPerToken1, earnings: earnings.data, lastChanges: changes.data };
};

export const readSmartLiquidity = async (sources: SmartLiquiditySources): Promise<SmartLiquidityRead> => {
  const listed = await sources.listPools();
  if (listed.v3 === null) return { status: "unavailable", notice: "market-data-not-configured" };
  if (listed.v3.status === "unavailable") return { status: "unavailable", notice: listed.v3.notice };

  const poolIds = listed.v3.pools.slice(0, SMART_POOLS).map(({ pool }) => pool.id);
  const nowSeconds = Math.floor(sources.now().getTime() / 1_000);

  const readings: (PoolReading | null)[] = [];
  for (let start = 0; start < poolIds.length; start += CONCURRENCY) {
    readings.push(
      ...(await Promise.all(poolIds.slice(start, start + CONCURRENCY).map((id) => readOnePool(id, sources, nowSeconds)))),
    );
  }

  const read = readings.filter((reading): reading is PoolReading => reading !== null);
  if (read.length === 0) return { status: "unavailable", notice: "market-data-unreachable" };

  return {
    status: "measured",
    data: composeSmartLiquidity(read, nowSeconds),
    poolsAsked: poolIds.length,
    poolsRead: read.length,
    measuredAt: sources.now().toISOString(),
  };
};
