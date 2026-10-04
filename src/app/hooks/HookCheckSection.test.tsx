import { isValidElement, Suspense, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HookCheckPending } from "@/components/HookCheck";
import type { HookCheck } from "@/lib/advisor/hookCheck";
import { HookCheckAnswer, HookCheckSection } from "./HookCheckSection";

const CHECK: HookCheck = {
  chainId: 1,
  address: "0x322dcec4958c14e021a9f1cd49df11b9457968cc",
  verification: { status: "verified", sources: ["sourcify", "blockscout"], name: "LaunchHook", proxy: null },
  usage: { status: "counted", pools: 1000, capped: true, firstCreatedAt: "2026-09-05T12:03:47.000Z" },
};

describe("one hook's check in its own boundary", () => {
  it("waits on the check and shows it", async () => {
    const markup = renderToStaticMarkup(await HookCheckAnswer({ check: Promise.resolve(CHECK), locale: "en" }));

    expect(markup).toContain("Source code verified on Sourcify and Blockscout.");
    expect(markup).toContain("Its published source names the contract LaunchHook.");
    expect(markup).toContain("<bdi>1,000+</bdi>");
  });

  it("streams in a boundary of its own, saying it is checking until it can say more", () => {
    const element = HookCheckSection({ check: Promise.resolve(CHECK), locale: "tr" }) as ReactElement<{ fallback: unknown }>;

    expect(element.type).toBe(Suspense);
    expect(isValidElement(element.props.fallback)).toBe(true);
    expect((element.props.fallback as ReactElement).type).toBe(HookCheckPending);
  });
});
