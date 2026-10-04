import "server-only";

import { keptReads } from "../cache/keptReads";
import { limitConcurrency } from "../cache/concurrency";
import { processShared } from "../cache/processShared";
import { v4SubgraphIdFor } from "../chains/chainEnvironment";
import type { V4ChainId } from "../chains/chains";
import { loggingFetch } from "../observability/serverDiagnostics";
import { fetchV4HookPools, type HookUsage } from "../uniswap/ethereumV4HookPools";
import { fetchBlockscoutAnswer } from "../verification/blockscout";
import { isAnswered, type SourceAnswer, unanswered } from "../verification/sourceAnswer";
import { fetchSourcifyAnswer, SOURCIFY_ANSWER_STATUSES } from "../verification/sourcify";
import { composeHookCheck, HOOK_CHECK_KEPT_MS, HOOK_CHECK_RETRY_MS, type HookCheck, isCounted } from "./hookCheck";

/*
 * The server-only boundary for what can be checked about a hook: three
 * questions per hook — Sourcify, the network's Blockscout, the network's v4
 * subgraph — each kept on its own, asked a few at a time, and never waited
 * on for long.
 *
 * **Kept** for twelve hours once answered and ten minutes when not
 * (hookCheck.ts says why), in this process's memory like the week's pool
 * list the directory is read from. Each source on its own, so a verifier
 * that was down when a hook was first asked about costs that hook its one
 * line for ten minutes, not the others for twelve hours.
 *
 * **A few at a time.** A directory lists up to fifty hooks; asked all at
 * once, that is fifty requests to somebody's free public API in the same
 * second. Each service has its own line, shared by every page and by the
 * warmer.
 *
 * **Never waited on for long.** A page gives each part {@link HOOK_CHECK_WAIT_MS}
 * and then says "could not be checked just now" for whatever has not come
 * back. The question is not abandoned: it goes on, its answer is kept, and
 * the next page reads it. Each line streams in a boundary of its own, so
 * even that wait holds back nothing else on the page.
 *
 * Nothing here takes a key but the subgraph's, which goes where it always
 * goes — an Authorization header, inside the transport.
 */

/**
 * The most a page waits for any part of a check: past every source's own
 * deadline once, and short enough that a line still waiting has not been
 * waiting long.
 */
export const HOOK_CHECK_WAIT_MS = 6_000;

/** Questions in flight at once, per service. Sourcify and Blockscout are free, public and shared with everyone. */
const VERIFIER_AT_ONCE = 4;
/** The gateway already serves the pages' heavier reads; three leaves them room. */
const SUBGRAPH_AT_ONCE = 3;

/** Bounded like every kept read here: the six networks' directories (126 hooks on 2026-10-04) and every hook a pool page shows, with room. */
const KEPT_HOOKS = 2_000;

const SOURCIFY_LABEL = "hook-sourcify";
const BLOCKSCOUT_LABEL = "hook-blockscout";
const POOLS_LABEL = "hook-pools";

const kept = {
  sourcify: keptReads<SourceAnswer>({
    name: "hook-sourcify",
    ttlMs: HOOK_CHECK_KEPT_MS,
    retryMs: HOOK_CHECK_RETRY_MS,
    keep: isAnswered,
    maxEntries: KEPT_HOOKS,
  }),
  blockscout: keptReads<SourceAnswer>({
    name: "hook-blockscout",
    ttlMs: HOOK_CHECK_KEPT_MS,
    retryMs: HOOK_CHECK_RETRY_MS,
    keep: isAnswered,
    maxEntries: KEPT_HOOKS,
  }),
  pools: keptReads<HookUsage>({
    name: "hook-pools",
    ttlMs: HOOK_CHECK_KEPT_MS,
    retryMs: HOOK_CHECK_RETRY_MS,
    keep: isCounted,
    maxEntries: KEPT_HOOKS,
  }),
};

/* One line per service for the whole process, the warmer's questions included (see processShared.ts). */
const lines = processShared("hook-check-lines", () => ({
  sourcify: limitConcurrency(VERIFIER_AT_ONCE),
  blockscout: limitConcurrency(VERIFIER_AT_ONCE),
  subgraph: limitConcurrency(SUBGRAPH_AT_ONCE),
}));

/** Exposed so a test can start from nothing rather than from another test's answers. */
export const forgetHookChecks = (): void => {
  kept.sourcify.forget();
  kept.blockscout.forget();
  kept.pools.forget();
};

const NOT_BACK: SourceAnswer = unanswered("timeout");
const NOT_COUNTED: HookUsage = { status: "unchecked" };

/** A hook as every address here is written; anything else is never sent anywhere. */
const HOOK_ADDRESS = /^0x[0-9a-f]{40}$/;

/** The three questions about one hook, each answered from what is kept where it can be. None of them rejects. */
const ask = (chainId: V4ChainId, address: string) => {
  const key = `${chainId}:${address}`;

  return {
    sourcify: kept.sourcify
      .read(key, () =>
        lines.sourcify(() =>
          fetchSourcifyAnswer({
            chainId,
            address,
            fetchImpl: loggingFetch(SOURCIFY_LABEL, undefined, undefined, { answers: SOURCIFY_ANSWER_STATUSES }),
          }),
        ),
      )
      .catch(() => unanswered("unreachable")),
    blockscout: kept.blockscout
      .read(key, () => lines.blockscout(() => fetchBlockscoutAnswer({ chainId, address, fetchImpl: loggingFetch(BLOCKSCOUT_LABEL) })))
      .catch(() => unanswered("unreachable")),
    pools: kept.pools
      .read(key, () =>
        lines.subgraph(() =>
          fetchV4HookPools({
            hook: address,
            apiKey: process.env.THE_GRAPH_API_KEY,
            subgraphId: v4SubgraphIdFor(chainId),
            fetchImpl: loggingFetch(POOLS_LABEL),
          }),
        ),
      )
      .catch((): HookUsage => NOT_COUNTED),
  };
};

/**
 * One hook's check, however long it takes: for the warmer, which has nobody
 * waiting on it.
 */
export const readHookCheck = async (chainId: V4ChainId, address: string): Promise<HookCheck> => {
  const hook = address.toLowerCase();
  if (!HOOK_ADDRESS.test(hook)) return composeHookCheck(chainId, hook, NOT_BACK, NOT_BACK, NOT_COUNTED);

  const asked = ask(chainId, hook);
  const [sourcify, blockscout, pools] = await Promise.all([asked.sourcify, asked.blockscout, asked.pools]);

  return composeHookCheck(chainId, hook, sourcify, blockscout, pools);
};

/**
 * One hook's check as a page shows it: whatever is back within `waitMs`,
 * and "could not be checked just now" for the rest. Never rejects.
 */
export const checkHook = async (
  chainId: V4ChainId,
  address: string,
  { waitMs = HOOK_CHECK_WAIT_MS }: { readonly waitMs?: number } = {},
): Promise<HookCheck> => {
  const hook = address.toLowerCase();
  if (!HOOK_ADDRESS.test(hook)) return composeHookCheck(chainId, hook, NOT_BACK, NOT_BACK, NOT_COUNTED);

  const asked = ask(chainId, hook);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, waitMs);
  });
  const by = <T>(answer: Promise<T>, otherwise: T): Promise<T> => Promise.race([answer, late.then(() => otherwise)]);

  try {
    const [sourcify, blockscout, pools] = await Promise.all([
      by(asked.sourcify, NOT_BACK),
      by(asked.blockscout, NOT_BACK),
      by(asked.pools, NOT_COUNTED),
    ]);
    return composeHookCheck(chainId, hook, sourcify, blockscout, pools);
  } finally {
    clearTimeout(timer);
  }
};
