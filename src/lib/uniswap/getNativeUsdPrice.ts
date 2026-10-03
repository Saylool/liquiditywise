import "server-only";

import type { DataResult } from "../../schemas";
import { keptReads } from "../cache/keptReads";
import { v3SubgraphIdFor, v4SubgraphIdFor } from "../chains/chainEnvironment";
import { type ChainId, ETHEREUM, nativeSymbolOf } from "../chains/chains";
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
 * The dollar price of the currency one protocol's subgraph prices in, on one
 * chain — asked of that subgraph, because two subgraphs of one chain need not
 * price in the same currency. On Polygon the v3 subgraph prices in ETH and
 * the v4 one in POL (measured 2026-10-03), so a price taken from one and used
 * for the other's figures is off by the ratio of the two, about 25,000.
 *
 * Where a chain's own currency is ETH and its subgraph does not answer
 * (Unichain's v4 one refused this query with "bad indexers" on 2026-10-03),
 * mainnet's v3 subgraph is asked instead: ETH is one price whichever chain it
 * is quoted on. A chain whose currency is not ETH has no such stand-in.
 */
export const getNativeUsdPrice = async (chainId: ChainId, protocol: "v3" | "v4"): Promise<DataResult<number>> => {
  const label = readerLabel(LABEL, chainId);
  const ask = (subgraphId: string | undefined) =>
    fetchNativeUsdPrice({ apiKey: process.env.THE_GRAPH_API_KEY, subgraphId, fetchImpl: loggingFetch(label) });

  return kept.read(`${chainId}:${protocol}`, async () => {
    const own = await ask(protocol === "v3" ? v3SubgraphIdFor(chainId) : v4SubgraphIdFor(chainId));
    if (own.status === "success" || nativeSymbolOf(chainId) !== "ETH" || chainId === ETHEREUM.id) {
      return logUnavailable(label, own);
    }
    return logUnavailable(label, await ask(v3SubgraphIdFor(ETHEREUM.id)));
  });
};
