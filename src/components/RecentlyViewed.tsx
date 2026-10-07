"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { CHAINS, ETHEREUM } from "../lib/chains/chains";
import { formatFeePpm } from "../lib/format/displayFormats";
import type { Locale } from "../lib/i18n/locales";
import { getRecentCopy } from "../lib/i18n/recentCopy";
import {
  isEmptyRecent,
  MAX_RECENT_ADDRESSES,
  MAX_RECENT_POOLS,
  type RecentlyViewed as Recent,
  recentAddressHref,
  recentPoolHref,
  shortAddress,
} from "../lib/recent/recentlyViewed";
import { forgetRecent, readRecent, readServerRecent, subscribeToRecent } from "../lib/recent/recentlyViewedStore";

/*
 * The pools and addresses a reader last looked at, as links back to them.
 *
 * A Client Component, because the list is in the browser and nowhere else.
 * The server renders nothing — `readServerRecent` is the empty list — so the
 * HTML it sends is the same for every reader and stays cacheable, and React
 * draws the real list right after hydration. There is no flash of the wrong
 * thing to hide: the block is simply absent until then, and absent for good
 * when there is nothing in it.
 *
 * Two placements of the same list. On the front page it has a heading of its
 * own and the sentence saying where the list is; beside the pool box it has
 * the one word "Recently", because the box is the thing on that page and the
 * list is a shortcut past it.
 *
 * The words that are the dictionary's — mainnet's name in the interface's own
 * words, and how a hook-set fee is described — arrive as strings from the
 * page, so the browser is not sent the dictionary to read two of its lines.
 */

/** The dictionary's words this block needs, as strings a Server Component can hand over. */
export type RecentWords = {
  /** How the interface names mainnet ("Ethereum mainnet"); the other networks go by their names. */
  readonly mainnet: string;
  /** How a fee a hook sets per swap is described, where a v3 page would show a percentage. */
  readonly dynamicFee: string;
};

export function RecentlyViewed({
  locale,
  placement,
  words,
}: {
  locale: Locale;
  placement: "home" | "lookup";
  words: RecentWords;
}) {
  const recent = useSyncExternalStore(subscribeToRecent, readRecent, readServerRecent);
  if (isEmptyRecent(recent)) return null;

  return <RecentlyViewedList recent={recent} locale={locale} placement={placement} words={words} onForget={forgetRecent} />;
}

/** A network's name as the rest of the site writes it: mainnet in the interface's words, the others by name. */
const networkName = (slug: string, mainnet: string): string =>
  slug === ETHEREUM.slug ? mainnet : (CHAINS.find((chain) => chain.slug === slug)?.name ?? slug);

/**
 * The list itself, given what to draw. Separate from the store so it can be
 * rendered with a list in hand, and so the control's wiring can be checked
 * without a browser.
 */
export function RecentlyViewedList({
  recent,
  locale,
  placement,
  words,
  onForget,
}: {
  recent: Recent;
  locale: Locale;
  placement: "home" | "lookup";
  words: RecentWords;
  onForget: () => void;
}) {
  const copy = getRecentCopy(locale);
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  /* Pools first, then addresses — each list newest first, as the store keeps them. */
  const entries = [
    ...recent.pools.map((pool) => ({
      key: `${pool.protocol}:${pool.chain}:${pool.id}`,
      href: recentPoolHref(pool),
      label: pool.pair,
      detail: pool.feePpm === null ? words.dynamicFee : formatFeePpm(pool.feePpm, locale),
      network: networkName(pool.chain, words.mainnet),
      at: pool.at,
    })),
    ...recent.addresses.map((entry) => ({
      key: `address:${entry.chain}:${entry.address}`,
      href: recentAddressHref(entry),
      label: shortAddress(entry.address),
      detail: null,
      network: networkName(entry.chain, words.mainnet),
      at: entry.at,
    })),
  ];

  return (
    <section className={`recent-block recent-${placement}`} aria-labelledby={`recent-heading-${placement}`}>
      <div className="recent-head">
        <h3 id={`recent-heading-${placement}`} className="eyebrow">
          {placement === "home" ? copy.heading : copy.recently}
        </h3>
        <button type="button" className="recent-forget" onClick={onForget}>
          {copy.forget}
        </button>
      </div>
      <ul className="recent-list">
        {entries.map((entry) => (
          <li key={entry.key}>
            <Link href={entry.href} prefetch={false}>
              <span className="recent-label">{entry.label}</span>
              {entry.detail === null ? null : (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{entry.detail}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{entry.network}</span>
              <time dateTime={new Date(entry.at).toISOString()} className="recent-when">
                {when.format(entry.at)}
              </time>
            </Link>
          </li>
        ))}
      </ul>
      {placement === "home" ? (
        <p className="recent-note">{copy.note(String(MAX_RECENT_POOLS), String(MAX_RECENT_ADDRESSES))}</p>
      ) : null}
    </section>
  );
}
