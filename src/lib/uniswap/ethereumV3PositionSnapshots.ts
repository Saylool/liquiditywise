import { z } from "zod";

import type { DataFailureNotice, DataFailureReason, DataResult } from "../../schemas";
import { askPositionsSubgraph, type PositionsSource } from "./ethereumV3InRangePositions";
import { convertNonNegativeDecimal, convertSafeInteger, unixSecondsToIso } from "./v3SubgraphRawResponse";

/*
 * Every change a v3 position has been through, as its chain's positions
 * subgraph recorded them — the raw material of the record the holdings page
 * shows under an open position (see advisor/positionRecord.ts).
 *
 * **What is taken from the subgraph, and what is not.** The subgraph writes a
 * snapshot each time a position changes: its liquidity after the change, the
 * running totals of what was deposited and withdrawn, and the fee-growth
 * snapshot the position manager holds at that block. Those are taken. Its
 * `collectedFeesToken*` fields are not even asked for: measured on 2026-10-04,
 * token1's is a copy of token0's and both include withdrawn principal (and on
 * 2026-09-30 they reported two billion dollars collected by a position that
 * had deposited thirty-two million). What a position earned is worked out from
 * the fee-growth snapshots instead, which are the manager's own figures.
 *
 * **Nothing here is believed on its own.** Whether a history reaches the
 * chain's present is decided by comparing its newest snapshot with what the
 * position manager holds now, and that happens downstream, where both are in
 * hand. What this reader guarantees is narrower: a history it returns is every
 * row the subgraph has for that position, in block order, each one read in
 * full. A row it cannot read makes its position's history unreadable rather
 * than one row shorter, because a history with a change missing from the
 * middle is the one that would add up to a wrong figure and still look whole.
 *
 * **Paged by block, not by count.** A thousand rows a question; the next page
 * starts at the last block the previous one reached, inclusive, and rows
 * already seen are skipped by id. Inclusive because a page can end part-way
 * through one block's rows — several positions changed by one transaction —
 * and a cursor that moved past that block would lose the rest of them. A
 * history longer than the pages this reads is not cut short: every position
 * asked about is reported unreadable, since any of them might have rows in
 * the part never read.
 */

const MALFORMED = "market-data-malformed";
const INDEXING_ERRORS = "market-data-indexing-errors";

/** Rows per question, which is the most the gateway returns at once. */
export const HISTORY_PAGE = 1_000;

/**
 * Questions per read. A position gains a row each time it is added to, taken
 * from or collected from, so three thousand rows across the dozen positions a
 * page shows is something compounding for months on end — and the page is not
 * held for it: those records say they could not be verified instead.
 */
export const MAX_HISTORY_PAGES = 3;

export const V3_POSITION_HISTORY_QUERY = `query V3PositionHistory($ids: [String!]!, $from: BigInt!, $limit: Int!) {
  positionSnapshots(
    first: $limit
    orderBy: blockNumber
    orderDirection: asc
    where: { position_in: $ids, blockNumber_gte: $from }
  ) {
    id
    position { id }
    blockNumber
    timestamp
    liquidity
    depositedToken0
    depositedToken1
    withdrawnToken0
    withdrawnToken1
    feeGrowthInside0LastX128
    feeGrowthInside1LastX128
  }
  _meta { hasIndexingErrors }
}`;

const RawSnapshotSchema = z.object({
  id: z.string(),
  position: z.object({ id: z.string() }),
  blockNumber: z.string(),
  timestamp: z.string(),
  liquidity: z.string(),
  depositedToken0: z.string(),
  depositedToken1: z.string(),
  withdrawnToken0: z.string(),
  withdrawnToken1: z.string(),
  feeGrowthInside0LastX128: z.string(),
  feeGrowthInside1LastX128: z.string(),
});

const HistoryResponseSchema = z.object({
  data: z
    .object({
      positionSnapshots: z.array(RawSnapshotSchema),
      _meta: z.object({ hasIndexingErrors: z.boolean() }).nullable(),
    })
    .nullish(),
  errors: z.array(z.unknown()).nullish(),
});

type RawSnapshot = z.infer<typeof RawSnapshotSchema>;

/** One change, as recorded at the end of the block it happened in. */
export type V3PositionSnapshot = {
  readonly blockNumber: bigint;
  /** The block's time, as an ISO instant. */
  readonly at: string;
  /** The position's liquidity after the change. */
  readonly liquidity: bigint;
  /**
   * Running totals in whole tokens, as the subgraph keeps them: everything put
   * in and everything taken out as principal, from the position's first block
   * to this one.
   */
  readonly deposited0: number;
  readonly deposited1: number;
  readonly withdrawn0: number;
  readonly withdrawn1: number;
  /** `feeGrowthInside{0,1}LastX128` as the position manager held them at this block. */
  readonly feeGrowthInside0: bigint;
  readonly feeGrowthInside1: bigint;
};

export type V3PositionHistories = {
  /** The positions asked about. One asked and absent from `snapshots` has none. */
  readonly asked: ReadonlySet<string>;
  /** Each position's snapshots, oldest first. */
  readonly snapshots: ReadonlyMap<string, readonly V3PositionSnapshot[]>;
  /** Positions with a row that could not be read, or a history longer than one read takes. */
  readonly unreadable: ReadonlySet<string>;
};

const DIGITS = /^[0-9]+$/;
const UINT128 = 1n << 128n;
const UINT256 = 1n << 256n;

/** A whole number below a bound, from the decimal string the subgraph sends a `BigInt` as. */
const below = (raw: string, bound: bigint): bigint | null => {
  if (!DIGITS.test(raw)) return null;
  const value = BigInt(raw);
  return value < bound ? value : null;
};

const decimal = (raw: string): number | null => {
  const converted = convertNonNegativeDecimal(raw, { allowZero: true });
  return converted.ok ? converted.value : null;
};

/** One row as a snapshot, or `null` when any field of it is not what it claims to be. */
export const readSnapshot = (raw: RawSnapshot): V3PositionSnapshot | null => {
  const blockNumber = below(raw.blockNumber, UINT256);
  const seconds = convertSafeInteger(raw.timestamp);
  const at = seconds.ok && seconds.value >= 0 ? unixSecondsToIso(seconds.value) : null;
  const liquidity = below(raw.liquidity, UINT128);
  const deposited0 = decimal(raw.depositedToken0);
  const deposited1 = decimal(raw.depositedToken1);
  const withdrawn0 = decimal(raw.withdrawnToken0);
  const withdrawn1 = decimal(raw.withdrawnToken1);
  const feeGrowthInside0 = below(raw.feeGrowthInside0LastX128, UINT256);
  const feeGrowthInside1 = below(raw.feeGrowthInside1LastX128, UINT256);
  if (blockNumber === null || at === null || liquidity === null) return null;
  if (deposited0 === null || deposited1 === null || withdrawn0 === null || withdrawn1 === null) return null;
  if (feeGrowthInside0 === null || feeGrowthInside1 === null) return null;

  return {
    blockNumber,
    at,
    liquidity,
    deposited0,
    deposited1,
    withdrawn0,
    withdrawn1,
    feeGrowthInside0,
    feeGrowthInside1,
  };
};

const unavailable = (reason: DataFailureReason, notice: DataFailureNotice): DataResult<V3PositionHistories> => ({
  status: "unavailable",
  reason,
  notice,
});

/**
 * The histories of the given positions, read whole or reported unreadable.
 *
 * A failed question fails the read — the positions' records are then shown as
 * unread, and nothing else on the page depends on this.
 */
export const fetchEthereumV3PositionHistories = async (
  tokenIds: readonly string[],
  source: PositionsSource,
): Promise<DataResult<V3PositionHistories>> => {
  const ids = [...new Set(tokenIds.filter((tokenId) => DIGITS.test(tokenId)))];
  const asked = new Set(ids);
  const snapshots = new Map<string, V3PositionSnapshot[]>();
  const unreadable = new Set<string>();
  if (ids.length === 0) return { status: "success", data: { asked, snapshots, unreadable } };

  const seen = new Set<string>();
  let from = 0n;
  for (let page = 0; page < MAX_HISTORY_PAGES; page += 1) {
    const answer = await askPositionsSubgraph(source, V3_POSITION_HISTORY_QUERY, {
      ids,
      from: from.toString(),
      limit: HISTORY_PAGE,
    });
    if (!answer.ok) return unavailable(answer.reason, answer.notice);
    const parsed = HistoryResponseSchema.safeParse(answer.payload);
    if (!parsed.success || parsed.data.data == null || (parsed.data.errors?.length ?? 0) > 0) {
      return unavailable("invalid-response", MALFORMED);
    }
    if (parsed.data.data._meta?.hasIndexingErrors === true) return unavailable("invalid-response", INDEXING_ERRORS);

    const rows = parsed.data.data.positionSnapshots;
    /*
     * The cursor is only sound if the rows came back in the order asked for.
     * A source that ignored it could put a block behind the cursor, where the
     * next page would never look, so its answer is not used at all.
     */
    const blocks = rows.map((row) => below(row.blockNumber, UINT256));
    if (blocks.some((block) => block === null)) return unavailable("invalid-response", MALFORMED);
    const ordered = blocks as readonly bigint[];
    if (ordered.some((block, index) => block < from || (index > 0 && block < (ordered[index - 1] as bigint)))) {
      return unavailable("invalid-response", MALFORMED);
    }

    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      const tokenId = row.position.id;
      /* A row about a position not asked about says nothing about the ones that were. */
      if (!asked.has(tokenId)) continue;

      const snapshot = readSnapshot(row);
      if (snapshot === null) {
        unreadable.add(tokenId);
        continue;
      }
      const history = snapshots.get(tokenId) ?? [];
      history.push(snapshot);
      snapshots.set(tokenId, history);
    }

    if (rows.length < HISTORY_PAGE) return { status: "success", data: { asked, snapshots, unreadable } };
    from = ordered[ordered.length - 1] as bigint;
  }

  /* Read to the last page and still more: none of these histories is known to be whole. */
  return { status: "success", data: { asked, snapshots, unreadable: new Set(ids) } };
};
