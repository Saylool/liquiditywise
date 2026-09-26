import "server-only";

import type { DataResult, V4PoolCandidateList } from "../../schemas";
import { logUnavailable } from "../observability/serverDiagnostics";
import { getEthereumV4PoolDays } from "./getEthereumV4PoolDays";
import { fetchEthereumV4TradedPools } from "./ethereumV4TradedPools";
import type { ChainId } from "../chains/chains";

/** Identifies this reader in server-side diagnostics. */
const LABEL = "v4-traded-pools";

/*
 * The server-only boundary for the v4 candidate list.
 *
 * The cache is one layer down, around the read itself, because the v4 search
 * makes the identical request and the two should not each hold their own copy
 * of half a megabyte. What is left here is the folding of days into pools,
 * which is cheap and is done per lookup.
 */
export const getEthereumV4TradedPools = async (chainId: ChainId = 1): Promise<DataResult<V4PoolCandidateList>> =>
  logUnavailable(LABEL, await fetchEthereumV4TradedPools(() => getEthereumV4PoolDays(chainId), chainId));
