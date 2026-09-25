import {
  Bytes32HexSchema,
  type DataSource,
  EvmAddressSchema,
  nonZeroEvmAddress,
  type ProtocolVersion,
} from "../../schemas";
import type { ChainId } from "../chains/chains";

/*
 * What a subgraph adapter needs to know about *which* pool it is reading, and
 * nothing else.
 *
 * The v3 and v4 subgraphs answer the same two queries — a pool's current state
 * and its daily rows — with the same field names and the same shapes. Everything
 * that makes a v3 read differ from a v4 read is in here: how a pool is named,
 * which protocol the answer describes, and which source to stamp on it.
 *
 * Parameterising rather than copying is not tidiness. The snapshot adapter holds
 * the price-direction mapping, the freshness gate and the reciprocal check; the
 * daily adapter holds the extremes inversion and the per-row ownership proof.
 * A second copy of either would be a second place for those to be right, and the
 * day they disagreed both would still return well-formed data.
 */

/** Refused for a v3 pool address for the same reason everywhere: no pool is there. */
const V3PoolAddressSchema = nonZeroEvmAddress("invalid-pool-address");

export type SubgraphPoolIdentity = {
  readonly protocolVersion: ProtocolVersion;
  /** The chain the pool is on, stamped onto every result the read produces. */
  readonly chainId: ChainId;
  /** Which subgraph the figures came from, stamped onto every result. */
  readonly source: DataSource;
  /** The validated, canonical id this read asked about. */
  readonly id: string;
  /**
   * Whether an id the provider echoed back names this same pool.
   *
   * A function rather than a string comparison, because the two protocols spell
   * an id differently and each has to be re-validated before it is compared:
   * an echo is untrusted text, and comparing it raw would let a differently
   * cased or padded string pass for the pool that was asked about.
   */
  readonly matches: (echoed: string) => boolean;
};

/**
 * Builds the identity for a v3 pool, or `null` when the address is not one.
 *
 * Returning `null` rather than throwing keeps the "caller input first, then
 * configuration" order the readers already follow: a malformed address is
 * answered before any credential is even looked at.
 */
export const v3PoolIdentity = (poolAddress: string, chainId: ChainId = 1): SubgraphPoolIdentity | null => {
  const address = V3PoolAddressSchema.safeParse(poolAddress);
  if (!address.success) return null;

  return {
    protocolVersion: "v3",
    chainId,
    source: "uniswap-v3-subgraph",
    id: address.data,
    matches: (echoed) => {
      const parsed = EvmAddressSchema.safeParse(echoed);
      return parsed.success && parsed.data === address.data;
    },
  };
};

/**
 * Builds the identity for a v4 pool.
 *
 * A PoolId is a 32-byte hash, not an address: a v4 pool is an entry inside the
 * singleton PoolManager rather than a contract of its own. The zero hash is not
 * specially refused here the way the zero address is for v3 — it is a perfectly
 * possible keccak256 output, and no pool is known to occupy it, so it simply
 * fails to be found like any other id nobody initialised.
 */
export const v4PoolIdentity = (poolId: string): SubgraphPoolIdentity | null => {
  const id = Bytes32HexSchema.safeParse(poolId);
  if (!id.success) return null;

  return {
    protocolVersion: "v4",
    /* Mainnet only: no v4 subgraph is configured for any other chain. */
    chainId: 1,
    source: "uniswap-v4-subgraph",
    id: id.data,
    matches: (echoed) => {
      const parsed = Bytes32HexSchema.safeParse(echoed);
      return parsed.success && parsed.data === id.data;
    },
  };
};

/**
 * How each protocol names a pool, keyed by protocol so a reader can take the
 * version as a parameter.
 *
 * `satisfies Record<ProtocolVersion, …>` is what makes adding a protocol a
 * compile error here rather than a reader that silently falls through to `v3`.
 */
/**
 * Validates a caller-supplied pool id the way its protocol spells one, on the
 * chain it was asked about. A v4 pool on another chain is refused rather than
 * looked up on mainnet, where the same id would name a different pool or none.
 */
export const poolIdentityFor = (
  protocolVersion: ProtocolVersion,
  poolId: string,
  chainId: ChainId = 1,
): SubgraphPoolIdentity | null => {
  if (protocolVersion === "v3") return v3PoolIdentity(poolId, chainId);
  return chainId === 1 ? v4PoolIdentity(poolId) : null;
};
