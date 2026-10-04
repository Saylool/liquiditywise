import type { DataResult, Position } from "../../schemas";
import { poolWeeksFrom, type PoolWeeks, readPairInput } from "../advisor/pairPools";
import type { PairPoolReaders } from "../advisor/readPairPools";
import { chainOf, type ChainId } from "../chains/chains";
import { missedFeeYield, type PairSearchFound } from "./leftRange";

/*
 * The reads behind the first of a left-range alert's lines, made once per
 * check run however many alerts need them.
 *
 * They are the pair page's own reads (see advisor/readPairPools.ts), handed in
 * — the pair search on the position's chain and protocol, that protocol's day
 * table for the week, and the dollar price of the currency its subgraph prices
 * in — and each already sits behind the cache its reader keeps: a day table
 * the most-traded warmer keeps costs nothing, and neither does a pair searched
 * on the site in the last ten minutes. What this adds is a memory for one
 * pass: two positions in one pool, or two chats following one, ask once, and
 * a read that failed is not asked again for every alert in the same pass.
 *
 * Asked only when a position has left its range, which is rare, and never in
 * a way that can stop the alert: a reader that throws is a reader that did not
 * answer, and a figure that could not be made is a line left out.
 */

const settle = async <T>(
  where: string,
  read: () => Promise<DataResult<T>>,
  onThrown: ((where: string) => void) | undefined,
): Promise<T | null> => {
  try {
    const result = await read();
    return result.status === "success" ? result.data : null;
  } catch {
    onThrown?.(where);
    return null;
  }
};

/** A position's pool's fee yield, as the pair page would give it, or `null`. */
export type FeeYieldOf = (position: Position, chainId: ChainId) => Promise<number | null>;

/** One pass's reader: its memory lives as long as the function it returns. */
export const feeYieldReader = (readers: PairPoolReaders): FeeYieldOf => {
  const kept = new Map<string, Promise<unknown>>();
  const once = <T>(key: string, read: () => Promise<T>): Promise<T> => {
    const known = kept.get(key) as Promise<T> | undefined;
    if (known !== undefined) return known;
    const reading = read();
    kept.set(key, reading);
    return reading;
  };
  const { onThrown } = readers;

  return async (position, chainId) => {
    const { pool } = position;
    /* The search box's own reading of the pair, as the pair page takes it; a pair it would refuse has no row there. */
    const input = readPairInput(`${pool.token0.symbol}/${pool.token1.symbol}`);
    if (input.kind !== "pair") return null;
    const { terms } = input;
    const chain = chainOf(chainId);
    const protocol = pool.protocolVersion;
    const where = `${chain.slug} ${protocol}`;

    const [found, weeks, nativeUsd] = await Promise.all([
      once(`search ${where} ${terms.join("/")}`, async (): Promise<PairSearchFound | null> => {
        if (protocol === "v3") {
          const read = await settle(`${where} search`, () => readers.searchV3(terms, chainId), onThrown);
          return read === null ? null : { protocol, matches: read.matches };
        }
        const read = await settle(`${where} search`, () => readers.searchV4(terms, chainId), onThrown);
        return read === null ? null : { protocol, matches: read.matches };
      }),
      /* Folded once per pass, as the pair page folds it: a week per pool, and how long the window had run. */
      once(`days ${where}`, async (): Promise<PoolWeeks | null> => {
        const days = await settle(
          `${where} days`,
          () => (protocol === "v3" ? readers.daysV3(chainId) : readers.daysV4(chainId)),
          onThrown,
        );
        return days === null ? null : poolWeeksFrom(protocol, days);
      }),
      once(`price ${where}`, (): Promise<number | null> =>
        settle(`${where} price`, () => readers.nativeUsd(chainId, protocol), onThrown),
      ),
    ]);

    return missedFeeYield({ position, chain, found, nativeUsd, weeks });
  };
};
