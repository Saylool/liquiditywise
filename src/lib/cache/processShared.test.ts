import { describe, expect, it } from "vitest";

import { processShared } from "./processShared";

describe("a value shared by the whole process", () => {
  it("is made once, and every later ask for the name gets that one", () => {
    let made = 0;
    const create = () => {
      made += 1;
      return new Map<string, number>();
    };

    const first = processShared("test.shared-once", create);
    first.set("a", 1);
    const second = processShared("test.shared-once", create);

    expect(second).toBe(first);
    expect(second.get("a")).toBe(1);
    expect(made).toBe(1);
  });

  it("is found under a registered symbol, which another bundle's copy of this module also finds", () => {
    const value = processShared("test.registered", () => ({ marker: 7 }));

    expect((globalThis as unknown as Record<symbol, unknown>)[Symbol.for("liquiditywise.test.registered")]).toBe(value);
  });

  it("keeps two names apart", () => {
    expect(processShared("test.left", () => ({}))).not.toBe(processShared("test.right", () => ({})));
  });
});
