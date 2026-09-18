import {
  AGGREGATE3_SELECTOR,
  type Aggregate3Call,
  type Aggregate3Result,
  MULTICALL3_ADDRESS,
} from "../multicall3";
import { MULTICALL3_RUNTIME_CODE } from "../multicall3RuntimeCode";
import type { FetchLike } from "../v3SubgraphTransport";

/*
 * A test endpoint playing the node and Multicall3 together.
 *
 * Not a test file, and imported by tests only: every reader that goes through
 * the aggregate needs the node's answers built the same way — the aggregated
 * call decoded into its questions, each answered, the results encoded back, and
 * the helper's code beside them — and one copy of that is easier to keep right
 * than one per reader.
 */

const word = (value: bigint | string): string =>
  (typeof value === "bigint" ? value.toString(16) : value.replace(/^0x/, "")).padStart(64, "0");

/** The calls an `aggregate3` calldata carries, in order: what an endpoint has to answer. */
export const decodeAggregate3Calls = (data: string): Aggregate3Call[] => {
  const hex = data.slice(AGGREGATE3_SELECTOR.length);
  const at = (byte: number) => Number(BigInt(`0x${hex.slice(byte * 2, byte * 2 + 64)}`));
  const arrayAt = at(0);
  const count = at(arrayAt);
  const base = arrayAt + 32;

  return Array.from({ length: count }, (_unused, index) => {
    const tuple = base + at(base + 32 * index);
    const bytesAt = tuple + at(tuple + 64);
    const length = at(bytesAt);

    return {
      to: `0x${hex.slice(tuple * 2 + 24, tuple * 2 + 64)}`,
      data: `0x${hex.slice((bytesAt + 32) * 2, (bytesAt + 32 + length) * 2)}`,
    };
  });
};

/** `Result[]` as Multicall3 returns it. */
export const encodeAggregate3Results = (results: readonly Aggregate3Result[]): string => {
  const elements = results.map(({ success, data }) => {
    const hex = data.replace(/^0x/, "");
    const length = hex.length / 2;

    return `${word(success ? 1n : 0n)}${word(64n)}${word(BigInt(length))}${hex.padEnd(Math.ceil(length / 32) * 64, "0")}`;
  });
  let offsets = "";
  let next = BigInt(results.length * 32);
  for (const element of elements) {
    offsets += word(next);
    next += BigInt(element.length / 2);
  }

  return `0x${word(32n)}${word(BigInt(results.length))}${offsets}${elements.join("")}`;
};

export type RpcAnswers = {
  /** Each question's answer, by the question and its place. `null` has the endpoint refuse the whole aggregated call. */
  readonly call?: (call: Aggregate3Call, index: number) => Aggregate3Result | null;
  /** The aggregated call's raw answer, when a test needs one that is not made of results. Overrides `call`. */
  readonly aggregate?: string | null;
  /**
   * What `eth_getCode` reports, by the address asked about.
   *
   * A string answers for every address, which is what a test about Multicall3
   * alone wants. A function is for a read that has to prove a second contract as
   * well — it is handed the address, so a test can give one the right code and
   * another the wrong one.
   */
  readonly code?: string | ((address: string) => string);
  /** What `eth_getLogs` returns for a filter. Nothing unless said otherwise. */
  readonly logs?: (filter: unknown) => unknown;
  /** An `eth_call` that is not the aggregate: its raw result, or `null` to refuse it. */
  readonly single?: (call: { readonly to: string; readonly data: string }) => string | null;
};

type Entry = { readonly id: number; readonly method: string; readonly params: readonly unknown[] };

/** Every answer decided: the defaults filled in, the aggregate override left optional. */
type Answers = Required<Omit<RpcAnswers, "aggregate">> & Pick<RpcAnswers, "aggregate">;

const answerEntry = (entry: Entry, answers: Answers): unknown => {
  const { id } = entry;
  const refused = { jsonrpc: "2.0", id, error: { code: 429, message: "slow down" } };
  if (entry.method === "eth_getCode") {
    const address = String(entry.params[0] ?? "");
    const code = typeof answers.code === "function" ? answers.code(address) : answers.code;
    return { jsonrpc: "2.0", id, result: code };
  }
  if (entry.method === "eth_getLogs") return { jsonrpc: "2.0", id, result: answers.logs(entry.params[0]) };
  if (entry.method !== "eth_call") return refused;

  const call = entry.params[0] as { to: string; data: string };
  if (call.to !== MULTICALL3_ADDRESS || !call.data.startsWith(AGGREGATE3_SELECTOR)) {
    const result = answers.single(call);
    return result === null ? refused : { jsonrpc: "2.0", id, result };
  }
  if (answers.aggregate !== undefined) {
    return answers.aggregate === null ? refused : { jsonrpc: "2.0", id, result: answers.aggregate };
  }

  const results: Aggregate3Result[] = [];
  for (const [index, question] of decodeAggregate3Calls(call.data).entries()) {
    const result = answers.call(question, index);
    if (result === null) return refused;
    results.push(result);
  }

  return { jsonrpc: "2.0", id, result: encodeAggregate3Results(results) };
};

/** Answers one JSON-RPC body — a batch or a single request — as the node would. */
export const answerRpc = (body: string, answers: RpcAnswers = {}): unknown => {
  const filled: Answers = {
    call: () => ({ success: true, data: `0x${word(0n)}` }),
    code: MULTICALL3_RUNTIME_CODE,
    logs: () => [],
    single: () => null,
    ...answers,
  };
  const parsed = JSON.parse(body) as Entry | Entry[];

  return Array.isArray(parsed) ? parsed.map((entry) => answerEntry(entry, filled)) : answerEntry(parsed, filled);
};

/** A fetch that answers every request as the node would. Wrap it in `vi.fn` to inspect what was sent. */
export const rpcEndpoint =
  (answers: RpcAnswers = {}): FetchLike =>
  async (_url, init) =>
    new Response(JSON.stringify(answerRpc(String(init.body), answers)), { status: 200 });
