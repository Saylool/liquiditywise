import "server-only";

import type { Chain } from "../chains/chains";
import { readsV4 } from "../chains/chains";
import { getHookDirectory } from "./getHookDirectory";
import { readHookCheck } from "./getHookChecks";

/*
 * Checks every hook a network's directory lists before a reader asks.
 *
 * Cold, the directory's lines each wait a few seconds for a verifier, and on
 * a network listing fifty hooks the ones at the back of the line run out of
 * that wait and say "could not be checked just now" — true, and not what
 * anybody came for. Warmed, every line is already kept and arrives with the
 * page.
 *
 * Cheap after the first round: a hook already kept is not asked about again
 * until its twelve hours run out, so an hourly round asks about the hooks
 * that are new to the week's list and the few whose answers expired.
 */

/** Hourly: new hooks reach the week's list slowly, and a kept answer lasts twelve hours. */
export const HOOK_CHECK_WARM_EVERY_MS = 60 * 60 * 1000;

/** After the lists' own first round (warmMostTraded.ts), so the directory is read from what they kept. */
export const HOOK_CHECK_FIRST_WARM_AFTER_MS = 2 * 60 * 1000;

const LABEL = "hook-check-warm";

/** One network's round. The checks queue in getHookChecks.ts's lines, so all are handed over at once. */
export const warmHookChecks = async (chain: Chain): Promise<{ asked: number; verified: number; counted: number }> => {
  /* Held as its own name so the narrowing reaches the callback below, where Celo (v3 alone) cannot. */
  const chainId = chain.id;
  if (!readsV4(chainId)) return { asked: 0, verified: 0, counted: 0 };

  const directory = await getHookDirectory(chainId);
  if (directory.status === "unavailable") {
    console.info(`[${LABEL}] chain=${chain.slug} directory unavailable (${directory.notice})`);
    return { asked: 0, verified: 0, counted: 0 };
  }

  const checks = await Promise.all(directory.data.hooks.map(({ address }) => readHookCheck(chainId, address)));
  const verified = checks.filter(({ verification }) => verification.status === "verified").length;
  const counted = checks.filter(({ usage }) => usage.status === "counted").length;

  console.info(`[${LABEL}] chain=${chain.slug} hooks=${checks.length} verified=${verified} counted=${counted}`);
  return { asked: checks.length, verified, counted };
};
