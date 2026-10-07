import { z } from "zod";

import { CHAINS, type ChainSlug, ETHEREUM } from "../chains/chains";
import { Bytes32HexSchema, EvmAddressSchema } from "../../schemas/primitives";

/*
 * What a reader last looked at, as a list the browser keeps for them.
 *
 * Pure: this module decides what the list holds, how an entry joins it and
 * what a stored string is read as. The store next door is the only thing that
 * touches `localStorage`, and the component the only thing that draws it.
 *
 * The list lives in the reader's own browser and nowhere else. The server
 * keeps nothing about who reads the site (methodCopy's last paragraph says so
 * and the usage journal holds it to that), and a list of the pools somebody
 * opened is exactly the kind of thing that rule exists for — so it is never a
 * cookie, which would ride along on every request, and never sent anywhere.
 * `localStorage` stays in the browser, and clearing the site's data empties it.
 *
 * Two short lists rather than one: the last five pools and the last two
 * addresses. Pools are what the site is for and a reader compares a handful
 * at a time; an address is usually their own, and there are rarely two. An
 * entry is the page's address and what the page showed at the top of it — the
 * pair and the fee tier — so the link can be read without being followed. The
 * fee is kept as the number the page formatted rather than as the formatted
 * text, so a reader who changes language sees it the way that language writes
 * it. Nothing else about the page is kept: no figures, no range, no settings.
 *
 * Whatever is in storage is treated as untrusted. Another tab, an older
 * version of this code, or a reader editing it by hand can leave anything
 * there, so each entry is read through its schema and one that fails is
 * dropped on its own — a corrupt line costs that line, never the list.
 */

/** The last pools kept. Five: a handful, which is what a reader compares. */
export const MAX_RECENT_POOLS = 5;

/** The last addresses kept. Two: usually a reader's own, and rarely another. */
export const MAX_RECENT_ADDRESSES = 2;

const ChainSlugSchema = z.enum(CHAINS.map(({ slug }) => slug) as [ChainSlug, ...ChainSlug[]]);

/** The pair as the page showed it, "WETH / USDC": a label, not two symbols to be re-joined. */
const PairLabelSchema = z.string().trim().min(1).max(80);

/** Milliseconds since the epoch, when the page was opened; a figure, not a date string anything could spell. */
const WhenSchema = z.number().int().positive();

/**
 * The fee the page showed: parts per million for a declared tier, `null` for a
 * v4 pool whose hook sets it per swap (and for one whose fee could not be read,
 * which the page shows the same way: as no single figure).
 */
const FeePpmSchema = z.number().int().nonnegative().nullable();

const v3PoolEntry = z.strictObject({
  protocol: z.literal("v3"),
  chain: ChainSlugSchema,
  id: EvmAddressSchema,
  pair: PairLabelSchema,
  feePpm: FeePpmSchema,
  at: WhenSchema,
});

const v4PoolEntry = z.strictObject({
  protocol: z.literal("v4"),
  chain: ChainSlugSchema,
  id: Bytes32HexSchema,
  pair: PairLabelSchema,
  feePpm: FeePpmSchema,
  at: WhenSchema,
});

export const RecentPoolSchema = z.discriminatedUnion("protocol", [v3PoolEntry, v4PoolEntry]);

export type RecentPool = z.infer<typeof RecentPoolSchema>;

export const RecentAddressSchema = z.strictObject({
  chain: ChainSlugSchema,
  address: EvmAddressSchema,
  at: WhenSchema,
});

export type RecentAddress = z.infer<typeof RecentAddressSchema>;

export type RecentlyViewed = {
  /** Newest first, at most `MAX_RECENT_POOLS`, no pool twice. */
  readonly pools: readonly RecentPool[];
  /** Newest first, at most `MAX_RECENT_ADDRESSES`, no address twice. */
  readonly addresses: readonly RecentAddress[];
};

/** A pool as the page hands it over to be remembered: everything but when, which is the browser's clock to read. */
export type PoolVisit = Omit<RecentPool, "at">;

/** Likewise an address. */
export type AddressVisit = Omit<RecentAddress, "at">;

/** What the server renders, and what a browser that has looked at nothing holds: the same one object, so a snapshot of it is stable. */
export const EMPTY_RECENT: RecentlyViewed = Object.freeze({ pools: [], addresses: [] });

export const isEmptyRecent = (recent: RecentlyViewed): boolean =>
  recent.pools.length === 0 && recent.addresses.length === 0;

/** Newest first; a tie keeps the order it was given in, which is already newest first. */
const newestFirst = <T extends { readonly at: number }>(entries: readonly T[]): T[] =>
  [...entries].sort((left, right) => right.at - left.at);

/**
 * Every entry of `items` that reads as a `T`, each on its own. One line that
 * fails costs that line; a list that is not a list costs the list.
 */
const salvage = <T>(items: unknown, schema: z.ZodType<T>): T[] =>
  Array.isArray(items)
    ? items.flatMap((item) => {
        const read = schema.safeParse(item);
        return read.success ? [read.data] : [];
      })
    : [];

/** No pool twice: the same pool is the same protocol, chain and id, whatever case the id was written in. */
const samePool = (left: PoolVisit, right: PoolVisit): boolean =>
  left.protocol === right.protocol && left.chain === right.chain && left.id.toLowerCase() === right.id.toLowerCase();

const sameAddress = (left: AddressVisit, right: AddressVisit): boolean =>
  left.chain === right.chain && left.address.toLowerCase() === right.address.toLowerCase();

/**
 * Each list, deduplicated and capped. The newest copy of a pool wins, which is
 * what makes reopening a pool move it to the front rather than list it twice.
 */
const settle = (recent: RecentlyViewed): RecentlyViewed => {
  const pools: RecentPool[] = [];
  for (const entry of newestFirst(recent.pools)) {
    if (pools.length === MAX_RECENT_POOLS) break;
    if (!pools.some((kept) => samePool(kept, entry))) pools.push(entry);
  }

  const addresses: RecentAddress[] = [];
  for (const entry of newestFirst(recent.addresses)) {
    if (addresses.length === MAX_RECENT_ADDRESSES) break;
    if (!addresses.some((kept) => sameAddress(kept, entry))) addresses.push(entry);
  }

  return { pools, addresses };
};

/**
 * What a stored string holds. `null` (nothing stored) and anything that is not
 * JSON, not an object, or not the shape expected are the empty list; a list
 * whose lines are partly readable is the readable lines, newest first and
 * within the caps — so an older copy of this code that kept more, or a hand
 * edit that added a line, is read for what it can be.
 */
export const readRecentlyViewed = (stored: string | null): RecentlyViewed => {
  if (stored === null) return EMPTY_RECENT;

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return EMPTY_RECENT;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return EMPTY_RECENT;

  const record = parsed as Record<string, unknown>;
  const settled = settle({
    pools: salvage(record.pools, RecentPoolSchema),
    addresses: salvage(record.addresses, RecentAddressSchema),
  });

  return isEmptyRecent(settled) ? EMPTY_RECENT : settled;
};

/** The string to store, which `readRecentlyViewed` reads back as the same list. */
export const writeRecentlyViewed = (recent: RecentlyViewed): string => JSON.stringify(recent);

/** The list with one more pool at its front, the same pool's older line gone, and the oldest beyond five gone. */
export const withPool = (recent: RecentlyViewed, visit: PoolVisit, at: number): RecentlyViewed =>
  settle({ pools: [{ ...visit, at }, ...recent.pools], addresses: recent.addresses });

/** Likewise an address, within two. */
export const withAddress = (recent: RecentlyViewed, visit: AddressVisit, at: number): RecentlyViewed =>
  settle({ pools: recent.pools, addresses: [{ ...visit, at }, ...recent.addresses] });

/*
 * The page each entry leads back to: the canonical form of each route, with
 * mainnet unsaid as every link on the site leaves it, and with none of the
 * band's parameters — the reader's preferences fill those in, as they do for
 * a pool reached from a search.
 */
const chainQuery = (chain: ChainSlug): string => (chain === ETHEREUM.slug ? "" : `chain=${chain}&`);

export const recentPoolHref = (entry: PoolVisit): string =>
  entry.protocol === "v3" ? `/pool?${chainQuery(entry.chain)}address=${entry.id}` : `/v4?${chainQuery(entry.chain)}id=${entry.id}`;

export const recentAddressHref = (entry: AddressVisit): string => `/holdings?${chainQuery(entry.chain)}address=${entry.address}`;

/** An address short enough to read as a label: its first and last four hex digits. */
export const shortAddress = (address: string): string => `${address.slice(0, 6)}…${address.slice(-4)}`;
