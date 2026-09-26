import { describe, expect, it } from "vitest";

import { HOOK_PERMISSION_FLAGS } from "../../schemas";
import { applyV4ChainReading, DYNAMIC_FEE_FLAG, normalizeV4Pool, readV4PoolEnvelope } from "./v4PoolAdapter";
import { UNREAD_CHAIN, type V4PoolChainReading } from "./v4PoolChainReading";

const POOL_ID = `0x${"e5".repeat(32)}`;
const POOL_MANAGER = "0x000000000004444c5dc75cb358380d2e3de08a90";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const NATIVE = `0x${"0".repeat(40)}`;

/** A hook address carrying exactly the given permission bits, as v4 mines them. */
const hookWith = (...bits: readonly number[]) =>
  `0x${"a".repeat(36)}${bits.reduce((all, bit) => all | bit, 0).toString(16).padStart(4, "0")}`;

const rawToken = (id: string, symbol: string, decimals: string, name = symbol) => ({
  id,
  symbol,
  name,
  decimals,
});

const rawPool = (overrides: Record<string, unknown> = {}) => ({
  id: POOL_ID,
  createdAtBlockNumber: "21688329",
  tickSpacing: "60",
  hooks: NATIVE,
  token0: rawToken(USDC, "USDC", "6"),
  token1: rawToken(WETH, "WETH", "18"),
  ...overrides,
});

const payload = (overrides: Record<string, unknown> = {}, poolManagers: unknown[] = [{ id: POOL_MANAGER }]) => ({
  data: {
    pool: rawPool(overrides),
    poolManagers,
    _meta: { hasIndexingErrors: false },
  },
});

/**
 * What the chain says, made to agree with a raw pool: the key's currencies,
 * spacing and hook are the pool's, and the state stores the key's fee, as the
 * PoolManager writes it. `fee` is the key's fee field, flag included.
 */
const chainFor = (
  raw: ReturnType<typeof rawPool>,
  fee = 3000,
  protocol = { zeroForOnePpm: 0, oneForZeroPpm: 0 },
): V4PoolChainReading => ({
  key: {
    currency0: raw.token0.id,
    currency1: raw.token1.id,
    fee,
    tickSpacing: Number(raw.tickSpacing),
    hooks: raw.hooks,
  },
  fees: { lpFeePpm: fee === DYNAMIC_FEE_FLAG ? 0 : fee, protocolFee: protocol },
});

const normalize = (body: unknown, chain: V4PoolChainReading = chainFor(rawPool())) =>
  normalizeV4Pool({ payload: body, poolId: POOL_ID, chain });

const succeeded = (result: ReturnType<typeof normalize>) => {
  if (result.status !== "success") throw new Error(`expected success, got ${result.status}`);
  return result.data;
};

describe("normalizeV4Pool", () => {
  it("reads a pool with no hook", () => {
    const pool = succeeded(normalize(payload()));

    expect(pool.protocolVersion).toBe("v4");
    expect(pool.id).toBe(POOL_ID);
    expect(pool.tickSpacing).toBe(60);
    expect(pool.fee).toEqual({ kind: "static", feePpm: 3000 });
    expect(pool.protocolFee).toEqual({ zeroForOnePpm: 0, oneForZeroPpm: 0 });
    // The zero address means "no hook" on the wire and null in the domain, so
    // the two can never be confused.
    expect(pool.hookAddress).toBeNull();
  });

  it("names mainnet when no chain is said, and the chain it is told otherwise, on the pool and its tokens", () => {
    expect(succeeded(normalize(payload())).chainId).toBe(1);

    const arbitrum = succeeded(
      normalizeV4Pool({ payload: payload(), poolId: POOL_ID, chain: chainFor(rawPool()), chainId: 42161 }),
    );
    expect([arbitrum.chainId, arbitrum.token0.chainId, arbitrum.token1.chainId]).toEqual([42161, 42161, 42161]);
  });

  /*
   * v4 permits fees far below anything v3 could express: the busiest pool on
   * mainnet charges twelve parts per million, where v3's lowest tier is a
   * hundred. The fee is the key's, from the chain — the indexer's figure is
   * not read at all.
   */
  it("reads a fee finer than v3 could express, from the key", () => {
    const pool = succeeded(normalize(payload(), chainFor(rawPool(), 10)));

    expect(pool.fee).toEqual({ kind: "static", feePpm: 10 });
  });

  /* Governance's cut, from the state, beside the key's fee. */
  it("carries the protocol's cut from the pool's state", () => {
    const protocol = { zeroForOnePpm: 125, oneForZeroPpm: 125 };
    const pool = succeeded(normalize(payload(), chainFor(rawPool(), 500, protocol)));

    expect(pool.fee).toEqual({ kind: "static", feePpm: 500 });
    expect(pool.protocolFee).toEqual(protocol);
  });

  /*
   * The sentinel is a wire-format detail and stops at this boundary: nothing
   * above the adapter ever sees the number, only that the fee is decided per
   * swap. A dynamic pool needs a hook, which the domain schema enforces. The
   * LP fee its state stores is not surfaced: a hook may override it on every
   * swap, and the busiest hooked pool on mainnet stores zero.
   */
  it("turns the dynamic-fee flag into a state, not a number", () => {
    const raw = rawPool({ hooks: hookWith(HOOK_PERMISSION_FLAGS.BEFORE_SWAP) });
    const pool = succeeded(normalize(payload(raw), chainFor(raw, DYNAMIC_FEE_FLAG)));

    expect(pool.fee).toEqual({ kind: "dynamic", currentFeePpm: null });
    expect(JSON.stringify(pool)).not.toContain(String(DYNAMIC_FEE_FLAG));
  });

  /*
   * A pool in a list whose key the chain did not answer for. The fee is
   * unread — a fact about the read — and nothing stands in for it.
   */
  it("publishes an unread fee when the chain was not asked", () => {
    const pool = succeeded(normalize(payload(), UNREAD_CHAIN));

    expect(pool.fee).toEqual({ kind: "unread" });
    expect(pool.protocolFee).toBeNull();
  });

  it("reads the fee from the key alone when the state was not read", () => {
    const pool = succeeded(normalize(payload(), { ...chainFor(rawPool(), 500), fees: null }));

    expect(pool.fee).toEqual({ kind: "static", feePpm: 500 });
    expect(pool.protocolFee).toBeNull();
  });

  /*
   * The zero address as a *currency* is not a dropped field: v4 lets a pool hold
   * the chain's own ether. This is why a v4 token goes through `TokenSchema` and
   * not the v3 one, which refuses it.
   */
  it("accepts native ether as a currency", () => {
    const raw = rawPool({ token0: rawToken(NATIVE, "ETH", "18") });
    const pool = succeeded(normalize(payload(raw), chainFor(raw)));

    expect(pool.token0.address).toBe(NATIVE);
    expect(pool.token0.symbol).toBe("ETH");
  });

  it("carries a hook address through as it is", () => {
    const hook = hookWith(HOOK_PERMISSION_FLAGS.BEFORE_SWAP, HOOK_PERMISSION_FLAGS.AFTER_SWAP);
    const raw = rawPool({ hooks: hook });
    const pool = succeeded(normalize(payload(raw), chainFor(raw)));

    expect(pool.hookAddress).toBe(hook);
  });

  /*
   * `Hooks.isValidHookAddress`: no hook means nobody could set the fee, so a
   * dynamic pool without one cannot exist on chain and must not be published as
   * though it did.
   */
  it("refuses a dynamic fee with no hook to set it", () => {
    expect(normalize(payload(), chainFor(rawPool(), DYNAMIC_FEE_FLAG)).status).toBe("unavailable");
  });

  /*
   * The other half of the same rule: a returns-delta permission without the
   * callback it modifies is an orphan the protocol rejects outright.
   */
  it("refuses a returns-delta permission with no callback under it", () => {
    const raw = rawPool({ hooks: hookWith(HOOK_PERMISSION_FLAGS.AFTER_SWAP_RETURNS_DELTA) });

    expect(normalize(payload(raw), chainFor(raw)).status).toBe("unavailable");
  });

  /*
   * The key hashed to the pool's id, so it is the pool's key; an indexer record
   * that disagrees with it is wrong, and the pool is not published on the
   * indexer's word.
   */
  it.each([
    ["a tick spacing the key does not have", { tickSpacing: "10" }],
    ["a hook the key does not name", { hooks: hookWith(HOOK_PERMISSION_FLAGS.BEFORE_SWAP) }],
    ["a currency the key does not hold", { token1: rawToken(`0x${"f".repeat(40)}`, "WETH", "18") }],
  ])("refuses an indexer record with %s", (_label, overrides) => {
    expect(normalize(payload(overrides), chainFor(rawPool())).status).toBe("unavailable");
  });

  /* The PoolManager writes the stored LP fee from the key; a state that differs is not this pool's. */
  it("refuses a state whose stored fee is not the key's", () => {
    const chain = { ...chainFor(rawPool(), 500), fees: { lpFeePpm: 3000, protocolFee: { zeroForOnePpm: 0, oneForZeroPpm: 0 } } };

    expect(normalize(payload(), chain).status).toBe("unavailable");
  });

  it("reports a pool the source has never heard of", () => {
    const result = normalize({ data: { pool: null, poolManagers: [], _meta: { hasIndexingErrors: false } } });

    expect(result.status === "unavailable" && result.notice).toBe("pool-not-found");
  });

  it.each([
    ["currencies the wrong way round", { token0: rawToken(WETH, "WETH", "18"), token1: rawToken(USDC, "USDC", "6") }],
    ["a fee above what a PoolKey can hold", {}, 1_000_001],
    ["a tick spacing past int16", { tickSpacing: "32768" }],
    ["a tick spacing of zero", { tickSpacing: "0" }],
    ["decimals that are not a number", { token0: rawToken(USDC, "USDC", "six") }],
    ["a symbol carrying a newline", { token0: rawToken(USDC, "US\nDC", "6") }],
  ])("refuses %s", (_label, overrides, fee = 3000) => {
    const raw = rawPool(overrides);

    expect(normalize(payload(overrides), chainFor(raw, fee)).status).toBe("unavailable");
  });

  it.each([
    ["a body that is not the expected shape", { data: { pool: "none" } }],
    ["a response carrying errors beside data", { ...payload(), errors: [{ message: "x" }] }],
    ["a response with no data", { data: null }],
    [
      "a source reporting indexing errors",
      { data: { pool: rawPool(), poolManagers: [], _meta: { hasIndexingErrors: true } } },
    ],
  ])("refuses %s", (_label, body) => {
    expect(normalize(body).status).toBe("unavailable");
  });
});

/*
 * The echo check. The single-pool query asks for one id, and the provider
 * answers with the pool it matched; the two are compared rather than the
 * requested id being stamped onto whatever came back.
 */
describe("normalizeV4Pool's echo check", () => {
  it("refuses a response describing a different pool", () => {
    const other = `0x${"7a".repeat(32)}`;
    const result = normalizeV4Pool({ payload: payload({ id: other }), poolId: POOL_ID, chain: chainFor(rawPool()) });

    expect(result.status).toBe("unavailable");
  });

  it("accepts an echo that differs only in case", () => {
    const shouted = `0x${"E5".repeat(32)}`;
    const result = normalizeV4Pool({ payload: payload({ id: shouted }), poolId: POOL_ID, chain: chainFor(rawPool()) });

    expect(result.status).toBe("success");
  });
});

/*
 * The envelope, opened before the chain is asked: the raw pool and the
 * manager, or the reason there is neither. The manager decides which
 * contract's logs and storage are read, so it is validated rather than trusted.
 */
describe("readV4PoolEnvelope", () => {
  it("hands back the raw pool and the manager the source named", () => {
    const envelope = readV4PoolEnvelope(payload());

    expect(envelope.ok && envelope.raw.createdAtBlockNumber).toBe("21688329");
    expect(envelope.ok && envelope.poolManager).toBe(POOL_MANAGER);
  });

  it.each([
    ["no manager at all", []],
    ["a manager that is not an address", [{ id: "0x1234" }]],
  ])("names no manager for %s", (_label, poolManagers) => {
    const envelope = readV4PoolEnvelope(payload({}, poolManagers));

    expect(envelope.ok && envelope.poolManager).toBeNull();
  });

  it("carries the failure for a pool the source has never heard of", () => {
    const envelope = readV4PoolEnvelope({ data: { pool: null, poolManagers: [], _meta: null } });

    expect(!envelope.ok && envelope.result.status === "unavailable" && envelope.result.notice).toBe("pool-not-found");
  });
});

/*
 * The reading applied after the fact, to a pool a list already carries with
 * its fee unread — which is how a holdings lookup reads the chain for the
 * pools it shows. The same rules as on the way in, by construction.
 */
describe("applyV4ChainReading", () => {
  const unread = succeeded(normalize(payload(), UNREAD_CHAIN));
  const hooked = succeeded(normalize(payload(rawPool({ hooks: hookWith(HOOK_PERMISSION_FLAGS.BEFORE_SWAP) })), UNREAD_CHAIN));

  it("settles a hookless pool from its state alone", () => {
    const applied = applyV4ChainReading(unread, { key: null, fees: { lpFeePpm: 500, protocolFee: { zeroForOnePpm: 125, oneForZeroPpm: 125 } } });

    expect(applied?.fee).toEqual({ kind: "static", feePpm: 500 });
    expect(applied?.protocolFee).toEqual({ zeroForOnePpm: 125, oneForZeroPpm: 125 });
  });

  it("leaves a hooked pool unread without its key, whatever its state stores", () => {
    const applied = applyV4ChainReading(hooked, { key: null, fees: { lpFeePpm: 500, protocolFee: { zeroForOnePpm: 0, oneForZeroPpm: 0 } } });

    expect(applied?.fee).toEqual({ kind: "unread" });
    expect(applied?.protocolFee).toEqual({ zeroForOnePpm: 0, oneForZeroPpm: 0 });
  });

  it("reads a hooked pool's kind from its key", () => {
    const chain = chainFor(rawPool({ hooks: hookWith(HOOK_PERMISSION_FLAGS.BEFORE_SWAP) }), DYNAMIC_FEE_FLAG);

    expect(applyV4ChainReading(hooked, chain)?.fee).toEqual({ kind: "dynamic", currentFeePpm: null });
  });

  it("leaves a pool as it is when the chain answered nothing", () => {
    expect(applyV4ChainReading(unread, UNREAD_CHAIN)).toEqual(unread);
  });

  it("refuses a key that is not the pool's", () => {
    const chain = { ...chainFor(rawPool()), key: { ...chainFor(rawPool()).key!, hooks: hookWith(HOOK_PERMISSION_FLAGS.BEFORE_SWAP) } };

    expect(applyV4ChainReading(unread, chain)).toBeNull();
  });
});
