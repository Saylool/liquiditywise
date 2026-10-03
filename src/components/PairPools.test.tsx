import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PairPoolRow, PairPools as PairPoolsData } from "../lib/advisor/pairPools";
import { chainById, ETHEREUM } from "../lib/chains/chains";
import { getDictionary } from "../lib/i18n/dictionaries";
import { getMostTradedCopy } from "../lib/i18n/mostTradedCopy";
import { getPairPoolsCopy } from "../lib/i18n/pairPoolsCopy";
import { PairPools, PairPoolsForm } from "./PairPools";

const BASE = chainById(8453);
const POLYGON = chainById(137);
const token = (chainId: number, symbol: string, address: string) => ({ chainId, symbol, decimals: 18, address });
const v3Id = (index: number) => `0x${String(index).repeat(40)}`;
const V4_ID = `0x${"e5".repeat(32)}`;

const v3Row = (index: number, chain = ETHEREUM, overrides: Partial<PairPoolRow> = {}): PairPoolRow => ({
  chain,
  pool: {
    protocolVersion: "v3",
    chainId: chain.id,
    id: v3Id(index),
    token0: token(chain.id, "USDC", `0x${"a".repeat(40)}`),
    token1: token(chain.id, "WETH", `0x${"b".repeat(40)}`),
    feePpm: 500,
  },
  liquidityUsd: 2_000_000,
  week: { status: "counted", volumeUsd: 14_000_000, feesUsd: 7_000, daysCounted: 7 },
  hookAltersSwaps: false,
  feeYield: 0.1825,
  standing: "ranked",
  ...overrides,
});

const hooked: PairPoolRow = {
  chain: ETHEREUM,
  pool: {
    protocolVersion: "v4",
    chainId: 1,
    id: V4_ID,
    token0: token(1, "USDC", `0x${"a".repeat(40)}`),
    token1: token(1, "WETH", `0x${"b".repeat(40)}`),
    tickSpacing: 10,
    fee: { kind: "dynamic", currentFeePpm: null },
    protocolFee: null,
    hookAddress: `0x${"1".repeat(36)}0080`,
  },
  liquidityUsd: 9_000_000,
  week: { status: "counted", volumeUsd: 1_000_000, feesUsd: 4_321, daysCounted: 5 },
  hookAltersSwaps: true,
  feeYield: null,
  standing: "hook",
};

const data: PairPoolsData = {
  terms: ["USDC", "WETH"],
  v3: {
    ranked: [v3Row(1, BASE), v3Row(2)],
    unranked: [
      v3Row(3, ETHEREUM, { liquidityUsd: 900, feeYield: null, standing: "thin" }),
      v3Row(4, ETHEREUM, { week: { status: "quiet" }, feeYield: null, standing: "unmeasured" }),
    ],
    chains: [
      { chain: ETHEREUM, status: "read", pools: 3 },
      { chain: BASE, status: "read", pools: 1 },
      { chain: POLYGON, status: "unavailable", notice: "market-data-timed-out" },
    ],
  },
  v4: {
    ranked: [],
    unranked: [hooked],
    chains: [{ chain: ETHEREUM, status: "read", pools: 1 }],
  },
};

const render = (locale: "en" | "tr" = "en", pools: PairPoolsData = data) =>
  renderToStaticMarkup(
    <PairPools data={pools} copy={getPairPoolsCopy(locale)} week={getMostTradedCopy(locale)} t={getDictionary(locale)} locale={locale} />,
  );

describe("one pair on every network", () => {
  it("says what the yield is, and that it is no recommendation, before any pool", () => {
    const markup = render();

    expect(markup).toContain("past fees over current liquidity");
    expect(markup).toContain("$100,000");
    expect(markup.indexOf("Nothing here is a recommendation")).toBeLessThan(markup.indexOf("USDC / WETH</h4>"));
  });

  it("keeps v3 and v4 apart, the ranked pools first and in the order given", () => {
    const markup = render();

    expect(markup.indexOf("On Uniswap v3")).toBeLessThan(markup.indexOf("Ranked by fee yield"));
    expect(markup.indexOf("Ranked by fee yield")).toBeLessThan(markup.indexOf("Not ranked"));
    expect(markup.indexOf("On Uniswap v4")).toBeGreaterThan(markup.indexOf("Not ranked"));
    expect(markup.indexOf(`chain=base&amp;address=${v3Id(1)}`)).toBeLessThan(markup.indexOf(`address=${v3Id(2)}`));
    expect(markup).toContain("18.25%");
  });

  it("links every pool to its own page, on its own network", () => {
    const markup = render();

    expect(markup).toContain(`href="/pool?chain=base&amp;address=${v3Id(1)}"`);
    expect(markup).toContain(`href="/pool?address=${v3Id(2)}"`);
    expect(markup).toContain(`href="/v4?id=${V4_ID}"`);
  });

  it("says why each unranked pool is unranked, and shows a thin pool no yield", () => {
    const markup = render();

    expect(markup).toContain("Worth less than $100,000: not ranked.");
    expect(markup).toContain("Not among this network&#x27;s busiest pools this week");
    expect(markup.match(/Past fees over liquidity, a year/g)).toHaveLength(2);
  });

  it("qualifies a swap-altering hook's fees as the site does everywhere, and works out no yield", () => {
    const markup = render();
    const card = markup.slice(markup.indexOf("On Uniswap v4"));

    expect(card).toContain("hook: may change what a swap costs");
    expect(card).toContain("no yield is worked out");
    expect(card).toContain("$4,321");
    expect(card).toContain("5 of 7 days");
    expect(card).not.toContain("Past fees over liquidity, a year");
  });

  it("names a network that could not be read, and why, without dropping the others", () => {
    const markup = render();

    expect(markup).toContain("Polygon: could not be read");
    expect(markup).toContain(getDictionary("en").notices.failure["market-data-timed-out"]);
    expect(markup).toContain("Base: 1 pool<");
    expect(markup).toContain("Ethereum: 3 pools");
  });

  it("says so when a protocol has no pool of the pair", () => {
    const markup = render("en", { ...data, v4: { ranked: [], unranked: [], chains: [] } });

    expect(markup).toContain("No pool of this pair on the networks read.");
  });

  it("speaks the reader's language", () => {
    const markup = render("tr");

    expect(markup).toContain("Komisyon verimine göre sıralı");
    expect(markup).toContain("Uniswap v3&#x27;te");
    expect(markup).not.toContain("Ranked by fee yield");
  });
});

describe("the pair box", () => {
  it("is a plain GET form to the pair page, sending the search box's own parameter", () => {
    const markup = renderToStaticMarkup(<PairPoolsForm copy={getPairPoolsCopy("en")} t={getDictionary("en")} value="USDC/WETH" />);

    expect(markup).toContain('action="/pair"');
    expect(markup).toContain('method="get"');
    expect(markup).toContain('name="q"');
    expect(markup).toContain('value="USDC/WETH"');
    expect(markup).not.toContain('role="alert"');
  });

  it("says why it refused what was typed", () => {
    const t = getDictionary("en");
    const notAPair = renderToStaticMarkup(<PairPoolsForm copy={getPairPoolsCopy("en")} t={t} notAPair />);
    const refused = renderToStaticMarkup(<PairPoolsForm copy={getPairPoolsCopy("en")} t={t} rejection="unsupported-characters" />);

    expect(notAPair).toContain("Type two different token symbols");
    expect(refused).toContain(t.search.rejected.unsupportedCharacters.replace(/'/g, "&#x27;"));
  });
});
