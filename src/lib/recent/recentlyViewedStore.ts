import {
  type AddressVisit,
  EMPTY_RECENT,
  type PoolVisit,
  readRecentlyViewed,
  type RecentlyViewed,
  withAddress,
  withPool,
  writeRecentlyViewed,
} from "./recentlyViewed";

/*
 * The kept list, as an external store React can subscribe to.
 *
 * The same shape as the theme's store, for the same reasons: the part with
 * behaviour — storage that may be blocked, a change made in another tab — is
 * worth testing on its own, and a component may not touch module state during
 * render. `localStorage` is the only place the list is, and this is the only
 * module that reads or writes it.
 *
 * A snapshot has to be the same object while nothing has changed, or
 * `useSyncExternalStore` sees a new list on every render and renders again.
 * So the last string read and the list it parsed to are kept together, and
 * the same string returns the same list.
 *
 * Storage that cannot be used — a private window, a browser set to block site
 * data — leaves the list empty and recording a no-op. There is no in-memory
 * fallback as the theme has: a list of the last pages, kept until the tab
 * closes, would be a convenience nobody asked for in a window they opened to
 * leave no trace.
 */

/** The one key under which the list is kept. */
export const RECENT_STORAGE_KEY = "recently-viewed";

const listeners = new Set<() => void>();

let lastStored: string | null | undefined;
let lastRead: RecentlyViewed = EMPTY_RECENT;

/**
 * Subscribes to changes — from this tab, through the listeners, and from
 * another, through the `storage` event, so a pool opened there is on the front
 * page here the next time it is looked at.
 */
export const subscribeToRecent = (onStoreChange: () => void): (() => void) => {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
};

/** The list as stored now; the empty list where storage cannot be read. */
export const readRecent = (): RecentlyViewed => {
  let stored: string | null;
  try {
    stored = localStorage.getItem(RECENT_STORAGE_KEY);
  } catch {
    stored = null;
  }

  if (stored !== lastStored) {
    lastStored = stored;
    lastRead = readRecentlyViewed(stored);
  }

  return lastRead;
};

/**
 * What the server renders: nothing. It cannot see a browser's storage, and it
 * must not guess, because the page it sends is the same page for everyone and
 * is cached as such. React draws the real list right after hydration.
 */
export const readServerRecent = (): RecentlyViewed => EMPTY_RECENT;

const store = (next: RecentlyViewed): void => {
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, writeRecentlyViewed(next));
  } catch {
    /* Blocked storage: the page was read, and that is all that happens. */
    return;
  }

  for (const listener of listeners) listener();
};

/** Remembers a pool page that rendered, as of now. */
export const recordPoolVisit = (visit: PoolVisit, now: () => number = Date.now): void => {
  store(withPool(readRecent(), visit, now()));
};

/** Remembers an address whose holdings rendered, as of now. */
export const recordAddressVisit = (visit: AddressVisit, now: () => number = Date.now): void => {
  store(withAddress(readRecent(), visit, now()));
};

/** Forgets the whole list — both pools and addresses — which is what the one control does. */
export const forgetRecent = (): void => {
  try {
    localStorage.removeItem(RECENT_STORAGE_KEY);
  } catch {
    return;
  }

  for (const listener of listeners) listener();
};
