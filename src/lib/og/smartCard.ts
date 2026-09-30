import type { SmartLiquidityRead } from "../advisor/readSmartLiquidity";
import { formatFeePpm, formatPercent, formatWhole } from "../format/displayFormats";
import { choosePriceQuote } from "../format/priceQuote";
import { rangeAroundInverted, signedPercent } from "../format/rangeAround";

/*
 * What a shared smart-money link's card says: the pair with the most
 * best-earning liquidity, the range that liquidity sits in, and how many of
 * the measured positions it is the top fifth of.
 *
 * Unlike a pool's card it carries figures that move — they are measured every
 * six hours — so the route keeps it six hours and no longer. Pure: English,
 * like the page a crawler is served.
 */

export type SmartCardText = {
  readonly pair: string;
  readonly range: string;
  readonly summary: string;
};

/** `null` unless a measurement is in hand and found somewhere the smart liquidity sits. */
export const smartCardText = (read: SmartLiquidityRead | null): SmartCardText | null => {
  if (read === null || read.status !== "measured") return null;
  const top = read.data.pairs[0];
  if (top === undefined || read.data.smartFrom === null) return null;

  const { below, above } = rangeAroundInverted(
    choosePriceQuote({ token0: top.pool.token0, token1: top.pool.token1 }, top.currentPrice).inverted,
    top.medianLowerRatio,
    top.medianUpperRatio,
  );

  return {
    pair: `${top.pool.token0.symbol} / ${top.pool.token1.symbol} · ${formatFeePpm(top.pool.feePpm, "en")}`,
    range: `${signedPercent(below, "en")} to ${signedPercent(above, "en")} around the price`,
    summary: `${formatWhole(read.data.smart.length, "en")} of ${formatWhole(read.data.measured, "en")} positions earn at least ${formatPercent(read.data.smartFrom, "en")} a year in fees`,
  };
};

/** Where the card is drawn, for the page's metadata. The chain goes unsaid on mainnet, as in every link. */
export const smartCardPath = (chainSlug: string): string =>
  chainSlug === "ethereum" ? "/og/smart" : `/og/smart?${new URLSearchParams({ chain: chainSlug }).toString()}`;
