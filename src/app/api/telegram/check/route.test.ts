import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/*
 * The scheduled pass run end to end against a fake store and fake readers:
 * what the route asks of each, and what counts it answers. The environment,
 * the chain readers and the bot are replaced; everything between them — the
 * links, the pool watches, the messages — is the real composition.
 */
const world = vi.hoisted(() => ({
  store: null as unknown,
  sent: [] as { chatId: number; text: string }[],
  ranges: new Map<string, readonly [number, number] | null>(),
  asked: [] as unknown[],
  heartbeats: [] as string[],
}));

vi.mock("@/lib/telegram/environment", () => ({
  telegramSetup: () => ({
    store: world.store,
    bot: {
      sendMessage: async (chatId: number, text: string) => {
        world.sent.push({ chatId, text });
        return true;
      },
    },
    username: "bot",
    webhookSecret: "hook",
    cronSecret: "cron-secret",
  }),
}));
vi.mock("@/lib/telegram/poolWatchReads", () => ({
  readPoolRange: async (target: { protocol: "v3" | "v4"; chainId: number; poolId: string }) => {
    world.asked.push(target);
    const range = world.ranges.get(target.poolId);
    if (range === undefined) throw new Error("https://secret-rpc.example/key timed out");
    return range === null
      ? null
      : { ...target, pair: { token0: "USDC", token1: "WETH" }, lpFeePpm: 500, currentPrice: 0.0004, range };
  },
}));
vi.mock("@/lib/advisor/getAddressPositions", () => ({
  getAddressPositions: async () => ({ status: "success", data: { positions: [] } }),
}));
vi.mock("@/lib/advisor/getPairPools", () => ({ pairPoolReaders: {} }));
vi.mock("@/lib/advisor/getSmartLiquidity", () => ({ peekSmartLiquidity: () => null }));
vi.mock("@/lib/advisor/smartStore", () => ({ readSeries: async () => null }));
vi.mock("@/lib/email/environment", () => ({ emailDigestSetup: () => null }));
vi.mock("@/lib/health/appReadings", () => ({
  recordAlertRun: async (_store: unknown, at: Date) => {
    world.heartbeats.push(at.toISOString());
  },
}));

import { GET } from "./route";
import { fakeStore } from "@/lib/telegram/fakeStore";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { addPoolWatch, readPoolWatches } from "@/lib/telegram/poolWatches";
import { claimLink, createPendingLink } from "@/lib/telegram/links";

const POOL = `0x${"c".repeat(40)}`;
const OTHER = `0x${"e".repeat(40)}`;
const TOLD = [0.0003, 0.0005] as const;

const call = (secret = "cron-secret") => GET(new NextRequest("http://localhost/api/telegram/check", { headers: { authorization: `Bearer ${secret}` } }));

let store: ReturnType<typeof fakeStore>;

beforeEach(() => {
  store = fakeStore();
  world.store = store;
  world.sent = [];
  world.ranges = new Map();
  world.asked = [];
  world.heartbeats = [];
});

describe("the check route", () => {
  it("refuses a pass without the cron secret", async () => {
    expect((await call("wrong")).status).toBe(401);
    expect(world.asked).toEqual([]);
  });

  it("reads every watched pool through the pages' cached reader, tells a moved range, and answers counts only", async () => {
    await createPendingLink(store, "abcDEF123456789012_-xy", { address: `0x${"a".repeat(40)}`, locale: "en", now: new Date() });
    await claimLink(store, "abcDEF123456789012_-xy", 42);
    await addPoolWatch(store, 99, { target: { protocol: "v3", chainId: 1, poolId: POOL }, range: TOLD, locale: "tr", now: new Date("2026-10-01T00:00:00.000Z") });
    await addPoolWatch(store, 99, { target: { protocol: "v3", chainId: 8453, poolId: OTHER }, range: TOLD, locale: "tr", now: new Date("2026-10-01T00:00:00.000Z") });
    world.ranges.set(POOL, [0.0004, 0.0006]);
    world.ranges.set(OTHER, [0.0003, 0.0005]);

    const response = await call();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(world.asked).toEqual([
      { protocol: "v3", chainId: 1, poolId: POOL },
      { protocol: "v3", chainId: 8453, poolId: OTHER },
    ]);
    expect(body).toMatchObject({ ok: true, watches: 1, checked: 1, poolWatches: 2, poolsUnreadable: 0, poolAlerts: 1 });
    expect(JSON.stringify(body)).not.toContain("99");
    expect(world.sent).toHaveLength(1);
    expect(world.sent[0]?.chatId).toBe(99);
    expect(world.sent[0]?.text).toContain("USDC/WETH");
    expect(world.sent[0]?.text).toContain(getDictionary("tr").telegram.footer);
    expect((await readPoolWatches(store, 99))?.watches[0]?.told).toMatchObject({ lower: 0.0004, upper: 0.0006 });
    expect(world.heartbeats).toHaveLength(1);
  });

  it("finishes the pass, and marks it, when a pool's reader throws or answers nothing", async () => {
    await addPoolWatch(store, 99, { target: { protocol: "v3", chainId: 1, poolId: POOL }, range: TOLD, locale: "en", now: new Date("2026-10-01T00:00:00.000Z") });
    await addPoolWatch(store, 99, { target: { protocol: "v4", chainId: 130, poolId: `0x${"d".repeat(64)}` }, range: TOLD, locale: "en", now: new Date("2026-10-01T00:00:00.000Z") });
    world.ranges.set(`0x${"d".repeat(64)}`, null);
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const body = await (await call()).json();

    expect(body).toMatchObject({ ok: true, poolWatches: 2, poolsUnreadable: 2, poolAlerts: 0 });
    expect(world.sent).toEqual([]);
    expect(world.heartbeats).toHaveLength(1);
    expect(quiet.mock.calls.map(([line]) => String(line))).toEqual([
      `[telegram] watched pool unreadable: v3 1 ${POOL}`,
      `[telegram] watched pool unreadable: v4 130 0x${"d".repeat(64)}`,
    ]);
    quiet.mockRestore();
  });
});
