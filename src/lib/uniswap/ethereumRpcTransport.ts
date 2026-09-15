import type { DataFailureNotice, DataFailureReason } from "../../schemas";
import type { FetchLike } from "./v3SubgraphTransport";

/*
 * Minimal JSON-RPC transport for read-only `eth_call`s.
 *
 * Separate from the subgraph transport because the credential lives somewhere
 * completely different: The Graph takes a bearer token in a header, while most
 * Ethereum providers embed the key in the URL itself
 * (https://…/v2/<KEY>). That single fact drives the rules below — the endpoint is
 * treated as a secret in its own right and never appears in a message, a warning
 * or a thrown error.
 *
 * Read-only by construction: this module can issue `eth_call` and nothing else.
 * There is no signing, no `eth_sendTransaction`, no account access.
 */

export const DEFAULT_RPC_TIMEOUT_MS = 10_000;

export type RpcTransportResult =
  | { readonly ok: true; readonly payload: unknown }
  | { readonly ok: false; readonly reason: DataFailureReason; readonly notice: DataFailureNotice };

const failure = (reason: DataFailureReason, notice: DataFailureNotice): RpcTransportResult => ({
  ok: false,
  reason,
  notice,
});

/*
 * Fixed notice codes of this application's own. Nothing from the wire reaches the caller:
 * no provider error text, no response body, and above all no endpoint URL, which
 * would leak the provider key on most services.
 */
const TIMED_OUT = "chain-data-timed-out";
const UNREACHABLE = "chain-data-unreachable";
const REJECTED_CREDENTIALS = "chain-data-credentials-rejected";
const RATE_LIMITED = "chain-data-rate-limited";
const UNREADABLE = "chain-data-unreadable";

const classifyStatus = (status: number): RpcTransportResult | null => {
  if (status === 200) return null;
  if (status === 401 || status === 403) return failure("configuration-error", REJECTED_CREDENTIALS);
  if (status === 429) return failure("rate-limited", RATE_LIMITED);
  if (status >= 500) return failure("network-error", UNREACHABLE);
  return failure("invalid-response", UNREADABLE);
};

export type EthCallRequest = {
  /** Full provider endpoint. Treated as a credential; never logged or returned. */
  readonly rpcUrl: string;
  /** Contract being called. */
  readonly to: string;
  /** ABI-encoded calldata, `0x`-prefixed. */
  readonly data: string;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs: number;
};

/**
 * Performs one `eth_call` against the latest block and returns the decoded JSON
 * body, or a domain failure. Interpreting that body is the adapter's job.
 *
 * Pinned to `"latest"` rather than a specific block: the only thing read through
 * here is a pool's immutable configuration, which is identical at every block
 * after deployment.
 */
export const postEthCall = async ({
  rpcUrl,
  to,
  data,
  fetchImpl,
  timeoutMs,
}: EthCallRequest): Promise<RpcTransportResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // A contract read is a point-in-time question; a cached body would answer a
      // different one.
      cache: "no-store",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to, data }, "latest"],
      }),
      signal: controller.signal,
    });

    const statusFailure = classifyStatus(response.status);
    if (statusFailure !== null) return statusFailure;

    try {
      return { ok: true, payload: await response.json() };
    } catch {
      return controller.signal.aborted
        ? failure("timeout", TIMED_OUT)
        : failure("invalid-response", UNREADABLE);
    }
  } catch {
    return controller.signal.aborted
      ? failure("timeout", TIMED_OUT)
      : failure("network-error", UNREACHABLE);
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * How many calls travel in one batch.
 *
 * Measured against the live endpoint. A batch of 25 answers every call; a batch
 * of 175 comes back with nine of them refused for exceeding the provider's
 * compute units per second, and the refusals are per call rather than per
 * request — so the size is a property of what the endpoint will compute at once,
 * not of what it will accept.
 */
export const ETH_CALL_BATCH_SIZE = 25;

/**
 * A pause between batches, so a sweep is a sequence rather than a burst.
 *
 * Also measured: reading 175 tokens as seven spaced batches answered all 175
 * with no refusals in 4.3 seconds, where the same seven sent back to back lost
 * thirteen. The delay is most of a second across a whole lookup and it is the
 * difference between an answer and a gap.
 */
export const ETH_CALL_BATCH_PAUSE_MS = 250;

/*
 * The pause is applied here, to every batch this process sends, rather than by
 * each sweep to its own batches — because the budget it protects is the
 * endpoint's, not the sweep's. Two sweeps that each paced themselves perfectly
 * and ran at the same time were a burst from the endpoint's point of view, and
 * that was measured the day a search began reading two protocols' pools at
 * once: one sweep of four batches answered 100 of 100 back to back, while the
 * two sweeps together lost 23 of 200 and then drew a response that was not JSON
 * at all — which the caller reads as a lost batch, and the page as a list it
 * cannot order.
 *
 * So batches queue. Each waits for the one before it to finish and for the
 * pause after it, whichever sweep sent either. Per process, like every limit in
 * this application: a deployment running several instances paces each on its
 * own, and the endpoint's budget is shared between them regardless.
 */
let previousBatchSettled: Promise<void> = Promise.resolve();

const pause = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ETH_CALL_BATCH_PAUSE_MS);
  });

/** Runs `send` once every batch before it has finished and rested. */
const paced = <T,>(send: () => Promise<T>): Promise<T> => {
  const turn = previousBatchSettled.then(send);
  // Whatever happened to this batch, the next one waits out the pause.
  previousBatchSettled = turn.then(pause, pause);

  return turn;
};

export type EthCallBatchRequest = {
  readonly rpcUrl: string;
  /** One `{ to, data }` per call, answered in the same order. */
  readonly calls: readonly { readonly to: string; readonly data: string }[];
  readonly fetchImpl: FetchLike;
  readonly timeoutMs: number;
};

/** One call's answer: the raw word, or the fact that this one was refused. */
export type BatchedCallResult =
  | { readonly ok: true; readonly result: string }
  | { readonly ok: false };

export type EthCallBatchResult =
  | { readonly ok: true; readonly results: readonly BatchedCallResult[] }
  | { readonly ok: false; readonly reason: DataFailureReason; readonly notice: DataFailureNotice };

/**
 * Performs many `eth_call`s in one HTTP request.
 *
 * JSON-RPC's own batch form rather than an aggregating contract: a batch needs
 * no address, and shipping a contract address asserted from memory is the thing
 * this project refuses everywhere else.
 *
 * Answers are matched by `id` rather than by position. The specification permits
 * a server to return them in any order, and a sweep that silently paired one
 * token's balance with another token's identity would be wrong in a way nothing
 * downstream could detect.
 */
const batchFailure = (
  reason: DataFailureReason,
  notice: DataFailureNotice,
): EthCallBatchResult => ({ ok: false, reason, notice });

export const postEthCallBatch = async ({
  rpcUrl,
  calls,
  fetchImpl,
  timeoutMs,
}: EthCallBatchRequest): Promise<EthCallBatchResult> => {
  if (calls.length === 0) return { ok: true, results: [] };

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    /*
     * The clock starts when the request is actually sent, not when it joins the
     * queue. A batch that waited behind three others would otherwise arrive at
     * the endpoint with most of its time already spent.
     */
    const response = await paced(() => {
      timeout = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      return fetchImpl(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(
          calls.map((call, index) => ({
            jsonrpc: "2.0",
            id: index,
            method: "eth_call",
            params: [{ to: call.to, data: call.data }, "latest"],
          })),
        ),
        signal: controller.signal,
      });
    });

    // `classifyStatus` answers `null` for 200 and a failure otherwise, so the
    // non-null branch is always one — narrowed here rather than asserted.
    const statusFailure = classifyStatus(response.status);
    if (statusFailure !== null && !statusFailure.ok) {
      return batchFailure(statusFailure.reason, statusFailure.notice);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return controller.signal.aborted
        ? batchFailure("timeout", TIMED_OUT)
        : batchFailure("invalid-response", UNREADABLE);
    }

    if (!Array.isArray(payload)) return batchFailure("invalid-response", UNREADABLE);

    const byId = new Map<number, unknown>();
    for (const row of payload) {
      const id = (row as { id?: unknown })?.id;
      if (typeof id === "number") byId.set(id, (row as { result?: unknown }).result);
    }

    return {
      ok: true,
      results: calls.map((_call, index) => {
        const result = byId.get(index);

        return typeof result === "string" ? { ok: true, result } : { ok: false };
      }),
    };
  } catch {
    return controller.signal.aborted
      ? batchFailure("timeout", TIMED_OUT)
      : batchFailure("network-error", UNREACHABLE);
  } finally {
    clearTimeout(timeout);
  }
};
