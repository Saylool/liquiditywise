import {
  type DataResult,
  EvmAddressSchema,
  nonZeroEvmAddress,
  ZERO_ADDRESS,
} from "../../schemas";
import { balanceOfCalldata, readBalanceWord } from "./erc20BalanceAdapter";
import {
  DEFAULT_RPC_TIMEOUT_MS,
  ethCallEntry,
  ethGetCodeEntry,
  postRpcBatch,
} from "./ethereumRpcTransport";
import {
  type Aggregate3Call,
  decodeAggregate3,
  encodeAggregate3,
  getEthBalanceCalldata,
  isMulticall3Code,
  MULTICALL3_ADDRESS,
} from "./multicall3";
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
 * may hold under the zero address. It is asked of the chain in the same call,
 * counts as one of the currencies checked, and comes back under that same
 * address so a v4 pool's side and an address's holding meet on one key.
 *
 * Read-only by construction. The transport underneath can issue `eth_call`,
 * `eth_getLogs` and `eth_getCode` and nothing else, so no code path from here
 * can move anything.
 */

const INVALID_ADDRESS = "invalid-pool-address";
const NOT_CONFIGURED = "chain-data-not-configured";
const UNREADABLE = "chain-data-unreadable";
const MALFORMED = "chain-data-malformed";
const AGGREGATOR_UNVERIFIED = "chain-aggregator-unverified";

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
  /** How many currencies were actually asked about, for the page to report. */
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
 * Asks every currency what the holder holds, in one call.
 *
 * One `eth_call` to Multicall3 carries every `balanceOf` and the ether
 * question, and the node's answer for the code at Multicall3's address travels
 * in the same batch: the balances are believed only if that code is the one
 * this application knows, byte for byte. See `multicall3.ts` for why.
 *
 * Measured against the live endpoint on 2026-09-16: 289 currencies in 0.6
 * seconds. The same sweep as twelve paced batches of direct calls had the
 * provider refuse the last of them, the ether question after them, and every
 * read the page made next.
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
   * become twenty identical questions.
   */
  const requested = new Set(
    request.tokenAddresses
      .map((address) => EvmAddressSchema.safeParse(address))
      .filter((parsed) => parsed.success)
      .map((parsed) => parsed.data),
  );
  /* The zero address is not a contract; Multicall3 itself answers for ether. */
  const wantsEther = requested.delete(ZERO_ADDRESS);
  const tokens = [...requested];
  if (tokens.length === 0 && !wantsEther) {
    return { status: "unavailable", reason: "invalid-input", notice: INVALID_ADDRESS };
  }

  /* One question per currency, in this order, and the answers come back in it. */
  const currencies = [...(wantsEther ? [ZERO_ADDRESS] : []), ...tokens];
  const data = balanceOfCalldata(holder.data);
  const calls: readonly Aggregate3Call[] = currencies.map((address) =>
    address === ZERO_ADDRESS
      ? { to: MULTICALL3_ADDRESS, data: getEthBalanceCalldata(holder.data) }
      : { to: address, data },
  );

  const batch = await postRpcBatch({
    rpcUrl,
    requests: [
      ethCallEntry({ to: MULTICALL3_ADDRESS, data: encodeAggregate3(calls) }),
      ethGetCodeEntry(MULTICALL3_ADDRESS),
    ],
    fetchImpl: request.fetchImpl,
    timeoutMs: request.timeoutMs ?? DEFAULT_RPC_TIMEOUT_MS,
  });
  if (!batch.ok) return { status: "unavailable", reason: batch.reason, notice: batch.notice };

  /* The proof first: an answer from a contract that is not Multicall3 is not an answer. */
  const [answers, code] = batch.results;
  if (code === undefined || !code.ok || !isMulticall3Code(code.result)) {
    return { status: "unavailable", reason: "configuration-error", notice: AGGREGATOR_UNVERIFIED };
  }

  /*
   * The sweep is one call, so a refusal is the whole sweep unread — and an
   * unread sweep is not an empty one. The same for an answer that does not
   * decode: publishing a guess at it would pair balances with the wrong names.
   */
  if (answers === undefined || !answers.ok) {
    return { status: "unavailable", reason: "invalid-response", notice: UNREADABLE };
  }
  const results = decodeAggregate3(answers.result, calls.length);
  if (results === null) {
    return { status: "unavailable", reason: "invalid-response", notice: MALFORMED };
  }

  const held: TokenBalance[] = [];
  let unreadable = 0;
  results.forEach((result, index) => {
    const address = currencies[index];
    if (address === undefined) return;

    /* A call that reverted, or answered with something other than a word, is one unreadable currency. */
    const balance = result.success ? readBalanceWord({ result: result.data }) : null;
    if (balance === null || !balance.ok) {
      unreadable += 1;
      return;
    }
    if (balance.amount !== "0") held.push({ address, amount: balance.amount });
  });

  /*
   * The rule that keeps a half-answered sweep from being read as an empty one,
   * applied to losses spread thinly across the list.
   */
  const checked = currencies.length;
  if (unreadable > checked * MAX_UNREADABLE_SHARE) {
    return { status: "unavailable", reason: "invalid-response", notice: UNREADABLE };
  }

  return {
    status: "success",
    data: { held, checked, unreadable },
  };
};
