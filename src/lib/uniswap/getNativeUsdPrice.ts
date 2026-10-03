import "server-only";

import type { DataResult } from "../../schemas";
import { keptReads } from "../cache/keptReads";
import { v3SubgraphIdFor, v4SubgraphIdFor } from "../chains/chainEnvironment";
import { type ChainId, readsV3 } from "../chains/chains";
import { loggingFetch, logUnavailable } from "../observability/serverDiagnostics";
import { fetchNativeUsdPrice } from "./nativeUsdPrice";
import { PAIR_READ_TTL_MS, readerLabel } from "./pairReads";

/** Identifies this reader in server-side diagnostics. */
const LABEL = "native-usd-price";

/*
 * Kept ten minutes per chain once answered, as a pair's pools are: the
 * figure it converts — what a pool holds, priced in the chain's currency — is
 * itself up to ten minutes old by then (see pairReads.ts).
 */
const kept = keptReads<DataResult<number>>({
  name: "native-usd-price",
  ttlMs: PAIR_READ_TTL_MS,
  keep: (result) => result.status === "success",
});

/** For tests. */
export const forgetNativeUsdPrice = (): void => kept.forget();

/**
 * The chain's own currency in dollars, from its v3 subgraph where v3 is read
 * and from its v4 subgraph where it is not (Unichain). One price per chain
 * for both protocols' pools: two subgraphs of one chain derive the same
 * currency's price from the chain's own pools, and asking both would double
 * the gateway's cost for the difference between two readings of one market.
 */
export const getNativeUsdPrice = async (chainId: ChainId): Promise<DataResult<number>> => {
  const label = readerLabel(LABEL, chainId);

  return kept.read(String(chainId), async () =>
    logUnavailable(
      label,
      await fetchNativeUsdPrice({
        apiKey: process.env.THE_GRAPH_API_KEY,
        subgraphId: readsV3(chainId) ? v3SubgraphIdFor(chainId) : v4SubgraphIdFor(chainId),
        fetchImpl: loggingFetch(label),
      }),
    ),
  );
};
