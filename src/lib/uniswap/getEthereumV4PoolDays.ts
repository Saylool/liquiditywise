import "server-only";

import type { DataResult } from "../../schemas";
import { loggingFetch, logUnavailable } from "../observability/serverDiagnostics";
import { fetchEthereumV4PoolDays, type V4PoolDays } from "./ethereumV4PoolDays";
import { ethereumSubgraphId } from "./ethereumSubgraphs";
import { isCleanAnswer } from "./cleanAnswer";
import { processShared } from "../cache/processShared";

/** Identifies this reader in server-side diagnostics. */
const LABEL = "v4-pool-days";

/*
 * The server-only boundary for the one list of v4 pools, behind the same
 * ten-minute cache the v3 candidate list has, for the same reasons: the query
 * takes no input, so every visitor asks the same question; the list is a net
 * rather than a figure; and a ten-minute-old net only means a pool listed since
 * has not been asked about yet.
 *
 * One cache for two pages, because they now make the identical request. Before
 * this the holdings net was cached and a v4 search was not, so a search paid
 * half a megabyte and a few seconds at the gateway for a list that was already
 * sitting in memory.
 *
 * Per process, like every other limit here: several running copies each keep
 * their own, which costs one query per copy per ten minutes.
 */
const CACHE_TTL_MS = 10 * 60 * 1000;

type Entry = {
  readonly value: DataResult<V4PoolDays>;
  readonly writtenAt: number;
};

/* Shared with the warmer (see processShared.ts). */
const kept = processShared("v4-pool-days", () => ({ entry: null as Entry | null }));

/** Exposed so a test can start from nothing rather than from another test's read. */
export const forgetV4PoolDays = (): void => {
  kept.entry = null;
};

/**
 * `refresh` reads anew whatever is kept, for the warmer; a read that fails
 * then leaves the kept one in place.
 */
export const getEthereumV4PoolDays = async (
  { refresh = false }: { readonly refresh?: boolean } = {},
): Promise<DataResult<V4PoolDays>> => {
  const now = Date.now();
  const cached = kept.entry;
  if (!refresh && cached !== null && now - cached.writtenAt < CACHE_TTL_MS) return cached.value;

  const result = await logUnavailable(
    LABEL,
    await fetchEthereumV4PoolDays({
      apiKey: process.env.THE_GRAPH_API_KEY,
      subgraphId: ethereumSubgraphId("v4"),
      fetchImpl: loggingFetch(LABEL),
      now: () => new Date(),
    }),
  );

  /* Only a read that answered. A refusal cached for ten minutes is an outage extended. */
  if (result.status === "success" && isCleanAnswer(result.data.payload)) kept.entry = { value: result, writtenAt: now };

  return result;
};
