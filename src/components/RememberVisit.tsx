"use client";

import { useEffect } from "react";

import type { AddressVisit, PoolVisit } from "../lib/recent/recentlyViewed";
import { recordAddressVisit, recordPoolVisit } from "../lib/recent/recentlyViewedStore";

/*
 * Remembers, in the reader's browser, that a page rendered.
 *
 * Mounted by a page only on the branch where it has something to show — a
 * pool that was read, holdings that were swept — with the entry as props, so
 * a failed read is never remembered as a place worth going back to. It draws
 * nothing: recording is an effect of the page having been shown, and an
 * effect is where it runs, after hydration, in the one place that has the
 * storage.
 *
 * Nothing is sent anywhere. The props are the page's own address and what it
 * showed at the top; the clock is the browser's.
 */
export function RememberVisit({ visit }: { visit: { readonly kind: "pool"; readonly pool: PoolVisit } | { readonly kind: "address"; readonly address: AddressVisit } }) {
  /*
   * On the props object itself: a server-rendered page hands it over once, and
   * recording the same entry twice is harmless anyway — the list keeps a pool
   * once and only moves its time forward.
   */
  useEffect(() => {
    if (visit.kind === "pool") recordPoolVisit(visit.pool);
    else recordAddressVisit(visit.address);
  }, [visit]);

  return null;
}
