import { afterEach, describe, expect, it, vi } from "vitest";

import type { PoolVisit } from "./recentlyViewed";

/*
 * The store keeps module-level state — the subscriber set and the last read —
 * so each test imports a fresh copy rather than inheriting what the previous
 * one left behind, as the theme store's tests do.
 */
const freshStore = async (options: { readonly storage?: "blocked" } = {}) => {
  const events = new Map<string, Set<() => void>>();
  const windowStub = {
    addEventListener: (type: string, listener: () => void) => {
      const listeners = events.get(type) ?? new Set<() => void>();
      listeners.add(listener);
      events.set(type, listeners);
    },
    removeEventListener: (type: string, listener: () => void) => {
      events.get(type)?.delete(listener);
    },
  };

  const insecure = () => {
    throw new Error("The operation is insecure.");
  };
  const blocked = { getItem: insecure, setItem: insecure, removeItem: insecure };

  const store = new Map<string, string>();
  const working = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };

  vi.resetModules();
  vi.stubGlobal("localStorage", options.storage === "blocked" ? blocked : working);
  vi.stubGlobal("window", windowStub);

  return { module: await import("./recentlyViewedStore"), events, store };
};

const POOL: PoolVisit = {
  protocol: "v3",
  chain: "ethereum",
  id: "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
  pair: "USDC / WETH",
  feePpm: 500,
};

const OWNER = "0x1111111111111111111111111111111111111111";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readRecent", () => {
  it("is the empty list when nothing is stored", async () => {
    const { module } = await freshStore();

    expect(module.readRecent()).toEqual({ pools: [], addresses: [] });
  });

  it("reads what is stored under the one key", async () => {
    const { module, store } = await freshStore();
    store.set(module.RECENT_STORAGE_KEY, JSON.stringify({ pools: [{ ...POOL, at: 1_000 }], addresses: [] }));

    expect(module.readRecent().pools).toEqual([{ ...POOL, at: 1_000 }]);
  });

  it("returns the same object while nothing has changed, so React does not see a new list on every render", async () => {
    const { module, store } = await freshStore();
    store.set(module.RECENT_STORAGE_KEY, JSON.stringify({ pools: [{ ...POOL, at: 1_000 }], addresses: [] }));

    expect(module.readRecent()).toBe(module.readRecent());
  });

  it("reads corrupt storage as the empty list rather than throwing", async () => {
    const { module, store } = await freshStore();
    store.set(module.RECENT_STORAGE_KEY, "{not json");

    expect(module.readRecent()).toEqual({ pools: [], addresses: [] });
  });

  it("is the empty list where storage cannot be read", async () => {
    const { module } = await freshStore({ storage: "blocked" });

    expect(module.readRecent()).toEqual({ pools: [], addresses: [] });
  });
});

describe("readServerRecent", () => {
  it("is the empty list, because the server cannot see a browser's storage and must not guess", async () => {
    const { module, store } = await freshStore();
    store.set(module.RECENT_STORAGE_KEY, JSON.stringify({ pools: [{ ...POOL, at: 1_000 }], addresses: [] }));

    expect(module.readServerRecent()).toEqual({ pools: [], addresses: [] });
  });
});

describe("recording a visit", () => {
  it("stores the pool with the clock's time, under the one key, and tells the subscribers", async () => {
    const { module, store } = await freshStore();
    const onChange = vi.fn();
    module.subscribeToRecent(onChange);

    module.recordPoolVisit(POOL, () => 1_234);

    expect(JSON.parse(store.get(module.RECENT_STORAGE_KEY)!)).toEqual({ pools: [{ ...POOL, at: 1_234 }], addresses: [] });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(module.readRecent().pools[0]!.at).toBe(1_234);
  });

  it("stores an address beside the pools already there", async () => {
    const { module } = await freshStore();

    module.recordPoolVisit(POOL, () => 1_000);
    module.recordAddressVisit({ chain: "base", address: OWNER }, () => 2_000);

    expect(module.readRecent()).toEqual({
      pools: [{ ...POOL, at: 1_000 }],
      addresses: [{ chain: "base", address: OWNER, at: 2_000 }],
    });
  });

  it("uses the browser's clock when none is given", async () => {
    const { module } = await freshStore();
    const before = Date.now();

    module.recordPoolVisit(POOL);

    expect(module.readRecent().pools[0]!.at).toBeGreaterThanOrEqual(before);
  });

  it("records nothing, and does not throw, where storage is blocked", async () => {
    const { module } = await freshStore({ storage: "blocked" });
    const onChange = vi.fn();
    module.subscribeToRecent(onChange);

    expect(() => module.recordPoolVisit(POOL, () => 1_000)).not.toThrow();
    expect(module.readRecent()).toEqual({ pools: [], addresses: [] });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("forgetRecent", () => {
  it("removes the key — pools and addresses both — and tells the subscribers", async () => {
    const { module, store } = await freshStore();
    module.recordPoolVisit(POOL, () => 1_000);
    module.recordAddressVisit({ chain: "ethereum", address: OWNER }, () => 2_000);
    const onChange = vi.fn();
    module.subscribeToRecent(onChange);

    module.forgetRecent();

    expect(store.has(module.RECENT_STORAGE_KEY)).toBe(false);
    expect(module.readRecent()).toEqual({ pools: [], addresses: [] });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("does not throw where storage is blocked", async () => {
    const { module } = await freshStore({ storage: "blocked" });

    expect(() => module.forgetRecent()).not.toThrow();
  });
});

describe("subscribeToRecent", () => {
  it("listens for another tab's change and stops on unsubscribe", async () => {
    const { module, events } = await freshStore();
    const onChange = vi.fn();

    const unsubscribe = module.subscribeToRecent(onChange);
    expect(events.get("storage")?.has(onChange)).toBe(true);

    unsubscribe();
    expect(events.get("storage")?.has(onChange)).toBe(false);

    module.recordPoolVisit(POOL, () => 1_000);
    expect(onChange).not.toHaveBeenCalled();
  });
});
