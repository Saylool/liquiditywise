import "server-only";

import type { ChainId } from "../chains/chains";
import { rpcUrlFor } from "../chains/chainEnvironment";
import { loggingFetch } from "../observability/serverDiagnostics";
import { getEthereumV3PoolDays } from "../uniswap/getEthereumV3PoolDays";
import { getEthereumV4PoolDays } from "../uniswap/getEthereumV4PoolDays";
import { type MostTraded, readMostTraded } from "./readMostTraded";

/** Identifies this reader in server-side diagnostics. */
const LABEL = "most-traded";

/**
 * Ten minutes, as the day tables' own caches: the page is the same for
 * everybody, a week's totals barely move in ten minutes, and a crawler
 * walking every language's address of it should cost one read, not eleven.
 */
const CACHE_TTL_MS = 10 * 60 * 1000;

const cached = new Map<ChainId, { readonly value: MostTraded; readonly writtenAt: number }>();

/** For tests. */
export const forgetMostTraded = (): void => {
  cached.clear();
};

/**
 * One chain's page figures, read at most once every ten minutes. Only a read
 * in which every half listed is kept: a half that failed is an outage, and
 * keeping it would extend it by ten minutes. v4 is read on mainnet alone.
 */
export const getMostTraded = async (chainId: ChainId = 1): Promise<MostTraded> => {
  const now = Date.now();
  const hit = cached.get(chainId);
  if (hit !== undefined && now - hit.writtenAt < CACHE_TTL_MS) return hit.value;

  const value = await readMostTraded({
    chainId,
    readV3Days: () => getEthereumV3PoolDays(chainId),
    readV4Days: chainId === 1 ? getEthereumV4PoolDays : null,
    rpcUrl: rpcUrlFor(1),
    fetchImpl: loggingFetch(LABEL),
  });

  if (value.v3.status === "listed" && (value.v4 === null || value.v4.status === "listed")) {
    cached.set(chainId, { value, writtenAt: now });
  }

  return value;
};
