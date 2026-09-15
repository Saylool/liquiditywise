/*
 * Keccak-256, written out.
 *
 * Seventy lines of bit work rather than a dependency, for the reason the ABI
 * encoding and the tick math are written out: this application needs one hash,
 * for one purpose — locating a Uniswap v4 pool's state in the PoolManager's
 * storage — and a library for that would be far more surface than the thing it
 * computes. It is also the kind of function that can be pinned completely by
 * known answers, and is.
 *
 * Keccak-256 is *not* SHA3-256. They share the permutation and differ in one
 * padding byte — 0x01 here, 0x06 there — which is why Node's `sha3-256` cannot
 * stand in for it, and why the tests carry vectors rather than comparing against
 * one. The permutation itself was checked independently while this was written,
 * by switching that byte and matching Python's `hashlib.sha3_256` on a
 * three-block input.
 *
 * Pure and total: the same bytes always hash to the same bytes. BigInt lanes
 * because clarity matters more than speed here — a search hashes a few dozen
 * 64-byte inputs, and a transcription of the specification that can be read
 * against it is worth more than a faster one that cannot.
 */

/** Bytes absorbed per block for a 256-bit output: (1600 - 2 * 256) / 8. */
const RATE_BYTES = 136;

const LANE_MASK = (1n << 64n) - 1n;

/** Round constants, ι step, as the specification lists them. */
const ROUND_CONSTANTS: readonly bigint[] = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

/** Rotation offsets, ρ step, indexed `[x][y]`. */
const ROTATIONS: readonly (readonly number[])[] = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14],
];

const rotateLeft = (lane: bigint, bits: number): bigint =>
  bits === 0 ? lane : ((lane << BigInt(bits)) | (lane >> BigInt(64 - bits))) & LANE_MASK;

/** The 5×5 lane state, addressed `x + 5y`. The fallbacks satisfy the type checker; the index is always in range. */
const lane = (state: readonly bigint[], x: number, y: number): bigint => state[x + 5 * y] ?? 0n;

/** Keccak-f[1600]: 24 rounds of θ, ρ, π, χ and ι, in place. */
const permute = (state: bigint[]): void => {
  for (const roundConstant of ROUND_CONSTANTS) {
    // θ: fold each column's parity into its neighbours.
    const parity = [0, 1, 2, 3, 4].map(
      (x) => lane(state, x, 0) ^ lane(state, x, 1) ^ lane(state, x, 2) ^ lane(state, x, 3) ^ lane(state, x, 4),
    );
    for (let x = 0; x < 5; x += 1) {
      const d = (parity[(x + 4) % 5] ?? 0n) ^ rotateLeft(parity[(x + 1) % 5] ?? 0n, 1);
      for (let y = 0; y < 5; y += 1) state[x + 5 * y] = lane(state, x, y) ^ d;
    }

    // ρ and π: rotate each lane and move it to (y, 2x + 3y).
    const moved: bigint[] = Array.from({ length: 25 }, () => 0n);
    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        moved[y + 5 * ((2 * x + 3 * y) % 5)] = rotateLeft(lane(state, x, y), ROTATIONS[x]?.[y] ?? 0);
      }
    }

    // χ: each lane against the two after it in its row.
    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        state[x + 5 * y] =
          lane(moved, x, y) ^ (~lane(moved, (x + 1) % 5, y) & LANE_MASK & lane(moved, (x + 2) % 5, y));
      }
    }

    // ι: break the symmetry between rounds.
    state[0] = lane(state, 0, 0) ^ roundConstant;
  }
};

/**
 * Keccak-256 of a byte string, as 32 bytes.
 *
 * Padding is the multi-rate rule with Keccak's domain byte: 0x01 after the
 * message, 0x80 at the end of the final block, and both in one byte when the
 * message fills a block to one byte short.
 */
export const keccak256 = (message: Uint8Array): Uint8Array => {
  const blocks = Math.ceil((message.length + 1) / RATE_BYTES);
  const padded = new Uint8Array(blocks * RATE_BYTES);
  padded.set(message);
  padded[message.length] = (padded[message.length] ?? 0) ^ 0x01;
  padded[padded.length - 1] = (padded[padded.length - 1] ?? 0) ^ 0x80;

  const state: bigint[] = Array.from({ length: 25 }, () => 0n);
  for (let offset = 0; offset < padded.length; offset += RATE_BYTES) {
    // Lanes are little-endian: the first byte of a lane is its least significant.
    for (let i = 0; i < RATE_BYTES / 8; i += 1) {
      let word = 0n;
      for (let b = 7; b >= 0; b -= 1) word = (word << 8n) | BigInt(padded[offset + i * 8 + b] ?? 0);
      state[i] = lane(state, i % 5, Math.floor(i / 5)) ^ word;
    }
    permute(state);
  }

  const digest = new Uint8Array(32);
  for (let i = 0; i < 4; i += 1) {
    let word = state[i] ?? 0n;
    for (let b = 0; b < 8; b += 1) {
      digest[i * 8 + b] = Number(word & 0xffn);
      word >>= 8n;
    }
  }

  return digest;
};

/** `0x` followed by an even number of hex digits, which is the only input this accepts. */
const HEX_BYTES = /^0x(?:[0-9a-fA-F]{2})*$/;

/**
 * Keccak-256 of a hex byte string, as a hex string.
 *
 * The form every caller in this application has: an ABI-encoded word or a
 * function signature's bytes, already spelled in hex. Refuses anything that is
 * not whole bytes, because hashing half a nibble would be hashing something
 * other than what the caller meant.
 */
export const keccak256Hex = (hexBytes: string): string | null => {
  if (!HEX_BYTES.test(hexBytes)) return null;

  const bytes = new Uint8Array(hexBytes.length / 2 - 1);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hexBytes.slice(2 + i * 2, 4 + i * 2), 16);
  }

  return `0x${Array.from(keccak256(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
};

/** The bytes of a string as UTF-8, for hashing a function signature. */
export const utf8Bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
