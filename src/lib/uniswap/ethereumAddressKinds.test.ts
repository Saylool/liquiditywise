import { beforeEach, describe, expect, it, vi } from "vitest";

const aggregated = vi.hoisted(() => ({
  requests: [] as { calls: unknown[]; codeOf?: string[] }[],
  codes: null as unknown as (addresses: string[]) => (string | null)[],
  ok: true,
}));
vi.mock("./ethereumAggregatedCalls", () => ({
  postAggregatedCalls: async (request: { calls: unknown[]; codeOf?: string[] }) => {
    aggregated.requests.push(request);
    return aggregated.ok
      ? { ok: true, results: [], codes: aggregated.codes(request.codeOf ?? []) }
      : { ok: false, reason: "network-error", notice: "chain-data-unreachable" };
  },
}));

import { fetchAddressKinds, KINDS_BATCH, kindOfCode } from "./ethereumAddressKinds";

const A = `0x${"a".repeat(40)}`;
const B = `0x${"b".repeat(40)}`;
const C = `0x${"c".repeat(40)}`;
const ask = (addresses: string[], rpcUrl: string | undefined = "https://rpc.example") =>
  fetchAddressKinds({ addresses, rpcUrl, fetchImpl: fetch });

beforeEach(() => {
  aggregated.requests = [];
  aggregated.ok = true;
  aggregated.codes = (addresses) => addresses.map(() => "0x");
});

describe("what code sits at an address", () => {
  it("is a wallet where there is none, and a contract where there is some", () => {
    expect(kindOfCode("0x")).toBe("wallet");
    expect(kindOfCode("0x6080604052")).toBe("contract");
  });

  it("is still a wallet for an account delegated to code under EIP-7702, which holds a marker and one address", () => {
    expect(kindOfCode(`0xef0100${"ab".repeat(20)}`)).toBe("wallet");
    expect(kindOfCode(`0xef0100${"ab".repeat(21)}`)).toBe("contract");
  });
});

describe("telling wallets from contracts", () => {
  it("asks for each distinct address's code once, lower-cased, in one batch", async () => {
    aggregated.codes = (addresses) => addresses.map((address) => (address === B ? "0x6080" : "0x"));
    const result = await ask([A.toUpperCase().replace("0X", "0x"), A, B]);

    expect(aggregated.requests).toHaveLength(1);
    expect(aggregated.requests[0]?.codeOf).toEqual([A, B]);
    expect(result.status === "success" && [...result.data]).toEqual([[A, "wallet"], [B, "contract"]]);
  });

  it("leaves out an address whose code did not come back, rather than calling it a wallet", async () => {
    aggregated.codes = () => ["0x", null, "not hex"];
    const result = await ask([A, B, C]);

    expect(result.status === "success" && [...result.data.keys()]).toEqual([A]);
  });

  it("asks a few at a time and puts the answers together", async () => {
    const many = Array.from({ length: KINDS_BATCH + 5 }, (_unused, index) => `0x${index.toString(16).padStart(40, "0")}`);
    const result = await ask(many);

    expect(aggregated.requests.map(({ codeOf }) => codeOf?.length)).toEqual([KINDS_BATCH, 5]);
    expect(result.status === "success" && result.data.size).toBe(many.length);
  });

  it("asks nothing for nothing, refuses without an endpoint, and fails whole when a batch is refused", async () => {
    expect(await ask([])).toEqual({ status: "success", data: new Map() });
    expect(await ask(["0xnope"])).toEqual({ status: "success", data: new Map() });
    expect(aggregated.requests).toHaveLength(0);
    expect(await ask([A], " ")).toMatchObject({ reason: "configuration-error" });
    aggregated.ok = false;
    expect(await ask([A])).toMatchObject({ status: "unavailable", reason: "network-error" });
  });
});
