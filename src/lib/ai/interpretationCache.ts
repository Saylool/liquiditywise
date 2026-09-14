import type { DataWarningNotice } from "../../schemas";
import type { PoolRangeAnalysis } from "../advisor/poolRangeAnalysis";
import type { Locale } from "../i18n/locales";

/*
 * Reuses an explanation when nothing it could legitimately say has changed.
 *
 * The key is the whole design, and it follows from a rule set much earlier: the
 * model may not state figures. Because it cannot quote the price, the tick, the
 * volatility or the bounds, its prose does not depend on them — it refers to
 * "the range shown above" and "the volatility figure", and those references stay
 * true whatever the numbers beside them say.
 *
 * What the prose *can* depend on is the handful of things it is allowed to
 * describe qualitatively: which pool, which two ticks, whether price is inside
 * them, whether either edge was truncated, which caveats apply, and the horizon
 * and multiplier the band was built from. Change any of those and the sentences
 * could be wrong; leave them alone and they stay right.
 *
 * Keying on the exact figures instead would look safer and be useless. The price
 * moves every block, so every visit would miss, and the cache would cost a map
 * lookup to achieve nothing.
 *
 * The figures a reader sees are never cached. They are recomputed on every
 * request and rendered fresh; only the prose about them is reused.
 */

/**
 * A 32-bit FNV-1a digest of the standing instruction.
 *
 * The key carries it so that editing the prompt — where the tone rules live —
 * invalidates every entry written under the old wording, without anyone having
 * to remember to bump a version. Not a security hash and not used as one: it
 * only has to change when the text changes.
 */
export const digestInstruction = (instruction: string): string => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < instruction.length; index += 1) {
    hash ^= instruction.charCodeAt(index);
    // Multiplication by the FNV prime, kept in 32 bits by `Math.imul`.
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36);
};

export type InterpretationCacheKeyInput = {
  readonly analysis: PoolRangeAnalysis;
  readonly warnings: readonly DataWarningNotice[];
  readonly locale: Locale;
  readonly model: string;
  /** The standing instruction the prose was written under. */
  readonly instruction: string;
};

/**
 * Encoded as JSON rather than joined by a separator: a caveat is an arbitrary
 * sentence, and any character chosen to divide the parts is a character one of
 * them could contain. Escaping removes the question instead of betting on it.
 */
export const interpretationCacheKey = (input: InterpretationCacheKeyInput): string => {
  const { analysis, warnings, locale, model, instruction } = input;
  const { pool, range, parameters } = analysis;

  return JSON.stringify([
    digestInstruction(instruction),
    model,
    locale,
    pool.chainId,
    pool.id,
    range.lowerTick,
    range.upperTick,
    range.containsCurrentPrice,
    range.lowerBoundTruncated,
    range.upperBoundTruncated,
    parameters.horizonDays,
    parameters.standardDeviationMultiplier,
    // Which caveats apply changes what the last section has to say.
    warnings,
  ]);
};

export type InterpretationCache<T> = {
  readonly get: (key: string) => T | undefined;
  readonly set: (key: string, value: T) => void;
  readonly size: () => number;
};

export type InterpretationCacheOptions = {
  /** How long an entry may be served. */
  readonly ttlMs: number;
  /** Ceiling on entries held, so a busy day cannot grow the map without bound. */
  readonly maxEntries: number;
  readonly now: () => number;
};

type Entry<T> = { readonly value: T; readonly writtenAt: number };

export const createInterpretationCache = <T,>(
  options: InterpretationCacheOptions,
): InterpretationCache<T> => {
  /*
   * A `Map` iterates in insertion order, and every entry is inserted fresh, so
   * the first key is always the one written longest ago — which is also the one
   * most likely to have expired. Eviction is a single O(1) delete with no scan.
   */
  const entries = new Map<string, Entry<T>>();

  const get = (key: string): T | undefined => {
    const entry = entries.get(key);
    if (entry === undefined) return undefined;

    if (options.now() - entry.writtenAt >= options.ttlMs) {
      entries.delete(key);
      return undefined;
    }

    return entry.value;
  };

  const set = (key: string, value: T): void => {
    // Deleted first so a rewritten entry moves to the back rather than keeping
    // its original position and being evicted while still the freshest.
    entries.delete(key);

    while (entries.size >= options.maxEntries) {
      const oldest = entries.keys().next();
      if (oldest.done === true) break;
      entries.delete(oldest.value);
    }

    entries.set(key, { value, writtenAt: options.now() });
  };

  return { get, set, size: () => entries.size };
};
