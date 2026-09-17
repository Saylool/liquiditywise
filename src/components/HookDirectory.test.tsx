import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { composeHookDirectory } from "../lib/advisor/hookDirectory";
import { getDictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import type { V4Pool, V4PoolCandidateList } from "../schemas";
import { HookDirectory } from "./HookDirectory";

const PARAMETERS = { horizonDays: 30, standardDeviationMultiplier: 1 };
const token = (address: string, symbol: string, decimals: number) => ({
  chainId: 1,
  address,
  symbol,
  decimals,
});
const USDC = token(`0x${"1".repeat(40)}`, "USDC", 6);
const WETH = token(`0x${"b".repeat(40)}`, "WETH", 18);

/** Real shapes: the last four hex characters are the permission list itself. */
const SWAP_HOOK = `0x${"1".repeat(36)}00c4`;
const LIQUIDITY_HOOK = `0x${"2".repeat(36)}0800`;

const pool = (index: number, hookAddress: string | null): V4Pool =>
  ({
    protocolVersion: "v4",
    chainId: 1,
    id: `0x${String(index).padStart(2, "0").repeat(32)}`,
    token0: USDC,
    token1: WETH,
    tickSpacing: 60,
    fee: { kind: "static", feePpm: 3000 },
    protocolFee: null,
    hookAddress,
  }) as unknown as V4Pool;

const directoryOf = (pools: readonly V4Pool[]) =>
  composeHookDirectory({
    pools,
    poolManager: `0x${"9".repeat(40)}`,
    createdAtBlockNumbers: {},
    fetchedAt: "2026-09-17T12:00:00.000Z",
    source: "uniswap-v4-subgraph",
  } as unknown as V4PoolCandidateList);

const render = (pools: readonly V4Pool[], locale: Locale = "en") =>
  renderToStaticMarkup(
    <HookDirectory
      result={directoryOf(pools)}
      parameters={PARAMETERS}
      t={getDictionary(locale)}
      locale={locale}
    />,
  );

const SIX_SWAP_POOLS = Array.from({ length: 6 }, (_unused, index) =>
  pool(index + 1, SWAP_HOOK),
);

describe("HookDirectory", () => {
  it("leads each entry with the address, because a hook has no name", () => {
    const markup = render([pool(1, SWAP_HOOK)]);

    expect(markup).toContain(SWAP_HOOK);
  });

  /*
   * The same sentences the single-pool page shows, from the same component on
   * the same fourteen bits. A second reading of one address is the one failure
   * a directory like this could have that nobody would notice.
   */
  it("says what each is permitted to do, in the words the pool page uses", () => {
    const markup = render([pool(1, SWAP_HOOK), pool(2, LIQUIDITY_HOOK)]);
    const t = getDictionary("en");

    expect(markup).toContain(t.v4.permissionWords.beforeSwap);
    expect(markup).toContain(t.v4.permissionWords.afterSwapReturnsDelta);
    expect(markup).toContain(t.v4.permissionWords.beforeAddLiquidity);
  });

  it("carries the warning for a hook that may rewrite a swap", () => {
    const t = getDictionary("en");

    expect(render([pool(1, SWAP_HOOK)])).toContain(t.v4.alterSwapWarning);
    expect(render([pool(1, LIQUIDITY_HOOK)])).not.toContain(t.v4.alterSwapWarning);
  });

  it("counts the pools it read, the hooked ones and the rest", () => {
    const markup = render([pool(1, SWAP_HOOK), pool(2, null), pool(3, null)]);

    expect(markup).toContain("busiest v4 days — 3 of them");
    expect(markup).toContain("1 name a hook; 2 name none");
  });

  it("links each pool it lists to that pool's own page", () => {
    const markup = render([pool(1, SWAP_HOOK)]);

    expect(markup).toContain(`href="/v4?id=0x${"01".repeat(32)}&amp;days=30&amp;sigma=1"`);
    expect(markup).toContain("USDC / WETH");
    /* Two pools of one pair under one hook are routine; the step tells them apart. */
    expect(markup).toContain("step 0.60%");
  });

  it("lists a few pools and counts the rest", () => {
    const markup = render(SIX_SWAP_POOLS);

    expect(markup).toContain("Runs 6 of them");
    expect(markup).toContain("and 2 more");
  });

  /* A hook whose pools are all on the page has nothing left to count. */
  it("says nothing about the rest when there is no rest", () => {
    const markup = render([pool(1, SWAP_HOOK), pool(2, SWAP_HOOK)]);

    expect(markup).toContain("Runs 2 of them");
    expect(markup).not.toContain("more");
  });

  it("says so when nothing in the week named a hook", () => {
    const markup = render([pool(1, null)]);

    expect(markup).toContain("busiest v4 days names a hook");
  });

  it("says why there is no directory when the list could not be read", () => {
    const markup = renderToStaticMarkup(
      <HookDirectory
        result={{ status: "unavailable", notice: "market-data-timed-out" }}
        parameters={PARAMETERS}
        t={getDictionary("en")}
        locale="en"
      />,
    );

    expect(markup).toContain("no directory to show");
  });

  it("says the same in Turkish", () => {
    const markup = render([pool(1, SWAP_HOOK)], "tr");

    expect(markup).toContain("Bunların 1 tanesini çalıştırıyor");
    expect(markup).toContain("Nerede çalışıyor");
    expect(markup).not.toContain("Where it runs");
  });
});
