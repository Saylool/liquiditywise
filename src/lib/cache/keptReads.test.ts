import { describe, expect, it } from "vitest";

import { keptReads } from "./keptReads";

const counter = () => {
  let calls = 0;
  const fetch = (value: string) => async () => {
    calls += 1;
    return value;
  };
  return { fetch, calls: () => calls };
};

describe("a kept read", () => {
  it("answers the same key from what it kept, until the time runs out", async () => {
    let clock = 0;
    const kept = keptReads<string>({ name: "test.ttl", ttlMs: 100, keep: () => true, now: () => clock });
    const { fetch, calls } = counter();

    await kept.read("a", fetch("one"));
    clock = 99;
    expect(await kept.read("a", fetch("two"))).toBe("one");
    clock = 100;
    expect(await kept.read("a", fetch("three"))).toBe("three");
    expect(calls()).toBe(2);
  });

  it("keeps each key apart", async () => {
    const kept = keptReads<string>({ name: "test.keys", ttlMs: 100, keep: () => true, now: () => 0 });

    await kept.read("a", async () => "A");
    expect(await kept.read("b", async () => "B")).toBe("B");
    expect(await kept.read("a", async () => "not asked")).toBe("A");
  });

  it("does not keep an answer it was told not to", async () => {
    const kept = keptReads<string>({ name: "test.keep", ttlMs: 100, keep: (value) => value !== "failed", now: () => 0 });
    const { fetch, calls } = counter();

    expect(await kept.read("a", fetch("failed"))).toBe("failed");
    expect(await kept.read("a", fetch("fine"))).toBe("fine");
    expect(await kept.read("a", fetch("later"))).toBe("fine");
    expect(calls()).toBe(2);
  });

  it("lets the entry written first go once it holds as many as it may, however recently it was read", async () => {
    const kept = keptReads<string>({ name: "test.bound", ttlMs: 1_000, keep: () => true, maxEntries: 2, now: () => 0 });

    await kept.read("a", async () => "A");
    await kept.read("b", async () => "B");
    await kept.read("a", async () => "not asked");
    await kept.read("c", async () => "C");

    expect(await kept.read("b", async () => "not asked")).toBe("B");
    expect(await kept.read("c", async () => "not asked")).toBe("C");
    expect(await kept.read("a", async () => "A again")).toBe("A again");
  });

  /* The hooks directory's rule: a failure kept briefly, so a source that is down is not asked forty times a page. */
  it("keeps an answer it would not keep for long only for as long as it was told to retry after", async () => {
    let clock = 0;
    const kept = keptReads<string>({
      name: "test.retry",
      ttlMs: 1_000,
      retryMs: 100,
      keep: (value) => value !== "failed",
      now: () => clock,
    });
    const { fetch, calls } = counter();

    expect(await kept.read("a", fetch("failed"))).toBe("failed");
    clock = 99;
    expect(await kept.read("a", fetch("not asked"))).toBe("failed");
    clock = 100;
    expect(await kept.read("a", fetch("fine"))).toBe("fine");
    clock = 1_099;
    expect(await kept.read("a", fetch("not asked either"))).toBe("fine");
    clock = 1_100;
    expect(await kept.read("a", fetch("again"))).toBe("again");
    expect(calls()).toBe(3);
  });

  it("joins a read already running for the same key rather than starting another", async () => {
    const kept = keptReads<string>({ name: "test.join", ttlMs: 100, keep: () => true, now: () => 0 });
    const releases: ((value: string) => void)[] = [];
    const slow = () => new Promise<string>((resolve) => releases.push(resolve));

    const first = kept.read("a", slow);
    const second = kept.read("a", slow);
    const other = kept.read("b", async () => "B");
    expect(releases).toHaveLength(1);
    for (const release of releases) release("A");

    expect(await Promise.all([first, second, other])).toEqual(["A", "A", "B"]);
  });

  it("joins a running read that fails, and asks again after it", async () => {
    const kept = keptReads<string>({ name: "test.joinfail", ttlMs: 100, keep: () => true, now: () => 0 });
    let calls = 0;
    const failing = async () => {
      calls += 1;
      throw new Error("down");
    };

    const results = await Promise.allSettled([kept.read("a", failing), kept.read("a", failing)]);
    expect(results.map(({ status }) => status)).toEqual(["rejected", "rejected"]);
    expect(calls).toBe(1);
    expect(await kept.read("a", async () => "back")).toBe("back");
  });

  it("starts from nothing once forgotten", async () => {
    const kept = keptReads<string>({ name: "test.forget", ttlMs: 100, keep: () => true, now: () => 0 });

    await kept.read("a", async () => "A");
    kept.forget();
    expect(await kept.read("a", async () => "A again")).toBe("A again");
  });
});
