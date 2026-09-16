import {
  Bytes32HexSchema,
  type DataFailureNotice,
  type DataResult,
  EvmAddressSchema,
  type V4FeeConfiguration,
  type V4Pool,
  V4PoolSchema,
  ZERO_ADDRESS,
} from "../../schemas";
import { normalizeV3Token } from "./v3TokenAdapter";
import { convertSafeInteger } from "./v3SubgraphRawResponse";
import type { V4PoolChainFees, V4PoolChainReading } from "./v4PoolChainReading";
import { DYNAMIC_FEE_FLAG, type V4PoolKey } from "./v4PoolKey";
import { type RawV4Pool, V4PoolResponseSchema } from "./v4PoolRawResponse";

/** Re-exported for the readers that decode the flag's wire form. */
export { DYNAMIC_FEE_FLAG } from "./v4PoolKey";

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
 * The pool's fee, from its key and its state — never from the indexer.
 *
 * A key carrying the dynamic-fee flag makes the pool dynamic, and the LP fee
 * its state stores is deliberately not surfaced as "current": a hook may
 * override it on every swap, and the busiest hooked pool on mainnet stores
 * zero while its swaps paid between 25 and 230 ppm. A static key's fee must be
 * the fee the state stores — the PoolManager writes one from the other — so a
 * state that says otherwise is not this pool's state, and the pool is refused.
 *
 * Without the key, the state alone settles a pool that has no hook. Such a
 * pool cannot be dynamic — there would be nobody to set the fee — and the
 * PoolManager writes a static pool's stored fee from its key and lets nothing
 * change it, so the stored fee *is* the key's. That is what lets a list read
 * the fee of its hookless majority from the word it already reads for depth,
 * and spend the costlier log read on hooked pools alone. A hooked pool's
 * stored fee says nothing about which kind it is, and stays unread without
 * the key; so does any pool the chain answered nothing for.
 */
export const readFeeConfiguration = (
  key: V4PoolKey | null,
  fees: V4PoolChainFees | null,
  hookAddress: string | null,
): V4FeeConfiguration | null => {
  if (key !== null) {
    if (key.fee === DYNAMIC_FEE_FLAG) return { kind: "dynamic", currentFeePpm: null };
    if (fees !== null && fees.lpFeePpm !== key.fee) return null;

    return { kind: "static", feePpm: key.fee };
  }
  if (fees !== null && hookAddress === null) return { kind: "static", feePpm: fees.lpFeePpm };

  return { kind: "unread" };
};

/**
 * A verified pool with what the chain said about it applied: the fee and the
 * protocol's cut, and the key checked against the pool's own fields.
 *
 * Used on the way into a list and again after one — a holdings lookup reads
 * the chain for the pools it will actually show, once it knows which those
 * are — so the two paths cannot disagree about what a reading means.
 */
export const applyV4ChainReading = (pool: V4Pool, chain: V4PoolChainReading): V4Pool | null => {
  if (chain.key !== null) {
    const { key } = chain;
    if (key.tickSpacing !== pool.tickSpacing) return null;
    if (key.hooks !== (pool.hookAddress ?? ZERO_ADDRESS)) return null;
    if (key.currency0 !== pool.token0.address || key.currency1 !== pool.token1.address) return null;
  }

  const fee = readFeeConfiguration(chain.key, chain.fees, pool.hookAddress);
  if (fee === null) return null;

  const applied = V4PoolSchema.safeParse({
    ...pool,
    fee,
    protocolFee: chain.fees === null ? null : chain.fees.protocolFee,
  });

  return applied.success ? applied.data : null;
};

/**
 * Turns one raw `Pool` entity and what the chain said about it into a verified
 * v4 pool, or `null` if the two cannot be reconciled.
 *
 * Shared by the single-pool read and every list a v4 pool can appear in, so a
 * pool is admitted on the same terms whichever way it was found. Two copies of
 * this would be two chances for one of them to stop checking that a dynamic
 * fee has a hook to set it.
 *
 * Pure: no clock, no network, no environment.
 *
 * The key, when it was read, is the authority: it hashed to the pool's id, so
 * it is the pool's key beyond argument. The indexer's currencies, spacing and
 * hook are checked against it and a disagreement refuses the pool — the same
 * fail-closed rule the v3 read applies when its two sources cannot agree. A
 * currency may be the zero address, which in v4 means the chain's native ether
 * rather than a dropped field, which is why these tokens go through
 * `TokenSchema` and not the v3 one.
 */
export const normalizeV4PoolEntity = (
  raw: RawV4Pool,
  chain: V4PoolChainReading,
): V4Pool | null => {
  const id = Bytes32HexSchema.safeParse(raw.id);
  if (!id.success) return null;

  const tickSpacing = convertSafeInteger(raw.tickSpacing);
  if (!tickSpacing.ok) return null;

  const token0 = normalizeV3Token(raw.token0, ETHEREUM_MAINNET_CHAIN_ID);
  const token1 = normalizeV3Token(raw.token1, ETHEREUM_MAINNET_CHAIN_ID);
  if (token0 === null || token1 === null) return null;

  /*
   * The zero address means "no hook" on the wire and `null` in the domain, so
   * the two can never be confused. The schema refuses the zero address as a hook
   * for exactly that reason.
   */
  const hooks = EvmAddressSchema.safeParse(raw.hooks);
  if (!hooks.success) return null;
  const hookAddress = hooks.data === ZERO_ADDRESS ? null : hooks.data;

  /*
   * The domain schema is the final authority, and for a v4 pool it carries two
   * rules the protocol enforces on chain: a hook must exist exactly when the fee
   * is dynamic, and a returns-delta permission must have the callback it
   * modifies. A pool failing either is not one this application can describe.
   * Parsed once with the fee unread — the indexer's record on its own — and
   * then again with the chain's reading applied, which is where the key is
   * checked against it and the fee is decided.
   */
  const pool = V4PoolSchema.safeParse({
    protocolVersion: "v4",
    chainId: ETHEREUM_MAINNET_CHAIN_ID,
    id: id.data,
    token0,
    token1,
    tickSpacing: tickSpacing.value,
    fee: { kind: "unread" },
    protocolFee: null,
    hookAddress,
  });

  return pool.success ? applyV4ChainReading(pool.data, chain) : null;
};

/** The single-pool envelope, opened: the pool's raw record and the manager to ask about it. */
export type V4PoolEnvelope =
  | { readonly ok: true; readonly raw: RawV4Pool; readonly poolManager: string | null }
  | { readonly ok: false; readonly result: DataResult<V4Pool> };

/**
 * Checks the shape and health of a single-pool response, and hands back the
 * raw pool if there is one. Nothing from the provider's error text is read.
 */
export const readV4PoolEnvelope = (payload: unknown): V4PoolEnvelope => {
  const parsed = V4PoolResponseSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, result: unavailable("invalid-response", MALFORMED) };

  const { data, errors } = parsed.data;
  if (errors != null && errors.length > 0) {
    return { ok: false, result: unavailable("invalid-response", MALFORMED) };
  }
  if (data == null) return { ok: false, result: unavailable("invalid-response", MALFORMED) };
  if (data._meta?.hasIndexingErrors === true) {
    return { ok: false, result: unavailable("invalid-response", INDEXING_ERRORS) };
  }
  if (data.pool === null) return { ok: false, result: unavailable("not-found", NOT_FOUND) };

  const manager = EvmAddressSchema.safeParse(data.poolManagers[0]?.id);

  return { ok: true, raw: data.pool, poolManager: manager.success ? manager.data : null };
};

/**
 * Turns one raw v4 pool payload and its chain reading into the domain type, or
 * an explicit failure.
 *
 * The provider echoes the id of the pool it matched, and that echo is compared
 * against the id that was asked for rather than trusted. A response describing
 * a different pool would otherwise be republished under the requested id — the
 * same guard every other single-pool read here keeps.
 */
export const normalizeV4Pool = ({
  payload,
  poolId,
  chain,
}: {
  readonly payload: unknown;
  readonly poolId: string;
  readonly chain: V4PoolChainReading;
}): DataResult<V4Pool> => {
  const envelope = readV4PoolEnvelope(payload);
  if (!envelope.ok) return envelope.result;

  const pool = normalizeV4PoolEntity(envelope.raw, chain);
  if (pool === null || pool.id !== poolId) return unavailable("invalid-response", MALFORMED);

  return { status: "success", data: pool };
};
