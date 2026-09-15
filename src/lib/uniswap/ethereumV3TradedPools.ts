import { type DataResult, type PoolCandidateList } from "../../schemas";
import { normalizeV3TradedPools } from "./v3TradedPoolsAdapter";
import { POOL_CARD_FRAGMENT } from "./v3PoolCardRawResponse";
import {
  DEFAULT_SUBGRAPH_TIMEOUT_MS,
  type FetchLike,
  postV3SubgraphQuery,
} from "./v3SubgraphTransport";

/**
 * The pools a holdings lookup draws its candidate tokens from.
 *
 * Two decisions, both measured against the live source rather than assumed.
 *
 * **Ordered by traded volume, not by reported liquidity.** Asked for the largest
 * pools by `totalValueLockedUSD`, this subgraph answers with `ease.org`,
 * `ez-cvxsteCRV` and `ez-yvCurve-IronBank` before it reaches USDC — the same
 * derived dollar figure that once put a pool nobody trades at the top of a
 * search for "weth". Ordered by volume the first names are USDC, WETH, USDT,
 * WBTC, DAI, wstETH. Money that moved is harder to inflate than money that is
 * claimed to be sitting there.
 *
 * **Filtered on transaction count.** That alone removes those four: their pools
 * have barely been used. It is also the more honest statement of what the list
 * is — pools that have actually been traded — and it needs no view about which
 * dollar figure to believe.
 *
 * The net is deliberately wide. A candidate that nobody holds costs one
 * `eth_call` out of a batch that runs in under a fifth of a second; a candidate
 * that is missing costs a reader the token they came to ask about.
 */
export const V3_TRADED_POOLS_QUERY = `query TradedPools($minTxCount: BigInt!, $limit: Int!) {
  pools(
    where: { txCount_gt: $minTxCount }
    orderBy: volumeUSD
    orderDirection: desc
    first: $limit
  ) {
    ...PoolCard
  }
  _meta {
    hasIndexingErrors
  }
}

${POOL_CARD_FRAGMENT}`;

/**
 * How many transactions a pool needs before its tokens are worth asking about.
 *
 * A thousand is not a quality bar and is not meant as one. It is the level at
 * which the list stops being led by pools that have hardly traded at all.
 */
export const TRADED_POOL_MIN_TX_COUNT = "1000";

/**
 * How many pools to draw candidates from.
 *
 * Measured: 250 pools yield about 176 distinct tokens, and asking all of them
 * for one address's balance took 195 milliseconds against the live endpoint.
 */
export const TRADED_POOL_LIMIT = 250;

const NOT_CONFIGURED = "market-data-not-configured";

export type EthereumV3TradedPoolsRequest = {
  /** Raw environment values; validated here so the wrapper stays free of logic. */
  readonly apiKey: string | undefined;
  readonly subgraphId: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly now: () => Date;
  readonly timeoutMs?: number;
};

/**
 * Reads the most-traded Ethereum mainnet Uniswap v3 pools.
 *
 * Takes no caller input at all, which is why there is nothing to validate before
 * the configuration check: the query is fixed, and the only thing that varies
 * between two calls is what the source has indexed since.
 */
export const fetchEthereumV3TradedPools = async (
  request: EthereumV3TradedPoolsRequest,
): Promise<DataResult<PoolCandidateList>> => {
  const apiKey = request.apiKey?.trim();
  const subgraphId = request.subgraphId?.trim();
  if (apiKey === undefined || apiKey === "" || subgraphId === undefined || subgraphId === "") {
    return { status: "unavailable", reason: "configuration-error", notice: NOT_CONFIGURED };
  }

  const transport = await postV3SubgraphQuery({
    apiKey,
    subgraphId,
    query: V3_TRADED_POOLS_QUERY,
    variables: { minTxCount: TRADED_POOL_MIN_TX_COUNT, limit: TRADED_POOL_LIMIT },
    fetchImpl: request.fetchImpl,
    timeoutMs: request.timeoutMs ?? DEFAULT_SUBGRAPH_TIMEOUT_MS,
  });

  if (!transport.ok) {
    return { status: "unavailable", reason: transport.reason, notice: transport.notice };
  }

  return normalizeV3TradedPools({
    payload: transport.payload,
    fetchedAt: request.now().toISOString(),
  });
};
