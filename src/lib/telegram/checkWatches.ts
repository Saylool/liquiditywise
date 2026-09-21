import type { AddressPositionsResult } from "../advisor/addressPositions";
import type { Dictionary } from "../i18n/dictionaries";
import type { Locale } from "../i18n/locales";
import type { BotClient } from "./botApi";
import { listWatches, recordSnapshot } from "./links";
import { alertText } from "./messages";
import { positionChanges, snapshotOf } from "./positionChanges";
import type { KeyValueStore } from "./upstashKeyValue";

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
 */

export type CheckSummary = {
  readonly watches: number;
  readonly checked: number;
  readonly unreadable: number;
  readonly alerts: number;
  readonly sent: number;
  /** True when the set of links itself could not be read; nothing was checked. */
  readonly storeUnavailable: boolean;
};

export type WatchChecking = {
  readonly store: KeyValueStore;
  readonly bot: BotClient;
  readonly readPositions: (address: string) => Promise<AddressPositionsResult>;
  readonly dictionary: (locale: Locale) => Dictionary;
};

export const checkWatches = async ({
  store,
  bot,
  readPositions,
  dictionary,
}: WatchChecking): Promise<CheckSummary> => {
  const watches = await listWatches(store);
  if (watches === null) {
    return { watches: 0, checked: 0, unreadable: 0, alerts: 0, sent: 0, storeUnavailable: true };
  }

  let checked = 0;
  let unreadable = 0;
  let alerts = 0;
  let sent = 0;

  for (const { token, link } of watches) {
    if (link.chatId === null) continue;

    const result = await readPositions(link.address);
    if (result.status === "unavailable") {
      unreadable += 1;
      continue;
    }
    checked += 1;

    const t = dictionary(link.locale);
    for (const change of positionChanges(link.snapshot, result.data.positions)) {
      alerts += 1;
      if (await bot.sendMessage(link.chatId, alertText(change, t, link.locale))) sent += 1;
    }

    await recordSnapshot(store, token, link, snapshotOf(result.data.positions));
  }

  return { watches: watches.length, checked, unreadable, alerts, sent, storeUnavailable: false };
};
