import { z } from "zod";

import type { V4ChainId } from "../chains/chains";
import type { FetchLike } from "../uniswap/v3SubgraphTransport";
import { getPublicJson, type PublicJsonAnswer } from "./publicJson";
import { contractNameOf, type SourceAnswer, unanswered, unansweredStatus } from "./sourceAnswer";

/*
 * Sourcify: whether it holds verified source for a contract.
 *
 * `GET /server/v2/contract/{chainId}/{address}` is public and takes no key.
 * Measured on 2026-10-04, from the hooks the directory lists on all six
 * networks: an answer in 75 to 400 milliseconds, every time.
 *
 * It says "verified" with a 200 and `match` set to `"match"` or
 * `"exact_match"`, and "not verified" with a 404 whose body still says
 * `"match": null`. The two kinds of match differ only in the metadata hash
 * the compiler appends — whether the comments and file layout are byte for
 * byte the deployer's — and are the same thing for what the page says: the
 * published source compiles to the code that is deployed. Uniswap's own
 * PoolManager on mainnet is a `"match"`.
 *
 * A 404 that does not say `"match": null` is not read as "not verified". It
 * is what a moved or retired endpoint would answer, and reading it as a
 * verdict would put "no verified source found" under every hook on the site
 * — a claim about each of them that nobody had made.
 *
 * `fields=compilation.name` adds the contract's name from the verified
 * source, for the hooks Blockscout has no name for (blockscout.ts).
 */

const SOURCIFY_CONTRACT_URL = "https://sourcify.dev/server/v2/contract";

/** Measured at 75–400 ms; three seconds is a service having a bad minute, not a slow one. */
export const SOURCIFY_TIMEOUT_MS = 3_000;

/** How Sourcify says "not verified": an answer, not a failure (see serverDiagnostics.ts). */
export const SOURCIFY_ANSWER_STATUSES: ReadonlySet<number> = new Set([404]);

/** Non-strict, as at every outside boundary: Sourcify adds fields, and none of the others is read. */
const VerifiedSchema = z.object({
  match: z.enum(["match", "exact_match"]),
  compilation: z.object({ name: z.unknown() }).optional(),
});

const NotVerifiedSchema = z.object({ match: z.null() });

export const sourcifyContractUrl = (chainId: V4ChainId, address: string): string =>
  `${SOURCIFY_CONTRACT_URL}/${chainId}/${address}?fields=compilation.name`;

/** Where a reader can read the source for themselves. Sourcify redirects a lower-cased address to its checksummed one. */
export const sourcifyPage = (chainId: V4ChainId, address: string): string =>
  `https://repo.sourcify.dev/${chainId}/${address}`;

/** Pure: one answer from Sourcify, read. */
export const readSourcifyAnswer = (answer: PublicJsonAnswer): SourceAnswer => {
  if (!answer.answered) return unanswered(answer.why);

  if (answer.status === 200) {
    const verified = VerifiedSchema.safeParse(answer.body);
    if (verified.success) {
      return { kind: "verified", name: contractNameOf(verified.data.compilation?.name), proxy: null };
    }
    /* A 200 that says no match is the same verdict a 404 gives. */
    return NotVerifiedSchema.safeParse(answer.body).success ? { kind: "unverified", proxy: null } : unanswered("unreadable");
  }

  if (answer.status === 404) {
    return NotVerifiedSchema.safeParse(answer.body).success ? { kind: "unverified", proxy: null } : unanswered("unreadable");
  }

  return unanswered(unansweredStatus(answer.status));
};

export type SourcifyRequest = {
  readonly chainId: V4ChainId;
  /** Lower-cased, `0x` and forty hex characters; the caller has checked. */
  readonly address: string;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
};

/** Asks Sourcify about one contract. Never throws: whatever happens is one of the answers above. */
export const fetchSourcifyAnswer = async ({
  chainId,
  address,
  fetchImpl,
  timeoutMs = SOURCIFY_TIMEOUT_MS,
}: SourcifyRequest): Promise<SourceAnswer> =>
  readSourcifyAnswer(await getPublicJson(sourcifyContractUrl(chainId, address), { fetchImpl, timeoutMs }));
