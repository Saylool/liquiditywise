import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AddressPositionsResult } from "../lib/advisor/addressPositions";
import { getDictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import { AddressPositions } from "./AddressPositions";

const PARAMETERS = { horizonDays: 30, standardDeviationMultiplier: 1 };
const OWNER = `0x${"b".repeat(40)}`;
const POOL = `0x${"7".repeat(40)}`;
const XOR = `0x${"4".repeat(40)}`;
const WETH = `0x${"c".repeat(40)}`;

const position = (overrides: Record<string, unknown> = {}) => ({
  tokenId: "1112391",
  pool: {
    protocolVersion: "v3",
    chainId: 1,
    id: POOL,
    feePpm: 10_000,
    token0: { chainId: 1, address: XOR, symbol: "XOR", decimals: 18 },
    token1: { chainId: 1, address: WETH, symbol: "WETH", decimals: 18 },
  },
  tickLower: -414_400,
  tickUpper: 0,
  lowerPrice: 1e-18,
  upperPrice: 1,
  liquidity: "38349616863029655014582929927279522",
  currentTick: -200_000,
  inRange: true,
  ...overrides,
});

const answer = (overrides: Record<string, unknown> = {}): AddressPositionsResult => ({
  status: "success",
  data: {
    address: OWNER,
    positions: [position()],
    held: 1,
    read: 1,
    open: 1,
    closed: 0,
    fetchedAt: "2026-09-18T07:00:00.000Z",
    sources: ["uniswap-v3-subgraph", "ethereum-rpc"],
    ...overrides,
  },
} as AddressPositionsResult);

const render = (result: AddressPositionsResult, locale: Locale = "en") =>
  renderToStaticMarkup(
    <AddressPositions
      result={result}
      parameters={PARAMETERS}
      t={getDictionary(locale)}
      locale={locale}
    />,
  );

describe("AddressPositions", () => {
  it("names the pair, the tier and the range", () => {
    const markup = render(answer());

    expect(markup).toContain("Positions this address already holds");
    expect(markup).toContain("XOR / WETH");
    expect(markup).toContain("1.00%");
  });

  /* The one thing a holder reads first, and its third state. */
  it.each([
    ["earning", { inRange: true }, "Earning now"],
    ["outside", { inRange: false }, "Outside its range"],
    ["unknown", { inRange: null, currentTick: null }, "Nobody has swapped here"],
  ])("says a position is %s", (_label, overrides, expected) => {
    expect(render(answer({ positions: [position(overrides)] }))).toContain(expected);
  });

  /*
   * A deliberate and common choice, and one the page was printing as
   * `2.96E-39 – 3.38E38` — true, and no use to anybody.
   */
  it("names a position covering everything rather than pricing its edges", () => {
    const markup = render(
      answer({
        positions: [
          position({ tickLower: -887_200, tickUpper: 887_200, lowerPrice: 1e-39, upperPrice: 1e38 }),
        ],
      }),
    );

    expect(markup).toContain("Every price this pool can express");
    expect(markup).not.toContain("E-39");
  });

  it("still prices the edges of a range that is merely wide", () => {
    const markup = render(
      answer({ positions: [position({ tickLower: -500_000, tickUpper: 500_000 })] }),
    );

    expect(markup).not.toContain("Every price this pool can express");
  });

  it("links each position to that pool's own analysis, carrying the band", () => {
    expect(render(answer())).toContain(`href="/pool?address=${POOL}&amp;days=30&amp;sigma=1"`);
  });

  it("counts what was held, what is open and what was closed", () => {
    const markup = render(answer({ held: 20, read: 20, open: 15, closed: 5 }));

    expect(markup).toContain("20 position tokens");
    expect(markup).toContain("15 still have liquidity");
    expect(markup).toContain("5 have been closed");
  });

  it("says when more are open than it lists", () => {
    expect(render(answer({ held: 20, read: 20, open: 15, closed: 5 }))).toContain(
      "14 more are open and not listed",
    );
  });

  it("says when it stopped reading before the end", () => {
    expect(render(answer({ held: 400, read: 250, open: 1, closed: 0 }))).toContain(
      "250 of 400 were read",
    );
  });

  it("says nothing about a cap it did not reach", () => {
    expect(render(answer())).not.toContain("were read");
  });

  it("tells an address holding none that it holds none", () => {
    const markup = render(answer({ positions: [], held: 0, read: 0, open: 0, closed: 0 }));

    expect(markup).toContain("holds no Uniswap v3 position tokens");
  });

  it("separates holding only closed ones from holding none", () => {
    const markup = render(answer({ positions: [], held: 3, read: 3, open: 0, closed: 3 }));

    expect(markup).toContain("has been closed");
    expect(markup).not.toContain("holds no Uniswap v3 position tokens");
  });

  /*
   * The one panel here about somebody's own money. It says the list is public
   * and that nothing on it is a valuation.
   */
  it("says what the list is and what it is not", () => {
    const markup = render(answer());

    expect(markup).toContain("this list is public");
    expect(markup).toContain("is not what a position is worth");
  });

  it("says why there is nothing when the read failed", () => {
    const markup = render({ status: "unavailable", notice: "positions-manager-unverified" });

    expect(markup).toContain("could not be read");
    expect(markup).toContain("did not answer with the code this application was built against");
  });

  it("says the same in Turkish", () => {
    const markup = render(answer(), "tr");

    expect(markup).toContain("Bu adresin hâlihazırda tuttuğu pozisyonlar");
    expect(markup).toContain("Şu anda kazanıyor");
    expect(markup).not.toContain("Earning now");
  });
});
