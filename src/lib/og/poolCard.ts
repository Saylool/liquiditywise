import type { Metadata } from "next";

import type { V3Pool, V4Pool } from "../../schemas";
import { chainOf } from "../chains/chains";
import { formatFeePpm } from "../format/displayFormats";

/*
 * What a shared pool link's card says: the pair, the protocol, the fee and
 * the chain, and nothing that changes with the price — the card is cached a
 * day, and a figure on it would be a day old in someone's feed.
 *
 * Pure: no clock, no network, no environment. English, like the page a
 * crawler is served.
 */

export type PoolCardText = {
  readonly pair: string;
  readonly detail: string;
};

export const poolCardText = (pool: V3Pool | V4Pool): PoolCardText => {
  const fee =
    pool.protocolVersion === "v3"
      ? formatFeePpm(pool.feePpm, "en")
      : pool.fee.kind === "static"
        ? formatFeePpm(pool.fee.feePpm, "en")
        : pool.fee.kind === "dynamic"
          ? "dynamic fee"
          : null;

  return {
    pair: `${pool.token0.symbol} / ${pool.token1.symbol}`,
    detail: [`Uniswap ${pool.protocolVersion}`, fee, chainOf(pool.chainId).name].filter((part) => part !== null).join(" · "),
  };
};

/** Where a pool's card is drawn, for its page's metadata. The chain goes unsaid on mainnet, as in every link. */
export const poolCardPath = (protocol: "v3" | "v4", id: string, chainSlug: string): string =>
  `/og/pool?${new URLSearchParams({
    protocol,
    id,
    ...(chainSlug === "ethereum" ? {} : { chain: chainSlug }),
  }).toString()}`;

/**
 * A pool page's share metadata, with its card. The whole openGraph object,
 * because a page's replaces the layout's rather than adding to it.
 */
export const poolShareMetadata = (card: string, title: string, description: string): Pick<Metadata, "openGraph" | "twitter"> => ({
  openGraph: { type: "website", siteName: "LiquidityWise", title, description, images: [{ url: card, width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title, description, images: [card] },
});
