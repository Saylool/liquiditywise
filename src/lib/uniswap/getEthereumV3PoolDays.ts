import "server-only";

import type { DataResult } from "../../schemas";
import { v3SubgraphIdFor } from "../chains/chainEnvironment";
import type { ChainId } from "../chains/chains";
import { loggingFetch, logUnavailable } from "../observability/serverDiagnostics";
import { fetchEthereumV3PoolDays } from "./ethereumV3PoolDays";
import type { V4PoolDays } from "./ethereumV4PoolDays";
import { isCleanAnswer } from "./cleanAnswer";
import { processShared } from "../cache/processShared";

const LABEL = "v3-pool-days";

/** Ten minutes, as the v4 day table's: a week's busiest days barely move in that time. */
const CACHE_TTL_MS = 10 * 60 * 1000;

/*
 * The week's busiest v3 pool-days on one chain, read once for everyone who
 * needs them within ten minutes: the most-traded page, and a name search on a
 * chain whose subgraph cannot answer one (see chains.ts). One entry per chain,
 * shared with the warmer (see processShared.ts).
 */
const cached = processShared(
  "v3-pool-days",
  () => new Map<ChainId, { readonly value: DataResult<V4PoolDays>; readonly writtenAt: number }>(),
);

/** For tests. */
export const forgetV3PoolDays = (): void => {
  cached.clear();
};

/**
 * `refresh` reads anew whatever is kept, for the warmer; a read that fails
 * then leaves the kept one in place.
 */
export const getEthereumV3PoolDays = async (
  chainId: ChainId = 1,
  { refresh = false }: { readonly refresh?: boolean } = {},
): Promise<DataResult<V4PoolDays>> => {
  const now = Date.now();
  const hit = cached.get(chainId);
  if (!refresh && hit !== undefined && now - hit.writtenAt < CACHE_TTL_MS) return hit.value;

  const value = await logUnavailable(
    LABEL,
    await fetchEthereumV3PoolDays({
      apiKey: process.env.THE_GRAPH_API_KEY,
      subgraphId: v3SubgraphIdFor(chainId),
      fetchImpl: loggingFetch(LABEL),
      now: () => new Date(),
    }),
  );

  /*
   * Only a read that answered cleanly: a refusal kept for ten minutes is an
   * outage extended, and so is an answer the gateway sent with errors in it.
   */
  if (value.status === "success" && isCleanAnswer(value.data.payload)) cached.set(chainId, { value, writtenAt: now });

  return value;
};
