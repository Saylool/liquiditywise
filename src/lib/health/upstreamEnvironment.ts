import "server-only";

import type { OtherChain, ProbeDependencies } from "./upstreamProbe";

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
        ] as const
      )
        .filter((entry): entry is readonly [OtherChain, string] => Boolean(entry[1]))
        .map(([chain, url]) => [chain, () => probeRpc(url)]),
    ),
    now: () => new Date(),
  };
};
