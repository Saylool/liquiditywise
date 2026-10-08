import { createHmac } from "node:crypto";

import type { KeyValueStore } from "../store/keyValueStore";
import { RATE_LIMIT_KEY_PREFIX } from "./rateLimitStore";

/*
 * What a public Server Action that writes to the store may spend.
 *
 * A Server Action is not reached only through its form. It is a POST anybody
 * can send, with no query the proxy would charge, so whatever an action
 * allocates has to be budgeted inside the action itself — the proxy's count
 * (proxy.ts) is a second line, not the one that holds. Two of them write a
 * record for a stranger: the Telegram button mints a pending link, and the
 * weekly page's form a pending subscription and a mail. Each is held to two
 * counts here, both in the shared store, so every process the site runs in
 * counts against the same numbers:
 *
 *   - **per client**, so one caller cannot take more than a reader ever needs;
 *   - **over everybody**, so many callers together cannot either. Each window
 *     allows at most `global` records, and a record lives about a window, so
 *     at most twice that is ever waiting at once, whoever sent them.
 *
 * Each count is one atomic step in the store (KeyValueStore.increment): a
 * count and its lifetime are written together, and two requests at once are
 * two counts, never one. The client's count is taken first and the shared one
 * only for a request that passed it, so a single caller over its own budget
 * spends nothing of everybody's.
 *
 * **No client address is written.** The client is counted under an HMAC of
 * its address, the action and the window, under a secret only the server
 * has: the key says nothing to anybody reading the store, and it is a
 * different key in every window, so even two windows of one client cannot be
 * told to be the same one. The counts live two windows and are not under a
 * prefix the backup copies. What readers are told is kept about them stays
 * true: no IP address, anywhere.
 *
 * A store that does not answer refuses the request. The store is where the
 * action was about to write; one that cannot count would most likely not
 * have taken the write either, and an action that cannot be counted is
 * exactly the one this exists to stop.
 */

export type ActionBudget = {
  /** Names the action in its keys, so two actions never share a count. */
  readonly action: string;
  /** Requests per window from one client. */
  readonly perClient: number;
  /** Requests per window from everybody together. */
  readonly global: number;
  readonly windowMs: number;
};

export type BudgetDecision = "allowed" | "client-spent" | "global-spent" | "unavailable";

/** Where an action's counts live: beside the proxy's, and never under a prefix the backup copies. */
export const ACTION_BUDGET_PREFIX = `${RATE_LIMIT_KEY_PREFIX}action:`;

/** The client's key for one window: unreadable without the secret, and unlinkable across windows. */
const clientCounter = (secret: string, action: string, windowStart: number, clientKey: string): string =>
  createHmac("sha256", secret).update(`${action}\n${windowStart}\n${clientKey}`).digest().subarray(0, 16).toString("base64url");

/**
 * Counts one request against an action's budget, and says whether it may go
 * on. A refusal names which count refused it, for the caller's log and tests;
 * the reader is answered the same either way.
 */
export const spendActionBudget = async (
  store: KeyValueStore,
  budget: ActionBudget,
  request: { readonly clientKey: string; readonly secret: string; readonly now: number },
): Promise<BudgetDecision> => {
  /* Aligned to the clock, as the proxy's shared window is, so every process agrees where a window starts. */
  const windowStart = request.now - (request.now % budget.windowMs);
  const base = `${ACTION_BUDGET_PREFIX}${budget.action}:${windowStart}:`;
  /* Two windows' life, so a clock a little off from the store's cannot end a count early. */
  const ttlMs = budget.windowMs * 2;

  const client = await store.increment(`${base}${clientCounter(request.secret, budget.action, windowStart, request.clientKey)}`, ttlMs);
  if (client === null) return "unavailable";
  if (client > budget.perClient) return "client-spent";

  const everybody = await store.increment(`${base}all`, ttlMs);
  if (everybody === null) return "unavailable";
  if (everybody > budget.global) return "global-spent";

  return "allowed";
};
