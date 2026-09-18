import { z } from "zod";

import type { DataFailureNotice, DataFailureReason, DataResult } from "../../schemas";
import {
  DEFAULT_SUBGRAPH_TIMEOUT_MS,
  type FetchLike,
  postV3SubgraphQuery,
} from "./v3SubgraphTransport";

/*
 * Which v4 position tokens an address holds, by id.
 *
 * **This is the one thing about a v4 position that cannot be asked of the
 * chain.** The v3 manager implements ERC-721's `Enumerable` extension, so an
 * owner's tokens can be walked by index. This one does not — measured on
 * 2026-09-18, `tokenOfOwnerByIndex` reverts — so there is no call that turns an
 * address into its list, and an indexer is the only place the list exists.
 *
 * That makes this the weakest link in the v4 answer, and it is treated as one:
 * nothing here is believed. Every id goes back to the manager, which is asked
 * who owns it, and an id the manager does not attribute to this address is
 * dropped. What an indexer can do wrong is leave something out — and that shows,
 * because the chain is also asked how many tokens the address holds, and the
 * page says so when the two disagree.
 *
 * Measured on 2026-09-18: 104 ids for the address holding the most, in 516ms,
 * and the chain's own `balanceOf` for that address was 104 as well.
 */

const MALFORMED = "market-data-malformed";
const NOT_CONFIGURED = "market-data-not-configured";
const INDEXING_ERRORS = "market-data-indexing-errors";

export const V4_POSITION_IDS_QUERY = `query V4PositionIds($owner: Bytes!, $limit: Int!) {
  positions(where: { owner: $owner }, first: $limit) {
    tokenId
  }
  _meta {
    hasIndexingErrors
  }
}`;

/**
 * The most ids to take from one address.
 *
 * A ceiling exists because each id costs three of the chain calls below it, and
 * an address minting in a loop would make that unbounded. Set to what one
 * aggregated call was measured carrying rather than to a round number.
 */
export const MAX_V4_POSITION_IDS = 200;

export const V4PositionIdsResponseSchema = z.object({
  data: z
    .object({
      positions: z.array(z.object({ tokenId: z.string() })),
      _meta: z.object({ hasIndexingErrors: z.boolean() }).nullable(),
    })
    .nullish(),
  errors: z.array(z.unknown()).nullish(),
});

export type EthereumV4PositionIdsRequest = {
  /** Whose positions. Lower-cased by the caller; checked again here. */
  readonly owner: string;
  readonly apiKey: string | undefined;
  readonly subgraphId: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
};

const ADDRESS = /^0x[0-9a-f]{40}$/;
const DECIMAL = /^[0-9]+$/;

const unavailable = (
  reason: DataFailureReason,
  notice: DataFailureNotice,
): DataResult<readonly string[]> => ({ status: "unavailable", reason, notice });

/**
 * Reads the ids the indexer attributes to one address.
 *
 * An id that is not a whole number is dropped rather than failing the read: it
 * cannot be turned into calldata, and one unreadable id among a hundred is a
 * shorter list rather than no list. Duplicates are removed, because asking the
 * chain the same question twice would count one position as two.
 */
export const fetchEthereumV4PositionIds = async ({
  owner,
  apiKey,
  subgraphId,
  fetchImpl,
  timeoutMs = DEFAULT_SUBGRAPH_TIMEOUT_MS,
}: EthereumV4PositionIdsRequest): Promise<DataResult<readonly string[]>> => {
  const holder = owner.trim().toLowerCase();
  if (!ADDRESS.test(holder)) return unavailable("invalid-input", "invalid-pool-address");

  const key = apiKey?.trim();
  const subgraph = subgraphId?.trim();
  if (key === undefined || key === "" || subgraph === undefined || subgraph === "") {
    return unavailable("configuration-error", NOT_CONFIGURED);
  }

  const transport = await postV3SubgraphQuery({
    apiKey: key,
    subgraphId: subgraph,
    query: V4_POSITION_IDS_QUERY,
    variables: { owner: holder, limit: MAX_V4_POSITION_IDS },
    fetchImpl,
    timeoutMs,
  });
  if (!transport.ok) return unavailable(transport.reason, transport.notice);

  const parsed = V4PositionIdsResponseSchema.safeParse(transport.payload);
  if (!parsed.success) return unavailable("invalid-response", MALFORMED);

  const { data, errors } = parsed.data;
  if (errors != null && errors.length > 0) return unavailable("invalid-response", MALFORMED);
  if (data == null) return unavailable("invalid-response", MALFORMED);
  if (data._meta?.hasIndexingErrors === true) {
    return unavailable("invalid-response", INDEXING_ERRORS);
  }

  return {
    status: "success",
    data: [...new Set(data.positions.map((position) => position.tokenId))].filter((tokenId) =>
      DECIMAL.test(tokenId),
    ),
  };
};
