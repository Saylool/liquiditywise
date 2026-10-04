import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Answer = { kind: string; [key: string]: unknown };
type Usage = { status: string; [key: string]: unknown };

/*
 * Each source answers from a script per hook, or hangs until let go, and
 * counts what it was asked — so a test can say how often a source was asked
 * and how many questions were in flight at once.
 */
const state = vi.hoisted(() => ({
  sourcify: new Map<string, () => Promise<unknown>>(),
  blockscout: new Map<string, () => Promise<unknown>>(),
  pools: new Map<string, () => Promise<unknown>>(),
  asked: { sourcify: [] as unknown[], blockscout: [] as unknown[], pools: [] as unknown[] },
  inFlight: { sourcify: 0, blockscout: 0, pools: 0 },
  peak: { sourcify: 0, blockscout: 0, pools: 0 },
}));

const answering = (source: "sourcify" | "blockscout" | "pools", key: string, request: unknown) => {
  state.asked[source].push(request);
  state.inFlight[source] += 1;
  state.peak[source] = Math.max(state.peak[source], state.inFlight[source]);
  const script = state[source].get(key);
  const done = () => {
    state.inFlight[source] -= 1;
  };
  if (script === undefined) {
    done();
    return Promise.reject(new Error(`no script for ${source} ${key}`));
  }
  return script().finally(done);
};

vi.mock("../verification/sourcify", async (original) => ({
  ...(await original<typeof import("../verification/sourcify")>()),
  fetchSourcifyAnswer: (request: { chainId: number; address: string }) =>
    answering("sourcify", `${request.chainId}:${request.address}`, request),
}));
vi.mock("../verification/blockscout", async (original) => ({
  ...(await original<typeof import("../verification/blockscout")>()),
  fetchBlockscoutAnswer: (request: { chainId: number; address: string }) =>
    answering("blockscout", `${request.chainId}:${request.address}`, request),
}));
vi.mock("../uniswap/ethereumV4HookPools", async (original) => ({
  ...(await original<typeof import("../uniswap/ethereumV4HookPools")>()),
  fetchV4HookPools: (request: { hook: string; subgraphId: string | undefined }) =>
    answering("pools", `${request.subgraphId}:${request.hook}`, request),
}));

import { HOOK_CHECK_KEPT_MS, HOOK_CHECK_RETRY_MS } from "./hookCheck";
import { checkHook, forgetHookChecks, HOOK_CHECK_WAIT_MS, readHookCheck } from "./getHookChecks";

const HOOK = "0xa0b0d2d00fd544d8e0887f1a3cedd6e24baf10cc";
const OTHER = "0x322dcec4958c14e021a9f1cd49df11b9457968cc";
const VERIFIED: Answer = { kind: "verified", name: "Spot", proxy: null };
const UNVERIFIED: Answer = { kind: "unverified", proxy: null };
const TIMED_OUT: Answer = { kind: "unanswered", why: "timeout" };
const COUNTED: Usage = { status: "counted", pools: 18, capped: false, firstCreatedAt: "2025-06-08T16:26:44.000Z" };
const UNCOUNTED: Usage = { status: "unchecked" };

const now = <T,>(value: T) => () => Promise.resolve(value);
/*
 * Answers when let go, and not before. Every one is let go after its test:
 * the lines are the process's (as a source's own deadline frees them in
 * use), and a question left hanging would hold its place into the next test.
 */
const hanging: (() => void)[] = [];
const held = <T,>() => {
  let release: (value: T) => void = () => undefined;
  const answer = new Promise<T>((resolve) => {
    release = resolve;
  });
  hanging.push(() => release({ kind: "unanswered", why: "timeout", status: "unchecked" } as T));
  return { script: () => answer, release: (value: T) => release(value) };
};

const script = (chainId: number, address: string, sourcify: () => Promise<unknown>, blockscout: () => Promise<unknown>, pools: () => Promise<unknown>) => {
  state.sourcify.set(`${chainId}:${address}`, sourcify);
  state.blockscout.set(`${chainId}:${address}`, blockscout);
  state.pools.set(`unichain-v4:${address}`, pools);
  state.pools.set(`base-v4:${address}`, pools);
  state.pools.set(`bnb-v4:${address}`, pools);
  state.pools.set(`avalanche-v4:${address}`, pools);
};

const calls = () => ({
  sourcify: state.asked.sourcify.length,
  blockscout: state.asked.blockscout.length,
  pools: state.asked.pools.length,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(new Date("2026-10-04T12:00:00.000Z"));
  vi.stubEnv("THE_GRAPH_API_KEY", "test-key");
  vi.stubEnv("UNISWAP_V4_UNICHAIN_SUBGRAPH_ID", "unichain-v4");
  vi.stubEnv("UNISWAP_V4_BASE_SUBGRAPH_ID", "base-v4");
  vi.stubEnv("UNISWAP_V4_BNB_SUBGRAPH_ID", "bnb-v4");
  vi.stubEnv("UNISWAP_V4_AVALANCHE_SUBGRAPH_ID", "avalanche-v4");
  forgetHookChecks();
  for (const map of [state.sourcify, state.blockscout, state.pools]) map.clear();
  state.asked = { sourcify: [], blockscout: [], pools: [] };
  state.inFlight = { sourcify: 0, blockscout: 0, pools: 0 };
  state.peak = { sourcify: 0, blockscout: 0, pools: 0 };
});

afterEach(async () => {
  for (const release of hanging.splice(0)) release();
  await vi.advanceTimersByTimeAsync(0);
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("checking a hook", () => {
  it("asks each source about the hook on its own network, and combines what they say", async () => {
    script(130, HOOK, now(UNVERIFIED), now(VERIFIED), now(COUNTED));

    const check = await checkHook(130, HOOK);

    expect(check).toEqual({
      chainId: 130,
      address: HOOK,
      verification: { status: "verified", sources: ["blockscout"], name: "Spot", proxy: null },
      usage: COUNTED,
    });
    expect(state.asked.sourcify).toMatchObject([{ chainId: 130, address: HOOK }]);
    expect(state.asked.blockscout).toMatchObject([{ chainId: 130, address: HOOK }]);
    expect(state.asked.pools).toMatchObject([{ hook: HOOK, subgraphId: "unichain-v4", apiKey: "test-key" }]);
  });

  it("reads an address as every address here is written, and never sends one that is not an address", async () => {
    script(130, HOOK, now(VERIFIED), now(VERIFIED), now(COUNTED));

    expect((await checkHook(130, HOOK.toUpperCase().replace("0X", "0x"))).address).toBe(HOOK);
    expect(await checkHook(130, "0xnot-a-hook/../../admin")).toMatchObject({
      verification: { status: "unchecked" },
      usage: { status: "unchecked" },
    });
    expect(calls()).toEqual({ sourcify: 1, blockscout: 1, pools: 1 });
  });

  it("keeps every answer for twelve hours, and asks again once they are up", async () => {
    script(130, HOOK, now(VERIFIED), now(UNVERIFIED), now(COUNTED));

    await checkHook(130, HOOK);
    vi.advanceTimersByTime(HOOK_CHECK_KEPT_MS - 1);
    await checkHook(130, HOOK);
    expect(calls()).toEqual({ sourcify: 1, blockscout: 1, pools: 1 });

    vi.advanceTimersByTime(1);
    await checkHook(130, HOOK);
    expect(calls()).toEqual({ sourcify: 2, blockscout: 2, pools: 2 });
  });

  /* Kept at all, so a source that is down is not asked again by every page; briefly, so it does not outlast the outage. */
  it("keeps a question that went unanswered for ten minutes only, each source on its own", async () => {
    script(130, HOOK, now(TIMED_OUT), now(VERIFIED), now(UNCOUNTED));

    await checkHook(130, HOOK);
    vi.advanceTimersByTime(HOOK_CHECK_RETRY_MS - 1);
    await checkHook(130, HOOK);
    expect(calls()).toEqual({ sourcify: 1, blockscout: 1, pools: 1 });

    vi.advanceTimersByTime(1);
    await checkHook(130, HOOK);
    expect(calls()).toEqual({ sourcify: 2, blockscout: 1, pools: 2 });
  });

  it("says no verified source was found only when both verifiers said so", async () => {
    script(130, HOOK, now(UNVERIFIED), now(UNVERIFIED), now(COUNTED));

    expect((await checkHook(130, HOOK)).verification).toEqual({ status: "unverified", proxy: null });
  });

  it("reads a source that threw as one that did not answer, and never rejects", async () => {
    script(130, HOOK, () => Promise.reject(new Error("boom")), now(UNVERIFIED), () => Promise.reject(new Error("boom")));

    expect(await checkHook(130, HOOK)).toMatchObject({ verification: { status: "unchecked" }, usage: { status: "unchecked" } });
  });
});

/* BNB Chain and Avalanche have no Blockscout (verification/blockscout.ts): two questions there, not three. */
describe("checking a hook on a network with no Blockscout", () => {
  it.each([
    ["BNB Chain", 56, "bnb-v4"],
    ["Avalanche", 43114, "avalanche-v4"],
  ] as const)("asks Sourcify and %s's own subgraph, and never a Blockscout", async (_, chainId, subgraphId) => {
    script(chainId, HOOK, now(VERIFIED), now(VERIFIED), now(COUNTED));

    const check = await checkHook(chainId, HOOK);

    expect(check).toEqual({
      chainId,
      address: HOOK,
      verification: { status: "verified", sources: ["sourcify"], name: "Spot", proxy: null },
      usage: COUNTED,
    });
    expect(state.asked.sourcify).toMatchObject([{ chainId, address: HOOK }]);
    expect(state.asked.blockscout).toEqual([]);
    expect(state.asked.pools).toMatchObject([{ hook: HOOK, subgraphId }]);
  });

  it("says no verified source was found on Sourcify's word alone there, and waits on nothing else", async () => {
    script(56, HOOK, now(UNVERIFIED), now(VERIFIED), now(COUNTED));

    expect((await readHookCheck(56, HOOK)).verification).toEqual({ status: "unverified", proxy: null });
    expect((await checkHook(56, OTHER)).verification).toEqual({ status: "unchecked" });
    expect(calls().blockscout).toBe(0);
  });
});

describe("a page waiting on a check", () => {
  it("waits for a slow source no longer than its wait, and says what is not back could not be checked", async () => {
    const sourcify = held<Answer>();
    const pools = held<Usage>();
    script(130, HOOK, sourcify.script, now(UNVERIFIED), pools.script);

    const check = checkHook(130, HOOK);
    await vi.advanceTimersByTimeAsync(HOOK_CHECK_WAIT_MS);

    expect(await check).toMatchObject({ verification: { status: "unchecked" }, usage: { status: "unchecked" } });
  });

  it("shows what did come back in time beside what did not", async () => {
    const pools = held<Usage>();
    script(130, HOOK, now(UNVERIFIED), now(VERIFIED), pools.script);

    const check = checkHook(130, HOOK);
    await vi.advanceTimersByTimeAsync(HOOK_CHECK_WAIT_MS);

    expect(await check).toMatchObject({ verification: { status: "verified", sources: ["blockscout"] }, usage: { status: "unchecked" } });
  });

  it("is not cut short when everything answers in time", async () => {
    const sourcify = held<Answer>();
    script(130, HOOK, sourcify.script, now(VERIFIED), now(COUNTED));

    const check = checkHook(130, HOOK);
    await vi.advanceTimersByTimeAsync(HOOK_CHECK_WAIT_MS - 1);
    sourcify.release(VERIFIED);

    expect(await check).toMatchObject({ verification: { status: "verified", sources: ["sourcify", "blockscout"] }, usage: COUNTED });
  });

  /* The question is not abandoned at the page's deadline: its answer is kept for the next page. */
  it("lets a question that outlasted the wait finish, and gives its answer to the next page without asking again", async () => {
    const sourcify = held<Answer>();
    script(130, HOOK, sourcify.script, now(UNVERIFIED), now(COUNTED));

    const first = checkHook(130, HOOK);
    await vi.advanceTimersByTimeAsync(HOOK_CHECK_WAIT_MS);
    expect((await first).verification).toEqual({ status: "unchecked" });

    sourcify.release(VERIFIED);
    await vi.advanceTimersByTimeAsync(0);

    expect((await checkHook(130, HOOK)).verification).toMatchObject({ status: "verified", sources: ["sourcify"] });
    expect(calls()).toEqual({ sourcify: 1, blockscout: 1, pools: 1 });
  });

  it("joins a question already being asked rather than asking it twice", async () => {
    const blockscout = held<Answer>();
    script(130, HOOK, now(UNVERIFIED), blockscout.script, now(COUNTED));

    const first = checkHook(130, HOOK);
    const second = checkHook(130, HOOK);
    blockscout.release(VERIFIED);

    expect((await first).verification).toEqual((await second).verification);
    expect(calls().blockscout).toBe(1);
  });

  it("waits for everything when nobody is waiting on it, as the warmer does", async () => {
    const pools = held<Usage>();
    script(130, HOOK, now(VERIFIED), now(VERIFIED), pools.script);

    const check = readHookCheck(130, HOOK);
    await vi.advanceTimersByTimeAsync(HOOK_CHECK_WAIT_MS * 3);
    pools.release(COUNTED);

    expect((await check).usage).toEqual(COUNTED);
  });
});

describe("a directory's worth of checks", () => {
  it("asks each service a few at a time, never all at once", async () => {
    const hooks = Array.from({ length: 12 }, (_unused, index) => `0x${index.toString(16).padStart(40, "0")}`);
    const holds = hooks.map(() => ({ sourcify: held<Answer>(), blockscout: held<Answer>(), pools: held<Usage>() }));
    hooks.forEach((hook, index) => script(8453, hook, holds[index]!.sourcify.script, holds[index]!.blockscout.script, holds[index]!.pools.script));

    const checks = hooks.map((hook) => readHookCheck(8453, hook));
    await vi.advanceTimersByTimeAsync(0);
    expect(state.inFlight).toEqual({ sourcify: 4, blockscout: 4, pools: 3 });

    for (const hold of holds) {
      hold.sourcify.release(VERIFIED);
      hold.blockscout.release(VERIFIED);
      hold.pools.release(COUNTED);
    }
    const done = await Promise.all(checks);

    expect(done.every(({ verification }) => verification.status === "verified")).toBe(true);
    expect(state.peak).toEqual({ sourcify: 4, blockscout: 4, pools: 3 });
    expect(calls()).toEqual({ sourcify: 12, blockscout: 12, pools: 12 });
    expect(state.asked.pools).toMatchObject(hooks.map((hook) => ({ hook, subgraphId: "base-v4" })));
  });

  it("keeps each hook's answers apart, and each network's", async () => {
    script(130, HOOK, now(VERIFIED), now(VERIFIED), now(COUNTED));
    script(130, OTHER, now(UNVERIFIED), now(UNVERIFIED), now(UNCOUNTED));
    script(8453, HOOK, now(UNVERIFIED), now(UNVERIFIED), now(COUNTED));

    expect((await checkHook(130, HOOK)).verification.status).toBe("verified");
    expect((await checkHook(130, OTHER)).verification.status).toBe("unverified");
    expect((await checkHook(8453, HOOK)).verification.status).toBe("unverified");
  });
});
