import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { HookCheck, HookVerification } from "../lib/advisor/hookCheck";
import { getHookCheckCopy } from "../lib/i18n/hookCheckCopy";
import type { Locale } from "../lib/i18n/locales";
import type { HookUsage } from "../lib/uniswap/ethereumV4HookPools";
import { HookCheckFrame, HookCheckLines, HookCheckPending } from "./HookCheck";

const HOOK = "0xa0b0d2d00fd544d8e0887f1a3cedd6e24baf10cc";
const COUNTED: HookUsage = { status: "counted", pools: 18, capped: false, firstCreatedAt: "2025-06-08T16:26:44.000Z" };

const check = (verification: HookVerification, usage: HookUsage = COUNTED): HookCheck => ({
  chainId: 130,
  address: HOOK,
  verification,
  usage,
});

const render = (value: HookCheck, locale: Locale = "en") => renderToStaticMarkup(<HookCheckLines check={value} locale={locale} />);
/** `renderToStaticMarkup` writes an apostrophe as an entity. */
const escaped = (text: string) => text.replace(/'/g, "&#x27;");

describe("what can be checked about a hook, on the page", () => {
  it("says on which verifiers its source is verified, and what that source calls the contract", () => {
    const markup = render(check({ status: "verified", sources: ["sourcify", "blockscout"], name: "Spot", proxy: null }));

    expect(markup).toContain("Source code verified on Sourcify and Blockscout.");
    expect(markup).toContain("Its published source names the contract Spot.");
  });

  it("links each verifier that holds the source to its own page for it, and no other", () => {
    const both = render(check({ status: "verified", sources: ["sourcify", "blockscout"], name: null, proxy: null }));
    const one = render(check({ status: "verified", sources: ["blockscout"], name: null, proxy: null }));

    expect(both).toContain(`href="https://repo.sourcify.dev/130/${HOOK}"`);
    expect(both).toContain(`href="https://unichain.blockscout.com/address/${HOOK}?tab=contract"`);
    expect(both).toContain('rel="noopener noreferrer"');
    expect(one).not.toContain("repo.sourcify.dev");
    expect(one).toContain("Source code verified on Blockscout.");
  });

  it("says no name where the source gave none, rather than a placeholder", () => {
    const markup = render(check({ status: "verified", sources: ["sourcify"], name: null, proxy: null }));

    expect(markup).not.toContain("names the contract");
    expect(markup).not.toContain("null");
  });

  it("says no verified source was found on either, and that no other explorer was asked", () => {
    const markup = render(check({ status: "unverified", proxy: null }));

    expect(markup).toContain(getHookCheckCopy("en").unverified);
    expect(markup).not.toContain("Read the source on");
  });

  it("says it could not be checked just now, and nothing that would read as either verdict", () => {
    const markup = render(check({ status: "unchecked" }));

    expect(markup).toContain("Whether its source code is verified could not be checked just now.");
    expect(markup).not.toContain("verified on");
    expect(markup).not.toContain("No verified source");
  });

  it("says when Blockscout reads the address as a proxy, naming the code behind it when it can", () => {
    const named = render(
      check({ status: "verified", sources: ["blockscout"], name: "ERC1967Proxy", proxy: { implementation: "StablePairHook" } }),
    );
    const unnamed = render(check({ status: "unverified", proxy: { implementation: null } }));

    expect(named).toContain("under the name StablePairHook");
    expect(named).toContain("A verified proxy says nothing about that code");
    expect(unnamed).toContain("Blockscout reads this address as a proxy");
    expect(unnamed).not.toContain("under the name");
  });

  it("shows how many v4 pools name it and when the first was created, as figures", () => {
    const markup = render(check({ status: "unchecked" }));

    expect(markup).toContain("v4 pools on this network that name it");
    expect(markup).toContain("<bdi>18</bdi>");
    expect(markup).toContain("<bdi>2025-06-08</bdi>");
    expect(markup).toContain(escaped("All of them, not only this week's busiest; counted up to 1,000."));
  });

  it("writes a count at the cap as at least that many", () => {
    const markup = render(check({ status: "unchecked" }, { status: "counted", pools: 1000, capped: true, firstCreatedAt: "2025-09-01T00:00:00.000Z" }));

    expect(markup).toContain("<bdi>1,000+</bdi>");
  });

  it("shows no date for a hook no pool names", () => {
    const markup = render(check({ status: "unchecked" }, { status: "counted", pools: 0, capped: false, firstCreatedAt: null }));

    expect(markup).toContain("<bdi>0</bdi>");
    expect(markup).not.toContain("The first of them created");
  });

  it("says the pools could not be counted just now, rather than a count of none", () => {
    const markup = render(check({ status: "unchecked" }, { status: "unchecked" }));

    expect(markup).toContain("How many v4 pools on this network name it could not be counted just now.");
    expect(markup).not.toContain("<bdi>");
  });

  it("writes in the reader's language, the verifiers listed in its own words", () => {
    const markup = render(check({ status: "verified", sources: ["sourcify", "blockscout"], name: "Spot", proxy: null }), "tr");

    expect(markup).toContain("Kaynak kodu Sourcify ve Blockscout üzerinde doğrulanmış.");
    expect(markup).toContain("<bdi>18</bdi>");
    expect(renderToStaticMarkup(<HookCheckPending locale="de" />)).toContain(getHookCheckCopy("de").pending);
  });
});

describe("the frame around it", () => {
  it("heads the block, and says what verified means only where asked to", () => {
    const explained = renderToStaticMarkup(
      <HookCheckFrame locale="en" explain>
        <p>line</p>
      </HookCheckFrame>,
    );
    const plain = renderToStaticMarkup(
      <HookCheckFrame locale="en" explain={false}>
        <p>line</p>
      </HookCheckFrame>,
    );
    const { heading, meaning } = getHookCheckCopy("en");

    expect(explained).toContain(heading);
    expect(explained).toContain(escaped(meaning));
    expect(explained.indexOf("<p>line</p>")).toBeLessThan(explained.indexOf("not an audit"));
    expect(plain).toContain(heading);
    expect(plain).not.toContain("not an audit");
  });
});
