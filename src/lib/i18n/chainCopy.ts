import type { Locale } from "./locales";

/*
 * The words the chain choice needs: the selector's label, and the two things a
 * reader has to be told when a chain cannot be read the way they asked.
 */

export type ChainCopy = {
  /** Beside the network selector under the pool box. */
  readonly network: string;
  /** For a `?chain=` this application does not read. */
  readonly unknown: string;
  /** For a name search on a chain other than mainnet, which only addresses reach for now. */
  readonly searchMainnetOnly: (chain: string) => string;
};

const COPY: Record<Locale, ChainCopy> = {
  en: {
    network: "Network",
    unknown: "LiquidityWise does not read that network. It reads Ethereum, Base and Arbitrum One.",
    searchMainnetOnly: (chain) =>
      `Searching by name works on Ethereum for now. To read a pool on ${chain}, paste its address.`,
  },
  tr: {
    network: "Ağ",
    unknown: "LiquidityWise bu ağı okumuyor. Okuduğu ağlar: Ethereum, Base ve Arbitrum One.",
    searchMainnetOnly: (chain) =>
      `İsimle arama şimdilik yalnızca Ethereum'da çalışıyor. ${chain} üzerindeki bir havuzu okumak için adresini yapıştır.`,
  },
  de: {
    network: "Netzwerk",
    unknown: "LiquidityWise liest dieses Netzwerk nicht. Gelesen werden Ethereum, Base und Arbitrum One.",
    searchMainnetOnly: (chain) =>
      `Die Suche nach Namen funktioniert vorerst nur auf Ethereum. Um einen Pool auf ${chain} zu lesen, füge seine Adresse ein.`,
  },
  es: {
    network: "Red",
    unknown: "LiquidityWise no lee esa red. Lee Ethereum, Base y Arbitrum One.",
    searchMainnetOnly: (chain) =>
      `Por ahora la búsqueda por nombre solo funciona en Ethereum. Para leer un pool en ${chain}, pega su dirección.`,
  },
  ar: {
    network: "الشبكة",
    unknown: "لا يقرأ LiquidityWise هذه الشبكة. الشبكات التي يقرؤها: Ethereum وBase وArbitrum One.",
    searchMainnetOnly: (chain) =>
      `البحث بالاسم يعمل على Ethereum فقط حاليًا. لقراءة تجمّع على ${chain}، الصق عنوانه.`,
  },
  hi: {
    network: "नेटवर्क",
    unknown: "LiquidityWise यह नेटवर्क नहीं पढ़ता। यह Ethereum, Base और Arbitrum One पढ़ता है।",
    searchMainnetOnly: (chain) =>
      `नाम से खोज अभी केवल Ethereum पर काम करती है। ${chain} पर किसी पूल को पढ़ने के लिए उसका पता चिपकाएँ।`,
  },
  zh: {
    network: "网络",
    unknown: "LiquidityWise 不读取该网络。它读取 Ethereum、Base 和 Arbitrum One。",
    searchMainnetOnly: (chain) => `按名称搜索目前只在 Ethereum 上可用。要读取 ${chain} 上的资金池，请粘贴它的地址。`,
  },
  ru: {
    network: "Сеть",
    unknown: "LiquidityWise не читает эту сеть. Он читает Ethereum, Base и Arbitrum One.",
    searchMainnetOnly: (chain) =>
      `Поиск по названию пока работает только в Ethereum. Чтобы прочитать пул в ${chain}, вставьте его адрес.`,
  },
  pt: {
    network: "Rede",
    unknown: "O LiquidityWise não lê essa rede. Ele lê Ethereum, Base e Arbitrum One.",
    searchMainnetOnly: (chain) =>
      `Por enquanto, a busca por nome só funciona na Ethereum. Para ler um pool na ${chain}, cole o endereço dele.`,
  },
  "zh-Hant": {
    network: "網路",
    unknown: "LiquidityWise 不讀取該網路。它讀取 Ethereum、Base 和 Arbitrum One。",
    searchMainnetOnly: (chain) => `按名稱搜尋目前只在 Ethereum 上可用。要讀取 ${chain} 上的資金池，請貼上它的位址。`,
  },
};

export const getChainCopy = (locale: Locale): ChainCopy => COPY[locale];
