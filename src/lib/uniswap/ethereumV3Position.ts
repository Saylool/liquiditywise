import type { DataFailureNotice, DataFailureReason, DataResult } from "../../schemas";
import { keccak256Hex } from "../crypto/keccak256";
import { decodeAddress } from "./abiWords";
import { postAggregatedCalls } from "./ethereumAggregatedCalls";
import type { FetchLike } from "./v3SubgraphTransport";
import {
  decodePosition,
  FACTORY_SELECTOR,
  isPositionManagerCode,
  positionsCalldata,
  type RawV3Position,
  V3_POSITION_MANAGERS,
} from "./v3PositionManager";
import type { V3ChainId } from "../chains/chains";

/*
 * One Uniswap v3 position, by its token id.
 *
 * The holdings page asks the manager three questions in a row — how many,
 * which ids, what each is (ethereumV3Positions.ts). A share card is asked
 * about one position it already knows the id of, so only the last question
 * is left, and it goes out in one aggregated call with the factory the pool
 * is derived from and the manager's code, which is checked before either
 * answer is believed, exactly as the sweep checks it.
 *
 * **A position that is not there is an answer, not a failure.** `positions`
 * reverts for an id that was never minted or has been burnt, and answers
 * with no liquidity for one that was closed; neither is something the chain
 * failed to say, so both come back as `null` and the caller says there is no
 * such open position. What fails whole is a refused batch, an unproved
 * manager, or a factory that does not decode.
 *
 * Who holds the position is not asked. A card about a position names the
 * position, which is public; the owner's address has no place on it.
 */

const NOT_CONFIGURED = "chain-data-not-configured";
const INVALID_ID = "invalid-pool-address";
const MANAGER_UNVERIFIED = "positions-manager-unverified";
const UNREADABLE = "positions-unreadable";

/** Whole seconds, like the sweep: this read is the first of several a card makes. */
export const DEFAULT_POSITION_TIMEOUT_MS = 10_000;

export type EthereumV3PositionRequest = {
  /** The position's token id, as an exact decimal string. Checked here before anything goes out. */
  readonly tokenId: string;
  /** The chain the endpoint serves, which decides whose manager is asked; mainnet when not said. */
  readonly chainId?: V3ChainId;
  /** Raw environment value; validated here so the wrapper stays free of logic. */
  readonly rpcUrl: string | undefined;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
};

/** What the chain said, before anything is made of it. */
export type RawV3PositionRead = {
  /** The factory the manager reports for itself, which is where the pool comes from. */
  readonly factory: string;
  /** The position, or `null` where the manager holds no open position under that id. */
  readonly position: RawV3Position | null;
};

const unavailable = (reason: DataFailureReason, notice: DataFailureNotice): DataResult<RawV3PositionRead> => ({
  status: "unavailable",
  reason,
  notice,
});

/**
 * Reads one position as the manager holds it now.
 *
 * A reverted `positions` call is one position that is not there rather than a
 * failed read, and so is one whose liquidity is gone: a burnt token is a
 * receipt of a position that was, as the holdings page says of a closed one.
 */
export const fetchEthereumV3Position = async ({
  tokenId,
  chainId = 1,
  rpcUrl,
  fetchImpl,
  timeoutMs = DEFAULT_POSITION_TIMEOUT_MS,
}: EthereumV3PositionRequest): Promise<DataResult<RawV3PositionRead>> => {
  const asked = positionsCalldata(tokenId);
  if (asked === null) return unavailable("invalid-input", INVALID_ID);

  const endpoint = rpcUrl?.trim();
  if (endpoint === undefined || endpoint === "") return unavailable("configuration-error", NOT_CONFIGURED);

  const manager = V3_POSITION_MANAGERS[chainId].address;
  const batch = await postAggregatedCalls({
    rpcUrl: endpoint,
    fetchImpl,
    timeoutMs,
    calls: [
      { to: manager, data: asked },
      { to: manager, data: FACTORY_SELECTOR },
    ],
    codeOf: [manager],
  });
  if (!batch.ok) return unavailable(batch.reason, batch.notice);

  /* The proof before the answers, as with the aggregator one layer down. */
  if (!isPositionManagerCode(batch.codes[0], keccak256Hex, chainId)) {
    return unavailable("configuration-error", MANAGER_UNVERIFIED);
  }

  const [positionResult, factoryResult] = batch.results;
  const factory = factoryResult?.success === true ? decodeAddress(factoryResult.data, 0) : null;
  if (factory === null) return unavailable("invalid-response", UNREADABLE);

  const position = positionResult?.success === true ? decodePosition(tokenId, positionResult.data) : null;

  /* A token whose liquidity is gone is a receipt, not a position. */
  return { status: "success", data: { factory, position: position === null || position.liquidity === "0" ? null : position } };
};
