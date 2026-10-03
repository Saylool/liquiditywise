import "server-only";

import { logDetail } from "../observability/serverDiagnostics";
import { getEthereumV3PoolDays } from "../uniswap/getEthereumV3PoolDays";
import { getEthereumV3PoolSearch } from "../uniswap/getEthereumV3PoolSearch";
import { getEthereumV4PoolDays } from "../uniswap/getEthereumV4PoolDays";
import { getEthereumV4PoolSearch } from "../uniswap/getEthereumV4PoolSearch";
import { getNativeUsdPrice } from "../uniswap/getNativeUsdPrice";
import type { PairPools, PairTerms } from "./pairPools";
import { readPairPools } from "./readPairPools";

/** Identifies this reader in server-side diagnostics. */
const LABEL = "pair-pools";

/*
 * The server-only boundary for the pair page: the readers the pool page's
 * search and the most-traded page already use, each with its own cache, so a
 * pair searched a minute ago on the pool page — or any day table the warmer
 * keeps — costs nothing here. Nothing is cached at this level: every piece is
 * kept where it is read, for as long as it is good.
 */
export const getPairPools = async (terms: PairTerms): Promise<PairPools> =>
  readPairPools(terms, {
    searchV3: (searched, chainId) => getEthereumV3PoolSearch(searched, chainId),
    searchV4: (searched, chainId) => getEthereumV4PoolSearch(searched, chainId),
    daysV3: (chainId) => getEthereumV3PoolDays(chainId),
    daysV4: (chainId) => getEthereumV4PoolDays(chainId),
    nativeUsd: (chainId) => getNativeUsdPrice(chainId),
    onThrown: (where) => {
      logDetail(LABEL, `a read threw instead of answering: ${where}`);
    },
  });
