import "server-only";

import { rpcUrlFor, v3PositionsSubgraphIdFor, v3SubgraphIdFor } from "../chains/chainEnvironment";
import type { V3PositionChainId } from "../chains/chains";
import { logUnavailable, loggingFetch } from "../observability/serverDiagnostics";
import { fetchEthereumV3Position } from "../uniswap/ethereumV3Position";
import { fetchEthereumV3PoolsByIds } from "../uniswap/ethereumV3PoolsByIds";
import { fetchEthereumV3PositionFees } from "../uniswap/ethereumV3PositionFees";
import { fetchEthereumV3PositionHistories } from "../uniswap/ethereumV3PositionSnapshots";
import { v3PoolAddress } from "../uniswap/v3PoolAddress";
import { describeOneV3, type DescribedV3Position } from "./addressPositions";

/** Identifies this reader in server-side diagnostics. */
const LABEL = "position-record";

/*
 * The server-only boundary for one open v3 position and its record, by token
 * id — what the share card is drawn from (see share/readPositionCard.ts).
 *
 * The holdings page reads an address's positions and, with them, each one's
 * history (getAddressPositions.ts). A card is asked about one position whose
 * id it already has, and the owner is nobody's business on it, so the sweep
 * by owner is replaced by one question to the manager; everything after that
 * is the same read the page makes, with the same readers: the pool derived
 * and confirmed by the subgraph, the fees and the price from the chain, the
 * history from the positions subgraph, and the same composition (see
 * addressPositions.ts) with the same proof. Nothing about a position is read
 * twice in two ways.
 *
 * `import "server-only"` keeps the RPC endpoint and the Graph key out of a
 * browser bundle, as everywhere else. Deliberately absent from every barrel.
 */

export type PositionRecordRead =
  /** The position as the manager holds it, and its record or why there is none. */
  | { readonly status: "found"; readonly described: DescribedV3Position }
  /** No open position under that id on that chain, or one whose pool could not be confirmed. */
  | { readonly status: "not-found" }
  /** The chain or a source could not be read just now. */
  | { readonly status: "unavailable" };

/**
 * One position and its record, on a chain whose positions are kept (see
 * chains.ts): the card is offered only where a record can be verified.
 *
 * The fees and the history are read together, after the position, since both
 * need the position before they can be asked for. Fees that could not be read
 * cost the record and not the answer, as on the holdings page; a history that
 * could not be read is reported as unavailable by its reader and becomes an
 * unread record in the composition. Never throws: a card is no place to show
 * a fault, so a throw from any reader is an unavailable read.
 */
export const getPositionRecord = async (tokenId: string, chainId: V3PositionChainId): Promise<PositionRecordRead> => {
  try {
    const rpcUrl = rpcUrlFor(chainId);
    const apiKey = process.env.THE_GRAPH_API_KEY;

    const read = await fetchEthereumV3Position({ tokenId, chainId, rpcUrl, fetchImpl: fetch });
    if (read.status === "unavailable") {
      await logUnavailable(LABEL, read);
      return { status: "unavailable" };
    }
    const { factory, position } = read.data;
    if (position === null) return { status: "not-found" };

    const derived = v3PoolAddress({ factory, token0: position.token0, token1: position.token1, feePpm: position.feePpm });
    if (derived === null) return { status: "not-found" };

    const [pools, fees, history] = await Promise.all([
      fetchEthereumV3PoolsByIds({
        poolAddresses: [derived],
        chainId,
        apiKey,
        subgraphId: v3SubgraphIdFor(chainId),
        fetchImpl: loggingFetch(LABEL),
      }),
      fetchEthereumV3PositionFees({ positions: [position], factory, rpcUrl, fetchImpl: fetch }),
      fetchEthereumV3PositionHistories([tokenId], {
        chainId,
        apiKey,
        subgraphId: v3PositionsSubgraphIdFor(chainId),
        fetchImpl: loggingFetch(LABEL),
      }),
    ]);
    if (pools.status === "unavailable") {
      await logUnavailable(LABEL, pools);
      return { status: "unavailable" };
    }
    if (fees.status === "unavailable") await logUnavailable(`${LABEL}-fees`, fees);
    if (history.status === "unavailable") await logUnavailable(`${LABEL}-history`, history);

    const described = describeOneV3(
      {
        raw: { factory, held: 1, read: 1, open: [position], closed: 0 },
        pools: pools.data,
        fees: fees.status === "success" ? fees.data.fees : new Map(),
        sqrtPrices: fees.status === "success" ? fees.data.sqrtPrices : new Map(),
        history,
      },
      tokenId,
    );

    return described === null ? { status: "not-found" } : { status: "found", described };
  } catch {
    return { status: "unavailable" };
  }
};
