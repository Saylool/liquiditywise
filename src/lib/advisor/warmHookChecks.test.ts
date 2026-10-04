import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  directory: null as unknown,
  directoriesRead: [] as number[],
  checked: [] as [number, string][],
}));

vi.mock("./getHookDirectory", () => ({
  getHookDirectory: async (chainId: number) => {
    state.directoriesRead.push(chainId);
    return state.directory;
  },
}));
vi.mock("./getHookChecks", () => ({
  readHookCheck: async (chainId: number, address: string) => {
    state.checked.push([chainId, address]);
    return {
      chainId,
      address,
      verification: address.endsWith("1") ? { status: "verified", sources: ["sourcify"], name: null, proxy: null } : { status: "unchecked" },
      usage: address.endsWith("1") ? { status: "counted", pools: 1, capped: false, firstCreatedAt: null } : { status: "unchecked" },
    };
  },
}));

import { CHAINS } from "../chains/chains";
import { warmHookChecks } from "./warmHookChecks";

const UNICHAIN = CHAINS.find(({ id }) => id === 130)!;
const listed = (...addresses: string[]) => ({
  status: "success",
  data: { hooks: addresses.map((address) => ({ address })) },
});

beforeEach(() => {
  Object.assign(state, { directory: null, directoriesRead: [], checked: [] });
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

describe("warming the checks beside a directory", () => {
  it("checks every hook the network's directory lists, on that network", async () => {
    state.directory = listed("0x01", "0x02", "0x11");

    expect(await warmHookChecks(UNICHAIN)).toEqual({ asked: 3, verified: 2, counted: 2 });
    expect(state.directoriesRead).toEqual([130]);
    expect(state.checked).toEqual([
      [130, "0x01"],
      [130, "0x02"],
      [130, "0x11"],
    ]);
  });

  it("asks nothing when the directory could not be read", async () => {
    state.directory = { status: "unavailable", notice: "market-data-timed-out" };

    expect(await warmHookChecks(UNICHAIN)).toEqual({ asked: 0, verified: 0, counted: 0 });
    expect(state.checked).toEqual([]);
  });
});
