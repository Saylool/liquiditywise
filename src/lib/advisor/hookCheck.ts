import type { V4ChainId } from "../chains/chains";
import type { HookUsage } from "../uniswap/ethereumV4HookPools";
import type { ProxyReading, SourceAnswer } from "../verification/sourceAnswer";

/*
 * What can be checked about a hook from outside it, beside what it is
 * permitted to do.
 *
 * Its permissions are the one thing the protocol enforces (HookPermissions.tsx);
 * nothing here adds to them or vouches for anything. Two other facts are
 * public and anyone can check them, so the pages check them too:
 *
 *   - **Whether its source code is published and verified.** Sourcify and the
 *     network's Blockscout are asked separately. Verified means the source
 *     somebody published for the address compiles to exactly the code that
 *     is deployed there — so the code can be read. It is not an audit, and
 *     the pages say so every time they say "verified".
 *   - **How widely it is used**: how many v4 pools on the network name it,
 *     and when the first of them was created.
 *
 * Pure: the answers arrive already read (verification/, uniswap/
 * ethereumV4HookPools.ts) and are only combined here. Asking, keeping and
 * waiting are getHookChecks.ts's.
 */

/**
 * How long an answer is kept: twelve hours. Whether a contract is verified
 * changes once in its life, if ever, and a count of pools moves slowly next
 * to a cap of a thousand; half a day keeps every question on the directory
 * to two a day.
 */
export const HOOK_CHECK_KEPT_MS = 12 * 60 * 60 * 1000;

/**
 * How long a question that went unanswered waits before it is asked again:
 * ten minutes. Kept at all, so a verifier that is down is not asked again by
 * every page that lists forty hooks; kept briefly, so "could not be checked"
 * does not outlast the outage by half a day.
 */
export const HOOK_CHECK_RETRY_MS = 10 * 60 * 1000;

export type VerificationSource = "sourcify" | "blockscout";

export type HookVerification =
  | {
      readonly status: "verified";
      /** Every verifier that holds verified source for it, Sourcify first. Never empty. */
      readonly sources: readonly VerificationSource[];
      /** The contract's name in that source, Blockscout's before Sourcify's; `null` where neither gave one. */
      readonly name: string | null;
      readonly proxy: ProxyReading | null;
    }
  | { readonly status: "unverified"; readonly proxy: ProxyReading | null }
  | { readonly status: "unchecked" };

export type HookCheck = {
  readonly chainId: V4ChainId;
  /** Lower-cased. */
  readonly address: string;
  readonly verification: HookVerification;
  readonly usage: HookUsage;
};

const nameOf = (answer: SourceAnswer): string | null => (answer.kind === "verified" ? answer.name : null);

/**
 * Two verifiers' answers, made one.
 *
 * Verified by either is verified: each holds what was submitted to it, and
 * deployers submit to one or the other — on 2026-10-04 thirteen of the
 * forty-seven hooks the Unichain directory listed were verified on Blockscout
 * alone. Not verified needs both to have said so; one "no" beside a verifier
 * that did not answer is not knowing, and the page says it could not check
 * rather than that nothing was found.
 *
 * The name is Blockscout's where it has one. It is Blockscout's reading of
 * the contract at that address, and the one beside its proxy reading; a
 * Sourcify name stands in only where Blockscout did not give one.
 *
 * `blockscout` is `null` on a network that has no Blockscout (BNB Chain and
 * Avalanche, verification/blockscout.ts) — not asked, rather than asked and
 * silent. There Sourcify's word is the whole verdict: "not found" needs only
 * its "no", and the page says Sourcify alone was asked. No proxy is read
 * there, because only Blockscout says whether an address is one.
 */
export const combineVerification = (sourcify: SourceAnswer, blockscout: SourceAnswer | null): HookVerification => {
  const proxy = blockscout === null || blockscout.kind === "unanswered" ? null : blockscout.proxy;
  const sources: VerificationSource[] = [];
  if (sourcify.kind === "verified") sources.push("sourcify");
  if (blockscout?.kind === "verified") sources.push("blockscout");

  if (sources.length > 0) {
    return {
      status: "verified",
      sources,
      name: (blockscout === null ? null : nameOf(blockscout)) ?? nameOf(sourcify),
      proxy,
    };
  }
  if (sourcify.kind === "unverified" && (blockscout === null || blockscout.kind === "unverified")) {
    return { status: "unverified", proxy };
  }

  return { status: "unchecked" };
};

export const composeHookCheck = (
  chainId: V4ChainId,
  address: string,
  sourcify: SourceAnswer,
  blockscout: SourceAnswer | null,
  usage: HookUsage,
): HookCheck => ({ chainId, address, verification: combineVerification(sourcify, blockscout), usage });

/** Whether a count came back — what decides how long it is kept. */
export const isCounted = (usage: HookUsage): boolean => usage.status === "counted";
