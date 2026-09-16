import { Bytes32HexSchema, nonZeroEvmAddress } from "../../schemas";
import { DEFAULT_RPC_TIMEOUT_MS, type LogFilter, postEthGetLogsBatch } from "./ethereumRpcTransport";
import type { FetchLike } from "./v3SubgraphTransport";
import { decodeInitializeLog, INITIALIZE_TOPIC, type V4PoolKey } from "./v4PoolKey";

/*
 * What the chain says each v4 pool's key is, for a list of pools.
 *
 * One `eth_getLogs` per pool, pinned to the single block the indexer says the
 * pool was created in, for the one event the PoolManager emitted for it. That
 * is the narrowest filter a provider can be asked for and it answers with one
 * log; the block came from the indexer, but a wrong block only means no log,
 * never a wrong one, because the log that comes back has to hash to the pool's
 * id before it is believed.
 *
 * Read-only, like everything on this path, and tolerant like the state read
 * beside it: a pool whose log could not be read is left out of the map rather
 * than given a fee it does not have, and a batch the endpoint refused costs
 * its pools their key and nothing else. The adapter publishes such a pool
 * with its fee marked unread, which is what it is.
 *
 * Measured against the live endpoint on 2026-09-15: a log query costs the
 * endpoint's budget about three times what a storage read does, and a sweep
 * of two hundred and fifty logs in batches of twenty-five was refused from the
 * seventh batch on. So the batches are smaller, and the callers ask only for
 * the pools whose fee the log alone can settle — the hooked ones.
 */

/** Logs per batch. Smaller than a storage batch, because each log query costs about three reads. */
export const LOG_BATCH_SIZE = 10;

/** A pool to ask about, and where the indexer says its creation is. */
export type V4PoolKeyRequest = {
  readonly id: string;
  /** `BigInt!` on the wire: a decimal block number. */
  readonly createdAtBlockNumber: string;
};

/** Refused for the same reason everywhere: nothing lives at the zero address. */
const PoolManagerAddressSchema = nonZeroEvmAddress("chain-data-malformed");

const BLOCK_NUMBER = /^(?:0|[1-9]\d*)$/;

/** A block number as `eth_getLogs` wants it: a hex quantity with no leading zeros. */
export const blockTag = (decimal: string): string | null =>
  BLOCK_NUMBER.test(decimal) ? `0x${BigInt(decimal).toString(16)}` : null;

/** The filter that matches exactly one pool's creation, and nothing else. */
export const initializeFilter = (
  poolManager: string,
  poolId: string,
  block: string,
): LogFilter => ({
  address: poolManager,
  fromBlock: block,
  toBlock: block,
  topics: [INITIALIZE_TOPIC, poolId],
});

export type EthereumV4PoolKeysRequest = {
  readonly pools: readonly V4PoolKeyRequest[];
  /** The PoolManager, as the data source reported it. Never asserted from memory. */
  readonly poolManager: string | null;
  /** Raw environment value; a missing one means no keys rather than a failure. */
  readonly rpcUrl: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number | undefined;
};

/**
 * Reads each pool's key out of its Initialize log, in as few requests as
 * possible, and returns the ones that decoded and hashed to their pool's id.
 */
export const fetchEthereumV4PoolKeys = async ({
  pools,
  poolManager,
  rpcUrl,
  fetchImpl,
  timeoutMs,
}: EthereumV4PoolKeysRequest): Promise<ReadonlyMap<string, V4PoolKey>> => {
  const endpoint = rpcUrl?.trim();
  const manager = PoolManagerAddressSchema.safeParse(poolManager);
  if (endpoint === undefined || endpoint === "" || !manager.success || pools.length === 0) {
    return new Map();
  }

  const askable: { readonly id: string; readonly filter: LogFilter }[] = [];
  for (const pool of pools) {
    const id = Bytes32HexSchema.safeParse(pool.id);
    const block = blockTag(pool.createdAtBlockNumber);
    if (!id.success || block === null) continue;
    askable.push({ id: id.data, filter: initializeFilter(manager.data, id.data, block) });
  }

  const keys = new Map<string, V4PoolKey>();
  for (let at = 0; at < askable.length; at += LOG_BATCH_SIZE) {
    const slice = askable.slice(at, at + LOG_BATCH_SIZE);
    const batch = await postEthGetLogsBatch({
      rpcUrl: endpoint,
      filters: slice.map((entry) => entry.filter),
      fetchImpl,
      timeoutMs: timeoutMs ?? DEFAULT_RPC_TIMEOUT_MS,
    });
    /* A refused batch costs its pools their key; the batches before and after it stand. */
    if (!batch.ok) continue;

    batch.results.forEach((result, index) => {
      const entry = slice[index];
      if (entry === undefined || !result.ok) return;
      /*
       * One log is expected. Every candidate is decoded rather than the first
       * taken, so a stray log the filter admitted could never stand in for the
       * real one — decoding refuses anything that does not hash to the id, and
       * two that do are the same key.
       */
      for (const log of result.logs) {
        const key = decodeInitializeLog(log, { poolManager: manager.data, poolId: entry.id });
        if (key !== null) keys.set(entry.id, key);
      }
    });
  }

  return keys;
};
