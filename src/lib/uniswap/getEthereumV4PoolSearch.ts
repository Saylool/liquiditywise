import "server-only";

import type { DataResult, V4PoolSearchResults } from "../../schemas";
import { logDetail, loggingFetch, logUnavailable } from "../observability/serverDiagnostics";
import { fetchEthereumV4PoolSearch } from "./ethereumV4PoolSearch";
import { getEthereumV4PoolDays } from "./getEthereumV4PoolDays";
import { rpcUrlFor } from "../chains/chainEnvironment";
import type { ChainId } from "../chains/chains";
import { keptReads } from "../cache/keptReads";
import { SEARCH_READ_TTL_MS } from "./pairReads";

/** Identifies this reader in server-side diagnostics. */
const LABEL = "v4-pool-search";

/*
 * The server-only boundary for the v4 half of a pool search. Same shape and
 * same reasons as the v3 one beside it; deliberately absent from every barrel.
 *
 * The pools come from the shared day-table read, so a search made within ten
 * minutes of a holdings lookup — or of another search — costs the gateway
 * nothing and starts at the chain reads. The `fetchImpl` here is for those.
 */
export const getEthereumV4PoolSearch = async (
  terms: readonly string[],
  chainId: ChainId = 1,
): Promise<DataResult<V4PoolSearchResults>> =>
  kept.read(JSON.stringify([chainId, ...terms]), () => searchV4(terms, chainId));

/* Kept ten minutes per chain and terms once answered, as the v3 search is (see there). */
const kept = keptReads<DataResult<V4PoolSearchResults>>({
  name: "v4-pool-search",
  ttlMs: SEARCH_READ_TTL_MS,
  keep: (result) => result.status === "success",
});

/** For tests. */
export const forgetV4PoolSearch = (): void => kept.forget();

const searchV4 = async (terms: readonly string[], chainId: ChainId): Promise<DataResult<V4PoolSearchResults>> =>
  logUnavailable(
    LABEL,
    await fetchEthereumV4PoolSearch({
      terms,
      readDays: () => getEthereumV4PoolDays(chainId),
      rpcUrl: rpcUrlFor(chainId),
      chainId,
      fetchImpl: loggingFetch(LABEL),
      onDiagnostic: (detail) => {
        logDetail(LABEL, detail);
      },
    }),
  );
