import "server-only";

import { loggingFetch, logUnavailable } from "../observability/serverDiagnostics";
import { fetchEthereumV3PoolDays } from "../uniswap/ethereumV3PoolDays";
import { getEthereumV4PoolDays } from "../uniswap/getEthereumV4PoolDays";
import { type MostTraded, readMostTraded } from "./readMostTraded";

/** Identifies this reader in server-side diagnostics. */
const LABEL = "most-traded";

/**
 * Ten minutes, as the v4 day table's own cache: the page is the same for
 * everybody, a week's totals barely move in ten minutes, and a crawler
 * walking every language's address of it should cost one read, not eleven.
 */
const CACHE_TTL_MS = 10 * 60 * 1000;

let cached: { readonly value: MostTraded; readonly writtenAt: number } | null = null;

/** For tests. */
export const forgetMostTraded = (): void => {
  cached = null;
};

/**
 * The page's figures, read at most once every ten minutes. Only a read in
 * which both halves listed is kept: a half that failed is an outage, and
 * keeping it would extend it by ten minutes.
 */
export const getMostTraded = async (): Promise<MostTraded> => {
  const now = Date.now();
  if (cached !== null && now - cached.writtenAt < CACHE_TTL_MS) return cached.value;

  const value = await readMostTraded({
    readV3Days: async () =>
      logUnavailable(
        LABEL,
        await fetchEthereumV3PoolDays({
          apiKey: process.env.THE_GRAPH_API_KEY,
          subgraphId: process.env.UNISWAP_V3_ETHEREUM_SUBGRAPH_ID,
          fetchImpl: loggingFetch(LABEL),
          now: () => new Date(),
        }),
      ),
    readV4Days: getEthereumV4PoolDays,
    rpcUrl: process.env.ETHEREUM_RPC_URL,
    fetchImpl: loggingFetch(LABEL),
  });

  if (value.v3.status === "listed" && value.v4.status === "listed") cached = { value, writtenAt: now };

  return value;
};
