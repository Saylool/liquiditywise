import type { AddressPositionsResult } from "../advisor/addressPositions";
import type { Dictionary } from "../i18n/dictionaries";
import type { Locale } from "../i18n/locales";
import type { BotClient } from "./botApi";
import type { SmartSnapshot } from "../analytics/smartHistory";
import type { SmartPair } from "../analytics/smartLiquidity";
import { listWatches, recordDigestSent, recordSnapshot, type TelegramLink } from "./links";
import { alertText, smartShiftText, weeklyDigestText } from "./messages";
import { positionChanges, snapshotOf } from "./positionChanges";
import { smartShifts } from "./smartShift";
import type { KeyValueStore } from "../store/keyValueStore";
import type { ChainId } from "../chains/chains";
import { digestChainOf, isDigestDue, weeklyDigestOf } from "./weeklyDigest";

/*
 * One pass over every linked address.
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
 */

export type CheckSummary = {
  readonly watches: number;
  readonly checked: number;
  readonly unreadable: number;
  readonly alerts: number;
  readonly sent: number;
  /** Monday digests that went out this pass. */
  readonly digests: number;
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
};

export const checkWatches = async ({
  store,
  bot,
  readPositions,
  dictionary,
  readSmartPairs,
  readSmartSeries,
  now,
}: WatchChecking): Promise<CheckSummary> => {
  const watches = await listWatches(store);
  if (watches === null) {
    return { watches: 0, checked: 0, unreadable: 0, alerts: 0, sent: 0, digests: 0, storeUnavailable: true };
  }

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
    for (const change of positionChanges(link.snapshot, result.data.positions)) {
      alerts += 1;
      if (await bot.sendMessage(chatId, alertText(change, t, link.locale, link.chainId ?? 1))) sent += 1;
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

  return { watches: watches.length, checked, unreadable, alerts, sent, digests, storeUnavailable: false };
};
