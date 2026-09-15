import { z } from "zod";

import type { ProtocolVersion } from "./uniswap";

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

/**
 * The subgraph that publishes pool data for each protocol.
 *
 * Every model that carries both a pool reference and a source checks itself
 * against this, so there is one answer to "may this source describe this pool"
 * rather than one per schema. A v3 series stamped as v4 — or the reverse — is
 * the kind of mismatch nothing downstream could detect: every figure would be
 * well-formed and would belong to a different pool.
 *
 * `satisfies Record<ProtocolVersion, DataSource>` makes adding a protocol a
 * compile error here rather than a silent fall-through.
 */
export const SUBGRAPH_SOURCE_BY_PROTOCOL = {
  v3: "uniswap-v3-subgraph",
  v4: "uniswap-v4-subgraph",
} as const satisfies Record<ProtocolVersion, DataSource>;

/** The two subgraph sources, as a schema, for a field that may only be one of them. */
export const SubgraphSourceSchema = DataSourceSchema.extract([
  "uniswap-v3-subgraph",
  "uniswap-v4-subgraph",
]);
