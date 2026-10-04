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
const V4_POOL = `0x${"a".repeat(64)}`;
const NATIVE = `0x${"0".repeat(40)}`;
const HEI = `0x${"f".repeat(40)}`;
const HOOK = "0x000000000000000000000000000000000000f0c0";

/*
 * A full-range v4 position: the outermost ticks a spacing of 7000 allows, which
 * is 882000 and nowhere near TickMath's own limit. The v3 test for "every price"
 * cannot recognise it, and the v4 one must, because a v4 position carries the
 * spacing that makes those the outermost ticks there are.
 */
const v4Position = (overrides: Record<string, unknown> = {}) => ({
  tokenId: "408162",
  pool: {
    protocolVersion: "v4",
    chainId: 1,
    id: V4_POOL,
    token0: { chainId: 1, address: NATIVE, symbol: "ETH", decimals: 18 },
    token1: { chainId: 1, address: HEI, symbol: "HEI", decimals: 18 },
    tickSpacing: 7_000,
    fee: { kind: "static", feePpm: 3_000 },
    protocolFee: null,
    hookAddress: null,
  },
  tickLower: -882_000,
  tickUpper: 882_000,
  lowerPrice: 1e-39,
  upperPrice: 1e38,
  liquidity: "28519709909040362220",
  currentTick: 98_526,
  inRange: true,
  uncollected: null,
  ...overrides,
});

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
  uncollected: null,
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
    unread: [],
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

    expect(markup).toContain("holds no Uniswap position tokens");
  });

  it("separates holding only closed ones from holding none", () => {
    const markup = render(answer({ positions: [], held: 3, read: 3, open: 0, closed: 3 }));

    expect(markup).toContain("has been closed");
    expect(markup).not.toContain("holds no Uniswap position tokens");
  });

  /*
   * The one panel here about somebody's own money. It says the list is public,
   * that a range is not a valuation, and that the records that do value a
   * position are a measurement at today's price.
   */
  it("says what the list is and what it is not", () => {
    const markup = render(answer());

    expect(markup).toContain("this list is public");
    expect(markup).toContain("is not what a position is worth");
    expect(markup).toContain("they are a measurement, not advice");
  });

  it("names the v4 pool, its fee and the protocol it is in", () => {
    const markup = render(answer({ positions: [v4Position()] }));

    expect(markup).toContain("ETH / HEI");
    expect(markup).toContain("v4 · 0.30%");
    expect(markup).toContain(`href="/v4?id=${V4_POOL}&amp;days=30&amp;sigma=1"`);
  });

  it("says when a v4 pool carries a hook", () => {
    const hooked = v4Position({
      pool: { ...v4Position().pool, hookAddress: HOOK, fee: { kind: "dynamic", currentFeePpm: null } },
    });

    expect(render(answer({ positions: [hooked] }))).toContain("Set by the hook, per swap · hook");
  });

  /*
   * The spacing is what makes these the outermost ticks, and a v4 position
   * carries it. The second case is the gain: at a spacing of 60 there are
   * plenty of usable ticks beyond 880000, so that position is wide and not
   * full-range — and the v3 test, which has to allow for the widest spacing any
   * pool could have, would have called it every price.
   */
  it("knows a v4 position is full-range from its pool's own spacing", () => {
    expect(render(answer({ positions: [v4Position()] }))).toContain(
      "Every price this pool can express",
    );
  });

  it("does not call a v4 position full-range when its spacing leaves room above", () => {
    const narrow = v4Position({
      pool: { ...v4Position().pool, tickSpacing: 60 },
      tickLower: -880_000,
      tickUpper: 880_000,
    });

    expect(render(answer({ positions: [narrow] }))).not.toContain(
      "Every price this pool can express",
    );
    /* The same ticks on a v3 pool, where the spacing is unknown, are not judged. */
    expect(
      render(answer({ positions: [position({ tickLower: -880_000, tickUpper: 880_000 })] })),
    ).toContain("Every price this pool can express");
  });

  /*
   * The list is capped and the protocols are read one after the other, so an
   * order that followed the reads would bury v4 behind a long v3 list.
   */
  it("puts what is earning now at the top, whichever protocol it is in", () => {
    const markup = render(
      answer({
        positions: [position({ inRange: false, currentTick: 10 }), v4Position()],
        open: 2,
        held: 2,
        read: 2,
      }),
    );

    expect(markup.indexOf("ETH / HEI")).toBeLessThan(markup.indexOf("XOR / WETH"));
  });

  it("says which protocol could not be read rather than passing over it", () => {
    const markup = render(answer({ unread: ["v4"] }));

    expect(markup).toContain("Uniswap v4 positions could not be read this time");
    expect(markup).toContain("about the other protocol alone");
  });

  /*
   * Three states, and the difference between the last two is the point: a
   * position that has earned nothing and one whose earnings nobody could read
   * are different facts about somebody's money.
   */
  it("says what a position has earned, in each token's own decimals", () => {
    /*
     * The real figures for token #998651 in USDC/WETH, where the two tokens
     * carry six decimals and eighteen. The same base-unit count means wholly
     * different amounts in the two, which is why the pool's decimals and not
     * the number decide what is printed.
     */
    const earning = position({
      pool: {
        ...position().pool,
        token0: { chainId: 1, address: XOR, symbol: "USDC", decimals: 6 },
        token1: { chainId: 1, address: WETH, symbol: "WETH", decimals: 18 },
      },
      uncollected: { token0: "161442767", token1: "64800531737822263" },
    });
    const markup = render(answer({ positions: [earning] }));

    expect(markup).toContain("Earned and not yet taken out");
    /* Each amount beside its own token, which is the pairing worth pinning. */
    expect(markup).toMatch(/161\.44[\d.,]* USDC and 0\.0648[\d.,]* WETH/);
  });

  /*
   * A range the price has moved through earns in one token and then the other,
   * so a position with something in only one of them is ordinary rather than
   * unusual — and calling that "nothing earned" would be wrong about money.
   */
  it("still reports an earning that is in one token only", () => {
    const markup = render(
      answer({
        positions: [position({ uncollected: { token0: "0", token1: "64800531737822263" } })],
      }),
    );

    expect(markup).toContain("Earned and not yet taken out");
    expect(markup).not.toContain("Nothing earned to take out yet");
  });

  it("separates having earned nothing from not knowing", () => {
    expect(
      render(answer({ positions: [position({ uncollected: { token0: "0", token1: "0" } })] })),
    ).toContain("Nothing earned to take out yet");
    expect(render(answer({ positions: [position()] }))).toContain(
      "What it has earned could not be read",
    );
  });

  it("says the same about earnings in Turkish", () => {
    const markup = render(
      answer({ positions: [position({ uncollected: { token0: "0", token1: "0" } })] }),
      "tr",
    );

    expect(markup).toContain("Henüz çekilecek bir kazanç yok");
    expect(markup).not.toContain("Nothing earned");
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

  it("names an unread protocol in Turkish too", () => {
    const markup = render(answer({ unread: ["v3"] }), "tr");

    expect(markup).toContain("Uniswap v3 pozisyonlar");
    expect(markup).not.toContain("could not be read");
  });
});

describe("a position off mainnet", () => {
  it("links to its pool on its own chain", () => {
    const onArbitrum = position({
      pool: { ...position().pool, chainId: 42161, token0: { ...position().pool.token0, chainId: 42161 }, token1: { ...position().pool.token1, chainId: 42161 } },
    });

    expect(render(answer({ positions: [onArbitrum] }))).toContain(`/pool?chain=arbitrum&amp;address=${POOL}`);
  });
});

describe("how each position has fared", () => {
  const withOutlook = (outlook: unknown, locale: Locale = "en") =>
    renderToStaticMarkup(
      <AddressPositions
        result={answer()}
        outlooks={new Map([["v3-1112391", outlook as never]])}
        parameters={PARAMETERS}
        t={getDictionary(locale)}
        locale={locale}
      />,
    );

  it("says the last days as counts, and the suggested range in the row's own quote", () => {
    const markup = withOutlook({ days: 30, inside: 12, outside: 10, crossed: 8, suggested: { lowerPrice: 0.5, upperPrice: 0.8 } });

    expect(markup).toContain("Last 30 days — wholly inside this range: 12 · wholly outside: 10 · across an edge: 8");
    expect(markup).toContain("The range this site suggests for the pool now:");
    expect(markup).toContain("WETH");
  });

  it("says the days alone when no range could be drawn, and nothing when there is no outlook", () => {
    const daysOnly = withOutlook({ days: 30, inside: 1, outside: 2, crossed: 3, suggested: null });

    expect(daysOnly).toContain("wholly inside this range: 1");
    expect(daysOnly).not.toContain("suggests for the pool");
    expect(render(answer())).not.toContain("wholly inside this range");
  });
});

describe("beside where the pool's best-earning liquidity sits", () => {
  /* A pair quoted WETH per XOR, so both ranges are inverted; the position is 600 ticks either side of the price. */
  const narrow = (overrides: Record<string, unknown> = {}) =>
    position({ tickLower: -200_600, tickUpper: -199_400, lowerPrice: 1e-9, upperPrice: 3e-9, currentTick: -200_000, ...overrides });
  const SMART = { lowerRatio: 0.97, upperRatio: 1.05, positions: 7 };
  const keyed = (chainId = 1, id = POOL) => new Map([[`${chainId}|${id}`, SMART]]);
  const withSmart = (result: AddressPositionsResult, smartRanges: ReadonlyMap<string, typeof SMART>, locale: Locale = "en") =>
    renderToStaticMarkup(
      <AddressPositions result={result} smartRanges={smartRanges} parameters={PARAMETERS} t={getDictionary(locale)} locale={locale} />,
    );

  it("states both as distances from the price now, in the row's own quote", () => {
    const own = 1.0001 ** 600;
    const markup = withSmart(answer({ positions: [narrow()] }), keyed());

    expect(markup).toContain("Where the best-earning liquidity in this pool sits (median of 7)");
    expect(markup).toContain(`${((1 / 1.05 - 1) * 100).toFixed(2)}% … +${((1 / 0.97 - 1) * 100).toFixed(2)}%`);
    expect(markup).toContain(`this position: ${((1 / own - 1) * 100).toFixed(2)}% … +${((own - 1) * 100).toFixed(2)}%`);
  });

  it("says nothing for a pool that was not measured, on another chain, or whose price is unread", () => {
    expect(withSmart(answer({ positions: [narrow()] }), new Map())).not.toContain("best-earning");
    expect(withSmart(answer({ positions: [narrow()] }), keyed(8453))).not.toContain("best-earning");
    expect(withSmart(answer({ positions: [narrow({ currentTick: null, inRange: null })] }), keyed())).not.toContain("best-earning");
    expect(render(answer({ positions: [narrow()] }))).not.toContain("best-earning");
  });

  it("is only for v3 positions, whose pools were the ones measured", () => {
    const markup = withSmart(answer({ positions: [v4Position()] }), keyed(1, V4_POOL));

    expect(markup).not.toContain("best-earning");
  });

  it("speaks the reader's language", () => {
    expect(withSmart(answer({ positions: [narrow()] }), keyed(), "tr")).toContain("Bu havuzda en çok kazanan likiditenin durduğu yer (7 pozisyonun medyanı)");
  });
});

/*
 * The record under each open v3 position. Round figures, so each line can be
 * checked by hand: one XOR is worth half a WETH.
 */
describe("the record under a position", () => {
  const RECORD = {
    openedAt: "2024-05-01T10:00:00.000Z",
    deposited: { token0: 100, token1: 10 },
    withdrawn: { token0: 0, token1: 1 },
    now: { token0: 80, token1: 15 },
    fees: { token0: 3, token1: 1 },
    price: 0.5,
  };
  const verified = new Map([["1112391", { status: "verified", record: RECORD } as const]]);
  const withRecords = (
    records: ReadonlyMap<string, unknown> | undefined,
    positions: unknown[] = [position()],
    locale: Locale = "en",
  ) => {
    const result = answer({ positions });
    const withThem = records === undefined ? result : ({ ...result, records } as AddressPositionsResult);
    return renderToStaticMarkup(
      <AddressPositions result={withThem} parameters={PARAMETERS} t={getDictionary(locale)} locale={locale} />,
    );
  };

  /*
   * This row quotes WETH in XOR, so the record is valued in XOR:
   * held 100 + 10 / 0.5 = 120, now 80 + 30 = 110, withdrawn 2, fees 3 + 2 = 5,
   * so 110 + 2 - 120 = -8 before fees and -3 after.
   */
  it("values every line in the token the row quotes its prices in", () => {
    const markup = withRecords(verified);

    expect(markup).toContain("Since it was opened on 2024-05-01, at today&#x27;s price in XOR");
    expect(markup).toContain("100 XOR + 10 WETH");
    expect(markup).toContain("0 XOR + 1 WETH");
    expect(markup).toContain("80 XOR + 15 WETH");
    expect(markup).toContain("3 XOR + 1 WETH");
    expect(markup).toContain("120 XOR");
    expect(markup).toContain("-3 XOR");
    expect(markup).toContain("fees +5 XOR, range effect -8 XOR");
  });

  /* The same record on a row quoted the pool's own way round is valued in WETH: held 100 x 0.5 + 10 = 60. */
  it("values it in token1 when the row quotes token0 in token1", () => {
    const markup = withRecords(verified, [position({ lowerPrice: 2, upperPrice: 8 })]);

    expect(markup).toContain("at today&#x27;s price in WETH");
    expect(markup).toContain("60 WETH");
    /* now 40 + 15 = 55, withdrawn 1, fees 1.5 + 1 = 2.5: 55 + 1 - 60 = -4, and -1.5 with fees. */
    expect(markup).toContain("-1.5 WETH");
    expect(markup).toContain("fees +2.5 WETH, range effect -4 WETH");
  });

  it("says what it leaves out, under the figures", () => {
    const markup = withRecords(verified);

    expect(markup).toContain("It leaves out the gas paid");
    expect(markup).toContain("under every owner it has had");
    expect(markup).toContain("A measurement, not advice.");
  });

  /* Label and value, stacked on a phone and side by side where there is room: no table to run off the screen. */
  it("is laid out to fit a phone's width, with no table", () => {
    const markup = withRecords(verified);

    expect(markup).not.toContain("<table");
    expect(markup).toContain('class="grid grid-cols-1');
    expect(markup).toContain("break-words");
  });

  it.each([
    ["unverified", { status: "unverified", reason: "liquidity-differs" }, "could not be checked against the chain"],
    ["unread", { status: "unread" }, "Not everything this record needs could be read"],
  ])("shows no figures for a record that is %s, and says why", (_label, record, expected) => {
    const markup = withRecords(new Map([["1112391", record]]));

    expect(markup).toContain(expected);
    expect(markup).not.toContain("Deposited");
    expect(markup).not.toContain("range effect");
  });

  it("says a v4 position has no history to work one out from", () => {
    expect(withRecords(new Map(), [v4Position()])).toContain("The v4 indexers keep no history for each position");
  });

  it("says nothing about records that were never asked for, of either protocol", () => {
    const markup = withRecords(undefined, [position(), v4Position()]);

    expect(markup).not.toContain("v4 indexers keep no history");
    expect(markup).not.toContain("Since it was opened");
    expect(markup).not.toContain("could not be checked against the chain");
    expect(markup).not.toContain("Not everything this record needs");
  });

  it("says nothing for a v3 position with no record in an answer that has them", () => {
    expect(withRecords(new Map(), [position()])).not.toContain("Since it was opened");
  });

  it("speaks the reader's language", () => {
    const markup = withRecords(verified, [position()], "tr");

    expect(markup).toContain("2024-05-01 tarihinde açıldığından beri, bugünkü fiyatla XOR cinsinden");
    expect(markup).toContain("komisyon +5 XOR, aralık etkisi -8 XOR");
  });
});
