import "server-only";

import type { DataResult, V4PairPools } from "../../schemas";
import { logDetail, loggingFetch, logUnavailable } from "../observability/serverDiagnostics";
import { fetchEthereumV4PairPools } from "./ethereumV4PairPools";
import { rpcUrlFor, v4SubgraphIdFor } from "../chains/chainEnvironment";
import type { ChainId } from "../chains/chains";

/** Identifies this reader in server-side diagnostics. */
const LABEL = "v4-pair-pools";

/*
 * The server-only boundary for the v4 pools of one pair. Same shape as the v3
 * fee-tiers wrapper beside it; deliberately absent from every barrel.
 */
export const getEthereumV4PairPools = async (
  pair: {
    readonly analysedPoolId: string | null;
    readonly token0Address: string;
    readonly token1Address: string;
  },
  chainId: ChainId = 1,
): Promise<DataResult<V4PairPools>> =>
  logUnavailable(
    LABEL,
    await fetchEthereumV4PairPools({
      ...pair,
      apiKey: process.env.THE_GRAPH_API_KEY,
      subgraphId: v4SubgraphIdFor(chainId),
      rpcUrl: rpcUrlFor(chainId),
      chainId,
      fetchImpl: loggingFetch(LABEL),
      now: () => new Date(),
      onDiagnostic: (detail) => {
        logDetail(LABEL, detail);
      },
    }),
  );
