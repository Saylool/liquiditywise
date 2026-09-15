import "server-only";

import type { ProtocolVersion } from "../../schemas";

/*
 * Which subgraph answers for which protocol.
 *
 * Server-only, because the values are deployment configuration rather than
 * domain facts, and because reading them anywhere a Client Component could
 * import is how a server-side setting becomes a browser bundle constant. A
 * Subgraph ID is not itself a credential — it is public in The Graph Explorer —
 * but it travels with `THE_GRAPH_API_KEY` and belongs on the same side of the
 * line.
 *
 * Read per call rather than captured at module load, so changing a deployment's
 * configuration takes effect without a restart.
 */

const READERS = {
  v3: () => process.env.UNISWAP_V3_ETHEREUM_SUBGRAPH_ID,
  v4: () => process.env.UNISWAP_V4_ETHEREUM_SUBGRAPH_ID,
} as const satisfies Record<ProtocolVersion, () => string | undefined>;

/**
 * The Subgraph ID configured for one protocol, or `undefined` when this
 * deployment has none.
 *
 * `satisfies Record<ProtocolVersion, …>` is what makes adding a protocol a
 * compile error here rather than a reader that silently queries the v3 subgraph
 * for a v4 pool — which would answer, with a well-formed result, about a pool
 * that does not exist there.
 */
export const ethereumSubgraphId = (protocolVersion: ProtocolVersion): string | undefined =>
  READERS[protocolVersion]();
