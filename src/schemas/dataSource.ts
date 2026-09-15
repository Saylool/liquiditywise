import { z } from "zod";

/**
 * Where a piece of normalized data came from.
 *
 * Identity only. Endpoint URLs, API keys and transport settings belong to the
 * service layer — putting them here would drag credentials into values that are
 * serialized to the client.
 */
export const DataSourceSchema = z.enum([
  "uniswap-v3-subgraph",
  "uniswap-v4-subgraph",
  "hook-registry",
  /**
   * The chain itself, read through a JSON-RPC `eth_call`.
   *
   * Distinct from a subgraph because it is a different kind of answer: an
   * indexer reports what it has processed, and a contract call reports what the
   * contract says right now. Where both can answer, they can disagree.
   */
  "ethereum-rpc",
  /** Computed by this application from other sources rather than fetched. */
  "derived-analytics",
]);

export type DataSource = z.infer<typeof DataSourceSchema>;
