import type { FetchLike } from "../uniswap/v3SubgraphTransport";

/*
 * One GET to a public JSON API that takes no key, with a deadline.
 *
 * The two contract verifiers a hook is asked about — Sourcify and the
 * network's Blockscout — are asked this way, and nothing else is. Neither
 * takes a credential, so unlike the subgraph and chain transports there is
 * nothing here to keep out of a log; what there is to keep out of the page is
 * time. A verifier is a stranger's service the pages lean on for one line, so
 * every question carries a deadline of its own and a slow answer is no answer.
 *
 * Transport only. What a status and a body *mean* is each verifier's own
 * business (sourcify.ts, blockscout.ts), because the two say "not verified"
 * in different ways: Sourcify with a 404, Blockscout with a 200 and a false.
 * So this hands back the status and the decoded body, untouched and
 * untrusted, or says that no answer came.
 */

/** Why no answer came: the deadline passed, or the request never completed. */
export type NoAnswer = "timeout" | "unreachable";

export type PublicJsonAnswer =
  | {
      readonly answered: true;
      readonly status: number;
      /** The decoded body, untrusted; `undefined` when it was not JSON at all. */
      readonly body: unknown;
    }
  | { readonly answered: false; readonly why: NoAnswer };

export type PublicJsonRequest = {
  readonly fetchImpl: FetchLike;
  readonly timeoutMs: number;
};

export const getPublicJson = async (
  url: string,
  { fetchImpl, timeoutMs }: PublicJsonRequest,
): Promise<PublicJsonAnswer> => {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      /* Kept by this application for as long as it chooses (see getHookChecks.ts), never by the framework. */
      cache: "no-store",
      signal: controller.signal,
    });

    try {
      return { answered: true, status: response.status, body: await response.json() };
    } catch {
      /*
       * The deadline can pass while the body is still arriving, and that is a
       * timeout. Otherwise the body was not JSON — an error page in front of
       * the API, say — which is an answer, just not one anybody can read.
       */
      return controller.signal.aborted
        ? { answered: false, why: "timeout" }
        : { answered: true, status: response.status, body: undefined };
    }
  } catch {
    return { answered: false, why: controller.signal.aborted ? "timeout" : "unreachable" };
  } finally {
    clearTimeout(timer);
  }
};
