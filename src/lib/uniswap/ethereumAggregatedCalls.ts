import type { DataFailureNotice, DataFailureReason } from "../../schemas";
import { ethCallEntry, ethGetCodeEntry, postRpcBatch } from "./ethereumRpcTransport";
import {
  type Aggregate3Call,
  type Aggregate3Result,
  decodeAggregate3,
  encodeAggregate3,
  isMulticall3Code,
  MULTICALL3_ADDRESS,
} from "./multicall3";
import type { FetchLike } from "./v3SubgraphTransport";

/*
 * Many contract reads as one, from a contract proven by its code.
 *
 * Every read this application makes against a contract — a token's balance, a
 * pool's storage word — goes through here: one `eth_call` to Multicall3 that
 * carries them all, and beside it, in the same batch, the node's answer for the
 * code at Multicall3's address. The answers are believed only if that code is
 * the runtime this application was built against, byte for byte; see
 * `multicall3.ts` for why the address alone is not trusted, and for what the
 * paced batches this replaced cost on a free-tier endpoint.
 *
 * Read-only, like the transport beneath it: `eth_call` and `eth_getCode`, and
 * nothing that could move anything.
 */

const UNREADABLE = "chain-data-unreadable";
const MALFORMED = "chain-data-malformed";
const AGGREGATOR_UNVERIFIED = "chain-aggregator-unverified";

export type AggregatedCallsRequest = {
  /** Full provider endpoint. Treated as a credential; never logged or returned. */
  readonly rpcUrl: string;
  /** Answered in the same order, one result each. */
  readonly calls: readonly Aggregate3Call[];
  readonly fetchImpl: FetchLike;
  readonly timeoutMs: number;
};

export type AggregatedCallsResult =
  | { readonly ok: true; readonly results: readonly Aggregate3Result[] }
  | { readonly ok: false; readonly reason: DataFailureReason; readonly notice: DataFailureNotice };

const failure = (reason: DataFailureReason, notice: DataFailureNotice): AggregatedCallsResult => ({
  ok: false,
  reason,
  notice,
});

/**
 * Performs every call in one request and returns one answer per call.
 *
 * A call that reverted comes back with `success: false` and stays in its place,
 * so a caller can count it as one unread figure rather than a failed read. What
 * fails whole is the request: a refused batch, a helper whose code is not
 * Multicall3's, an aggregated answer the endpoint refused, or one that does not
 * decode into exactly one result per call.
 */
export const postAggregatedCalls = async ({
  rpcUrl,
  calls,
  fetchImpl,
  timeoutMs,
}: AggregatedCallsRequest): Promise<AggregatedCallsResult> => {
  if (calls.length === 0) return { ok: true, results: [] };

  const batch = await postRpcBatch({
    rpcUrl,
    requests: [
      ethCallEntry({ to: MULTICALL3_ADDRESS, data: encodeAggregate3(calls) }),
      ethGetCodeEntry(MULTICALL3_ADDRESS),
    ],
    fetchImpl,
    timeoutMs,
  });
  if (!batch.ok) return batch;

  /* The proof first: an answer from a contract that is not Multicall3 is not an answer. */
  const [answers, code] = batch.results;
  if (code === undefined || !code.ok || !isMulticall3Code(code.result)) {
    return failure("configuration-error", AGGREGATOR_UNVERIFIED);
  }

  /*
   * One call carries every question, so a refusal is every question unread.
   * The same for an answer that does not decode: a guess at it would pair one
   * question's answer with another's name.
   */
  if (answers === undefined || !answers.ok) return failure("invalid-response", UNREADABLE);
  const results = decodeAggregate3(answers.result, calls.length);
  if (results === null) return failure("invalid-response", MALFORMED);

  return { ok: true, results };
};
