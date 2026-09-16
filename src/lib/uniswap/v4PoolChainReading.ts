import type { V4PoolKey } from "./v4PoolKey";
import type { ProtocolFeeBits } from "./v4PoolStateSlots";

/*
 * What the chain says about a v4 pool, as the adapter is handed it beside the
 * indexer's record: the key from the log that created the pool, and the fees
 * from its current state. Either may be missing for a pool in a list, and the
 * adapter publishes what it can with the rest marked unread.
 */

export type V4PoolChainFees = {
  /** `Slot0.lpFee`, the LP fee the pool currently stores. */
  readonly lpFeePpm: number;
  readonly protocolFee: ProtocolFeeBits;
};

export type V4PoolChainReading = {
  readonly key: V4PoolKey | null;
  readonly fees: V4PoolChainFees | null;
};

/** The reading for a pool the chain could not be asked about. */
export const UNREAD_CHAIN: V4PoolChainReading = { key: null, fees: null };

/** One pool's reading out of the two maps a list read fills. */
export const chainReadingFor = (
  poolId: string,
  keys: ReadonlyMap<string, V4PoolKey>,
  fees: ReadonlyMap<string, V4PoolChainFees>,
): V4PoolChainReading => ({
  key: keys.get(poolId) ?? null,
  fees: fees.get(poolId) ?? null,
});
