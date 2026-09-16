import { nonZeroEvmAddress } from "../../schemas";
import type { V4PoolChainFees } from "./v4PoolChainReading";
import {
  DEFAULT_RPC_TIMEOUT_MS,
  ETH_CALL_BATCH_SIZE,
  postEthCallBatch,
} from "./ethereumRpcTransport";
import type { FetchLike } from "./v3SubgraphTransport";
import {
  extsloadCalldata,
  LIQUIDITY_OFFSET,
  poolStateSlot,
  readStorageWord,
  SLOT0_OFFSET,
  unpackLiquidity,
  unpackSlot0,
} from "./v4PoolStateSlots";

/*
 * What the PoolManager itself says a v4 pool's active liquidity and price are.
 *
 * This is the v4 counterpart of asking a token contract what a v3 pool holds,
 * and it exists for the same reason: the indexer's answer was checked and found
 * wrong. Its stored liquidity matched the chain on 23 of the 24 busiest pools
 * and was fifteen percent off on the twenty-fourth. A list ordered by it would
 * have put that pool in the wrong place with nothing on the page to show it.
 *
 * Read-only, like everything on this path: `extsload` is a view of raw storage
 * and can change nothing.
 */

/** One pool's state: two exact integer strings, and the fees the same word holds. */
export type V4PoolState = V4PoolChainFees & {
  /** `Pool.State.liquidity`, a uint128. */
  readonly liquidity: string;
  /** `Slot0.sqrtPriceX96`, a uint160. */
  readonly sqrtPriceX96: string;
};

/** Refused for the same reason everywhere: nothing lives at the zero address. */
const PoolManagerAddressSchema = nonZeroEvmAddress("chain-data-malformed");

export type EthereumV4PoolStateRequest = {
  readonly poolIds: readonly string[];
  /** The PoolManager, as the data source reported it. Never asserted from memory. */
  readonly poolManager: string | null;
  /** Raw environment value; a missing one means no state rather than a failure. */
  readonly rpcUrl: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number | undefined;
};

/**
 * Reads price and liquidity for each pool, in as few requests as possible.
 *
 * Returns a map and omits what it could not read, like the v3 reserves read: a
 * chain that would not answer should cost the reader a figure, not the list —
 * and a batch it refused costs the pools in that batch their figure, not the
 * pools in every other batch theirs. What must never happen is an unread pool
 * being ordered as an empty one, and that is why a missing entry stays
 * missing rather than becoming zeros.
 *
 * A price of zero is treated as unread too. An initialised pool's price is never
 * zero, so a zero word is a slot nobody wrote — a pool the PoolManager does not
 * have — and the honest thing to say about it is nothing.
 */
export const fetchEthereumV4PoolStates = async ({
  poolIds,
  poolManager,
  rpcUrl,
  fetchImpl,
  timeoutMs,
}: EthereumV4PoolStateRequest): Promise<ReadonlyMap<string, V4PoolState>> => {
  const endpoint = rpcUrl?.trim();
  const manager = PoolManagerAddressSchema.safeParse(poolManager);
  if (endpoint === undefined || endpoint === "" || !manager.success || poolIds.length === 0) {
    return new Map();
  }

  /* Two calls per pool: the packed price word, then the liquidity word. */
  const calls: { to: string; data: string }[] = [];
  const readable: string[] = [];
  for (const poolId of poolIds) {
    const slot0 = poolStateSlot(poolId, SLOT0_OFFSET);
    const liquidity = poolStateSlot(poolId, LIQUIDITY_OFFSET);
    if (slot0 === null || liquidity === null) continue;
    readable.push(poolId);
    calls.push(
      { to: manager.data, data: extsloadCalldata(slot0) },
      { to: manager.data, data: extsloadCalldata(liquidity) },
    );
  }

  const words: (bigint | null)[] = [];
  for (let at = 0; at < calls.length; at += ETH_CALL_BATCH_SIZE) {
    const slice = calls.slice(at, at + ETH_CALL_BATCH_SIZE);
    const batch = await postEthCallBatch({
      rpcUrl: endpoint,
      calls: slice,
      fetchImpl,
      timeoutMs: timeoutMs ?? DEFAULT_RPC_TIMEOUT_MS,
    });
    /* A refused batch is so many unread words; the other batches stand. */
    if (!batch.ok) {
      words.push(...slice.map(() => null));
      continue;
    }

    for (const result of batch.results) {
      words.push(result.ok ? readStorageWord(result.result) : null);
    }
  }

  const states = new Map<string, V4PoolState>();
  readable.forEach((poolId, index) => {
    const slot0 = words[index * 2];
    const liquidity = words[index * 2 + 1];
    // Both or neither: half a pool's state cannot be valued.
    if (slot0 == null || liquidity == null) return;

    const { sqrtPriceX96, lpFeePpm, protocolFee } = unpackSlot0(slot0);
    if (sqrtPriceX96 === 0n) return;

    states.set(poolId, {
      liquidity: unpackLiquidity(liquidity).toString(),
      sqrtPriceX96: sqrtPriceX96.toString(),
      lpFeePpm,
      protocolFee,
    });
  });

  return states;
};

/**
 * The fees alone — one word per pool rather than two — for pools that are not
 * being ordered by depth: the handful a holdings lookup is about to show. Same
 * endpoint rules, same omission of what could not be read.
 */
export const fetchEthereumV4PoolFees = async ({
  poolIds,
  poolManager,
  rpcUrl,
  fetchImpl,
  timeoutMs,
}: EthereumV4PoolStateRequest): Promise<ReadonlyMap<string, V4PoolChainFees>> => {
  const endpoint = rpcUrl?.trim();
  const manager = PoolManagerAddressSchema.safeParse(poolManager);
  if (endpoint === undefined || endpoint === "" || !manager.success || poolIds.length === 0) {
    return new Map();
  }

  const calls: { to: string; data: string }[] = [];
  const readable: string[] = [];
  for (const poolId of poolIds) {
    const slot0 = poolStateSlot(poolId, SLOT0_OFFSET);
    if (slot0 === null) continue;
    readable.push(poolId);
    calls.push({ to: manager.data, data: extsloadCalldata(slot0) });
  }

  const fees = new Map<string, V4PoolChainFees>();
  for (let at = 0; at < calls.length; at += ETH_CALL_BATCH_SIZE) {
    const batch = await postEthCallBatch({
      rpcUrl: endpoint,
      calls: calls.slice(at, at + ETH_CALL_BATCH_SIZE),
      fetchImpl,
      timeoutMs: timeoutMs ?? DEFAULT_RPC_TIMEOUT_MS,
    });
    if (!batch.ok) continue;

    batch.results.forEach((result, index) => {
      const poolId = readable[at + index];
      const word = result.ok ? readStorageWord(result.result) : null;
      if (poolId === undefined || word === null) return;

      const { sqrtPriceX96, lpFeePpm, protocolFee } = unpackSlot0(word);
      if (sqrtPriceX96 === 0n) return;
      fees.set(poolId, { lpFeePpm, protocolFee });
    });
  }

  return fees;
};
