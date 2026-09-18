import type { DataFailureNotice, DataFailureReason, DataResult } from "../../schemas";
import { keccak256Hex } from "../crypto/keccak256";
import { decodeAddress, decodeUint } from "./abiWords";
import { postAggregatedCalls } from "./ethereumAggregatedCalls";
import type { Aggregate3Result } from "./multicall3";
import type { FetchLike } from "./v3SubgraphTransport";
import {
  balanceOfCalldata,
  decodePosition,
  FACTORY_SELECTOR,
  isPositionManagerCode,
  POSITION_MANAGER_ADDRESS,
  positionsCalldata,
  type RawV3Position,
  tokenOfOwnerByIndexCalldata,
} from "./v3PositionManager";

/*
 * Which Uniswap v3 positions one address actually holds.
 *
 * Everything else a holdings lookup answers is about what an address *could*
 * do — which pools its tokens open. This is what it has already done, and it
 * comes from a different place: a position is an ERC-721 token held by one
 * singleton, so the question is asked of that contract rather than of a pool or
 * an indexer.
 *
 * **Three round trips, and the order is the contract's rather than a choice.**
 * How many tokens the address holds, then the id at each place in its list,
 * then what each id is. The ids come out of the count and the positions out of
 * the ids; nothing here can be started earlier than it is. Each step is one
 * aggregated call, so three round trips carry hundreds of questions.
 *
 * **Two contracts have to be proved before anything they say is believed.**
 * Multicall3 is checked by the layer below; the position manager is checked
 * here, in the same batch as the first call, against the runtime this was built
 * against. An address is a claim either way.
 */

const NOT_CONFIGURED = "chain-data-not-configured";
const INVALID_ADDRESS = "invalid-pool-address";
const MANAGER_UNVERIFIED = "positions-manager-unverified";
const UNREADABLE = "positions-unreadable";

/** Whole seconds: this is the last of several reads a holdings page makes. */
export const DEFAULT_POSITIONS_TIMEOUT_MS = 10_000;

/**
 * The most positions to ask about.
 *
 * Measured on 2026-09-18: ordinary owners hold one, and the busiest hold 84 and
 * 154. A ceiling exists because the list is read by index and an address minting
 * in a loop could make it unbounded — not because the calls are dear, since each
 * step is one aggregated call whatever its width. An owner past it is read down
 * to this and the page says how many were left.
 */
export const MAX_POSITIONS_READ = 250;

const ADDRESS = /^0x[0-9a-f]{40}$/;

export type EthereumV3PositionsRequest = {
  /** Whose positions. Lower-cased and checked here before anything goes out. */
  readonly owner: string;
  /** Raw environment value; validated here so the wrapper stays free of logic. */
  readonly rpcUrl: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
};

/** What the chain said, before anything is made of it. */
export type RawV3Positions = {
  /** The factory the manager reports for itself, which is where pools come from. */
  readonly factory: string;
  /** How many position tokens the address holds, open and closed together. */
  readonly held: number;
  /** How many of those were asked about, which is `held` unless it is past the ceiling. */
  readonly read: number;
  /** Those with liquidity left in them, in the order the manager lists them. */
  readonly open: readonly RawV3Position[];
  /** How many of the ones read had been closed. A minted-and-burnt token is not a position. */
  readonly closed: number;
};

/**
 * The ids an `tokenOfOwnerByIndex` sweep produced, in the order it asked.
 *
 * A call that reverted is one id unread rather than a shorter list with the rest
 * shifted up — an id can be burnt between two of these round trips, and the
 * answers around it stay true. Dropping it here is what keeps the next sweep's
 * answers lined up with the ids that produced them.
 */
export const collectTokenIds = (results: readonly Aggregate3Result[]): readonly string[] =>
  results
    .map((result) => (result.success ? decodeUint(result.data) : null))
    .filter((tokenId): tokenId is string => tokenId !== null);

/**
 * Splits one `positions` sweep into the open ones and a count of the closed.
 *
 * Pairing is by place, which is the only thing that pairs them: the calls went
 * out in the order of `tokenIds` and came back in the same order. An answer with
 * no id at its index, one that reverted, or one that does not decode is neither
 * open nor closed — it is unread, and counting it as either would be a figure
 * about a position nobody read.
 */
export const collectPositions = (
  tokenIds: readonly string[],
  results: readonly Aggregate3Result[],
): { readonly open: readonly RawV3Position[]; readonly closed: number } => {
  const open: RawV3Position[] = [];
  let closed = 0;

  for (const [index, result] of results.entries()) {
    const tokenId = tokenIds[index];
    if (tokenId === undefined || !result.success) continue;

    const position = decodePosition(tokenId, result.data);
    if (position === null) continue;
    /* A token whose liquidity is gone is a receipt, not a position. */
    if (position.liquidity === "0") closed += 1;
    else open.push(position);
  }

  return { open, closed };
};

const unavailable = (
  reason: DataFailureReason,
  notice: DataFailureNotice,
): DataResult<RawV3Positions> => ({ status: "unavailable", reason, notice });

/**
 * Reads one address's open positions.
 *
 * A single call that reverted is one position unread rather than a failed read —
 * an id can be burnt between two of these round trips, and the answer for the
 * rest is still true. What fails whole is a refused batch, an unproved manager,
 * or a count that does not decode: those are not a shorter list, they are no
 * list at all, and an address that holds positions must never be shown as
 * holding none.
 */
export const fetchEthereumV3Positions = async ({
  owner,
  rpcUrl,
  fetchImpl,
  timeoutMs = DEFAULT_POSITIONS_TIMEOUT_MS,
}: EthereumV3PositionsRequest): Promise<DataResult<RawV3Positions>> => {
  const holder = owner.trim().toLowerCase();
  if (!ADDRESS.test(holder)) return unavailable("invalid-input", INVALID_ADDRESS);

  const endpoint = rpcUrl?.trim();
  if (endpoint === undefined || endpoint === "") {
    return unavailable("configuration-error", NOT_CONFIGURED);
  }

  const balanceOf = balanceOfCalldata(holder);
  if (balanceOf === null) return unavailable("invalid-input", INVALID_ADDRESS);

  const shared = { rpcUrl: endpoint, fetchImpl, timeoutMs };
  const first = await postAggregatedCalls({
    ...shared,
    calls: [
      { to: POSITION_MANAGER_ADDRESS, data: balanceOf },
      { to: POSITION_MANAGER_ADDRESS, data: FACTORY_SELECTOR },
    ],
    codeOf: [POSITION_MANAGER_ADDRESS],
  });
  if (!first.ok) return unavailable(first.reason, first.notice);

  /* The proof before the answers, as with the aggregator one layer down. */
  if (!isPositionManagerCode(first.codes[0], keccak256Hex)) {
    return unavailable("configuration-error", MANAGER_UNVERIFIED);
  }

  const [balanceResult, factoryResult] = first.results;
  const held = balanceResult?.success === true ? decodeUint(balanceResult.data) : null;
  const factory = factoryResult?.success === true ? decodeAddress(factoryResult.data, 0) : null;
  if (held === null || factory === null) return unavailable("invalid-response", UNREADABLE);

  const count = Number(held);
  if (!Number.isSafeInteger(count) || count < 0) return unavailable("invalid-response", UNREADABLE);
  if (count === 0) {
    return { status: "success", data: { factory, held: 0, read: 0, open: [], closed: 0 } };
  }

  const read = Math.min(count, MAX_POSITIONS_READ);
  const indexed = await postAggregatedCalls({
    ...shared,
    calls: Array.from({ length: read }, (_unused, index) => ({
      to: POSITION_MANAGER_ADDRESS,
      data: tokenOfOwnerByIndexCalldata(holder, index) ?? "",
    })),
  });
  if (!indexed.ok) return unavailable(indexed.reason, indexed.notice);

  const tokenIds = collectTokenIds(indexed.results);

  const described = await postAggregatedCalls({
    ...shared,
    calls: tokenIds.map((tokenId) => ({
      to: POSITION_MANAGER_ADDRESS,
      data: positionsCalldata(tokenId) ?? "",
    })),
  });
  if (!described.ok) return unavailable(described.reason, described.notice);

  const { open, closed } = collectPositions(tokenIds, described.results);

  return { status: "success", data: { factory, held: count, read, open, closed } };
};
