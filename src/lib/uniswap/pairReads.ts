import { chainById, type ChainId } from "../chains/chains";

/*
 * What the pair and search readers share: how long a list is kept, and how
 * a reader names itself in the log.
 */

/**
 * How long a pair's pools are kept once read: ten minutes, as the day tables.
 * A pair gains a pool rarely. The depths beside them, read from the chain,
 * are then up to ten minutes old — they order a list of alternatives, and
 * the page's own figures for the pool being read are always read afresh.
 */
export const PAIR_READ_TTL_MS = 10 * 60 * 1000;

/** How long a search's results are kept once read: ten minutes, as a pair's pools. */
export const SEARCH_READ_TTL_MS = PAIR_READ_TTL_MS;

/** A reader's diagnostic label, with the chain named off mainnet so a slow line says where. */
export const readerLabel = (label: string, chainId: ChainId): string =>
  chainId === 1 ? label : `${label}@${chainById(chainId).slug}`;
