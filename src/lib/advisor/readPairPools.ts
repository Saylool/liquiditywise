import {
  type DataResult,
  depthInEth,
  heldInEth,
  type PoolSearchMatch,
  type PoolSearchResults,
  type V4PoolSearchMatch,
  type V4PoolSearchResults,
} from "../../schemas";
import { type Chain, CHAINS, type ChainId, readsV3, readsV4 } from "../chains/chains";
import type { V4PoolDays } from "../uniswap/ethereumV4PoolDays";
import {
  composePairPoolsHalf,
  composePairRow,
  isThePair,
  type PairChainRead,
  type PairPoolRow,
  type PairPools,
  type PairTerms,
  type PoolWeeks,
  poolWeeksFrom,
} from "./pairPools";

/*
 * The pair page's reads, with every source handed in: on each chain, the v3
 * and v4 name searches the pool page runs, the week's day tables the
 * most-traded page folds, and the chain currency's dollar price.
 *
 * Every chain is read at once, and each read keeps the timeout its own reader
 * already has — nothing here waits longer than a search on that chain would.
 *
 * **Chains fail apart.** A chain whose search could not be read is listed as
 * such and costs the page that chain and nothing else; one whose day table or
 * price could not be read still lists its pools, unranked, with what was read.
 * A reader that throws rather than answering is treated as one that answered
 * "unreachable", so a fault in one chain's read cannot take the page with it.
 */

export type PairPoolReaders = {
  readonly searchV3: (terms: PairTerms, chainId: ChainId) => Promise<DataResult<PoolSearchResults>>;
  readonly searchV4: (terms: PairTerms, chainId: ChainId) => Promise<DataResult<V4PoolSearchResults>>;
  readonly daysV3: (chainId: ChainId) => Promise<DataResult<V4PoolDays>>;
  readonly daysV4: (chainId: ChainId) => Promise<DataResult<V4PoolDays>>;
  readonly nativeUsd: (chainId: ChainId) => Promise<DataResult<number>>;
  /** Told when a reader threw instead of answering; the page goes on without that read. */
  readonly onThrown?: (where: string) => void;
};

const settle = async <T>(
  where: string,
  read: () => Promise<DataResult<T>>,
  onThrown: ((where: string) => void) | undefined,
): Promise<DataResult<T>> => {
  try {
    return await read();
  } catch {
    onThrown?.(where);
    return { status: "unavailable", reason: "network-error", notice: "market-data-unreachable" };
  }
};

const dataOf = <T>(result: DataResult<T>): T | null => (result.status === "unavailable" ? null : result.data);

/** What every search match has, whichever protocol's: a pool with two symbols. */
type Match = {
  readonly pool: { readonly token0: { readonly symbol: string }; readonly token1: { readonly symbol: string } };
};

/** One protocol on one chain: its search, its day table and the chain's price, made into rows. */
const readHalf = async <Results extends { readonly matches: readonly Match[] }>({
  chain,
  protocol,
  terms,
  search,
  days,
  price,
  toRow,
}: {
  readonly chain: Chain;
  readonly protocol: "v3" | "v4";
  readonly terms: PairTerms;
  readonly search: Promise<DataResult<Results>>;
  readonly days: Promise<DataResult<V4PoolDays>>;
  readonly price: Promise<DataResult<number>>;
  readonly toRow: (match: Results["matches"][number], nativeUsd: number | null, weeks: PoolWeeks | null) => PairPoolRow;
}): Promise<PairChainRead> => {
  const [found, week, usd] = await Promise.all([search, days, price]);
  if (found.status === "unavailable") {
    return { outcome: { chain, status: "unavailable", notice: found.notice }, rows: [] };
  }

  const weekData = dataOf(week);
  const weeks = weekData === null ? null : poolWeeksFrom(protocol, weekData);
  const nativeUsd = dataOf(usd);
  const rows = found.data.matches
    .filter(({ pool }) => isThePair(terms, [pool.token0.symbol, pool.token1.symbol]))
    .map((match) => toRow(match, nativeUsd, weeks));

  return { outcome: { chain, status: "read", pools: rows.length }, rows };
};

/**
 * Every pool of the pair on every chain in `chains` (all of them unless a
 * test says otherwise), v3 and v4 apart, each ranked across its chains.
 */
export const readPairPools = async (
  terms: PairTerms,
  readers: PairPoolReaders,
  chains: readonly Chain[] = CHAINS,
): Promise<PairPools> => {
  const { onThrown } = readers;

  const perChain = chains.map((chain) => {
    /* One price per chain, asked once and awaited by both halves. */
    const price = settle(`${chain.slug} price`, () => readers.nativeUsd(chain.id), onThrown);

    const v3 = !readsV3(chain.id)
      ? null
      : readHalf({
          chain,
          protocol: "v3",
          terms,
          search: settle(`${chain.slug} v3 search`, () => readers.searchV3(terms, chain.id), onThrown),
          days: settle(`${chain.slug} v3 days`, () => readers.daysV3(chain.id), onThrown),
          price,
          /* What the token contracts hold for the pool, as the v3 search orders by. */
          toRow: (match: PoolSearchMatch, nativeUsd, weeks) =>
            composePairRow({ chain, pool: match.pool, liquidityInNative: heldInEth(match), nativeUsd, weeks }),
        });

    const v4 = !readsV4(chain.id)
      ? null
      : readHalf({
          chain,
          protocol: "v4",
          terms,
          search: settle(`${chain.slug} v4 search`, () => readers.searchV4(terms, chain.id), onThrown),
          days: settle(`${chain.slug} v4 days`, () => readers.daysV4(chain.id), onThrown),
          price,
          /* Depth at the current price, as the v4 search orders by: nothing on chain says what one v4 pool holds. */
          toRow: (match: V4PoolSearchMatch, nativeUsd, weeks) =>
            composePairRow({ chain, pool: match.pool, liquidityInNative: depthInEth(match), nativeUsd, weeks }),
        });

    return { v3, v4 };
  });

  const [v3, v4] = await Promise.all([
    Promise.all(perChain.flatMap(({ v3 }) => (v3 === null ? [] : [v3]))),
    Promise.all(perChain.flatMap(({ v4 }) => (v4 === null ? [] : [v4]))),
  ]);

  return { terms, v3: composePairPoolsHalf(v3), v4: composePairPoolsHalf(v4) };
};
