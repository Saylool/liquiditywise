import { describe, expect, it } from "vitest";

import { BACKUP_PREFIXES } from "../backup/storeBackup";
import { fakeStore } from "../telegram/fakeStore";
import { ACTION_BUDGET_PREFIX, type ActionBudget, spendActionBudget } from "./actionBudget";

const BUDGET: ActionBudget = { action: "test", perClient: 2, global: 3, windowMs: 60_000 };
const NOW = Date.parse("2026-10-08T10:00:30.000Z");

const spend = (store: ReturnType<typeof fakeStore>, clientKey: string, now = NOW, secret = "server-secret") =>
  spendActionBudget(store, BUDGET, { clientKey, secret, now });

describe("an action's budget", () => {
  it("lets a client spend its own budget, and refuses it the next", async () => {
    const store = fakeStore();
    expect(await spend(store, "198.51.100.1")).toBe("allowed");
    expect(await spend(store, "198.51.100.1")).toBe("allowed");
    expect(await spend(store, "198.51.100.1")).toBe("client-spent");
  });

  it("holds everybody together to the global ceiling, however many clients they are", async () => {
    const store = fakeStore();
    expect(await spend(store, "198.51.100.1")).toBe("allowed");
    expect(await spend(store, "198.51.100.2")).toBe("allowed");
    expect(await spend(store, "198.51.100.3")).toBe("allowed");
    expect(await spend(store, "198.51.100.4")).toBe("global-spent");
  });

  it("spends nothing of everybody's on a client already over its own budget", async () => {
    const store = fakeStore();
    await spend(store, "198.51.100.1");
    await spend(store, "198.51.100.1");
    for (let i = 0; i < 10; i += 1) expect(await spend(store, "198.51.100.1")).toBe("client-spent");
    expect(await spend(store, "198.51.100.2")).toBe("allowed");
  });

  it("starts again in the next window", async () => {
    const store = fakeStore();
    await spend(store, "198.51.100.1");
    await spend(store, "198.51.100.1");
    expect(await spend(store, "198.51.100.1", NOW + BUDGET.windowMs)).toBe("allowed");
  });

  it("refuses when the store cannot count", async () => {
    const store = fakeStore();
    store.down = true;
    expect(await spend(store, "198.51.100.1")).toBe("unavailable");
  });

  it("writes no client address, under no prefix the backup copies, and a different key in every window", async () => {
    const store = fakeStore();
    await spend(store, "198.51.100.77");
    await spend(store, "198.51.100.77", NOW + BUDGET.windowMs);

    const keys = [...store.data.keys()];
    expect(keys.every((key) => key.startsWith(ACTION_BUDGET_PREFIX))).toBe(true);
    expect(keys.some((key) => key.includes("198.51.100.77"))).toBe(false);
    expect(keys.some((key) => BACKUP_PREFIXES.some((prefix) => key.startsWith(prefix)))).toBe(false);
    const clientKeys = keys.filter((key) => !key.endsWith(":all")).map((key) => key.split(":").at(-1));
    expect(new Set(clientKeys).size).toBe(2);
  });
});
