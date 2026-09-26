import "server-only";

import type { ChainId } from "../chains/chains";
import { rpcUrlFor } from "../chains/chainEnvironment";
import { processShared } from "../cache/processShared";
import { loggingFetch } from "../observability/serverDiagnostics";
import { getEthereumV3PoolDays } from "../uniswap/getEthereumV3PoolDays";
import { getEthereumV4PoolDays } from "../uniswap/getEthereumV4PoolDays";
import { type MostTraded, readMostTraded } from "./readMostTraded";
import { MOST_TRADED_TTL_MS } from "./warmMostTraded";

/** Identifies this reader in server-side diagnostics. */
const LABEL = "most-traded";


/* Shared with the warmer (see processShared.ts). */
const cached = processShared(
  "most-traded",
  () => new Map<ChainId, { readonly value: MostTraded; readonly writtenAt: number }>(),
);

/** For tests. */
export const forgetMostTraded = (): void => {
  cached.clear();
};

/**
 * One chain's page figures, read at most once every thirty minutes, and
 * anew every twenty-five by the warmer, so a reader never waits on the read. Only a read
 * in which every half listed is kept: a half that failed is an outage, and
 * keeping it would extend it. v4 is read on mainnet alone.
 *
 * `refresh` reads anew, day tables included, whatever is kept; a read that
 * fails then leaves the kept one to serve until it runs out.
 */
export const getMostTraded = async (
  chainId: ChainId = 1,
  { refresh = false }: { readonly refresh?: boolean } = {},
): Promise<MostTraded> => {
  const now = Date.now();
  const hit = cached.get(chainId);
  if (!refresh && hit !== undefined && now - hit.writtenAt < MOST_TRADED_TTL_MS) return hit.value;

  const value = await readMostTraded({
    chainId,
    readV3Days: () => getEthereumV3PoolDays(chainId, { refresh }),
    readV4Days: chainId === 1 ? () => getEthereumV4PoolDays({ refresh }) : null,
    rpcUrl: rpcUrlFor(1),
    fetchImpl: loggingFetch(LABEL),
  });

  if (value.v3.status === "listed" && (value.v4 === null || value.v4.status === "listed")) {
    cached.set(chainId, { value, writtenAt: now });
  }

  return value;
};
