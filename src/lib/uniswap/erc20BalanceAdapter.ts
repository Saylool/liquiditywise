import type { DataFailureNotice } from "../../schemas";

/*
 * `balanceOf(address)`, encoded and decoded by hand.
 *
 * Two lines of ABI work rather than a library, for the same reason the tick
 * spacing read is: one function with one address argument and one integer
 * return, on a standard every ERC-20 implements. A dependency for that would be
 * more surface than the thing it encodes.
 */

/** `keccak256("balanceOf(address)")`, first four bytes. */
export const BALANCE_OF_SELECTOR = "0x70a08231";

/** A 32-byte ABI return word: `0x` plus exactly 64 hex characters. */
const ABI_WORD_PATTERN = /^0x[0-9a-fA-F]{64}$/;

const MALFORMED = "chain-data-malformed";

/**
 * Encodes the one call this application makes against a token.
 *
 * The address is left-padded into a 32-byte word, which is what an `address`
 * argument is on the wire. It arrives already validated as forty hex characters,
 * so there is nothing here that could produce a call to somewhere else.
 */
export const balanceOfCalldata = (holder: string): string =>
  `${BALANCE_OF_SELECTOR}${holder.replace(/^0x/, "").toLowerCase().padStart(64, "0")}`;

export type BalanceReadResult =
  | { readonly ok: true; readonly amount: string }
  | { readonly ok: false; readonly notice: DataFailureNotice };

/**
 * Reads one balance out of an `eth_call` response.
 *
 * The amount comes back as a decimal *string* and stays one. A uint256 balance
 * of an eighteen-decimal token is routinely past what a double holds exactly, so
 * a number here would round somebody's balance at the boundary and leave nothing
 * to round back.
 *
 * A token that is not a token — an address with no code, or one whose
 * `balanceOf` reverts — answers with something that is not a 32-byte word, and
 * that is reported rather than guessed at.
 */
export const readBalanceWord = (payload: unknown): BalanceReadResult => {
  const result = (payload as { result?: unknown })?.result;
  if (typeof result !== "string" || !ABI_WORD_PATTERN.test(result)) {
    return { ok: false, notice: MALFORMED };
  }

  return { ok: true, amount: BigInt(result).toString() };
};
