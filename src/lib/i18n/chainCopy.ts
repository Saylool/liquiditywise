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
};

const COPY: Record<Locale, ChainCopy> = {
  en: {
    network: "Network",
    unknown: "LiquidityWise does not read that network. It reads Ethereum, Base and Arbitrum One.",
  },
  tr: {
    network: "Ağ",
    unknown: "LiquidityWise bu ağı okumuyor. Okuduğu ağlar: Ethereum, Base ve Arbitrum One.",
  },
  de: {
    network: "Netzwerk",
    unknown: "LiquidityWise liest dieses Netzwerk nicht. Gelesen werden Ethereum, Base und Arbitrum One.",
  },
  es: {
    network: "Red",
    unknown: "LiquidityWise no lee esa red. Lee Ethereum, Base y Arbitrum One.",
  },
  ar: {
    network: "الشبكة",
    unknown: "لا يقرأ LiquidityWise هذه الشبكة. الشبكات التي يقرؤها: Ethereum وBase وArbitrum One.",
  },
  hi: {
    network: "नेटवर्क",
    unknown: "LiquidityWise यह नेटवर्क नहीं पढ़ता। यह Ethereum, Base और Arbitrum One पढ़ता है।",
  },
  zh: {
    network: "网络",
    unknown: "LiquidityWise 不读取该网络。它读取 Ethereum、Base 和 Arbitrum One。",
  },
  ru: {
    network: "Сеть",
    unknown: "LiquidityWise не читает эту сеть. Он читает Ethereum, Base и Arbitrum One.",
  },
  pt: {
    network: "Rede",
    unknown: "O LiquidityWise não lê essa rede. Ele lê Ethereum, Base e Arbitrum One.",
  },
  "zh-Hant": {
    network: "網路",
    unknown: "LiquidityWise 不讀取該網路。它讀取 Ethereum、Base 和 Arbitrum One。",
  },
};

export const getChainCopy = (locale: Locale): ChainCopy => COPY[locale];
