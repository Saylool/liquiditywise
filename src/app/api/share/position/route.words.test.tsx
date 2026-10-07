import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { visualOrder } from "@/lib/share/visualOrder";

vi.mock("server-only", () => ({}));

/*
 * What the card says, which a PNG cannot be asked. The renderer is replaced
 * by one that writes the element it is given as markup, so the words the
 * route hands it — in the language the address names, with the figures or
 * without them — can be read back; route.test.ts keeps the real renderer
 * for the bytes, the statuses and the caching.
 */
const drawn = vi.hoisted(() => ({ fonts: [] as string[] }));
vi.mock("next/og", () => ({
  ImageResponse: class {
    constructor(element: React.ReactElement, options: { fonts?: { name: string }[]; headers?: Record<string, string> }) {
      drawn.fonts = (options.fonts ?? []).map(({ name }) => name);
      return new Response(renderToStaticMarkup(element), { status: 200, headers: { "content-type": "text/html", ...options.headers } });
    }
  },
}));

const chain = vi.hoisted(() => ({ answer: "verified" as "verified" | "unverified" }));
const XOR = `0x${"4".repeat(40)}`;
const WETH = `0x${"c".repeat(40)}`;

vi.mock("@/lib/advisor/getPositionRecord", () => ({
  getPositionRecord: async (tokenId: string, chainId: number) => ({
    status: "found",
    described: {
      position: {
        tokenId,
        pool: {
          protocolVersion: "v3",
          chainId,
          id: `0x${"7".repeat(40)}`,
          feePpm: 10_000,
          token0: { chainId, address: XOR, symbol: "XOR", decimals: 18 },
          token1: { chainId, address: WETH, symbol: "WETH", decimals: 18 },
        },
        tickLower: -414_400,
        tickUpper: 0,
        lowerPrice: 1e-18,
        upperPrice: 1,
        liquidity: "38349616863029655014582929927279522",
        currentTick: -200_000,
        inRange: true,
        uncollected: null,
      },
      record:
        chain.answer === "unverified"
          ? { status: "unverified", reason: "liquidity-differs" }
          : {
              status: "verified",
              record: {
                openedAt: "2024-05-01T10:00:00.000Z",
                deposited: { token0: 100, token1: 10 },
                withdrawn: { token0: 0, token1: 1 },
                now: { token0: 80, token1: 15 },
                fees: { token0: 3, token1: 1 },
                price: 0.5,
              },
            },
    },
  }),
}));

import { GET } from "./route";
import { forgetPositionCards } from "@/lib/share/readPositionCard";

const words = async (path: string) => (await GET(new NextRequest(`http://localhost${path}`))).text();

beforeEach(() => {
  chain.answer = "verified";
  drawn.fonts = [];
  forgetPositionCards();
});

describe("what the share card says", () => {
  it("carries the pair, the range, the fees, the result with its parts, the day opened and the one line every card carries", async () => {
    const markup = await words("/api/share/position?id=1112391");

    expect(markup).toContain("XOR / WETH");
    expect(markup).toContain("v3 · 1.00% · Ethereum mainnet");
    expect(markup).toContain("XOR per WETH");
    expect(markup).toContain("3 XOR + 1 WETH");
    expect(markup).toContain("-3 XOR");
    expect(markup).toContain("fees +5 XOR, range effect -8 XOR");
    expect(markup).toContain("since 2024-05-01");
    expect(markup).toContain("measured on liquiditywise.com · not advice");
  });

  it("speaks the language its address names, and English when it names none", async () => {
    const turkish = await words("/api/share/position?chain=base&id=1112391&lang=tr");

    expect(turkish).toContain("Bütün ömrü boyunca kazanılan komisyon");
    expect(turkish).toContain("2024-05-01 tarihinden beri");
    expect(turkish).toContain("v3 · %1,00 · Base");
    expect(turkish).toContain("komisyon +5 XOR, aralık etkisi -8 XOR");
    expect(turkish).not.toContain("since 2024");
    expect(await words("/api/share/position?id=1112391&lang=xx")).toContain("since 2024-05-01");
  });

  /* Never a partial figure: the plain card names the pair and says why, and nothing else. */
  it("shows no figure for a record that could not be verified, and says so", async () => {
    chain.answer = "unverified";
    const markup = await words("/api/share/position?id=1112391&lang=de");

    expect(markup).toContain("XOR / WETH");
    expect(markup).toContain("Der Verlauf dieser Position ließ sich nicht gegen die Chain prüfen");
    expect(markup).toContain("gemessen auf liquiditywise.com");
    expect(markup).not.toContain("XOR +");
    expect(markup).not.toContain("-3 XOR");
    expect(markup).not.toContain("2024-05-01");
  });

  /*
   * The renderer lays every line out left to right and knows no bidi, so an
   * Arabic card's words are handed to it already in drawing order (see
   * lib/share/visualOrder.ts): the footer's last word first.
   */
  it("hands an Arabic card its words in drawing order, not reading order", async () => {
    const markup = await words("/api/share/position?id=1112391&lang=ar");
    const footer = "قياس من liquiditywise.com · ليس نصيحة";

    expect(markup).toContain(visualOrder(footer));
    expect(markup).not.toContain(footer);
    expect(visualOrder(footer)).not.toBe(footer);
  });

  it("is drawn in the site's own three faces, and an Arabic face the renderer can parse for the glyphs they lack", async () => {
    await words("/api/share/position?id=1112391");

    expect(drawn.fonts).toEqual(["Geist", "Geist Mono", "Instrument Serif", "IBM Plex Sans Arabic"]);
  });
});
