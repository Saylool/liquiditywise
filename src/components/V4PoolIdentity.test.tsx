import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getDictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import { type DataResult, HOOK_PERMISSION_FLAGS, type V4Pool, type V4ProtocolFee } from "../schemas";
import { V4PoolIdentity } from "./V4PoolIdentity";

const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const SWAP_HOOK = `0x${"1".repeat(36)}${HOOK_PERMISSION_FLAGS.BEFORE_SWAP.toString(16).padStart(4, "0")}`;

const pool = (
  fee: V4Pool["fee"],
  protocolFee: V4ProtocolFee | null,
  hookAddress: string | null = null,
): DataResult<V4Pool> => ({
  status: "success",
  data: {
    protocolVersion: "v4",
    chainId: 1,
    id: `0x${"e5".repeat(32)}`,
    token0: { chainId: 1, address: USDC, symbol: "USDC", decimals: 6 },
    token1: { chainId: 1, address: WETH, symbol: "WETH", decimals: 18 },
    tickSpacing: 10,
    fee,
    protocolFee,
    hookAddress,
  },
});

const render = (result: DataResult<V4Pool>, locale: Locale = "en") =>
  renderToStaticMarkup(<V4PoolIdentity result={result} t={getDictionary(locale)} locale={locale} />);

/*
 * The fee, as the chain says it: the key's, and the protocol's cut on top —
 * the ETH/USDC pool at 500 ppm and 125 ppm, whose indexer figure read 625.
 */
describe("V4PoolIdentity and the fee", () => {
  it("shows the key's fee and what a swap pays with the protocol's cut on top", () => {
    const markup = render(pool({ kind: "static", feePpm: 500 }, { zeroForOnePpm: 125, oneForZeroPpm: 125 }));

    expect(markup).toContain(">0.05%<");
    expect(markup).toContain("A swap pays 0.0625%: this 0.05% to liquidity providers, and 0.0125% to the protocol on top.");
    expect(markup).toContain("Protocol fee");
    expect(markup).toContain(">0.0125%<");
  });

  it("says the protocol takes nothing when it takes nothing", () => {
    const markup = render(pool({ kind: "static", feePpm: 500 }, { zeroForOnePpm: 0, oneForZeroPpm: 0 }));

    expect(markup).toContain("The protocol takes nothing on top, so this is what a swap pays.");
    expect(markup).toContain(">None<");
  });

  it("shows both cuts when they differ by direction, and says which is which", () => {
    const markup = render(pool({ kind: "static", feePpm: 500 }, { zeroForOnePpm: 100, oneForZeroPpm: 125 }));

    expect(markup).toContain("0.01% / 0.0125%");
    expect(markup).toContain("the first when USDC is sold, the second when WETH is.");
    expect(markup).toContain("A swap pays 0.06% / 0.0625%");
  });

  /* A cut in one direction is a cut, not none: the figure shows both halves. */
  it("shows a cut taken in one direction only as a cut", () => {
    const markup = render(pool({ kind: "static", feePpm: 500 }, { zeroForOnePpm: 0, oneForZeroPpm: 125 }));

    expect(markup).toContain("0.00% / 0.0125%");
    expect(markup).not.toContain(">None<");
    expect(markup).toContain("A swap pays 0.05% / 0.0625%");
  });

  it("shows a dynamic fee as the hook's to set, with no number", () => {
    const markup = render(pool({ kind: "dynamic", currentFeePpm: null }, { zeroForOnePpm: 0, oneForZeroPpm: 0 }, SWAP_HOOK));

    expect(markup).toContain("Set by the hook, per swap");
    expect(markup).toContain("there is no fee here to report");
  });

  /* Never the indexer's figure: a fee the chain did not answer for is said to be unread. */
  it("says the fee was not read rather than showing anything else", () => {
    const markup = render(pool({ kind: "unread" }, null));

    expect(markup).toContain("fee not read");
    expect(markup).toContain("Nothing else is a substitute for it.");
    expect(markup).not.toContain("Protocol fee");
  });

  it("translates the fee and its note", () => {
    const markup = render(pool({ kind: "static", feePpm: 500 }, { zeroForOnePpm: 125, oneForZeroPpm: 125 }), "tr");

    expect(markup).toContain("Bir takas %0,0625 öder");
    expect(markup).toContain("Protokol komisyonu");
    expect(markup).not.toContain("A swap pays");
  });
});
