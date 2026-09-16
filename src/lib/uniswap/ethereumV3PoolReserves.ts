import type { V3PoolMetadata } from "../../schemas";
import { balanceOfCalldata, readBalanceWord } from "./erc20BalanceAdapter";
import { postAggregatedCalls } from "./ethereumAggregatedCalls";
import { DEFAULT_RPC_TIMEOUT_MS } from "./ethereumRpcTransport";
import type { FetchLike } from "./v3SubgraphTransport";

/*
 * What a pool contract actually holds, asked of the tokens themselves.
 *
 * This exists because the indexer's answer is wrong. Measured against
 * `balanceOf` on five of the busiest pools, the subgraph's
 * `totalValueLockedToken0/1` overstate what is there by between 1.3 and 13
 * times — 144 million USDC reported against 11 million held, 15,058 WETH against
 * 1,729 — and the dollar figure derived from them is internally consistent and
 * therefore wrong by the same factor. A pool's balance is not something an
 * indexer has to accumulate; it is something a token contract can be asked.
 *
 * Read-only, like everything else on this path: the aggregate beneath can
 * issue `eth_call` and `eth_getCode` and nothing else.
 */

/** A pool's two balances, in each token's own base units. */
export type PoolReserves = {
  readonly token0: string;
  readonly token1: string;
};

export type EthereumV3PoolReservesRequest = {
  readonly pools: readonly V3PoolMetadata[];
  /** Raw environment value; a missing one means no reserves rather than a failure. */
  readonly rpcUrl: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number | undefined;
};

/**
 * Reads both balances for each pool, in one call.
 *
 * Returns a map rather than a result, and omits what it could not read rather
 * than failing: these reserves are context beside a list of fee tiers, and a
 * chain that would not answer should cost the reader a figure, not the panel.
 * What must never happen is an unread balance being shown as an empty pool, and
 * that is why a missing entry stays missing instead of becoming a zero.
 */
export const fetchEthereumV3PoolReserves = async ({
  pools,
  rpcUrl,
  fetchImpl,
  timeoutMs,
}: EthereumV3PoolReservesRequest): Promise<ReadonlyMap<string, PoolReserves>> => {
  const endpoint = rpcUrl?.trim();
  if (endpoint === undefined || endpoint === "" || pools.length === 0) return new Map();

  /* Two questions per pool, both asking a token what this pool address holds. */
  const calls = pools.flatMap((pool) => [
    { to: pool.token0.address, data: balanceOfCalldata(pool.id) },
    { to: pool.token1.address, data: balanceOfCalldata(pool.id) },
  ]);

  const aggregated = await postAggregatedCalls({
    rpcUrl: endpoint,
    calls,
    fetchImpl,
    timeoutMs: timeoutMs ?? DEFAULT_RPC_TIMEOUT_MS,
  });
  if (!aggregated.ok) return new Map();

  /* A question that reverted, or answered with something other than a word, is one unread balance. */
  const answers = aggregated.results.map((result) => {
    if (!result.success) return null;
    const balance = readBalanceWord({ result: result.data });

    return balance.ok ? balance.amount : null;
  });

  const reserves = new Map<string, PoolReserves>();
  pools.forEach((pool, index) => {
    const token0 = answers[index * 2];
    const token1 = answers[index * 2 + 1];
    // Both or neither: half a pool's reserves cannot be compared with another's.
    if (token0 == null || token1 == null) return;
    reserves.set(pool.id, { token0, token1 });
  });

  return reserves;
};
