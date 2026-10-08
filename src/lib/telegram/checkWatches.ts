import type { Position } from "../../schemas";
import type { AddressPositionsResult } from "../advisor/addressPositions";
import type { PairPoolReaders } from "../advisor/readPairPools";
import type { Dictionary } from "../i18n/dictionaries";
import type { Locale } from "../i18n/locales";
import type { BotClient } from "./botApi";
import type { SmartSnapshot } from "../analytics/smartHistory";
import type { SmartPair } from "../analytics/smartLiquidity";
import { buildChatIndex, recordDigestSent, recordSnapshot, type TelegramLink, watchesForPass } from "./links";
import { alertText, poolRangeMovedText, smartShiftText, weeklyDigestText } from "./messages";
import { positionChanges, snapshotOf } from "./positionChanges";
import type { PoolWatchTarget } from "./poolWatchCommand";
import { type PoolRangeReading, shouldTell } from "./poolRangeShift";
import { type PoolWatchRecord, poolWatchersForPass, recordRangeTold } from "./poolWatches";
import { smartShifts } from "./smartShift";
import type { KeyValueStore } from "../store/keyValueStore";
import type { ChainId } from "../chains/chains";
import { digestChainOf, isDigestDue, weeklyDigestOf } from "./weeklyDigest";
import { type LeftRangeLines, recentreCost } from "./leftRange";
import { feeYieldReader } from "./leftRangeReads";

/*
 * One pass over the linked addresses, a budget of them at a time.
 *
 * Reads each address's positions the way the page does — the same verified
 * composition, nothing estimated — compares with what it saw last time, sends
 * a message per change, and records what it saw. An address that could not be
 * read this time is left as it was: a failed read is not a change, and the
 * next pass will compare against the last good one.
 *
 * Sequential rather than parallel, on purpose. Every address costs a subgraph
 * query and a sweep of contract calls, the RPC endpoint is a free tier that
 * answers about a hundred and fifty calls in a burst, and a burst of alerts
 * that never went out is worse than a pass that takes a minute.
 *
 * The Monday digest rides on the same pass rather than a schedule of its own:
 * a chat that asked for it with /weekly is sent it on the first pass it is
 * due in (see weeklyDigest.ts), before its position alerts and whether or not
 * its address could be read, since it is about the chain's measurements and
 * not the address. Each chain's kept series is read once per pass, and only
 * when somebody is due.
 *
 * An alert that a position has left its range carries two lines more where
 * they can be made (see leftRange.ts): the pool's fee yield, from the pair
 * page's own reads, and what re-centring would cost in swap fees, from the
 * position as it was just read. Those reads are made only for a leave, once
 * per pool per pass, and nothing they do can hold the alert back: a read that
 * fails or a figure that throws costs its line, and the alert goes out as it
 * always did.
 *
 * The pool watches come after the links, on the same pass. Each watched pool
 * is read through the embedded card's cached reader — the pool page's own
 * pipeline, kept a few minutes — and its suggested range now is set against
 * the one the chat was last told (poolRangeShift.ts): moved far enough, and
 * not told within a day, it is told, and what was told is kept. A pool that
 * could not be read is logged and passed over, and holds nothing else back;
 * a pass is never the slower or the shorter for one pool's source being down.
 *
 * **A pass has a hard budget, and takes its turn.** At most
 * `LINKS_PER_PASS` links and `POOLS_PER_PASS` watched pools are read in one
 * pass, however many there are: every link is a subgraph query and a sweep of
 * contract calls, and a pass that grew with the number of readers would one
 * day outgrow the five minutes between passes and the free tiers behind
 * them. Which ones are read goes round: each pass starts after the last link
 * and the last chat the one before it read, in a fixed order, so every one is
 * read within as many passes as there are budgets' worth of them, and none is
 * passed over for one that happens to sort first. Where the last pass
 * stopped is kept in this process's memory (`PassCursor`) and nowhere else —
 * a cursor in the store would be a chat's id kept after its `/stop` — and a
 * process that has just started, with no memory of one, starts at a place of
 * chance rather than at the top, so even a server restarted every few passes
 * favours no one. The ceilings on links and watchers (links.ts,
 * poolWatches.ts) keep a whole round within the day.
 */

/** Links read per pass. Each is a few seconds of reads, and a pass has five minutes. */
export const LINKS_PER_PASS = 50;

/** Watched pools read per pass. Each goes through a cached reader, so most cost nothing upstream. */
export const POOLS_PER_PASS = 100;

/** Where the last pass stopped: the last token and the last chat it read. `null` before any. */
export type PassCursor = { links: string | null; pools: string | null };

/** The server's own, for as long as the process lives. */
const processCursor: PassCursor = { links: null, pools: null };

export type CheckSummary = {
  /** Links over every chat, read this pass or not. */
  readonly watches: number;
  readonly checked: number;
  readonly unreadable: number;
  readonly alerts: number;
  readonly sent: number;
  /** Monday digests that went out this pass. */
  readonly digests: number;
  /** Watched pools read this pass, how many of them could not be read, and how many range alerts went out. */
  readonly poolWatches: number;
  readonly poolsUnreadable: number;
  readonly poolAlerts: number;
  /** True when the set of links itself could not be read; nothing was checked. */
  readonly storeUnavailable: boolean;
};

export type WatchChecking = {
  readonly store: KeyValueStore;
  readonly bot: BotClient;
  /** One address's positions on one chain; a link with no chain in it is mainnet. */
  readonly readPositions: (address: string, chainId: ChainId) => Promise<AddressPositionsResult>;
  readonly dictionary: (locale: Locale) => Dictionary;
  /**
   * Where each pool's best-earning liquidity sat at the last measurement, by
   * pool, on one chain — only what is kept, never a measurement made here.
   */
  readonly readSmartPairs: (chainId: ChainId) => ReadonlyMap<string, SmartPair>;
  /** The smart-money measurements kept for one chain, oldest first, or `null` when the store did not answer. */
  readonly readSmartSeries: (chainId: ChainId) => Promise<readonly SmartSnapshot[] | null>;
  /** The time, handed in so a test can stand on any Monday. */
  readonly now: () => Date;
  /**
   * The pair page's reads, for the fee yield a left-range alert gives. Absent,
   * that line is never made.
   */
  readonly pairReaders?: PairPoolReaders;
  /** One watched pool's suggested range now, through the pages' cached reader; `null` when it could not be read. */
  readonly readPoolRange: (target: PoolWatchTarget) => Promise<PoolRangeReading | null>;
  /** Where a pool that could not be read is noted. The default is the server's log; a test hands in its own. */
  readonly log?: (line: string) => void;
  /** Where the last pass stopped. The default is this process's own; a test hands in its own. */
  readonly cursor?: PassCursor;
  /** A number in [0, 1), for where a pass with no cursor starts. The default is chance. */
  readonly random?: () => number;
};

/** A starting place for a pass with no cursor: far enough into any set this could hold, by chance. */
const startOf = (random: () => number): number => Math.floor(random() * 1_000_000_000);

/** Whatever goes wrong in making one of the lines costs that line and nothing else. */
const quietly = async <T>(make: () => T | Promise<T>): Promise<T | null> => {
  try {
    return await make();
  } catch {
    return null;
  }
};

export const checkWatches = async ({
  store,
  bot,
  readPositions,
  dictionary,
  readSmartPairs,
  readSmartSeries,
  now,
  pairReaders,
  readPoolRange,
  log = (line) => console.error(line),
  cursor = processCursor,
  random = Math.random,
}: WatchChecking): Promise<CheckSummary> => {
  /* Once, on the first pass that can: the chat keys for every link made before them (links.ts). */
  await buildChatIndex(store);

  const pass = await watchesForPass(store, { budget: LINKS_PER_PASS, after: cursor.links, start: startOf(random) });
  if (pass === null) {
    return { watches: 0, checked: 0, unreadable: 0, alerts: 0, sent: 0, digests: 0, poolWatches: 0, poolsUnreadable: 0, poolAlerts: 0, storeUnavailable: true };
  }
  cursor.links = pass.last;
  const watches = pass.watches;

  let checked = 0;
  let unreadable = 0;
  let alerts = 0;
  let sent = 0;
  let digests = 0;

  /* One read per chain per pass, however many chats are due on it. */
  const series = new Map<ChainId, Promise<readonly SmartSnapshot[] | null>>();
  const seriesOf = (chainId: ChainId): Promise<readonly SmartSnapshot[] | null> => {
    const kept = series.get(chainId) ?? readSmartSeries(chainId);
    series.set(chainId, kept);
    return kept;
  };

  /* One reader per pass: what it reads for one alert, the next one in the same pool is spared. */
  const feeYieldOf = pairReaders === undefined ? null : feeYieldReader(pairReaders);
  const leftRangeLines = async (position: Position, chainId: ChainId): Promise<LeftRangeLines> => ({
    feeYield: feeYieldOf === null ? null : await quietly(() => feeYieldOf(position, chainId)),
    recentre: await quietly(() => recentreCost(position)),
  });

  for (const { token, link: listed } of watches) {
    const chatId = listed.chatId;
    if (chatId === null) continue;
    let link: TelegramLink = listed;

    /*
     * Sent first, and recorded only once Telegram has taken it: a failed send
     * leaves the chat due for the next pass. What was written is what the
     * rest of this pass writes from, so the snapshot below keeps the new time.
     */
    const at = now();
    if (link.weekly !== undefined && isDigestDue(link.weekly.sentAt, at)) {
      const chainId = digestChainOf(link.chainId);
      const kept = await seriesOf(chainId);
      const digest = kept === null ? null : weeklyDigestOf(kept);
      if (digest !== null && (await bot.sendMessage(chatId, weeklyDigestText(digest, dictionary(link.locale), link.locale, chainId)))) {
        digests += 1;
        link = await recordDigestSent(store, token, link, at);
      }
    }

    const result = await readPositions(link.address, link.chainId ?? 1);
    if (result.status === "unavailable") {
      unreadable += 1;
      continue;
    }
    checked += 1;

    const t = dictionary(link.locale);
    const chainId = link.chainId ?? 1;
    for (const change of positionChanges(link.snapshot, result.data.positions)) {
      alerts += 1;
      /* Only a leave carries the lines; every other alert is made as it always was. */
      const lines = change.kind === "left" ? await leftRangeLines(change.position, chainId) : undefined;
      if (await bot.sendMessage(chatId, alertText(change, t, link.locale, chainId, lines))) sent += 1;
    }

    /*
     * Only for a chat that asked. The first reading of a pool is a baseline and
     * says nothing; what is kept is replaced only when it is told again.
     */
    const smart =
      link.smart === undefined
        ? null
        : smartShifts(link.smart.ranges, result.data.positions, readSmartPairs(link.chainId ?? 1));
    for (const shift of smart?.shifts ?? []) {
      alerts += 1;
      if (await bot.sendMessage(chatId, smartShiftText(shift, t, link.locale, link.chainId ?? 1))) sent += 1;
    }

    await recordSnapshot(store, token, link, snapshotOf(result.data.positions, link.snapshot), smart?.ranges);
  }

  const pools = await checkPoolWatches({ store, bot, dictionary, now, readPoolRange, log, cursor, random });

  return { watches: pass.total, checked, unreadable, alerts, sent, digests, ...pools, storeUnavailable: false };
};

/**
 * The pool watches' half of the pass. The set that could not be read is
 * logged and counts as no pool: the links' half has already run, and a pass
 * that did its first half should say so rather than nothing.
 */
const checkPoolWatches = async ({
  store,
  bot,
  dictionary,
  now,
  readPoolRange,
  log,
  cursor,
  random,
}: Pick<WatchChecking, "store" | "bot" | "dictionary" | "now" | "readPoolRange"> & {
  readonly log: (line: string) => void;
  readonly cursor: PassCursor;
  readonly random: () => number;
}): Promise<Pick<CheckSummary, "poolWatches" | "poolsUnreadable" | "poolAlerts">> => {
  const pass = await poolWatchersForPass(store, { budget: POOLS_PER_PASS, after: cursor.pools, start: startOf(random) });
  if (pass === null) {
    log("[telegram] the set of pool watchers could not be read; no pool was checked");
    return { poolWatches: 0, poolsUnreadable: 0, poolAlerts: 0 };
  }
  cursor.pools = pass.last;
  const watchers = pass.watchers;

  let poolWatches = 0;
  let poolsUnreadable = 0;
  let poolAlerts = 0;

  for (const { chatId, record: listed } of watchers) {
    let record: PoolWatchRecord = listed;
    const t = dictionary(record.locale);

    for (const watch of listed.watches) {
      poolWatches += 1;
      /* A read that fails or throws costs this pool this pass and nothing else; the pool is public, so it may be named. */
      const reading = await quietly(() => readPoolRange({ protocol: watch.protocol, chainId: watch.chainId, poolId: watch.poolId }));
      if (reading === null) {
        poolsUnreadable += 1;
        log(`[telegram] watched pool unreadable: ${watch.protocol} ${watch.chainId} ${watch.poolId}`);
        continue;
      }

      const at = now();
      if (!shouldTell([watch.told.lower, watch.told.upper], watch.told.at, reading.range, at)) continue;

      /* Sent first, recorded once Telegram has taken it; a failed send leaves the chat due next pass. */
      if (await bot.sendMessage(chatId, poolRangeMovedText(reading, [watch.told.lower, watch.told.upper], t, record.locale))) {
        poolAlerts += 1;
        record = (await recordRangeTold(store, chatId, record, watch, reading.range, at)).record;
      }
    }
  }

  return { poolWatches, poolsUnreadable, poolAlerts };
};
