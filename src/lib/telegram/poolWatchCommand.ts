import type { ProtocolVersion } from "../../schemas";
import { type Chain, chainBySlug, type ChainId, ETHEREUM, readsV3, readsV4 } from "../chains/chains";

/*
 * What `/watch` and `/unwatch` were asked for: one pool on one chain.
 *
 *   /watch 0x88e6…                 a v3 pool on mainnet
 *   /watch base 0xd0b5…            a v3 pool on Base
 *   /watch 0x3258… unichain        a v4 pool on Unichain, chain last
 *
 * The same names the pages take (embed/embedRequest.ts): a 20-byte address
 * is a v3 pool and a 32-byte id a v4 pool, so nothing has to say which
 * protocol it is, and the chain goes unsaid on mainnet. The chain is its slug,
 * the word a `?chain=` carries, in either position: a reader who copies a
 * pool from one message and types the network after it is not sent back to
 * learn an order.
 *
 * Pure. Refused whole for anything else, and told why, so the help the bot
 * answers with can point at the one thing that was wrong.
 */

export type PoolWatchTarget = {
  readonly protocol: ProtocolVersion;
  readonly chainId: ChainId;
  /** Lower case, as every pool is named here. */
  readonly poolId: string;
};

export type PoolWatchParse =
  | { readonly ok: true; readonly target: PoolWatchTarget }
  /** No word that could be a pool, or more words than a pool and a chain. */
  | { readonly ok: false; readonly reason: "no-pool" }
  /** A word with the shape of a pool but not the length of either kind. */
  | { readonly ok: false; readonly reason: "bad-pool" }
  /** A second word that names no chain this site reads. */
  | { readonly ok: false; readonly reason: "unknown-chain"; readonly word: string }
  /** A chain this site reads, but not that protocol on it: v3 on Unichain, v4 on Celo. */
  | { readonly ok: false; readonly reason: "not-on-chain"; readonly protocol: ProtocolVersion; readonly chain: Chain };

const V3_POOL = /^0x[0-9a-f]{40}$/;
const V4_POOL = /^0x[0-9a-f]{64}$/;

/** The protocol a pool's name says it is, by its length; `null` for a hex word of any other length. */
const protocolOf = (word: string): ProtocolVersion | null => (V3_POOL.test(word) ? "v3" : V4_POOL.test(word) ? "v4" : null);

export const parsePoolWatch = (argument: string | null): PoolWatchParse => {
  const words = (argument ?? "")
    .trim()
    .split(/\s+/)
    .filter((word) => word !== "")
    .map((word) => word.toLowerCase());
  if (words.length === 0 || words.length > 2) return { ok: false, reason: "no-pool" };

  const poolWord = words.find((word) => word.startsWith("0x"));
  if (poolWord === undefined) return { ok: false, reason: "no-pool" };
  const protocol = protocolOf(poolWord);
  if (protocol === null) return { ok: false, reason: "bad-pool" };

  const chainWord = words.find((word) => word !== poolWord);
  const chain = chainWord === undefined ? ETHEREUM : chainBySlug(chainWord);
  if (chain === null) return { ok: false, reason: "unknown-chain", word: chainWord ?? "" };

  const read = protocol === "v3" ? readsV3(chain.id) : readsV4(chain.id);
  if (!read) return { ok: false, reason: "not-on-chain", protocol, chain };

  return { ok: true, target: { protocol, chainId: chain.id, poolId: poolWord } };
};

/** One watch's name as the chat typed it, for the list and the receipt: the slug first off mainnet. */
export const poolWatchWords = (target: PoolWatchTarget, chain: Chain): string =>
  target.chainId === ETHEREUM.id ? target.poolId : `${chain.slug} ${target.poolId}`;
