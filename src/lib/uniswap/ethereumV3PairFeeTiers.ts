import {
  type DataResult,
  nonZeroEvmAddress,
  PAIR_FEE_TIER_FETCH_LIMIT,
  type PairFeeTiers,
} from "../../schemas";
import { fetchEthereumV3PoolReserves } from "./ethereumV3PoolReserves";
import {
  normalizeV3PairFeeTiers,
  type PairFeeTiersDiagnostic,
  readPoolsForReserves,
} from "./v3PairFeeTiersAdapter";
import { POOL_CARD_FRAGMENT } from "./v3PoolCardRawResponse";
import {
  DEFAULT_SUBGRAPH_TIMEOUT_MS,
  type FetchLike,
  postV3SubgraphQuery,
} from "./v3SubgraphTransport";

/**
 * Every pool of one token pair.
 *
 * One selection, filtered on both token addresses. Three things about it were
 * confirmed against the live gateway rather than read off a schema:
 *
 *   - An entity-reference filter (`token0:`) takes the referenced entity's id,
 *     and the generated variable type is `String!`. `ID!` is accepted too; the
 *     declared one is used.
 *   - Asked with the two addresses the other way round it returns an empty list,
 *     because a pool stores its pair in address order. So the caller must pass
 *     them in the pool's own order — which every verified `V3PoolMetadata`
 *     guarantees — and there is no second aliased selection to merge.
 *   - `totalValueLockedUSD` is the source's own figure, which is why it decides
 *     only which pools survive the window, never how they are presented.
 *
 * Both addresses travel as variables and are never spliced into this text.
 */
export const V3_PAIR_FEE_TIERS_QUERY = `query PairFeeTiers($token0: String!, $token1: String!, $limit: Int!) {
  pools(
    where: { token0: $token0, token1: $token1 }
    orderBy: totalValueLockedUSD
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

const INVALID_ADDRESS = "invalid-pool-address";
const NOT_CONFIGURED = "market-data-not-configured";

/** Shared with the other v3 readers: no v3 token or pool sits at address zero. */
const AddressSchema = nonZeroEvmAddress(INVALID_ADDRESS);

export type EthereumV3PairFeeTiersRequest = {
  /** The pool the reader is looking at. It must be one of the pair's pools. */
  readonly poolAddress: string;
  /** The pair, in the pool's own address order. */
  readonly token0Address: string;
  readonly token1Address: string;
  /** Raw environment values; validated here so the wrapper stays free of logic. */
  readonly apiKey: string | undefined;
  readonly subgraphId: string | undefined;
  /** Raw environment value; without it the tiers arrive with no reserves. */
  readonly rpcUrl: string | undefined;
  readonly fetchImpl: FetchLike;
  /** Injected, because a result carries when it was read. */
  readonly now: () => Date;
  readonly timeoutMs?: number;
  readonly onDiagnostic?: PairFeeTiersDiagnostic | undefined;
};

/**
 * Reads every Ethereum mainnet Uniswap v3 pool that trades one token pair.
 *
 * The three addresses arrive from a pool this application has already verified,
 * and they are validated again here rather than trusted — the same order every
 * other reader follows: caller input first, then server configuration, and
 * neither reaches the network.
 *
 * This costs one request beyond the analysis, deliberately its own rather than a
 * second selection bolted onto the metadata read. A pair's siblings are context;
 * failing to read them must cost the page a panel, never its figures.
 */
export const fetchEthereumV3PairFeeTiers = async (
  request: EthereumV3PairFeeTiersRequest,
): Promise<DataResult<PairFeeTiers>> => {
  const poolAddress = AddressSchema.safeParse(request.poolAddress);
  const token0 = AddressSchema.safeParse(request.token0Address);
  const token1 = AddressSchema.safeParse(request.token1Address);
  if (!poolAddress.success || !token0.success || !token1.success) {
    return { status: "unavailable", reason: "invalid-input", notice: INVALID_ADDRESS };
  }

  const apiKey = request.apiKey?.trim();
  const subgraphId = request.subgraphId?.trim();
  if (apiKey === undefined || apiKey === "" || subgraphId === undefined || subgraphId === "") {
    return { status: "unavailable", reason: "configuration-error", notice: NOT_CONFIGURED };
  }

  const transport = await postV3SubgraphQuery({
    apiKey,
    subgraphId,
    query: V3_PAIR_FEE_TIERS_QUERY,
    variables: {
      token0: token0.data,
      token1: token1.data,
      limit: PAIR_FEE_TIER_FETCH_LIMIT,
    },
    fetchImpl: request.fetchImpl,
    timeoutMs: request.timeoutMs ?? DEFAULT_SUBGRAPH_TIMEOUT_MS,
  });

  if (!transport.ok) {
    return { status: "unavailable", reason: transport.reason, notice: transport.notice };
  }

  /*
   * The pools come from the indexer and what they hold comes from the chain,
   * because the indexer's answer is measurably wrong — its own token totals run
   * between 1.3 and 13 times the balances the token contracts report. The two
   * reads are sequential because the second needs the first's pool addresses.
   */
  const pools = readPoolsForReserves(transport.payload);
  const reserves = await fetchEthereumV3PoolReserves({
    pools,
    rpcUrl: request.rpcUrl,
    fetchImpl: request.fetchImpl,
    timeoutMs: request.timeoutMs,
  });

  return normalizeV3PairFeeTiers({
    payload: transport.payload,
    reserves,
    analysedPoolId: poolAddress.data,
    fetchedAt: request.now().toISOString(),
    onDiagnostic: request.onDiagnostic,
  });
};
