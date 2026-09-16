import { MULTICALL3_RUNTIME_CODE } from "./multicall3RuntimeCode";

/*
 * Multicall3, used for one thing: asking every token contract of a sweep for a
 * balance in a single `eth_call`.
 *
 * Why an aggregating contract, when this project refuses addresses asserted
 * from memory everywhere else. Measured on 2026-09-16: a sweep of 289 tokens
 * as twelve paced batches had the provider refuse eight of the last thirteen
 * calls, then the ether question, then every one of the fifteen fee reads the
 * holdings page makes after it — the endpoint's budget was spent on the sweep,
 * and the page published its v4 pools with every fee unread. The same 289
 * balances through Multicall3 came back in one call, in 0.6 seconds, 65
 * kilobytes out and 46 back, and agreed with the direct reads on every token
 * whose balance had not moved between the two.
 *
 * And why the address is still not trusted. Nothing here relies on it being
 * right: in the same batch as the aggregated call, the sweep asks the node for
 * the code at that address, and believes the answers only if that code is,
 * byte for byte, the Multicall3 runtime this application was built against —
 * see `multicall3RuntimeCode.ts`. A typo would find no code there; another
 * chain would find the same code, because the contract was deployed with
 * CREATE2 from the same bytecode everywhere. What the check makes true is
 * that the contract asked is the contract whose behaviour is known, and
 * Multicall3 has no owner, no upgrade path and no state of its own.
 */

/** The canonical deployment, the same on every chain. Never trusted on its own: see above. */
export const MULTICALL3_ADDRESS = "0xca11bde05977b3631167028862be2a173976ca11";

/** `keccak256` of {@link MULTICALL3_RUNTIME_CODE}. Pinned by its own test. */
export const MULTICALL3_CODE_HASH =
  "0xd5c15df687b16f2ff992fc8d767b4216323184a2bbc6ee2f9c398c318e770891";

/** `keccak256("aggregate3((address,bool,bytes)[])")`, first four bytes. Pinned by its own test. */
export const AGGREGATE3_SELECTOR = "0x82ad56cb";

/** `keccak256("getEthBalance(address)")`, first four bytes. Pinned by its own test. */
export const GET_ETH_BALANCE_SELECTOR = "0x4d2301cc";

/** Whether `code` — an `eth_getCode` answer — is the Multicall3 runtime, byte for byte. */
export const isMulticall3Code = (code: unknown): boolean =>
  typeof code === "string" && code.toLowerCase() === MULTICALL3_RUNTIME_CODE;

export type Aggregate3Call = {
  readonly to: string;
  readonly data: string;
};

/** One call's answer as Multicall3 reports it: whether it succeeded, and what it returned. */
export type Aggregate3Result = {
  readonly success: boolean;
  readonly data: string;
};

const WORD_BYTES = 32;
const HEX = /^0x[0-9a-fA-F]*$/;

/** A 32-byte ABI word: a number, or a hex string left-padded. */
const word = (value: bigint | string): string =>
  (typeof value === "bigint" ? value.toString(16) : value.replace(/^0x/, "").toLowerCase()).padStart(64, "0");

/** `getEthBalance(address)` calldata: what Multicall3 answers for the chain's own ether. */
export const getEthBalanceCalldata = (holder: string): string =>
  `${GET_ETH_BALANCE_SELECTOR}${word(holder)}`;

/**
 * `aggregate3(Call3[])` calldata, every call allowed to fail.
 *
 * ABI encoding by hand, as everywhere here: a dynamic array of dynamic tuples.
 * The head is the array's offset; the array is its length and one offset per
 * element, each relative to the first element; each element is the target,
 * the flag, the offset of its bytes within the tuple, their length, and the
 * bytes padded to a word. `allowFailure` is always true: a token that reverts
 * is one unreadable balance, not a failed sweep.
 */
export const encodeAggregate3 = (calls: readonly Aggregate3Call[]): string => {
  const elements = calls.map((call) => {
    const data = call.data.replace(/^0x/, "");
    const length = data.length / 2;
    const padded = data.padEnd(Math.ceil(length / WORD_BYTES) * WORD_BYTES * 2, "0");

    return `${word(call.to)}${word(1n)}${word(BigInt(3 * WORD_BYTES))}${word(BigInt(length))}${padded}`;
  });

  let offsets = "";
  let next = BigInt(calls.length * WORD_BYTES);
  for (const element of elements) {
    offsets += word(next);
    next += BigInt(element.length / 2);
  }

  return `${AGGREGATE3_SELECTOR}${word(BigInt(WORD_BYTES))}${word(BigInt(calls.length))}${offsets}${elements.join("")}`;
};

/**
 * Reads `aggregate3`'s return value: `Result[]`, one `(bool success, bytes
 * returnData)` per call, in the order the calls were made.
 *
 * `null` for anything that is not exactly that — not hex, an offset past the
 * end, a flag that is neither true nor false, a count other than the number of
 * calls made — because a decoder that guessed its way through a malformed
 * answer would pair one token's balance with another token's name.
 */
export const decodeAggregate3 = (
  returned: unknown,
  expected: number,
): readonly Aggregate3Result[] | null => {
  if (typeof returned !== "string" || !HEX.test(returned) || returned.length % 2 !== 0) return null;
  const hex = returned.slice(2);
  const bytes = hex.length / 2;

  /**
   * The word at a byte offset as a number, or `null` when the answer ends
   * before it does. A word too large for a number is still read faithfully
   * enough: it is beyond the answer's end, and the bounds checks refuse it.
   */
  const wordAt = (offset: number): number | null =>
    offset + WORD_BYTES > bytes ? null : Number(BigInt(`0x${hex.slice(offset * 2, (offset + WORD_BYTES) * 2)}`));

  const arrayAt = wordAt(0);
  const count = arrayAt === null ? null : wordAt(arrayAt);
  if (arrayAt === null || count === null || count !== expected) return null;
  const base = arrayAt + WORD_BYTES;

  const results: Aggregate3Result[] = [];
  for (let index = 0; index < count; index += 1) {
    const relative = wordAt(base + index * WORD_BYTES);
    if (relative === null) return null;
    const tuple = base + relative;
    const success = wordAt(tuple);
    const dataRelative = wordAt(tuple + WORD_BYTES);
    if (success === null || dataRelative === null || (success !== 0 && success !== 1)) return null;
    const dataAt = tuple + dataRelative;
    const length = wordAt(dataAt);
    if (length === null || dataAt + WORD_BYTES + length > bytes) return null;

    results.push({
      success: success === 1,
      data: `0x${hex.slice((dataAt + WORD_BYTES) * 2, (dataAt + WORD_BYTES + length) * 2)}`,
    });
  }

  return results;
};
