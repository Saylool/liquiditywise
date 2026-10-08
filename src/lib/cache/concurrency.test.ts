import { describe, expect, it } from "vitest";

import { concurrencyBudget, limitConcurrency, OVER_BUDGET } from "./concurrency";

/** A task that runs until it is let go, and says how many were running beside it. */
const gate = () => {
  const releases: (() => void)[] = [];
  let running = 0;
  let peak = 0;
  const task = (value: number) => async () => {
    running += 1;
    peak = Math.max(peak, running);
    await new Promise<void>((resolve) => releases.push(resolve));
    running -= 1;
    return value;
  };
  return { task, releases, peak: () => peak, running: () => running };
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("a limit on how many run at once", () => {
  it("runs no more than its limit, and the rest in the order they came", async () => {
    const limited = limitConcurrency(2);
    const { task, releases, peak } = gate();

    const results = [1, 2, 3, 4, 5].map((value) => limited(task(value)));
    await settle();
    expect(releases).toHaveLength(2);

    while (releases.length > 0) {
      releases.shift()?.();
      await settle();
    }

    expect(await Promise.all(results)).toEqual([1, 2, 3, 4, 5]);
    expect(peak()).toBe(2);
  });

  /*
   * A place given up rather than handed on is free for one microtask before
   * the task waiting for it wakes, and a newcomer arriving in that moment
   * takes it: two running under a limit of one. When that moment falls
   * depends on how many hops the newcomer's own call is behind, so every
   * spacing up to a few is tried.
   */
  it("hands a finished task's place to the next in line, so a newcomer never makes it one over", async () => {
    for (let hops = 0; hops < 6; hops += 1) {
      const limited = limitConcurrency(1);
      const { task, releases, peak } = gate();

      const first = limited(task(1));
      const second = limited(task(2));
      await settle();
      releases.shift()?.();
      let behind = Promise.resolve();
      for (let hop = 0; hop < hops; hop += 1) behind = behind.then(() => undefined);
      const third = behind.then(() => limited(task(3)));
      while ((await Promise.race([Promise.all([first, second, third]), settle().then(() => null)])) === null) {
        releases.shift()?.();
      }

      expect(peak(), `${hops} hops behind`).toBe(1);
    }
  });

  it("lets a task fail on its own, and goes on with the next", async () => {
    const limited = limitConcurrency(1);
    const failing = limited(async () => {
      throw new Error("down");
    });
    const after = limited(async () => "after");

    await expect(failing).rejects.toThrow("down");
    expect(await after).toBe("after");
  });
});

/*
 * The budget a stranger can spend: so many at once, so many in line, and
 * everyone past that turned away without their task ever starting.
 */
describe("a budget on how many run and wait at once", () => {
  it("runs its limit, queues its line, and turns the rest away without starting them", async () => {
    const budget = concurrencyBudget(2, 1);
    const { task, releases, peak } = gate();
    const started: number[] = [];
    const counted = (value: number) => () => {
      started.push(value);
      return task(value)();
    };

    const admitted = [1, 2, 3].map((value) => budget(counted(value)));
    const turnedAway = await budget(counted(4));
    await settle();

    expect(turnedAway).toBe(OVER_BUDGET);
    expect(started).toEqual([1, 2]);

    while (releases.length > 0 || started.length < 3) {
      releases.shift()?.();
      await settle();
    }

    expect(await Promise.all(admitted)).toEqual([1, 2, 3]);
    expect(started).toEqual([1, 2, 3]);
    expect(peak()).toBe(2);
  });

  /* Bounded, not closed: a place that has settled is a place again. */
  it("admits again once the work in it has finished", async () => {
    const budget = concurrencyBudget(1, 0);
    const { task, releases } = gate();

    const first = budget(task(1));
    expect(await budget(task(2))).toBe(OVER_BUDGET);

    await settle();
    releases.shift()?.();
    expect(await first).toBe(1);

    expect(await budget(async () => "again")).toBe("again");
  });

  it("gives a failed task's place back like an answered one", async () => {
    const budget = concurrencyBudget(1, 0);

    await expect(
      budget(async () => {
        throw new Error("down");
      }),
    ).rejects.toThrow("down");

    expect(await budget(async () => "after")).toBe("after");
  });
});
