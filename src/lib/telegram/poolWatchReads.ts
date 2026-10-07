import "server-only";

import { chainById } from "../chains/chains";
import { quotedInterval } from "../format/priceQuote";
import { readPoolEmbed } from "../embed/readPoolEmbed";
import type { PoolEmbedFigures } from "../embed/poolEmbed";
import type { PoolRangeReading } from "./poolRangeShift";
import type { PoolWatchTarget } from "./poolWatchCommand";

/*
 * How the bot reads a watched pool: through the embedded card's reader, and
 * through nothing else.
 *
 * The card (embed/readPoolEmbed.ts) runs the pool page's own pipeline for the
 * default horizon and width and keeps the answer a few minutes per pool, for
 * every reader of every page the card is pasted into. The bot asks the same
 * question — the suggested range as the pool page draws it now — so it asks
 * the same reader: a pool a card showed a minute ago costs the pass nothing,
 * and a pool the pass just read costs the next card nothing. A second
 * computation would be a second answer to disagree with the page.
 *
 * The card's figures are written the way the page shows prices, the dearer
 * token as the base; the bot keeps and compares its ranges in the pool's own
 * direction, as every range here is kept, and turns them back when it writes
 * a message. Which way the card turned them is read off its base token.
 */

/** The card's figures as the bot keeps them: every price back in the pool's own direction. */
export const readingFromFigures = (figures: PoolEmbedFigures, target: PoolWatchTarget): PoolRangeReading => {
  /* The card quotes the dearer token as the base; inverted means token1 was the dearer. */
  const inverted = figures.price.base === figures.pair.token1 && figures.price.quote === figures.pair.token0;
  const quote = { inverted };
  const own = quotedInterval(quote, { lower: figures.range.lower, upper: figures.range.upper });

  return {
    protocol: target.protocol,
    chainId: target.chainId,
    poolId: target.poolId,
    pair: { token0: figures.pair.token0, token1: figures.pair.token1 },
    lpFeePpm: figures.lpFeePpm,
    currentPrice: inverted ? 1 / figures.price.current : figures.price.current,
    range: [own.lower, own.upper],
  };
};

/** One watched pool's suggested range now, or `null` when it could not be read. */
export const readPoolRange = async (target: PoolWatchTarget): Promise<PoolRangeReading | null> => {
  const read = await readPoolEmbed({ protocol: target.protocol, chain: chainById(target.chainId), poolId: target.poolId });
  return read.status === "read" ? readingFromFigures(read.figures, target) : null;
};
