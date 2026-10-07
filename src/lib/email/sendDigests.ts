import type { SmartSnapshot } from "../analytics/smartHistory";
import type { ChainId } from "../chains/chains";
import type { Dictionary } from "../i18n/dictionaries";
import { getEmailDigestCopy } from "../i18n/emailDigestCopy";
import type { Locale } from "../i18n/locales";
import { getWeeklyCopy } from "../i18n/weeklyCopy";
import type { KeyValueStore } from "../store/keyValueStore";
import { digestChainOf, isDigestDue, weeklyDigestOf } from "../telegram/weeklyDigest";
import { digestEmail } from "./digestEmail";
import type { SendEmail } from "./provider";
import { listConfirmed, recordDigestSent } from "./subscriptions";

/*
 * One pass over every confirmed address: who is due the week's digest, and
 * sending it.
 *
 * Rides on the same scheduled pass as the Telegram digest (telegram/
 * checkWatches.ts, called from /api/telegram/check every five minutes) and
 * keeps its rules: an address is due on Monday from 08:00 UTC when the last
 * digest went out before this Monday's eight (weeklyDigest.ts, `isDigestDue`
 * — the same function, so a reader with both hears both at the same hour);
 * the first pass that finds it due sends, every later one finds it sent; a
 * send that fails records nothing, so the next pass tries again, and nothing
 * loops inside one pass — a provider that is down is retried in five minutes,
 * not in a tight loop against a timeout. A failure is counted and logged by
 * the record's id, never by the address.
 *
 * Nothing rather than an empty mail, as for the bot: a week the series says
 * nothing about sends nothing and records nothing, so a pass later that
 * Monday with a measurement more may still have something to say.
 *
 * Each chain's kept series is read once per pass, and only when somebody on
 * it is due. Sequential: one provider, one request at a time, and a Monday's
 * worth of subscribers is a few seconds.
 */

export type MailingSummary = {
  /** Confirmed addresses on the list. */
  readonly subscribers: number;
  /** Of them, due a digest at the time of the pass. */
  readonly due: number;
  readonly sent: number;
  /** Due, with a digest to send, and the provider did not take it; left due for the next pass. */
  readonly failed: number;
  /** True when the list itself could not be read; nothing was sent. */
  readonly storeUnavailable: boolean;
};

export type DigestMailing = {
  readonly store: KeyValueStore;
  readonly sendEmail: SendEmail;
  /** What the unsubscribe link in each mail is signed under. */
  readonly secret: string;
  readonly dictionary: (locale: Locale) => Dictionary;
  /** The smart-money measurements kept for one chain, oldest first, or `null` when the store did not answer. */
  readonly readSmartSeries: (chainId: ChainId) => Promise<readonly SmartSnapshot[] | null>;
  /** The time, handed in so a test can stand on any Monday. */
  readonly now: () => Date;
  /** Where a failed send is noted. The default is the server's log; a test hands in its own. */
  readonly log?: (line: string) => void;
};

export const sendDigestEmails = async ({
  store,
  sendEmail,
  secret,
  dictionary,
  readSmartSeries,
  now,
  log = (line) => console.error(line),
}: DigestMailing): Promise<MailingSummary> => {
  const confirmed = await listConfirmed(store);
  if (confirmed === null) return { subscribers: 0, due: 0, sent: 0, failed: 0, storeUnavailable: true };

  let due = 0;
  let sent = 0;
  let failed = 0;

  /* One read per chain per pass, however many addresses are due on it. */
  const series = new Map<ChainId, Promise<readonly SmartSnapshot[] | null>>();
  const seriesOf = (chainId: ChainId): Promise<readonly SmartSnapshot[] | null> => {
    const kept = series.get(chainId) ?? readSmartSeries(chainId);
    series.set(chainId, kept);
    return kept;
  };

  for (const { id, subscription } of confirmed) {
    const at = now();
    if (!isDigestDue(subscription.lastSentAt, at)) continue;
    due += 1;

    const chainId = digestChainOf(subscription.chainId);
    const kept = await seriesOf(chainId);
    const digest = kept === null ? null : weeklyDigestOf(kept);
    if (digest === null) continue;

    const { locale } = subscription;
    const message = digestEmail({
      digest,
      chainId,
      locale,
      t: dictionary(locale),
      copy: getEmailDigestCopy(locale),
      weekly: getWeeklyCopy(locale),
      subscriptionId: id,
      secret,
    });

    /* Sent first, recorded only once the provider has taken it: a failed send leaves the address due for the next pass. */
    if (await sendEmail({ to: subscription.address, ...message })) {
      sent += 1;
      await recordDigestSent(store, id, subscription, at);
    } else {
      failed += 1;
      log(`[email] the digest to subscription ${id} was not taken by the provider; due again next pass`);
    }
  }

  return { subscribers: confirmed.length, due, sent, failed, storeUnavailable: false };
};
