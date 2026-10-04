import { z } from "zod";

import type { V4ChainId } from "../chains/chains";
import type { FetchLike } from "../uniswap/v3SubgraphTransport";
import { getPublicJson, type PublicJsonAnswer } from "./publicJson";
import {
  contractNameOf,
  type ProxyReading,
  type SourceAnswer,
  unanswered,
  unansweredStatus,
} from "./sourceAnswer";

/*
 * The network's own Blockscout: whether it holds verified source for a
 * contract, what that source calls it, and whether it is a proxy.
 *
 * Every network a v4 pool is read on has a public instance, and each was
 * asked about Uniswap's own PoolManager there on 2026-10-04 and answered
 * `is_verified: true`, `name: "PoolManager"`. OP Mainnet's lives at
 * explorer.optimism.io: optimism.blockscout.com answers with a 301 to it, so
 * it is asked directly rather than through the redirect.
 *
 * **`/api/v2/addresses/{address}`, not `/api/v2/smart-contracts/{address}`.**
 * Both say `is_verified` and `name`. The second also sends the whole verified
 * source — 30 to 610 KB per hook on mainnet, measured — to read two fields;
 * the first is under a kilobyte and was as fast or faster on every network.
 * It also answers 200 for an address it has never seen (`is_verified: false`),
 * where the other answers 404, so "not verified" has one shape here.
 *
 * `name` is read only where `is_verified` is true. For an unverified address
 * Blockscout may still fill it — from a tag or a token, measured on a Steer
 * hook on Unichain — and that is a label, not a name from published source.
 *
 * Measured the same day: 0.15 to 3.3 seconds, the slowest on Unichain, where
 * some addresses take three seconds every time they are asked.
 */

export const BLOCKSCOUT_HOSTS = {
  1: "eth.blockscout.com",
  8453: "base.blockscout.com",
  42161: "arbitrum.blockscout.com",
  130: "unichain.blockscout.com",
  10: "explorer.optimism.io",
  137: "polygon.blockscout.com",
} as const satisfies Record<V4ChainId, string>;

/** Above Unichain's measured three seconds, with room; below anything a reader should wait on. */
export const BLOCKSCOUT_TIMEOUT_MS = 5_000;

/** Non-strict: an address answer carries thirty fields and four are read. */
const AddressSchema = z.object({
  is_verified: z.boolean().nullable(),
  name: z.unknown(),
  /** `"eip1967"`, `"eip1967_beacon"`, `"eip1167"` and others, or null for none. */
  proxy_type: z.string().nullish(),
  implementations: z.array(z.object({ name: z.unknown() })).nullish(),
});

/** How Blockscout answers a path or an address it has no entry for, rather than an error page in front of it. */
const NotFoundSchema = z.object({ message: z.literal("Not found") });

export const blockscoutAddressUrl = (chainId: V4ChainId, address: string): string =>
  `https://${BLOCKSCOUT_HOSTS[chainId]}/api/v2/addresses/${address}`;

/** Where a reader can read the verified source for themselves. */
export const blockscoutPage = (chainId: V4ChainId, address: string): string =>
  `https://${BLOCKSCOUT_HOSTS[chainId]}/address/${address}?tab=contract`;

const proxyOf = (
  proxyType: string | null | undefined,
  implementations: readonly { readonly name: unknown }[] | null | undefined,
): ProxyReading | null =>
  proxyType === null || proxyType === undefined || proxyType === ""
    ? null
    : { implementation: contractNameOf(implementations?.[0]?.name) };

/** Pure: one answer from Blockscout, read. */
export const readBlockscoutAnswer = (answer: PublicJsonAnswer): SourceAnswer => {
  if (!answer.answered) return unanswered(answer.why);

  if (answer.status === 200) {
    const parsed = AddressSchema.safeParse(answer.body);
    if (!parsed.success) return unanswered("unreadable");

    const { is_verified: verified, name, proxy_type: proxyType, implementations } = parsed.data;
    const proxy = proxyOf(proxyType, implementations);

    return verified === true
      ? { kind: "verified", name: contractNameOf(name), proxy }
      : { kind: "unverified", proxy };
  }

  /* Not this endpoint's way of saying "no contract", but an instance that has never indexed the address may say it. */
  if (answer.status === 404) {
    return NotFoundSchema.safeParse(answer.body).success ? { kind: "unverified", proxy: null } : unanswered("unreadable");
  }

  return unanswered(unansweredStatus(answer.status));
};

export type BlockscoutRequest = {
  readonly chainId: V4ChainId;
  /** Lower-cased, `0x` and forty hex characters; the caller has checked. */
  readonly address: string;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
};

/** Asks the network's Blockscout about one address. Never throws. */
export const fetchBlockscoutAnswer = async ({
  chainId,
  address,
  fetchImpl,
  timeoutMs = BLOCKSCOUT_TIMEOUT_MS,
}: BlockscoutRequest): Promise<SourceAnswer> =>
  readBlockscoutAnswer(await getPublicJson(blockscoutAddressUrl(chainId, address), { fetchImpl, timeoutMs }));
