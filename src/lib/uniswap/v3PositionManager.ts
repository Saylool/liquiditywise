/*
 * The contract that holds Uniswap v3 positions, and how to ask it what an
 * address owns.
 *
 * Pure: no network, no environment. Every function here turns arguments into
 * calldata or an answer into a value, and none of them can fail in a way the
 * caller cannot see.
 *
 * A v3 position is an ERC-721 token minted by one singleton — so "which
 * positions does this address hold" is three questions in a row and not one:
 * how many, which ids, and what each id is. They are strictly sequential, which
 * is a property of the contract rather than a missed optimisation: the ids come
 * out of the count and the positions come out of the ids.
 *
 * **The address is a claim; the code at it is the check.** It is pinned here and
 * the reader refuses every answer unless the code at that address hashes to the
 * runtime below — the same rule the balance sweep applies to Multicall3, for the
 * same reason. A typo finds no code there.
 */

/** The `NonfungiblePositionManager` on Ethereum mainnet. */
export const POSITION_MANAGER_ADDRESS = "0xc36442b4a4522e871399cd717abdd847ab11fe88";

/**
 * `keccak256` of its deployed runtime, read from mainnet on 2026-09-18: 24,384
 * bytes. It has no upgrade path, so the code at that address is all there is to
 * know about it and it does not change.
 */
export const POSITION_MANAGER_CODE_HASH =
  "0x692e658b31cbe3407682854806658d315d61a58c7e4933a2f91d383dc00736c6";

/**
 * The four-byte selectors, each the first four bytes of the keccak of its own
 * signature. Written out rather than hashed at load, and a test derives every
 * one of them from its signature so a wrong digit cannot survive.
 */
export const FACTORY_SELECTOR = "0xc45a0155";
export const BALANCE_OF_SELECTOR = "0x70a08231";
export const TOKEN_OF_OWNER_BY_INDEX_SELECTOR = "0x2f745c59";
export const POSITIONS_SELECTOR = "0x99fbab88";
export const SLOT0_SELECTOR = "0x3850c7bd";

const ADDRESS = /^0x[0-9a-f]{40}$/;
const WORD = /^[0-9a-f]{64}$/;

/** One 32-byte argument word from a hex value, left-padded as the ABI pads. */
const word = (value: string): string => value.replace(/^0x/, "").toLowerCase().padStart(64, "0");

/** True when a returned `eth_getCode` is the manager this was built against. */
export const isPositionManagerCode = (code: unknown, hashOf: (hex: string) => string | null): boolean =>
  typeof code === "string" && hashOf(code) === POSITION_MANAGER_CODE_HASH;

/** `balanceOf(owner)`: how many position tokens an address holds. */
export const balanceOfCalldata = (owner: string): string | null =>
  ADDRESS.test(owner) ? `${BALANCE_OF_SELECTOR}${word(owner)}` : null;

/** `tokenOfOwnerByIndex(owner, index)`: the id at one place in that list. */
export const tokenOfOwnerByIndexCalldata = (owner: string, index: number): string | null => {
  if (!ADDRESS.test(owner) || !Number.isSafeInteger(index) || index < 0) return null;

  return `${TOKEN_OF_OWNER_BY_INDEX_SELECTOR}${word(owner)}${word(index.toString(16))}`;
};

/** `positions(tokenId)`: everything the manager records about one position. */
export const positionsCalldata = (tokenId: string): string | null =>
  /^[0-9]+$/.test(tokenId) ? `${POSITIONS_SELECTOR}${word(BigInt(tokenId).toString(16))}` : null;

/** Splits an answer into its 32-byte words, or `null` if it is not whole words. */
const words = (data: unknown): readonly string[] | null => {
  if (typeof data !== "string" || !/^0x(?:[0-9a-f]{2})*$/i.test(data)) return null;

  const body = data.slice(2).toLowerCase();
  if (body.length % 64 !== 0) return null;

  return body.match(/.{64}/g) ?? [];
};

/** A whole number from one word, as an exact decimal string. */
export const decodeUint = (data: unknown, index = 0): string | null => {
  const parts = words(data);
  const part = parts?.[index];

  return part === undefined || !WORD.test(part) ? null : BigInt(`0x${part}`).toString();
};

/** An address from one word: the low twenty bytes, with the padding checked. */
export const decodeAddress = (data: unknown, index: number): string | null => {
  const part = words(data)?.[index];
  if (part === undefined || !WORD.test(part) || !/^0{24}/.test(part)) return null;

  return `0x${part.slice(24)}`;
};

/**
 * A tick from one word.
 *
 * An `int24` arrives **sign-extended to the whole 32-byte word**, not to three
 * bytes — so a tick of -414400 comes back as `2^256 - 414400` and reading the
 * low three bytes of it gives a number that is not a tick and does not look like
 * one. The range is checked afterwards, so a word that is neither a small
 * positive number nor a sign-extended negative one is refused rather than
 * truncated into something plausible.
 */
export const decodeInt24 = (data: unknown, index: number): number | null => {
  const part = words(data)?.[index];
  if (part === undefined || !WORD.test(part)) return null;

  const raw = BigInt(`0x${part}`);
  const value = raw >= 1n << 255n ? raw - (1n << 256n) : raw;
  if (value < -8_388_608n || value > 8_388_607n) return null;

  return Number(value);
};

/** One position, exactly as the manager records it and before anything is made of it. */
export type RawV3Position = {
  readonly tokenId: string;
  readonly token0: string;
  readonly token1: string;
  readonly feePpm: number;
  readonly tickLower: number;
  readonly tickUpper: number;
  /** Zero for a position that has been closed. Kept as an exact decimal string. */
  readonly liquidity: string;
};

/**
 * Reads one `positions(tokenId)` answer.
 *
 * The struct is twelve words — nonce, operator, the pair, the fee, the two
 * ticks, the liquidity and four fee-accounting figures — and exactly twelve is
 * required. An answer of a different width is a different function's, and
 * reading the pair out of the wrong offsets would name two real tokens that are
 * not this position's.
 */
export const decodePosition = (tokenId: string, data: unknown): RawV3Position | null => {
  const parts = words(data);
  if (parts === null || parts.length !== 12) return null;

  const token0 = decodeAddress(data, 2);
  const token1 = decodeAddress(data, 3);
  const feePpm = decodeUint(data, 4);
  const tickLower = decodeInt24(data, 5);
  const tickUpper = decodeInt24(data, 6);
  const liquidity = decodeUint(data, 7);
  if (token0 === null || token1 === null || feePpm === null) return null;
  if (tickLower === null || tickUpper === null || liquidity === null) return null;
  if (tickLower >= tickUpper) return null;

  const fee = Number(feePpm);
  if (!Number.isSafeInteger(fee)) return null;

  return { tokenId, token0, token1, feePpm: fee, tickLower, tickUpper, liquidity };
};
