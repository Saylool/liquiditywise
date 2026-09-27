import { type Token, ZERO_ADDRESS } from "../../schemas";
import { type ChainId, nativeSymbolOf } from "./chains";

const NATIVE_NAMES = { ETH: "Ether", POL: "Polygon Ecosystem Token" } as const;

/**
 * The chain's own currency under the zero address, which is how v4 spells it
 * and what the holdings sweep asks a balance of: ETH everywhere but Polygon,
 * where it is POL. Eighteen decimals on both.
 */
export const nativeCurrencyOn = (chainId: ChainId): Token => ({
  chainId,
  address: ZERO_ADDRESS,
  symbol: nativeSymbolOf(chainId),
  name: NATIVE_NAMES[nativeSymbolOf(chainId)],
  decimals: 18,
});
