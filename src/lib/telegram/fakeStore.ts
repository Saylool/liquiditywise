import type { KeyValueStore } from "../store/keyValueStore";

/** An in-memory store with the same contract, for tests. `down` makes every call fail. */
export const fakeStore = (): KeyValueStore & {
  readonly data: Map<string, string>;
  readonly sets: Map<string, Set<string>>;
  down: boolean;
} => {
  const data = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const store = {
    data,
    sets,
    down: false,
    get: async (key: string) => (store.down ? undefined : (data.get(key) ?? null)),
    set: async (key: string, value: string) => {
      if (store.down) return false;
      data.set(key, value);
      return true;
    },
    del: async (key: string) => {
      if (store.down) return false;
      data.delete(key);
      return true;
    },
    sadd: async (key: string, member: string) => {
      if (store.down) return false;
      (sets.get(key) ?? sets.set(key, new Set()).get(key))?.add(member);
      return true;
    },
    srem: async (key: string, member: string) => {
      if (store.down) return false;
      sets.get(key)?.delete(member);
      return true;
    },
    smembers: async (key: string) => (store.down ? null : [...(sets.get(key) ?? [])]),
    scard: async (key: string) => (store.down ? null : (sets.get(key)?.size ?? 0)),
    /* Lifetimes are not kept: a test that needs a window to pass uses a key of the next window, as the code does. */
    increment: async (key: string) => {
      if (store.down) return null;
      const next = Number(data.get(key) ?? "0") + 1;
      data.set(key, String(next));
      return next;
    },
  };
  return store;
};
