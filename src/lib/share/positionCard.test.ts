import { describe, expect, it } from "vitest";

import type { Position } from "../../schemas";
import type { PositionRecordResult } from "../advisor/positionRecord";
import { LOCALES } from "../i18n/locales";
import { positionCardText, positionPostText, recordFigures } from "./positionCard";

/*
 * The card's words, from the same round figures the holdings page's record is
 * tested with (components/AddressPositions.test.tsx): one XOR is worth half a
 * WETH, so every line can be checked by hand — and against what that page
 * shows, which is the point.
 */

const XOR = `0x${"4".repeat(40)}`;
const WETH = `0x${"c".repeat(40)}`;
const POOL = `0x${"7".repeat(40)}`;

const position = (overrides: Record<string, unknown> = {}): Position =>
  ({
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
  }) as Position;

const RECORD = {
  openedAt: "2024-05-01T10:00:00.000Z",
  deposited: { token0: 100, token1: 10 },
  withdrawn: { token0: 0, token1: 1 },
  now: { token0: 80, token1: 15 },
  fees: { token0: 3, token1: 1 },
  price: 0.5,
};
const verified: PositionRecordResult = { status: "verified", record: RECORD };

describe("the figures on a shared card", () => {
  /*
   * The row quotes WETH in XOR, so the record is valued in XOR:
   * held 100 + 10 / 0.5 = 120, now 80 + 30 = 110, withdrawn 2, fees 3 + 2 = 5,
   * so 110 + 2 - 120 = -8 before fees and -3 after — the page's own lines.
   */
  it("are the holdings page's own, in the token that page quotes the pool in", () => {
    const figures = recordFigures(position(), RECORD, "en");

    expect(figures).toEqual({
      pair: "XOR / WETH",
      detail: "v3 · 1.00% · Ethereum mainnet",
      range: expect.stringContaining("XOR per WETH"),
      fees: "3 XOR + 1 WETH",
      feesValued: "+5 XOR",
      result: "-3 XOR",
      parts: "fees +5 XOR, range effect -8 XOR",
      openedOn: "2024-05-01",
    });
  });

  /* The same record on a row quoted the pool's own way round is valued in WETH: held 100 x 0.5 + 10 = 60. */
  it("follow the quote the row would choose, the other way round when the base is dearer", () => {
    const figures = recordFigures(position({ lowerPrice: 2, upperPrice: 8 }), RECORD, "en");

    expect(figures.result).toBe("-1.5 WETH");
    expect(figures.parts).toBe("fees +2.5 WETH, range effect -4 WETH");
    expect(figures.range).toContain("WETH per XOR");
  });

  it("name a position covering everything rather than pricing its edges, and the network it is on", () => {
    const everything = position({ tickLower: -887_200, tickUpper: 887_200, lowerPrice: 1e-39, upperPrice: 1e38 });
    const onBase = position({ pool: { ...position().pool, chainId: 8453 } });

    expect(recordFigures(everything, RECORD, "en").range).toBe("Every price this pool can express");
    expect(recordFigures(onBase, RECORD, "en").detail).toBe("v3 · 1.00% · Base");
  });

  it("are written in the reader's language", () => {
    const figures = recordFigures(position(), RECORD, "tr");

    expect(figures.detail).toBe("v3 · %1,00 · Ethereum ana ağı");
    expect(figures.parts).toBe("komisyon +5 XOR, aralık etkisi -8 XOR");
  });
});

describe("what the card says", () => {
  it("carries the figures, the day it was opened, its labels and the one line every card carries", () => {
    const text = positionCardText({ position: position(), record: verified }, "en");

    expect(text.kind).toBe("record");
    if (text.kind !== "record") return;
    expect(text.title).toBe("An open Uniswap v3 position, at today's price");
    expect(text.figures.result).toBe("-3 XOR");
    expect(text.since).toBe("since 2024-05-01");
    expect(text.labels).toEqual({ range: "Range", fees: "Fees earned over its whole life", against: "Against simply holding the deposits" });
    expect(text.footer).toBe("measured on liquiditywise.com · not advice");
  });

  /* Never a partial figure: a record the chain did not confirm gives a card with none. */
  it.each<[string, PositionRecordResult]>([
    ["unverified", { status: "unverified", reason: "fee-growth-differs" }],
    ["unread", { status: "unread" }],
  ])("shows no figure for a record that is %s, and says so", (_label, record) => {
    const text = positionCardText({ position: position(), record }, "en");

    expect(text).toEqual({
      kind: "unverified",
      title: "An open Uniswap v3 position, at today's price",
      pair: "XOR / WETH",
      detail: "v3 · 1.00% · Ethereum mainnet",
      message: "This position's record could not be verified against the chain, so this card shows no figure.",
      footer: "measured on liquiditywise.com · not advice",
    });
    expect(JSON.stringify(text)).not.toContain("XOR +");
    expect(JSON.stringify(text)).not.toContain("-3");
  });

  it("speaks every language, with the same figures in each", () => {
    for (const locale of LOCALES) {
      const text = positionCardText({ position: position(), record: verified }, locale);
      expect(text.kind, locale).toBe("record");
      if (text.kind !== "record") return;
      /* Arabic marks a Latin figure's direction; the figure itself is the same. */
      expect(text.figures.result.replace(/\u200e/g, ""), locale).toBe("-3 XOR");
      expect(text.since, locale).toContain("2024-05-01");
    }
  });
});

describe("the post the row prewrites", () => {
  it("carries the pair, the result, the fees and the day opened, and says it is measured and not advice", () => {
    expect(positionPostText(position(), RECORD, "en")).toBe(
      "XOR / WETH on Uniswap v3, since 2024-05-01: -3 XOR against simply holding, of which fees +5 XOR. Measured on LiquidityWise, not advice.",
    );
  });

  it("is written in the reader's language", () => {
    expect(positionPostText(position(), RECORD, "tr")).toBe(
      "Uniswap v3'te XOR / WETH, 2024-05-01 tarihinden beri: sadece tutmaya kıyasla -3 XOR, bunun komisyon kısmı +5 XOR. LiquidityWise'ta ölçüldü, yatırım tavsiyesi değildir.",
    );
  });
});
