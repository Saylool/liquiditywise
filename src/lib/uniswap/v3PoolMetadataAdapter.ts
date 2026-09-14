import {
  type DataFailureNotice,
  type DataResult,
  type EvmAddress,
  EvmAddressSchema,
  type V3PoolMetadata,
  V3PoolMetadataSchema,
} from "../../schemas";
import { V3PoolMetadataResponseSchema } from "./v3PoolMetadataRawResponse";
import { convertSafeInteger } from "./v3SubgraphRawResponse";
import { normalizeV3Token } from "./v3TokenAdapter";

/** This adapter reads Ethereum mainnet only; multi-chain support is not modelled yet. */
export const ETHEREUM_MAINNET_CHAIN_ID = 1;

const MALFORMED = "market-data-malformed";
const INDEXING_ERRORS = "market-data-indexing-errors";
const NOT_FOUND = "pool-not-found";

const unavailable = (
  reason: "invalid-response" | "not-found",
  notice: DataFailureNotice,
): DataResult<V3PoolMetadata> => ({ status: "unavailable", reason, notice });

export type NormalizeV3PoolMetadataInput = {
  /** The decoded JSON body, still untrusted. */
  readonly payload: unknown;
  /** The caller's pool address, already validated and lower-cased. */
  readonly poolAddress: EvmAddress;
};

/**
 * Turns one raw pool-metadata payload into the domain type, or into an explicit
 * failure. Pure: no clock, no network, no environment.
 *
 * There is no `partial` outcome. Every field here is required for the metadata to
 * mean anything — a pool with unknown token decimals cannot be used for price
 * work at all — so the result is either complete or unavailable.
 *
 * No freshness gate either, unlike the snapshot and history readers. Those gate
 * on staleness because their values move; a pool's tokens and fee tier are fixed
 * at deployment, so a reading taken from a lagging indexer is exactly as correct
 * as a fresh one. Rejecting it would discard good data for no gain.
 */
export const normalizeV3PoolMetadata = ({
  payload,
  poolAddress,
}: NormalizeV3PoolMetadataInput): DataResult<V3PoolMetadata> => {
  const parsed = V3PoolMetadataResponseSchema.safeParse(payload);
  if (!parsed.success) return unavailable("invalid-response", MALFORMED);

  const { data, errors } = parsed.data;

  // Fail closed: a GraphQL response may carry data beside errors, and that data
  // is not verified.
  if (errors != null && errors.length > 0) return unavailable("invalid-response", MALFORMED);
  if (data == null) return unavailable("invalid-response", MALFORMED);
  if (data._meta?.hasIndexingErrors === true) {
    return unavailable("invalid-response", INDEXING_ERRORS);
  }
  if (data.pool === null) return unavailable("not-found", NOT_FOUND);

  // The provider echoes the pool id it matched; a mismatch means the response
  // describes a different pool than the one asked about.
  const returnedId = EvmAddressSchema.safeParse(data.pool.id);
  if (!returnedId.success || returnedId.data !== poolAddress) {
    return unavailable("invalid-response", MALFORMED);
  }

  const feePpm = convertSafeInteger(data.pool.feeTier);
  if (!feePpm.ok) return unavailable("invalid-response", MALFORMED);

  const token0 = normalizeV3Token(data.pool.token0, ETHEREUM_MAINNET_CHAIN_ID);
  const token1 = normalizeV3Token(data.pool.token1, ETHEREUM_MAINNET_CHAIN_ID);
  if (token0 === null || token1 === null) return unavailable("invalid-response", MALFORMED);

  const candidate = {
    protocolVersion: "v3",
    chainId: ETHEREUM_MAINNET_CHAIN_ID,
    id: poolAddress,
    token0,
    token1,
    feePpm: feePpm.value,
  };

  /*
   * The domain schema is the final authority. It re-checks the fee bound, the
   * uint8 decimals range, the non-zero token addresses, and — the reason this
   * adapter exists — that token0 sorts before token1. A provider returning the
   * pair the wrong way round would otherwise invert every price derived from
   * these decimals, silently.
   */
  const metadata = V3PoolMetadataSchema.safeParse(candidate);
  if (!metadata.success) return unavailable("invalid-response", MALFORMED);

  return { status: "success", data: metadata.data };
};
