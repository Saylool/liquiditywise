import "server-only";

import { v3PositionsSubgraphIdFor, v3SubgraphIdFor, v4SubgraphIdFor } from "../chains/chainEnvironment";
import type { OtherChain, ProbeDependencies, SubgraphName } from "./upstreamProbe";

/*
 * The cheapest question that still proves a credential.
 *
 * Neither of these asks for data. `_meta { block { number } }` is the
 * subgraph's own health field and touches no entity; `eth_blockNumber` is the
 * smallest call an Ethereum node answers. Both cost a request and nothing
 * else, and both come back 401 or 403 when the credential is the problem,
 * which is the only answer this is asking about.
 *
 * Neither the key nor the RPC URL leaves this module: the probes resolve to
 * an HTTP status and nothing more, so no part of a credential can reach a
 * report, a log or a Telegram message.
 */

/** Ten seconds. A probe that has to wait longer has answered the question. */
const PROBE_TIMEOUT_MS = 10_000;

const GATEWAY_SUBGRAPH_BASE_URL = "https://gateway.thegraph.com/api/subgraphs/id";

const statusOf = async (request: () => Promise<Response>): Promise<number> => {
  try {
    const response = await request();
    return response.status;
  } catch {
    // Unreachable, aborted, DNS — not a credential, and classified as such.
    return 0;
  }
};

const withTimeout = async (run: (signal: AbortSignal) => Promise<Response>): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * `null` when there is nothing configured to probe — a deployment without
 * these keys is not a deployment whose keys are broken.
 */
/** One block-number question to an RPC endpoint, answered by its HTTP status alone. */
const probeRpc = (url: string): Promise<number> =>
  statusOf(() =>
    withTimeout((signal) =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
        signal,
        cache: "no-store",
      }),
    ),
  );

/** Which subgraph each name is, read from the same settings the pages read. */
const SUBGRAPH_IDS: Record<SubgraphName, () => string | undefined> = {
  "v3-ethereum": () => v3SubgraphIdFor(1),
  "v3-base": () => v3SubgraphIdFor(8453),
  "v3-arbitrum": () => v3SubgraphIdFor(42161),
  "v3-optimism": () => v3SubgraphIdFor(10),
  "v3-polygon": () => v3SubgraphIdFor(137),
  "v4-ethereum": () => v4SubgraphIdFor(1),
  "v4-base": () => v4SubgraphIdFor(8453),
  "v4-arbitrum": () => v4SubgraphIdFor(42161),
  "v4-unichain": () => v4SubgraphIdFor(130),
  "v4-optimism": () => v4SubgraphIdFor(10),
  "v4-polygon": () => v4SubgraphIdFor(137),
  "v3-base-positions": () => v3PositionsSubgraphIdFor(8453),
  "v3-optimism-positions": () => v3PositionsSubgraphIdFor(10),
};

/**
 * Whether a subgraph still answers: its own health field and how far behind
 * the chain it is, which touch no entity. The body comes back for the probe
 * to read; it holds no credential, and nothing of it is logged.
 */
const probeSubgraph = (apiKey: string, subgraphId: string) => async (): Promise<{ status: number; body: unknown }> => {
  try {
    const response = await withTimeout((signal) =>
      fetch(`${GATEWAY_SUBGRAPH_BASE_URL}/${subgraphId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ query: "{ _meta { hasIndexingErrors block { timestamp } } }" }),
        signal,
        cache: "no-store",
      }),
    );
    return { status: response.status, body: await response.json().catch(() => null) };
  } catch {
    return { status: 0, body: null };
  }
};

export const upstreamProbes = (): ProbeDependencies | null => {
  const apiKey = process.env.THE_GRAPH_API_KEY?.trim();
  const subgraphId = process.env.UNISWAP_V3_ETHEREUM_SUBGRAPH_ID?.trim();
  const rpcUrl = process.env.ETHEREUM_RPC_URL?.trim();

  if (!apiKey || !subgraphId || !rpcUrl) return null;

  return {
    probeMarketData: () =>
      statusOf(() =>
        withTimeout((signal) =>
          fetch(`${GATEWAY_SUBGRAPH_BASE_URL}/${subgraphId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ query: "{ _meta { block { number } } }" }),
            signal,
            cache: "no-store",
          }),
        ),
      ),
    probeChainData: () => probeRpc(rpcUrl),
    probeOtherChains: Object.fromEntries(
      (
        [
          ["base", process.env.BASE_RPC_URL?.trim()],
          ["arbitrum", process.env.ARBITRUM_RPC_URL?.trim()],
          ["unichain", process.env.UNICHAIN_RPC_URL?.trim()],
          ["optimism", process.env.OPTIMISM_RPC_URL?.trim()],
          ["polygon", process.env.POLYGON_RPC_URL?.trim()],
        ] as const
      )
        .filter((entry): entry is readonly [OtherChain, string] => Boolean(entry[1]))
        .map(([chain, url]) => [chain, () => probeRpc(url)]),
    ),
    probeSubgraphs: Object.fromEntries(
      Object.entries(SUBGRAPH_IDS).flatMap(([name, idOf]) => {
        const id = idOf()?.trim();
        return id ? [[name, probeSubgraph(apiKey, id)]] : [];
      }),
    ),
    now: () => new Date(),
  };
};
