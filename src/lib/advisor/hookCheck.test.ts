import { describe, expect, it } from "vitest";

import type { SourceAnswer } from "../verification/sourceAnswer";
import { combineVerification, composeHookCheck, isCounted } from "./hookCheck";

const verified = (name: string | null, proxy: { implementation: string | null } | null = null): SourceAnswer => ({
  kind: "verified",
  name,
  proxy,
});
const unverified = (proxy: { implementation: string | null } | null = null): SourceAnswer => ({ kind: "unverified", proxy });
const silent: SourceAnswer = { kind: "unanswered", why: "timeout" };
const unreadable: SourceAnswer = { kind: "unanswered", why: "unreadable" };

describe("two verifiers' answers, made one", () => {
  it("is verified on both when both hold verified source, Sourcify named first", () => {
    expect(combineVerification(verified("LaunchHook"), verified("LaunchHook"))).toEqual({
      status: "verified",
      sources: ["sourcify", "blockscout"],
      name: "LaunchHook",
      proxy: null,
    });
  });

  /* Thirteen of Unichain's forty-seven listed hooks on 2026-10-04: on Blockscout, not on Sourcify. */
  it("is verified on either alone, whatever the other said or did not say", () => {
    expect(combineVerification(unverified(), verified("Spot"))).toMatchObject({ status: "verified", sources: ["blockscout"], name: "Spot" });
    expect(combineVerification(silent, verified("Spot"))).toMatchObject({ status: "verified", sources: ["blockscout"] });
    expect(combineVerification(verified("Gauge"), unverified())).toMatchObject({ status: "verified", sources: ["sourcify"], name: "Gauge" });
    expect(combineVerification(verified("Gauge"), unreadable)).toMatchObject({ status: "verified", sources: ["sourcify"], name: "Gauge" });
  });

  it("takes Blockscout's name over Sourcify's, and Sourcify's only where Blockscout gave none", () => {
    expect(combineVerification(verified("FromSourcify"), verified("FromBlockscout"))).toMatchObject({ name: "FromBlockscout" });
    expect(combineVerification(verified("FromSourcify"), verified(null))).toMatchObject({ name: "FromSourcify" });
    expect(combineVerification(verified("FromSourcify"), unverified())).toMatchObject({ name: "FromSourcify" });
    expect(combineVerification(verified(null), verified(null))).toMatchObject({ name: null });
  });

  it("is not found only when both said so", () => {
    expect(combineVerification(unverified(), unverified())).toEqual({ status: "unverified", proxy: null });
  });

  /* One "no" beside a verifier that did not answer is not knowing; "not found" there would be a guess. */
  it("is unchecked when either could not be asked and neither found it", () => {
    expect(combineVerification(unverified(), silent)).toEqual({ status: "unchecked" });
    expect(combineVerification(silent, unverified())).toEqual({ status: "unchecked" });
    expect(combineVerification(unreadable, unverified())).toEqual({ status: "unchecked" });
    expect(combineVerification(silent, silent)).toEqual({ status: "unchecked" });
  });

  it("carries Blockscout's proxy reading, verified or not", () => {
    const proxy = { implementation: "StablePairHook" };

    expect(combineVerification(verified("ERC1967Proxy"), verified("ERC1967Proxy", proxy))).toMatchObject({ proxy });
    expect(combineVerification(unverified(), unverified({ implementation: null }))).toEqual({
      status: "unverified",
      proxy: { implementation: null },
    });
    expect(combineVerification(verified("Hook"), silent)).toMatchObject({ proxy: null });
  });
});

/*
 * BNB Chain and Avalanche have no Blockscout (verification/blockscout.ts), so
 * Blockscout is not asked there — `null`, which is not the same as asked and
 * silent.
 */
describe("a verdict on a network with no Blockscout", () => {
  it("is Sourcify's alone: verified, not found, or not known as Sourcify says", () => {
    expect(combineVerification(verified("BnbHook"), null)).toEqual({
      status: "verified",
      sources: ["sourcify"],
      name: "BnbHook",
      proxy: null,
    });
    expect(combineVerification(unverified(), null)).toEqual({ status: "unverified", proxy: null });
    expect(combineVerification(silent, null)).toEqual({ status: "unchecked" });
    expect(combineVerification(unreadable, null)).toEqual({ status: "unchecked" });
  });

  it("is not found there on Sourcify's word, where elsewhere it would need Blockscout's too", () => {
    expect(combineVerification(unverified(), null)).toMatchObject({ status: "unverified" });
    expect(combineVerification(unverified(), silent)).toEqual({ status: "unchecked" });
  });

  it("is a check of its own chain, never borrowing another network's Blockscout", () => {
    const usage = { status: "unchecked" as const };

    expect(composeHookCheck(56, "0xb0b0", unverified(), null, usage)).toEqual({
      chainId: 56,
      address: "0xb0b0",
      verification: { status: "unverified", proxy: null },
      usage,
    });
  });
});

describe("a hook's check", () => {
  it("is its chain and address, the combined verification and the count as given", () => {
    const usage = { status: "counted" as const, pools: 18, capped: false, firstCreatedAt: "2025-06-08T16:26:44.000Z" };

    expect(composeHookCheck(130, "0xa0b0", unverified(), verified("Spot"), usage)).toEqual({
      chainId: 130,
      address: "0xa0b0",
      verification: { status: "verified", sources: ["blockscout"], name: "Spot", proxy: null },
      usage,
    });
  });

  it("counts a count as answered and an unchecked one as not", () => {
    expect(isCounted({ status: "counted", pools: 0, capped: false, firstCreatedAt: null })).toBe(true);
    expect(isCounted({ status: "unchecked" })).toBe(false);
  });
});
