import { processShared } from "./processShared";

/*
 * A read kept for a while per key, once it has answered cleanly.
 *
 * For reads whose answer is the same for everyone asking the same question
 * within minutes — a pair's pools, which a v4 page and a v3 page and the
 * comparison page all ask about — and whose source is sometimes slow: a kept
 * answer turns the next visit's ten seconds into none. Only what `keep`
 * accepts is kept for `ttlMs`, because a failure kept is an outage extended.
 *
 * Unless `retryMs` says otherwise. A read asked forty times a page — one per
 * hook on the hooks directory — would ask a source that is down forty times
 * on every visit; there, a failure is kept for a short while instead, so the
 * source is asked again minutes later rather than at once or hours later.
 *
 * A key already being read is joined rather than read twice. Two pages
 * asking about one pool at the same moment, or a page and the warmer, would
 * otherwise each pay for the same answer.
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
  retryMs,
  maxEntries = 500,
  now = () => Date.now(),
}: {
  readonly name: string;
  readonly ttlMs: number;
  readonly keep: (value: T) => boolean;
  /** How long a value `keep` refuses is kept; not at all when not said. */
  readonly retryMs?: number;
  readonly maxEntries?: number;
  readonly now?: () => number;
}): KeptReads<T> => {
  const entries = processShared(`kept.${name}`, () => new Map<string, { value: T; writtenAt: number; keptForMs: number }>());
  const running = processShared(`kept.${name}.running`, () => new Map<string, Promise<T>>());

  const write = (key: string, value: T): void => {
    const keptForMs = keep(value) ? ttlMs : retryMs;
    if (keptForMs === undefined) return;

    /*
     * A key is only written again once it has run out, and whatever was
     * written before it has run out too, so letting the oldest go here
     * never costs an entry that could still have answered.
     */
    entries.delete(key);
    while (entries.size >= maxEntries) {
      const oldest = entries.keys().next();
      if (oldest.done === true) break;
      entries.delete(oldest.value);
    }
    entries.set(key, { value, writtenAt: now(), keptForMs });
  };

  const read = async (key: string, fetch: () => Promise<T>): Promise<T> => {
    const hit = entries.get(key);
    if (hit !== undefined && now() - hit.writtenAt < hit.keptForMs) return hit.value;

    const joined = running.get(key);
    if (joined !== undefined) return joined;

    const reading = fetch().then((value) => {
      write(key, value);
      return value;
    });
    running.set(key, reading);
    try {
      return await reading;
    } finally {
      /* Only its own: after a `forget`, the key may already be another read's. */
      if (running.get(key) === reading) running.delete(key);
    }
  };

  return {
    read,
    forget: () => {
      entries.clear();
      running.clear();
    },
  };
};
