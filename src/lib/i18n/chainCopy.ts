import type { Locale } from "./locales";

/*
 * The words the chain choice needs: the selector's label, and what a reader
 * is told when a chain cannot be read.
 */

export type ChainCopy = {
  /** Beside the network selector under the pool box. */
  readonly network: string;
  /** For a `?chain=` this application does not read. */
  readonly unknown: string;
  /** On the v4 page, for a chain whose v3 pools are read and v4 pools are not. */
  readonly v4NotRead: (chain: string) => string;
};

const COPY: Record<Locale, ChainCopy> = {
  en: {
    network: "Network",
    unknown: "LiquidityWise does not read that network. It reads Ethereum, Base and Arbitrum One.",
    v4NotRead: (chain) =>
      `LiquidityWise reads Uniswap v4 pools on Ethereum and Arbitrum One, not yet on ${chain}.`,
  },
  tr: {
    network: "Ağ",
    unknown: "LiquidityWise bu ağı okumuyor. Okuduğu ağlar: Ethereum, Base ve Arbitrum One.",
    v4NotRead: (chain) =>
      `LiquidityWise Uniswap v4 havuzlarını Ethereum ve Arbitrum One üzerinde okuyor, ${chain} üzerinde henüz okumuyor.`,
  },
  de: {
    network: "Netzwerk",
    unknown: "LiquidityWise liest dieses Netzwerk nicht. Gelesen werden Ethereum, Base und Arbitrum One.",
    v4NotRead: (chain) =>
      `LiquidityWise liest Uniswap-v4-Pools auf Ethereum und Arbitrum One, auf ${chain} noch nicht.`,
  },
  es: {
    network: "Red",
    unknown: "LiquidityWise no lee esa red. Lee Ethereum, Base y Arbitrum One.",
    v4NotRead: (chain) =>
      `LiquidityWise lee pools de Uniswap v4 en Ethereum y Arbitrum One, todavía no en ${chain}.`,
  },
  ar: {
    network: "الشبكة",
    unknown: "لا يقرأ LiquidityWise هذه الشبكة. الشبكات التي يقرؤها: Ethereum وBase وArbitrum One.",
    v4NotRead: (chain) =>
      `يقرأ LiquidityWise مجمعات Uniswap v4 على Ethereum وArbitrum One، ولا يقرؤها بعد على ${chain}.`,
  },
  hi: {
    network: "नेटवर्क",
    unknown: "LiquidityWise यह नेटवर्क नहीं पढ़ता। यह Ethereum, Base और Arbitrum One पढ़ता है।",
    v4NotRead: (chain) =>
      `LiquidityWise Ethereum और Arbitrum One पर Uniswap v4 पूल पढ़ता है, ${chain} पर अभी नहीं।`,
  },
  zh: {
    network: "网络",
    unknown: "LiquidityWise 不读取该网络。它读取 Ethereum、Base 和 Arbitrum One。",
    v4NotRead: (chain) =>
      `LiquidityWise 读取 Ethereum 和 Arbitrum One 上的 Uniswap v4 池，尚未读取 ${chain} 上的。`,
  },
  ru: {
    network: "Сеть",
    unknown: "LiquidityWise не читает эту сеть. Он читает Ethereum, Base и Arbitrum One.",
    v4NotRead: (chain) =>
      `LiquidityWise читает пулы Uniswap v4 в Ethereum и Arbitrum One, в ${chain} пока нет.`,
  },
  pt: {
    network: "Rede",
    unknown: "O LiquidityWise não lê essa rede. Ele lê Ethereum, Base e Arbitrum One.",
    v4NotRead: (chain) =>
      `O LiquidityWise lê pools do Uniswap v4 em Ethereum e Arbitrum One, ainda não em ${chain}.`,
  },
  "zh-Hant": {
    network: "網路",
    unknown: "LiquidityWise 不讀取該網路。它讀取 Ethereum、Base 和 Arbitrum One。",
    v4NotRead: (chain) =>
      `LiquidityWise 讀取 Ethereum 和 Arbitrum One 上的 Uniswap v4 池，尚未讀取 ${chain} 上的。`,
  },
};

export const getChainCopy = (locale: Locale): ChainCopy => COPY[locale];
