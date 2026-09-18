/*
 * Reading values out of an ABI-encoded answer, one 32-byte word at a time.
 *
 * Pure, and deliberately small: every function here takes an untrusted string
 * off the wire and either returns a value or `null`. None of them slice-and-
 * believe — the padding of an address is checked, the width of a number is
 * checked, and an answer that is not whole words is refused outright rather
 * than read from the wrong offsets.
 *
 * Shared because two position managers decode the same encoding. The
 * alternative was a second copy of `decodeInt24`, which is exactly the function
 * whose subtlety cost a probe rewrite: it is the one place a wrong byte
 * produces a plausible-looking wrong answer instead of an error.
 */

const WORD = /^[0-9a-f]{64}$/;

/** One 32-byte argument word from a hex value, left-padded as the ABI pads. */
export const argumentWord = (value: string): string =>
  value.replace(/^0x/, "").toLowerCase().padStart(64, "0");

/** Splits an answer into its 32-byte words, or `null` if it is not whole words. */
export const words = (data: unknown): readonly string[] | null => {
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
 *
 * This is the rule for an `int24` the ABI encoded *on its own*. One packed
 * beside other fields inside a single word is sign-extended to its own 24 bits
 * instead, and is read by {@link decodePackedInt24}.
 */
export const decodeInt24 = (data: unknown, index: number): number | null => {
  const part = words(data)?.[index];
  if (part === undefined || !WORD.test(part)) return null;

  /*
   * Written without a sign threshold, because the threshold would not be doing
   * the work: a word small enough to be a tick *is* one, and any other word is
   * a tick only if subtracting 2^256 lands it inside the negative half. Testing
   * the top bit first and range-checking after accepts exactly the same words,
   * which is another way of saying the bit is not what decides it.
   */
  const raw = BigInt(`0x${part}`);
  if (raw <= 8_388_607n) return Number(raw);

  const value = raw - (1n << 256n);

  return value >= -8_388_608n ? Number(value) : null;
};

/**
 * An `int24` packed inside a word beside other fields, given as its own six
 * hex digits.
 *
 * The opposite convention to {@link decodeInt24}, and the difference is the
 * whole reason both exist: a field sharing a word cannot be sign-extended past
 * its own bits without overwriting its neighbour, so the sign lives in bit 23
 * rather than bit 255. Reading such a field with the other function returns a
 * large positive number for every negative tick — a wrong answer that looks
 * like a right one.
 */
export const decodePackedInt24 = (digits: string): number | null => {
  if (!/^[0-9a-f]{6}$/.test(digits)) return null;

  const raw = Number.parseInt(digits, 16);

  return raw >= 0x800000 ? raw - 0x1000000 : raw;
};
