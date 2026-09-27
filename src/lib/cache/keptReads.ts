import { processShared } from "./processShared";

/*
 * A read kept for a while per key, once it has answered cleanly.
 *
 * For reads whose answer is the same for everyone asking the same question
 * within minutes — a pair's pools, which a v4 page and a v3 page and the
 * comparison page all ask about — and whose source is sometimes slow: a kept
 * answer turns the next visit's ten seconds into none. Only what `keep`
 * accepts is kept, because a failure kept is an outage extended.
 *
 * On `globalThis` like every cache here (see processShared.ts), and bounded:
 * the oldest entry goes first once `maxEntries` are held.
 */
export type KeptReads<T> = {
  readonly read: (key: string, fetch: () => Promise<T>) => Promise<T>;
  /** For tests. */
  readonly forget: () => void;
};

export const keptReads = <T>({
  name,
  ttlMs,
  keep,
  maxEntries = 500,
  now = () => Date.now(),
}: {
  readonly name: string;
  readonly ttlMs: number;
  readonly keep: (value: T) => boolean;
  readonly maxEntries?: number;
  readonly now?: () => number;
}): KeptReads<T> => {
  const entries = processShared(`kept.${name}`, () => new Map<string, { value: T; writtenAt: number }>());

  const read = async (key: string, fetch: () => Promise<T>): Promise<T> => {
    const hit = entries.get(key);
    if (hit !== undefined && now() - hit.writtenAt < ttlMs) return hit.value;

    const value = await fetch();
    if (keep(value)) {
      /*
       * A key is only written again once it has run out, and whatever was
       * written before it has run out too, so letting the oldest go here
       * never costs an entry that could still have answered.
       */
      while (entries.size >= maxEntries) {
        const oldest = entries.keys().next();
        if (oldest.done === true) break;
        entries.delete(oldest.value);
      }
      entries.set(key, { value, writtenAt: now() });
    }

    return value;
  };

  return { read, forget: () => entries.clear() };
};
