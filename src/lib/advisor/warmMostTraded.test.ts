import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIRST_WARM_AFTER_MS, MOST_TRADED_TTL_MS, startWarming, WARM_EVERY_MS } from "./warmMostTraded";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const recorder = () => {
  const warmed: string[] = [];
  const warm = async (chain: string) => {
    warmed.push(chain);
  };
  return { warmed, warm };
};

describe("the most-traded warmer", () => {
  it("waits a moment after starting, then reads every chain, one after another", async () => {
    const { warmed, warm } = recorder();
    const stop = startWarming({ chains: ["ethereum", "base", "arbitrum"], warm });

    await vi.advanceTimersByTimeAsync(FIRST_WARM_AFTER_MS - 1);
    expect(warmed).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(warmed).toEqual(["ethereum", "base", "arbitrum"]);
    stop();
  });

  it("reads them again every round, and not before a round is due", async () => {
    const { warmed, warm } = recorder();
    const stop = startWarming({ chains: ["ethereum", "base"], warm });

    await vi.advanceTimersByTimeAsync(FIRST_WARM_AFTER_MS);
    await vi.advanceTimersByTimeAsync(WARM_EVERY_MS - 1);
    expect(warmed).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(warmed).toEqual(["ethereum", "base", "ethereum", "base"]);
    stop();
  });

  it("waits for one chain before asking about the next", async () => {
    const started: string[] = [];
    let finishFirst = () => {};
    const warm = (chain: string) => {
      started.push(chain);
      return chain === "ethereum" ? new Promise<void>((resolve) => (finishFirst = resolve)) : Promise.resolve();
    };
    const stop = startWarming({ chains: ["ethereum", "base"], warm });

    await vi.advanceTimersByTimeAsync(FIRST_WARM_AFTER_MS);
    expect(started).toEqual(["ethereum"]);
    finishFirst();
    await vi.advanceTimersByTimeAsync(0);
    expect(started).toEqual(["ethereum", "base"]);
    stop();
  });

  it("goes on to the next chain, and the next round, when a read throws", async () => {
    const warmed: string[] = [];
    const warm = async (chain: string) => {
      warmed.push(chain);
      if (chain === "ethereum") throw new Error("gateway down");
    };
    const stop = startWarming({ chains: ["ethereum", "base"], warm });

    await vi.advanceTimersByTimeAsync(FIRST_WARM_AFTER_MS + WARM_EVERY_MS);
    expect(warmed).toEqual(["ethereum", "base", "ethereum", "base"]);
    stop();
  });

  it("reads nothing more once stopped, not even the rest of a round under way", async () => {
    let stop = () => {};
    const warmed: string[] = [];
    const warm = async (chain: string) => {
      warmed.push(chain);
      stop();
    };
    stop = startWarming({ chains: ["ethereum", "base"], warm });

    await vi.advanceTimersByTimeAsync(FIRST_WARM_AFTER_MS + 3 * WARM_EVERY_MS);
    expect(warmed).toEqual(["ethereum"]);
  });

  it("sets no further timer when stopped during a round's last read", async () => {
    let stop = () => {};
    const warmed: string[] = [];
    const timers: number[] = [];
    const warm = async (chain: string) => {
      warmed.push(chain);
      stop();
    };
    stop = startWarming({
      chains: ["ethereum"],
      warm,
      setTimer: (run, afterMs) => {
        timers.push(afterMs);
        return setTimeout(run, afterMs);
      },
    });

    await vi.advanceTimersByTimeAsync(FIRST_WARM_AFTER_MS + 3 * WARM_EVERY_MS);
    expect(warmed).toEqual(["ethereum"]);
    expect(timers).toEqual([FIRST_WARM_AFTER_MS]);
  });

  it("gives back its waiting timer when stopped", () => {
    const timer = { unref: () => {} };
    const cleared: unknown[] = [];
    const stop = startWarming({
      chains: ["ethereum"],
      warm: async () => {},
      setTimer: () => timer,
      clearTimer: (each) => cleared.push(each),
    });

    stop();
    expect(cleared).toEqual([timer]);
  });

  it("reads nothing at all when stopped before the first round", async () => {
    const { warmed, warm } = recorder();
    startWarming({ chains: ["ethereum"], warm })();

    await vi.advanceTimersByTimeAsync(FIRST_WARM_AFTER_MS + WARM_EVERY_MS);
    expect(warmed).toEqual([]);
  });

  it("does not hold the process open with its timer", () => {
    const unref = vi.fn();
    const stop = startWarming({
      chains: ["ethereum"],
      warm: async () => {},
      setTimer: () => ({ unref }),
      clearTimer: () => {},
    });

    expect(unref).toHaveBeenCalledTimes(1);
    stop();
  });

  it("keeps each round inside the page's kept read, with room for a slow one", () => {
    expect(WARM_EVERY_MS).toBeLessThan(MOST_TRADED_TTL_MS);
    expect(MOST_TRADED_TTL_MS - WARM_EVERY_MS).toBeGreaterThanOrEqual(60 * 1000);
  });
});
