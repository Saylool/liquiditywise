import { z } from "zod";

import type { NoAnswer } from "./publicJson";

/*
 * What one verifier said about one contract, in the only three shapes the
 * pages can use: it holds verified source for it, it does not, or it could
 * not be asked.
 *
 * "Could not be asked" keeps its reason, because the reasons are not alike.
 * A timeout, a dropped connection, a 429 or a 5xx is a service having a bad
 * minute, and the next page asks again. A 401 or 403 — a verifier refusing
 * this server — or an answer whose shape is no longer the one written down
 * here, will not pass on its own: every hook would read "could not be checked"
 * from then on and nothing would say why. The health check tells those apart
 * (health/upstreamProbe.ts); the pages do not need to.
 */

export type Unanswered = NoAnswer | "busy" | "refused" | "unreadable";

/**
 * What a verifier says about a proxy: that the code which runs is elsewhere,
 * and, where it has verified that code too, what that code's source calls it.
 */
export type ProxyReading = { readonly implementation: string | null };

export type SourceAnswer =
  | {
      readonly kind: "verified";
      /** The contract's name in the verified source, when it is a name at all (see {@link contractNameOf}). */
      readonly name: string | null;
      /** Only Blockscout says whether an address is a proxy; `null` is "not said", not "not a proxy". */
      readonly proxy: ProxyReading | null;
    }
  | { readonly kind: "unverified"; readonly proxy: ProxyReading | null }
  | { readonly kind: "unanswered"; readonly why: Unanswered };

export const unanswered = (why: Unanswered): SourceAnswer => ({ kind: "unanswered", why });

/**
 * A status that is not the verifier's answer, sorted by whether it will pass.
 *
 * Everything not named here — a 400, a 404 in a body nobody wrote, a 410 —
 * is "unreadable": the service answered, and what it said is not something
 * this was written to read.
 */
export const unansweredStatus = (status: number): Unanswered => {
  if (status === 429 || status >= 500) return "busy";
  if (status === 401 || status === 403) return "refused";
  return "unreadable";
};

/**
 * A Solidity identifier, and nothing else.
 *
 * The name comes from somebody else's source file and lands on this
 * application's page. A contract name cannot hold a space, a full stop or a
 * letter outside ASCII, so anything that does is not a contract name —
 * whatever it is, it is not shown, rather than shown as one. That also keeps
 * a "name" written to look like a sentence or a brand ("Uniswap Labs:
 * Official") off the page, and a long one from running past a phone's edge.
 */
const ContractNameSchema = z.string().regex(/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/);

export const contractNameOf = (raw: unknown): string | null => {
  const parsed = ContractNameSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
};

/** Whether the verifier answered at all — what decides how long an answer is kept (getHookChecks.ts). */
export const isAnswered = (answer: SourceAnswer): boolean => answer.kind !== "unanswered";
