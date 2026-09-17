import "server-only";

import type { DataResult, V4PoolSearchResults } from "../../schemas";
import { logDetail, loggingFetch, logUnavailable } from "../observability/serverDiagnostics";
import { fetchEthereumV4PoolSearch } from "./ethereumV4PoolSearch";
import { getEthereumV4PoolDays } from "./getEthereumV4PoolDays";

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
): Promise<DataResult<V4PoolSearchResults>> =>
  logUnavailable(
    LABEL,
    await fetchEthereumV4PoolSearch({
      terms,
      readDays: getEthereumV4PoolDays,
      rpcUrl: process.env.ETHEREUM_RPC_URL,
      fetchImpl: loggingFetch(LABEL),
      onDiagnostic: (detail) => {
        logDetail(LABEL, detail);
      },
    }),
  );
