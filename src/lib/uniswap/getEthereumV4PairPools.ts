import "server-only";

import type { DataResult, V4PairPools } from "../../schemas";
import { keptReads } from "../cache/keptReads";
import { logDetail, loggingFetch, logUnavailable } from "../observability/serverDiagnostics";
import { fetchEthereumV4PairPools } from "./ethereumV4PairPools";
import { getEthereumV4PoolDays } from "./getEthereumV4PoolDays";
import { rpcUrlFor, v4SubgraphIdFor } from "../chains/chainEnvironment";
import { chainById, type ChainId } from "../chains/chains";
import { PAIR_READ_TTL_MS, readerLabel } from "./pairReads";

/** Identifies this reader in server-side diagnostics. */
const LABEL = "v4-pair-pools";

/*
 * Kept for ten minutes per pair, once answered: the v4 page, the v3 page and
 * the comparison page all ask about the same pair, and the subgraph answers
 * the same query in a third of a second one minute and ten seconds the next.
 */
const kept = keptReads<DataResult<V4PairPools>>({
  name: "v4-pair-pools",
  ttlMs: PAIR_READ_TTL_MS,
  keep: (result) => result.status === "success",
});

/** For tests. */
export const forgetV4PairPools = (): void => kept.forget();

/*
 * The server-only boundary for the v4 pools of one pair. Same shape as the v3
 * fee-tiers wrapper beside it; deliberately absent from every barrel.
 *
 * On a chain whose subgraph cannot answer the pair query (`v4Pairs: "days"`
 * in chains.ts) the pair's pools come from the week's day table instead.
 */
export const getEthereumV4PairPools = async (
  pair: {
    readonly analysedPoolId: string | null;
    readonly token0Address: string;
    readonly token1Address: string;
  },
  chainId: ChainId = 1,
): Promise<DataResult<V4PairPools>> => {
  const label = readerLabel(LABEL, chainId);
  const key = JSON.stringify([
    chainId,
    pair.analysedPoolId,
    pair.token0Address.toLowerCase(),
    pair.token1Address.toLowerCase(),
  ]);

  return kept.read(key, async () =>
    logUnavailable(
      label,
      await fetchEthereumV4PairPools({
        ...pair,
        apiKey: process.env.THE_GRAPH_API_KEY,
        subgraphId: v4SubgraphIdFor(chainId),
        rpcUrl: rpcUrlFor(chainId),
        chainId,
        ...(chainById(chainId).v4Pairs === "days" ? { readDays: () => getEthereumV4PoolDays(chainId) } : {}),
        fetchImpl: loggingFetch(label),
        now: () => new Date(),
        onDiagnostic: (detail) => {
          logDetail(label, detail);
        },
      }),
    ),
  );
};
