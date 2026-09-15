import { describe, expect, it, vi } from "vitest";

import { type Eip1193Provider, readFirstAccount, requestAccount } from "./eip1193";

const ADDRESS = `0x${"a".repeat(40)}`;

const providerReturning = (accounts: unknown): Eip1193Provider => ({
  request: vi.fn(async () => accounts),
});

const providerThrowing = (error: unknown): Eip1193Provider => ({
  request: vi.fn(async () => {
    throw error;
  }),
});

describe("readFirstAccount", () => {
  it("takes the first address a provider reports", () => {
    expect(readFirstAccount([ADDRESS, `0x${"b".repeat(40)}`])).toBe(ADDRESS);
  });

  it("lowercases it, as every other address here is", () => {
    expect(readFirstAccount([ADDRESS.toUpperCase().replace("0X", "0x")])).toBe(ADDRESS);
  });

  /*
   * A wallet is an extension that got there first, and nothing in the browser
   * obliges it to answer this method with what the standard says. Every shape
   * below is one an injected object could return.
   */
  it.each([
    ["nothing at all", undefined],
    ["null", null],
    ["a bare string instead of an array", ADDRESS],
    ["an empty array", []],
    ["an array of something else", [{ address: ADDRESS }]],
    ["an address that is too short", ["0x1234"]],
    ["an address with non-hex in it", [`0x${"z".repeat(40)}`]],
  ])("refuses %s", (_label, accounts) => {
    expect(readFirstAccount(accounts)).toBeNull();
  });
});

describe("requestAccount", () => {
  it("asks for accounts and nothing else", async () => {
    const provider = providerReturning([ADDRESS]);
    const result = await requestAccount(provider);

    expect(result).toEqual({ status: "connected", address: ADDRESS });
    expect(provider.request).toHaveBeenCalledWith({ method: "eth_requestAccounts" });
    expect(provider.request).toHaveBeenCalledTimes(1);
  });

  /*
   * A refusal is an answer, not a fault. Someone who changed their mind should
   * not be shown an error, so the two carry different codes.
   */
  it("tells a refusal apart from a failure", async () => {
    const declined = await requestAccount(
      providerThrowing({ code: 4001, message: "User rejected the request." }),
    );
    const failed = await requestAccount(providerThrowing(new Error("boom")));

    expect(declined).toEqual({ status: "unavailable", notice: "wallet-request-declined" });
    expect(failed).toEqual({ status: "unavailable", notice: "wallet-request-failed" });
  });

  it("reports a provider that answers with no usable account", async () => {
    expect(await requestAccount(providerReturning([]))).toEqual({
      status: "unavailable",
      notice: "wallet-no-account",
    });
  });

  /*
   * The property worth pinning: there is one method in this path. A change that
   * added a signing or transaction call would fail here, which is the point.
   */
  it("never asks a wallet to sign or send anything", async () => {
    const provider = providerReturning([ADDRESS]);
    await requestAccount(provider);

    const methods = (provider.request as unknown as { mock: { calls: [{ method: string }][] } }).mock
      .calls.map(([args]) => args.method);

    expect(methods).toEqual(["eth_requestAccounts"]);
    expect(methods.some((method) => /sign|sendTransaction|personal_/i.test(method))).toBe(false);
  });
});
