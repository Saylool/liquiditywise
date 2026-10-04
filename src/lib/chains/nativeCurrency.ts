import { type Token, ZERO_ADDRESS } from "../../schemas";
import { type ChainId, nativeSymbolOf } from "./chains";

/* Each chain's currency by the name it goes by; the symbol is what the pages show. */
const NATIVE_NAMES = {
  ETH: "Ether",
  POL: "Polygon Ecosystem Token",
  BNB: "BNB",
  AVAX: "Avalanche",
  CELO: "Celo",
} as const;

/**
 * The chain's own currency under the zero address, which is how v4 spells it
 * and what the holdings sweep asks a balance of: ETH on Ethereum and the
 * rollups, POL on Polygon, BNB on BNB Chain, AVAX on Avalanche and CELO on
 * Celo. Eighteen decimals on every one.
 */
export const nativeCurrencyOn = (chainId: ChainId): Token => ({
  chainId,
  address: ZERO_ADDRESS,
  symbol: nativeSymbolOf(chainId),
  name: NATIVE_NAMES[nativeSymbolOf(chainId)],
  decimals: 18,
});
