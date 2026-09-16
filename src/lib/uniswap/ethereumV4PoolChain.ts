import {
  Bytes32HexSchema,
  type DataFailureNotice,
  type DataFailureReason,
  type DataResult,
  nonZeroEvmAddress,
} from "../../schemas";
import {
  DEFAULT_RPC_TIMEOUT_MS,
  ethCallEntry,
  ethGetLogsEntry,
  postRpcBatch,
} from "./ethereumRpcTransport";
import { blockTag, initializeFilter } from "./ethereumV4PoolKeys";
import type { FetchLike } from "./v3SubgraphTransport";
import type { V4PoolChainReading } from "./v4PoolChainReading";
import { decodeInitializeLog, type V4PoolKey } from "./v4PoolKey";
import {
  extsloadCalldata,
  poolStateSlot,
  readStorageWord,
  SLOT0_OFFSET,
  unpackSlot0,
} from "./v4PoolStateSlots";

/*
 * What the chain says about one v4 pool: its key, from the log that created
 * it, and the fees in its current state.
 *
 * The single-pool counterpart of the two list readers, and unlike them it
 * fails rather than omits. A list can carry a pool whose fee could not be read
 * and say so on the row; a page about one pool has nothing to show without it,
 * and the honest answer is the reason — the endpoint is not configured, the
 * endpoint refused, or the indexer and the chain disagree about the pool.
 *
 * One HTTP request: the log and the state travel in one batch.
 */

const NOT_CONFIGURED = "chain-data-not-configured";
const SOURCE_MALFORMED = "market-data-malformed";
const INCONSISTENT = "pool-configuration-inconsistent";
const UNREADABLE = "chain-data-unreadable";

const PoolManagerAddressSchema = nonZeroEvmAddress("chain-data-malformed");

const unavailable = (
  reason: DataFailureReason,
  notice: DataFailureNotice,
): DataResult<V4PoolChainReading> => ({ status: "unavailable", reason, notice });

export type EthereumV4PoolChainRequest = {
  readonly poolId: string;
  /** Where the indexer says the pool was created; a decimal block number. */
  readonly createdAtBlockNumber: string;
  /** The PoolManager, as the indexer reported it. Never asserted from memory. */
  readonly poolManager: string | null;
  readonly rpcUrl: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number | undefined;
};

/**
 * Reads one pool's key and current fees, or says why it could not.
 *
 * Validation order matches every other reader: the caller's input and the
 * indexer's answer first, then the server's configuration, and none of it
 * reaches the network until all of it is in order.
 */
export const fetchEthereumV4PoolChain = async (
  request: EthereumV4PoolChainRequest,
): Promise<DataResult<V4PoolChainReading>> => {
  const poolId = Bytes32HexSchema.safeParse(request.poolId);
  if (!poolId.success) return unavailable("invalid-input", "invalid-pool-address");

  const manager = PoolManagerAddressSchema.safeParse(request.poolManager);
  const block = blockTag(request.createdAtBlockNumber);
  const slot0 = poolStateSlot(poolId.data, SLOT0_OFFSET);
  if (!manager.success || block === null || slot0 === null) {
    return unavailable("invalid-response", SOURCE_MALFORMED);
  }

  const endpoint = request.rpcUrl?.trim();
  if (endpoint === undefined || endpoint === "") {
    return unavailable("configuration-error", NOT_CONFIGURED);
  }

  const batch = await postRpcBatch({
    rpcUrl: endpoint,
    requests: [
      ethGetLogsEntry(initializeFilter(manager.data, poolId.data, block)),
      ethCallEntry({ to: manager.data, data: extsloadCalldata(slot0) }),
    ],
    fetchImpl: request.fetchImpl,
    timeoutMs: request.timeoutMs ?? DEFAULT_RPC_TIMEOUT_MS,
  });
  if (!batch.ok) return unavailable(batch.reason, batch.notice);

  const [logs, word] = batch.results;
  if (logs === undefined || word === undefined || !logs.ok || !word.ok) {
    return unavailable("invalid-response", UNREADABLE);
  }

  /*
   * No log at the block the indexer named, or none that hashes to this id, is
   * the indexer and the chain disagreeing about what the pool is — the same
   * failure a v3 pool reports when its two sources cannot be reconciled.
   */
  const key = Array.isArray(logs.result)
    ? logs.result
        .map((log) => decodeInitializeLog(log, { poolManager: manager.data, poolId: poolId.data }))
        .find((decoded): decoded is V4PoolKey => decoded !== null) ?? null
    : null;
  if (key === null) return unavailable("invalid-response", INCONSISTENT);

  const stored = readStorageWord(word.result);
  if (stored === null) return unavailable("invalid-response", UNREADABLE);
  const state = unpackSlot0(stored);
  /* A slot nobody wrote: the indexer lists a pool the PoolManager does not have. */
  if (state.sqrtPriceX96 === 0n) return unavailable("invalid-response", INCONSISTENT);

  return {
    status: "success",
    data: {
      key,
      fees: { lpFeePpm: state.lpFeePpm, protocolFee: state.protocolFee },
    },
  };
};
