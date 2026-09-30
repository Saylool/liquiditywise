import type { DataFailureNotice, DataFailureReason, DataResult } from "../../schemas";
import { postAggregatedCalls } from "./ethereumAggregatedCalls";
import { MULTICALL3_ADDRESS } from "./multicall3";
import type { FetchLike } from "./v3SubgraphTransport";

/*
 * Whether each of some addresses is a wallet or a contract, from the code the
 * chain holds at it.
 *
 * The smart-money page says which of the holders that keep turning up are
 * people's wallets and which are contracts — a vault, a bot or another
 * program managing positions on many people's behalf, which is a different
 * thing to read a yield of. One `eth_getCode` per address rides in one batch;
 * an address whose code did not come back is left out rather than guessed at.
 */

const NOT_CONFIGURED = "chain-data-not-configured";

/** Addresses per batch: each is one more request in it, and an endpoint answers a batch of this size at once. */
export const KINDS_BATCH = 40;

/** `getChainId()`: the harmless question that makes the batch worth proving Multicall3 for. */
const CHAIN_ID_SELECTOR = "0x3408e470";

export type AddressKind = "wallet" | "contract";

/**
 * "0x" is an account with no code. An account delegated to code under EIP-7702
 * holds `0xef0100` and the address it delegates to: still somebody's own
 * wallet, so still a wallet.
 */
export const kindOfCode = (code: string): AddressKind =>
  code === "0x" || code === "" || /^0xef0100[0-9a-f]{40}$/i.test(code) ? "wallet" : "contract";

const unavailable = (
  reason: DataFailureReason,
  notice: DataFailureNotice,
): DataResult<ReadonlyMap<string, AddressKind>> => ({ status: "unavailable", reason, notice });

export const fetchAddressKinds = async ({
  addresses,
  rpcUrl,
  fetchImpl,
  timeoutMs = 15_000,
}: {
  readonly addresses: readonly string[];
  readonly rpcUrl: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
}): Promise<DataResult<ReadonlyMap<string, AddressKind>>> => {
  const wanted = [...new Set(addresses.map((address) => address.toLowerCase()))].filter((address) => /^0x[0-9a-f]{40}$/.test(address));
  const kinds = new Map<string, AddressKind>();
  if (wanted.length === 0) return { status: "success", data: kinds };

  const endpoint = rpcUrl?.trim();
  if (endpoint === undefined || endpoint === "") return unavailable("configuration-error", NOT_CONFIGURED);

  for (let start = 0; start < wanted.length; start += KINDS_BATCH) {
    const batch = wanted.slice(start, start + KINDS_BATCH);
    const answered = await postAggregatedCalls({
      rpcUrl: endpoint,
      fetchImpl,
      timeoutMs,
      calls: [{ to: MULTICALL3_ADDRESS, data: CHAIN_ID_SELECTOR }],
      codeOf: batch,
    });
    if (!answered.ok) return unavailable(answered.reason, answered.notice);

    batch.forEach((address, index) => {
      const code = answered.codes[index];
      if (typeof code === "string" && /^0x[0-9a-f]*$/i.test(code)) kinds.set(address, kindOfCode(code));
    });
  }

  return { status: "success", data: kinds };
};
