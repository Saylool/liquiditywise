import {
  type DataFailureNotice,
  type DataResult,
  type V4FeeConfiguration,
  type V4Pool,
  V4PoolSchema,
  ZERO_ADDRESS,
} from "../../schemas";
import { normalizeV3Token } from "./v3TokenAdapter";
import { convertSafeInteger } from "./v3SubgraphRawResponse";
import { V4PoolResponseSchema } from "./v4PoolRawResponse";

/** This adapter reads Ethereum mainnet only; multi-chain support is not modelled yet. */
export const ETHEREUM_MAINNET_CHAIN_ID = 1;

const MALFORMED = "market-data-malformed";
const INDEXING_ERRORS = "market-data-indexing-errors";
const NOT_FOUND = "pool-not-found";

const unavailable = (
  reason: "invalid-response" | "not-found",
  notice: DataFailureNotice,
): DataResult<V4Pool> => ({ status: "unavailable", reason, notice });

/**
 * `LPFeeLibrary.DYNAMIC_FEE_FLAG`, the sentinel a PoolKey carries instead of a
 * fee when the hook sets one per swap.
 *
 * Far above `MAX_LP_FEE`, which is what makes it unambiguous: no real fee can
 * collide with it. It is a wire-format detail and stops here — nothing above
 * this line ever sees the number, only `{ kind: "dynamic" }`.
 */
export const DYNAMIC_FEE_FLAG = 0x800000;

/**
 * Reads the PoolKey's fee field into the two states the domain models.
 *
 * A dynamic pool's *current* fee is null rather than zero: the hook decides it
 * per swap, and this read did not observe one. Zero would be a fee, and a real
 * one — v4 permits it.
 */
const readFeeConfiguration = (feeTier: string): V4FeeConfiguration | null => {
  const fee = convertSafeInteger(feeTier);
  if (!fee.ok) return null;

  return fee.value === DYNAMIC_FEE_FLAG
    ? { kind: "dynamic", currentFeePpm: null }
    : { kind: "static", feePpm: fee.value };
};

/**
 * Turns one raw v4 pool payload into the domain type, or an explicit failure.
 *
 * Pure: no clock, no network, no environment.
 *
 * Two things differ from the v3 path and both are the protocol's doing. A v4
 * pool's tick spacing lives in its PoolKey, so it arrives with everything else
 * rather than needing a contract call. And a currency may be the zero address,
 * which in v4 means the chain's native ether rather than a dropped field — which
 * is why these tokens go through `TokenSchema` and not the v3 one.
 */
export const normalizeV4Pool = ({
  payload,
  poolId,
}: {
  readonly payload: unknown;
  readonly poolId: string;
}): DataResult<V4Pool> => {
  const parsed = V4PoolResponseSchema.safeParse(payload);
  if (!parsed.success) return unavailable("invalid-response", MALFORMED);

  const { data, errors } = parsed.data;
  if (errors != null && errors.length > 0) return unavailable("invalid-response", MALFORMED);
  if (data == null) return unavailable("invalid-response", MALFORMED);
  if (data._meta?.hasIndexingErrors === true) {
    return unavailable("invalid-response", INDEXING_ERRORS);
  }
  if (data.pool === null) return unavailable("not-found", NOT_FOUND);

  const raw = data.pool;
  const fee = readFeeConfiguration(raw.feeTier);
  if (fee === null) return unavailable("invalid-response", MALFORMED);

  const tickSpacing = convertSafeInteger(raw.tickSpacing);
  if (!tickSpacing.ok) return unavailable("invalid-response", MALFORMED);

  const token0 = normalizeV3Token(raw.token0, ETHEREUM_MAINNET_CHAIN_ID);
  const token1 = normalizeV3Token(raw.token1, ETHEREUM_MAINNET_CHAIN_ID);
  if (token0 === null || token1 === null) return unavailable("invalid-response", MALFORMED);

  /*
   * The zero address means "no hook" on the wire and `null` in the domain, so
   * the two can never be confused. The schema refuses the zero address as a hook
   * for exactly that reason.
   */
  const hookAddress = raw.hooks.toLowerCase() === ZERO_ADDRESS ? null : raw.hooks;

  /*
   * The domain schema is the final authority, and for a v4 pool it carries two
   * rules the protocol enforces on chain: a hook must exist exactly when the fee
   * is dynamic, and a returns-delta permission must have the callback it
   * modifies. A pool failing either is not one this application can describe.
   */
  const pool = V4PoolSchema.safeParse({
    protocolVersion: "v4",
    chainId: ETHEREUM_MAINNET_CHAIN_ID,
    id: poolId,
    token0,
    token1,
    tickSpacing: tickSpacing.value,
    fee,
    hookAddress,
  });
  if (!pool.success) return unavailable("invalid-response", MALFORMED);

  return { status: "success", data: pool.data };
};
