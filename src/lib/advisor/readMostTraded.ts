import type { DataResult } from "../../schemas";
import type { V4PoolDays } from "../uniswap/ethereumV4PoolDays";
import { fetchEthereumV4PoolKeys } from "../uniswap/ethereumV4PoolKeys";
import { fetchEthereumV4PoolStates } from "../uniswap/ethereumV4PoolState";
import type { FetchLike } from "../uniswap/v3SubgraphTransport";
import { hookedRefs, poolRefs } from "../uniswap/v4PoolSearchAdapter";
import { composeMostTradedV3, composeMostTradedV4, type MostTradedList, v4WeekCandidates } from "./mostTraded";
import type { ChainId } from "../chains/chains";

/*
 * The most-traded page's reads, with every source handed in: the two day
 * tables, and the chain for the v4 fees the indexer does not carry.
 *
 * The halves are read together and fail apart. A v3 subgraph that is down
 * costs the page its v3 half and nothing else; the v4 chain not answering
 * costs the v4 half its fees, which then read as unread, and never the list.
 */

/** `v4` is `null` off mainnet, the only chain a v4 subgraph is read on. */
export type MostTraded = { readonly v3: MostTradedList; readonly v4: MostTradedList | null };

export type ReadDays = () => Promise<DataResult<V4PoolDays>>;

export type ReadMostTradedRequest = {
  readonly readV3Days: ReadDays;
  /** `null` off mainnet: no v4 is read there. */
  readonly readV4Days: ReadDays | null;
  /** The chain the v3 day table is on; mainnet when not said. */
  readonly chainId?: ChainId;
  /** Raw environment value; without it the v4 fees are unread. */
  readonly rpcUrl: string | undefined;
  readonly fetchImpl: FetchLike;
};

const readV3 = async (readDays: ReadDays, chainId: ChainId): Promise<MostTradedList> => {
  const days = await readDays();
  if (days.status === "unavailable") return { status: "unavailable", notice: days.notice };

  return composeMostTradedV3({ ...days.data, chainId });
};

const readV4 = async (
  readV4Days: ReadDays,
  { rpcUrl, fetchImpl }: ReadMostTradedRequest,
): Promise<MostTradedList> => {
  const days = await readV4Days();
  if (days.status === "unavailable") return { status: "unavailable", notice: days.notice };

  const candidates = v4WeekCandidates(days.data.payload);
  if ("status" in candidates) return candidates;

  /*
   * As the v4 search reads them: the state for every pool, which holds the fee
   * it stores, and the creation log only for a hooked one, the one case where
   * that stored fee may not be the fee the pool charges.
   */
  const refs = poolRefs(candidates.weeks.map(({ card }) => card));
  const chain = { poolManager: candidates.poolManager, rpcUrl, fetchImpl };
  const [keys, fees] = await Promise.all([
    fetchEthereumV4PoolKeys({ pools: hookedRefs(refs), ...chain }),
    fetchEthereumV4PoolStates({ poolIds: refs.map(({ id }) => id), ...chain }),
  ]);

  return composeMostTradedV4({ weeks: candidates.weeks, keys, fees, fetchedAt: days.data.fetchedAt });
};

export const readMostTraded = async (request: ReadMostTradedRequest): Promise<MostTraded> => {
  const [v3, v4] = await Promise.all([
    readV3(request.readV3Days, request.chainId ?? 1),
    request.readV4Days === null ? null : readV4(request.readV4Days, request),
  ]);

  return { v3, v4 };
};
