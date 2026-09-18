import type { DataFailureNotice, DataFailureReason, DataResult } from "../../schemas";
import { keccak256Hex } from "../crypto/keccak256";
import { decodeAddress, decodeUint } from "./abiWords";
import { postAggregatedCalls } from "./ethereumAggregatedCalls";
import type { Aggregate3Result } from "./multicall3";
import type { FetchLike } from "./v3SubgraphTransport";
import {
  decodePoolAndPositionInfo,
  isV4PositionManagerCode,
  ownerOfCalldata,
  poolAndPositionInfoCalldata,
  positionLiquidityCalldata,
  type RawV4Position,
  V4_POSITION_MANAGER_ADDRESS,
  v4BalanceOfCalldata,
} from "./v4PositionManager";

/*
 * What each of an address's v4 position tokens actually is.
 *
 * **One round trip, where v3 needs three.** A v3 position has to be enumerated —
 * how many, then which id at each place, then what each id is — and each step
 * comes out of the one before it. Here the ids arrive from the indexer and
 * everything about a position is in one answer, so every question goes out at
 * once. Measured on 2026-09-18: 312 calls for 104 positions in 401ms.
 *
 * **The indexer's list is checked, not trusted.** Every id is put back to the
 * manager with `ownerOf`, and one the manager does not attribute to this address
 * is dropped rather than shown — a list of positions is exactly the answer where
 * showing somebody else's would be worst. The chain's own count comes back in
 * the same batch, so an indexer that has fallen behind shows as a gap between
 * what is held and what was read instead of silently shortening the list.
 *
 * **Two contracts are proved before anything they say is believed.** Multicall3
 * by the layer below, the position manager here, in the same batch as the
 * questions. An address is a claim either way.
 */

const NOT_CONFIGURED = "chain-data-not-configured";
const INVALID_ADDRESS = "invalid-pool-address";
const MANAGER_UNVERIFIED = "positions-manager-unverified";
const UNREADABLE = "positions-unreadable";

/** Whole seconds: this is the last of several reads a holdings page makes. */
export const DEFAULT_V4_POSITIONS_TIMEOUT_MS = 10_000;

const ADDRESS = /^0x[0-9a-f]{40}$/;

export type EthereumV4PositionsRequest = {
  /** Whose positions. Lower-cased and checked here before anything goes out. */
  readonly owner: string;
  /** The ids the indexer offered, already capped. Each is checked against the chain. */
  readonly tokenIds: readonly string[];
  /** Raw environment value; validated here so the wrapper stays free of logic. */
  readonly rpcUrl: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
};

/** What the chain said, before anything is made of it. */
export type RawV4Positions = {
  /** How many position tokens the address holds, open and closed together. */
  readonly held: number;
  /** How many the chain confirmed it owns out of the ids that were offered. */
  readonly read: number;
  /** Those with liquidity left in them, in the order the ids arrived. */
  readonly open: readonly RawV4Position[];
  /** How many of the ones read had been closed. A minted-and-burnt token is not a position. */
  readonly closed: number;
};

/**
 * Splits one sweep into the positions that are this address's and the rest.
 *
 * Three answers to an id, in the order they were asked: who owns it, what it is,
 * how much is in it. Pairing is by place, which is the only thing that pairs
 * them — the calls went out in the order of `tokenIds` and come back in it.
 *
 * An id the manager attributes to somebody else is not counted at all. It was
 * never this address's position, so counting it as read would put a gap in the
 * page's own arithmetic and describe a shortfall that does not exist.
 */
export const collectV4Positions = (
  owner: string,
  tokenIds: readonly string[],
  results: readonly Aggregate3Result[],
): { readonly open: readonly RawV4Position[]; readonly read: number; readonly closed: number } => {
  const open: RawV4Position[] = [];
  let read = 0;
  let closed = 0;

  for (const [index, tokenId] of tokenIds.entries()) {
    const held = results[index * 3];
    const info = results[index * 3 + 1];
    const liquid = results[index * 3 + 2];
    if (held?.success !== true || info?.success !== true || liquid?.success !== true) continue;
    if (decodeAddress(held.data, 0) !== owner) continue;

    read += 1;

    const description = decodePoolAndPositionInfo(info.data);
    const liquidity = decodeUint(liquid.data);
    if (description === null || liquidity === null) continue;

    /* A token whose liquidity is gone is a receipt, not a position. */
    if (liquidity === "0") closed += 1;
    else open.push({ tokenId, liquidity, ...description });
  }

  return { open, read, closed };
};

const unavailable = (
  reason: DataFailureReason,
  notice: DataFailureNotice,
): DataResult<RawV4Positions> => ({ status: "unavailable", reason, notice });

/**
 * Reads what each of the offered ids is.
 *
 * A single call that reverted is one position unread rather than a failed read —
 * an id can be burnt between the indexer's answer and this one, and the rest
 * stay true. What fails whole is a refused batch, an unproved manager, or a
 * count that does not decode: those are not a shorter list, they are no list at
 * all, and an address that holds positions must never be shown as holding none.
 */
export const fetchEthereumV4Positions = async ({
  owner,
  tokenIds,
  rpcUrl,
  fetchImpl,
  timeoutMs = DEFAULT_V4_POSITIONS_TIMEOUT_MS,
}: EthereumV4PositionsRequest): Promise<DataResult<RawV4Positions>> => {
  const holder = owner.trim().toLowerCase();
  if (!ADDRESS.test(holder)) return unavailable("invalid-input", INVALID_ADDRESS);

  const endpoint = rpcUrl?.trim();
  if (endpoint === undefined || endpoint === "") {
    return unavailable("configuration-error", NOT_CONFIGURED);
  }

  const balanceOf = v4BalanceOfCalldata(holder);
  if (balanceOf === null) return unavailable("invalid-input", INVALID_ADDRESS);

  /*
   * An id that cannot be turned into calldata is dropped here rather than sent
   * as an empty call, so the three answers per id stay lined up with the id
   * that produced them.
   */
  const asked = tokenIds.filter(
    (tokenId) =>
      ownerOfCalldata(tokenId) !== null &&
      poolAndPositionInfoCalldata(tokenId) !== null &&
      positionLiquidityCalldata(tokenId) !== null,
  );

  const batch = await postAggregatedCalls({
    rpcUrl: endpoint,
    fetchImpl,
    timeoutMs,
    calls: [
      { to: V4_POSITION_MANAGER_ADDRESS, data: balanceOf },
      ...asked.flatMap((tokenId) => [
        { to: V4_POSITION_MANAGER_ADDRESS, data: ownerOfCalldata(tokenId) ?? "" },
        { to: V4_POSITION_MANAGER_ADDRESS, data: poolAndPositionInfoCalldata(tokenId) ?? "" },
        { to: V4_POSITION_MANAGER_ADDRESS, data: positionLiquidityCalldata(tokenId) ?? "" },
      ]),
    ],
    codeOf: [V4_POSITION_MANAGER_ADDRESS],
  });
  if (!batch.ok) return unavailable(batch.reason, batch.notice);

  /* The proof before the answers, as with the aggregator one layer down. */
  if (!isV4PositionManagerCode(batch.codes[0], keccak256Hex)) {
    return unavailable("configuration-error", MANAGER_UNVERIFIED);
  }

  const [balanceResult, ...rest] = batch.results;
  const balance = balanceResult?.success === true ? decodeUint(balanceResult.data) : null;
  if (balance === null) return unavailable("invalid-response", UNREADABLE);

  const held = Number(balance);
  if (!Number.isSafeInteger(held) || held < 0) return unavailable("invalid-response", UNREADABLE);

  const { open, read, closed } = collectV4Positions(holder, asked, rest);

  return { status: "success", data: { held, read, open, closed } };
};
