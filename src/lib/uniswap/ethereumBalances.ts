import {
  type DataResult,
  EvmAddressSchema,
  nonZeroEvmAddress,
  ZERO_ADDRESS,
} from "../../schemas";
import { balanceOfCalldata, readBalanceWord } from "./erc20BalanceAdapter";
import {
  DEFAULT_RPC_TIMEOUT_MS,
  ETH_CALL_BATCH_SIZE,
  postEthCallBatch,
  postEthGetBalance,
} from "./ethereumRpcTransport";
import type { FetchLike } from "./v3SubgraphTransport";

/*
 * What one address holds, of a list of currencies it was asked about.
 *
 * There is no way to enumerate an address's tokens: an ERC-20 balance lives in
 * the token's own contract, so finding one means already knowing which contract
 * to ask. Every "wallet contents" anywhere is a list of guesses that were
 * checked, and this one says how many it checked.
 *
 * One currency has no contract to ask: the chain's own ether, which a v4 pool
 * may hold under the zero address. It is asked of the chain directly, counts as
 * one of the currencies checked, and comes back under that same address so a
 * v4 pool's side and an address's holding meet on one key.
 *
 * Read-only by construction. The transport underneath can issue `eth_call` and
 * `eth_getBalance` and nothing else, so no code path from here can move anything.
 */

const INVALID_ADDRESS = "invalid-pool-address";
const NOT_CONFIGURED = "chain-data-not-configured";
const UNREADABLE = "chain-data-unreadable";

/**
 * How much of a sweep may go unread before the answer is refused instead of
 * published.
 *
 * An unread balance is not a zero balance, and the difference is the whole
 * danger here: a list built from failed reads renders as "you hold nothing",
 * which is a definite-looking answer to a question that was never answered. A
 * dropped search result is visible because the list gets shorter; a dropped
 * balance is invisible.
 *
 * Measured, a clean sweep of 175 tokens leaves none unread — so any material
 * number is a signal rather than noise. A tenth is generous enough that a
 * handful of unusual tokens does not sink a lookup, and strict enough that a
 * half-failed sweep can never be mistaken for an empty wallet.
 */
export const MAX_UNREADABLE_SHARE = 0.1;

/** One balance, for one token, as a base-unit decimal string. */
export type TokenBalance = {
  readonly address: string;
  readonly amount: string;
};

export type AddressBalances = {
  /** Only the non-zero ones. A zero balance is an answer, not a holding. */
  readonly held: readonly TokenBalance[];
  /** How many token contracts were actually asked, for the page to report. */
  readonly checked: number;
  /**
   * How many answered with something unusable.
   *
   * A candidate list drawn from pool data can contain an address that is not a
   * working ERC-20, and one of those must not take the page down — so it is
   * dropped and counted, the way an unverifiable search result is.
   */
  readonly unreadable: number;
};

export type EthereumBalancesRequest = {
  readonly holder: string;
  /**
   * Currencies to ask about: token contracts, and the zero address for the
   * chain's own ether. Deduplicated here; order is not significant.
   */
  readonly tokenAddresses: readonly string[];
  /** Raw environment value; validated here so the wrapper stays free of logic. */
  readonly rpcUrl: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
};

const HolderSchema = nonZeroEvmAddress(INVALID_ADDRESS);

/**
 * Asks each token what the holder holds, all at once.
 *
 * In parallel because they are independent and the difference is the whole
 * experience: measured against the live endpoint, 176 tokens answered in under
 * 200 milliseconds together, where in sequence they would have taken most of a
 * minute.
 */
export const fetchEthereumBalances = async (
  request: EthereumBalancesRequest,
): Promise<DataResult<AddressBalances>> => {
  const holder = HolderSchema.safeParse(request.holder);
  if (!holder.success) {
    return { status: "unavailable", reason: "invalid-input", notice: INVALID_ADDRESS };
  }

  const rpcUrl = request.rpcUrl?.trim();
  if (rpcUrl === undefined || rpcUrl === "") {
    return { status: "unavailable", reason: "configuration-error", notice: NOT_CONFIGURED };
  }

  /*
   * Validated and deduplicated before any call goes out. A candidate list is
   * assembled from pool data, and one token appearing in twenty pools must not
   * become twenty identical requests.
   */
  const requested = new Set(
    request.tokenAddresses
      .map((address) => EvmAddressSchema.safeParse(address))
      .filter((parsed) => parsed.success)
      .map((parsed) => parsed.data),
  );
  /* The zero address is not a contract and gets its own question, below. */
  const wantsEther = requested.delete(ZERO_ADDRESS);
  const tokens = [...requested];
  if (tokens.length === 0 && !wantsEther) {
    return { status: "unavailable", reason: "invalid-input", notice: INVALID_ADDRESS };
  }

  /*
   * One HTTP request per chunk rather than one per token, and a pause between
   * chunks — the pause is the transport's now, applied to every batch this
   * process sends, so it is not repeated here.
   *
   * Both are measured. All 175 tokens at once cost 175 connections and the
   * endpoint refused most of them; the same 175 as seven spaced batches were
   * answered in full, in 4.3 seconds. The provider meters compute units per
   * second, so what matters is the rate, not the request count.
   */
  const data = balanceOfCalldata(holder.data);
  const held: TokenBalance[] = [];
  let unreadable = 0;

  for (let at = 0; at < tokens.length; at += ETH_CALL_BATCH_SIZE) {
    const chunk = tokens.slice(at, at + ETH_CALL_BATCH_SIZE);

    const batch = await postEthCallBatch({
      rpcUrl,
      calls: chunk.map((address) => ({ to: address, data })),
      fetchImpl: request.fetchImpl,
      timeoutMs: request.timeoutMs ?? DEFAULT_RPC_TIMEOUT_MS,
    });

    /*
     * A whole chunk lost is a quarter of the sweep unknown at once. Carrying on
     * would mean publishing a list whose gaps are invisible, so the read stops
     * and says it could not answer.
     */
    if (!batch.ok) return { status: "unavailable", reason: batch.reason, notice: batch.notice };

    batch.results.forEach((result, index) => {
      const address = chunk[index];
      if (address === undefined) return;
      if (!result.ok) {
        unreadable += 1;
        return;
      }

      const balance = readBalanceWord({ result: result.result });
      if (!balance.ok) {
        unreadable += 1;
        return;
      }
      if (balance.amount !== "0") held.push({ address, amount: balance.amount });
    });
  }

  /*
   * Ether, asked once and directly. It is one currency of the sweep and is
   * counted as one: an answer the chain would not give is one unreadable
   * currency, not a failed lookup.
   */
  const checked = tokens.length + (wantsEther ? 1 : 0);
  if (wantsEther) {
    const ether = await postEthGetBalance({
      rpcUrl,
      address: holder.data,
      fetchImpl: request.fetchImpl,
      timeoutMs: request.timeoutMs ?? DEFAULT_RPC_TIMEOUT_MS,
    });
    const amount = ether.ok ? readQuantity(ether.payload) : null;
    if (amount === null) unreadable += 1;
    else if (amount !== "0") held.push({ address: ZERO_ADDRESS, amount });
  }

  /*
   * The same rule as a lost chunk, applied to losses spread thinly enough to
   * pass the check above one batch at a time.
   */
  if (unreadable > checked * MAX_UNREADABLE_SHARE) {
    return { status: "unavailable", reason: "invalid-response", notice: UNREADABLE };
  }

  return {
    status: "success",
    data: { held, checked, unreadable },
  };
};

/** A JSON-RPC quantity: `0x` and hex digits with no leading zeros, `0x0` for zero. */
const QUANTITY = /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;

/**
 * Reads a balance out of an `eth_getBalance` response.
 *
 * A quantity, not an ABI word: no padding, and the spec forbids leading zeros,
 * so a padded answer is a provider doing something other than what was asked
 * and is refused rather than read. Stays a decimal string for the reason every
 * balance here does — wei is eighteen decimals past what a double holds.
 */
const readQuantity = (payload: unknown): string | null => {
  const result = (payload as { result?: unknown })?.result;

  return typeof result === "string" && QUANTITY.test(result) ? BigInt(result).toString() : null;
};
