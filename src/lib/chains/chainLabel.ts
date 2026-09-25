import { getInterfaceCopy } from "../i18n/interface";
import type { Locale } from "../i18n/locales";
import { chainById, isSupportedChainId } from "./chains";

/**
 * A chain's name as a reader should see it: mainnet in the interface's own
 * words for it ("Ethereum ana ağı"), the others by the name they go by in
 * every language.
 */
export const chainLabel = (chainId: number, locale: Locale): string =>
  chainId === 1 || !isSupportedChainId(chainId) ? getInterfaceCopy(locale).chain : chainById(chainId).name;
