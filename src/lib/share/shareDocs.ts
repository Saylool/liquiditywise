import { ETHEREUM } from "../chains/chains";
import { shareCardUrl } from "./shareLinks";
import type { ShareRequest } from "./shareRequest";
import {
  NO_SUCH_POSITION_CACHE,
  NOT_A_POSITION_CACHE,
  SHARE_CARD_CACHE,
  SHARE_UNREADABLE_CACHE,
  type ShareFailure,
} from "./shareResponses";

/*
 * What the developers page states about the share card, taken from the code
 * that serves it rather than written beside it — as embed/embedDocs.ts does
 * for the pool card, and for the same reason: the page documents an address
 * somebody may link to, so a sentence that drifted from the code would be a
 * dead link, not a typo. The example address is built by the function the
 * holdings page builds its links with, and each status and its lifetime is
 * the constant the route sends; shareDocs.test.ts holds the rest to the
 * route and the proxy.
 *
 * Pure and static: nothing here reads the network, the clock or a position.
 */

/**
 * The position every example names: #998651, USDC / WETH at 0.05% on Ethereum
 * mainnet, the position the record's own arithmetic was measured against
 * (advisor/positionRecord.ts). A real id, so the example can be opened as it
 * stands — and answered with `404` the day it is closed, which is also as
 * documented.
 */
export const EXAMPLE_SHARE_REQUEST: ShareRequest = { chain: ETHEREUM, chainId: 1, tokenId: "998651" };

export const EXAMPLE_SHARE_URL = shareCardUrl(EXAMPLE_SHARE_REQUEST.chain, EXAMPLE_SHARE_REQUEST.tokenId, "en");

/** What every answer of the card is: the image, or one of four failures. */
export const SHARE_STATUS_KINDS = ["card", "not-a-position", "no-such-position", "unreadable", "rate-limited"] as const;

export type ShareStatusKind = (typeof SHARE_STATUS_KINDS)[number];

export type ShareStatus = {
  readonly kind: ShareStatusKind;
  readonly status: number;
  /** The `error` a failure's JSON carries; `null` for the card. */
  readonly error: ShareFailure | "rate-limited" | null;
  readonly cacheControl: string;
};

/** Each status, with how long it may be kept. Held to shareResponses.ts and to the proxy's refusal by shareDocs.test.ts. */
export const SHARE_STATUSES: readonly ShareStatus[] = [
  { kind: "card", status: 200, error: null, cacheControl: SHARE_CARD_CACHE },
  { kind: "not-a-position", status: 400, error: "not-a-position", cacheControl: NOT_A_POSITION_CACHE },
  { kind: "no-such-position", status: 404, error: "no-such-position", cacheControl: NO_SUCH_POSITION_CACHE },
  { kind: "unreadable", status: 503, error: "unreadable", cacheControl: SHARE_UNREADABLE_CACHE },
  { kind: "rate-limited", status: 429, error: "rate-limited", cacheControl: "no-store" },
];
