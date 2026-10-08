import type { ActionBudget } from "../ratelimit/actionBudget";
import { PENDING_LINK_TTL_MS } from "./links";

/*
 * How many alert links may be asked for, per half hour — the life of a
 * pending link. Its own file because the action's file is "use server", and
 * such a file may export async functions and nothing else: a build fails on
 * the object (it did, 2026-10-08), though types, lint and tests all pass.
 */

/** Per half hour: a reader trying two or three addresses, and a mistake or two. */
export const TELEGRAM_LINK_BUDGET: ActionBudget = {
  action: "telegram-link",
  perClient: 5,
  global: 300,
  windowMs: PENDING_LINK_TTL_MS,
};
