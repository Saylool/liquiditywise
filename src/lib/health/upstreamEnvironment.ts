import "server-only";

import { v3PositionsSubgraphIdFor, v3SubgraphIdFor, v4SubgraphIdFor } from "../chains/chainEnvironment";
import type { V4ChainId } from "../chains/chains";
import { emailDigestSetup } from "../email/environment";
import { type BlockscoutChainId, fetchBlockscoutAnswer } from "../verification/blockscout";
import type { SourceAnswer } from "../verification/sourceAnswer";
import { fetchSourcifyAnswer } from "../verification/sourcify";
import type { OtherChain, ProbeDependencies, SubgraphName, VerifierName } from "./upstreamProbe";

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
 *
 * The e-mail provider's key is asked about the same way, where the digest by
 * e-mail is set up (email/environment.ts): its own probe answers a status
 * alone, and a Monday on which every digest silently failed to send would
 * otherwise be the first anybody heard of a key revoked on Tuesday.
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
  "v3-bnb": () => v3SubgraphIdFor(56),
  "v3-avalanche": () => v3SubgraphIdFor(43114),
  "v3-celo": () => v3SubgraphIdFor(42220),
  "v4-ethereum": () => v4SubgraphIdFor(1),
  "v4-base": () => v4SubgraphIdFor(8453),
  "v4-arbitrum": () => v4SubgraphIdFor(42161),
  "v4-unichain": () => v4SubgraphIdFor(130),
  "v4-optimism": () => v4SubgraphIdFor(10),
  "v4-polygon": () => v4SubgraphIdFor(137),
  "v4-bnb": () => v4SubgraphIdFor(56),
  "v4-avalanche": () => v4SubgraphIdFor(43114),
  "v3-base-positions": () => v3PositionsSubgraphIdFor(8453),
  "v3-optimism-positions": () => v3PositionsSubgraphIdFor(10),
  "v3-arbitrum-positions": () => v3PositionsSubgraphIdFor(42161),
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

/**
 * Uniswap's own PoolManager on each network: the one contract every verifier
 * the hook pages ask is known to hold verified there — each network's
 * Blockscout for its own, and Sourcify for mainnet's (it holds none for
 * Unichain's). Measured 2026-10-04. BNB Chain's and Avalanche's have no
 * Blockscout to ask (verification/blockscout.ts); Sourcify holds both, and is
 * asked about mainnet's alone, since it is one service whichever network a
 * question names.
 */
const POOL_MANAGERS = {
  1: "0x000000000004444c5dc75cb358380d2e3de08a90",
  8453: "0x498581ff718922c3f8e6a244956af099b2652b2b",
  42161: "0x360e68faccca8ca495c1b759fd9eee466db9fb32",
  130: "0x1f98400000000000000000000000000000000004",
  10: "0x9a13f98cb987694c9f086b1f5eb990eea8264ec3",
  137: "0x67366782805870060151383f4bbff9dab53e5cd6",
  56: "0x28e2ea090877bf75740558f6bfb36a5ffee9e9df",
  43114: "0x06380c0e0912312b5150364b9dc4542ba0dbbc85",
} as const satisfies Record<V4ChainId, string>;

const askBlockscout = (chainId: BlockscoutChainId) => (): Promise<SourceAnswer> =>
  fetchBlockscoutAnswer({ chainId, address: POOL_MANAGERS[chainId], fetchImpl: fetch, timeoutMs: PROBE_TIMEOUT_MS });

/** Keyless, so always asked: nothing to configure, and nothing that could leave this module but a verdict. */
const VERIFIER_PROBES: Record<VerifierName, () => Promise<SourceAnswer>> = {
  sourcify: () => fetchSourcifyAnswer({ chainId: 1, address: POOL_MANAGERS[1], fetchImpl: fetch, timeoutMs: PROBE_TIMEOUT_MS }),
  "blockscout-ethereum": askBlockscout(1),
  "blockscout-base": askBlockscout(8453),
  "blockscout-arbitrum": askBlockscout(42161),
  "blockscout-unichain": askBlockscout(130),
  "blockscout-optimism": askBlockscout(10),
  "blockscout-polygon": askBlockscout(137),
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
          ["bnb", process.env.BNB_RPC_URL?.trim()],
          ["avalanche", process.env.AVALANCHE_RPC_URL?.trim()],
          ["celo", process.env.CELO_RPC_URL?.trim()],
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
    probeVerifiers: VERIFIER_PROBES,
    ...emailProbe(),
    now: () => new Date(),
  };
};

/** The e-mail provider's probe, where the digest by e-mail is set up, and nothing where it is not. */
const emailProbe = (): Pick<ProbeDependencies, "probeEmailProvider"> => {
  const email = emailDigestSetup();
  return email === null ? {} : { probeEmailProvider: email.provider.probe };
};
