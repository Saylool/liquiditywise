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
  /** On a v3 page, for a chain whose v4 pools are read and v3 pools are not. */
  readonly v3NotRead: (chain: string) => string;
  /** How a holdings lookup looked, on a chain whose v4 pools alone are read. */
  readonly holdingsV4Only: (tokens: string, v4Pools: string, chain: string) => string;
};

const COPY: Record<Locale, ChainCopy> = {
  en: {
    network: "Network",
    unknown: "LiquidityWise does not read that network. It reads Ethereum, Base, Arbitrum One and Unichain.",
    v4NotRead: (chain) =>
      `LiquidityWise does not read Uniswap v4 pools on ${chain} yet.`,
    v3NotRead: (chain) =>
      `LiquidityWise reads Uniswap v4 pools on ${chain}, not v3 ones: no source for its v3 pools answers.`,
    holdingsV4Only: (tokens, v4Pools, chain) =>
      `A token's balance lives inside the token's own contract, so there is no list of what an address owns — only tokens that can be asked, one at a time. This asked ${tokens} of them: every currency in the ${v4Pools} v4 pools on ${chain} that traded the most over the last seven days, the chain's own ether among them. Something held outside that set is not missing from this page because the address does not hold it.`,
  },
  tr: {
    network: "Ağ",
    unknown: "LiquidityWise bu ağı okumuyor. Okuduğu ağlar: Ethereum, Base, Arbitrum One ve Unichain.",
    v4NotRead: (chain) =>
      `LiquidityWise ${chain} üzerindeki Uniswap v4 havuzlarını henüz okumuyor.`,
    v3NotRead: (chain) =>
      `LiquidityWise ${chain} üzerinde Uniswap v4 havuzlarını okuyor, v3 havuzlarını okumuyor: oradaki v3 havuzları için cevap veren bir kaynak yok.`,
    holdingsV4Only: (tokens, v4Pools, chain) =>
      `Bir tokenın bakiyesi tokenın kendi sözleşmesinin içinde durur; yani bir adresin nelere sahip olduğunun listesi diye bir şey yoktur, yalnızca tek tek sorulabilecek tokenlar vardır. Burada ${tokens} tanesi soruldu: ${chain} üzerinde son yedi günde en çok işlem gören ${v4Pools} v4 havuzundaki para birimlerinin tamamı — zincirin kendi ether'i dahil. Bu kümenin dışında tutulan bir şey, adres onu tutmadığı için değil, sorulmadığı için bu sayfada yok.`,
  },
  de: {
    network: "Netzwerk",
    unknown: "LiquidityWise liest dieses Netzwerk nicht. Gelesen werden Ethereum, Base, Arbitrum One und Unichain.",
    v4NotRead: (chain) =>
      `LiquidityWise liest Uniswap-v4-Pools auf ${chain} noch nicht.`,
    v3NotRead: (chain) =>
      `LiquidityWise liest auf ${chain} Uniswap-v4-Pools, keine v3-Pools: Für seine v3-Pools antwortet keine Quelle.`,
    holdingsV4Only: (tokens, v4Pools, chain) =>
      `Der Bestand eines Tokens liegt im Vertrag des Tokens selbst; es gibt also keine Liste dessen, was eine Adresse besitzt — nur Token, die sich einzeln fragen lassen. Hier wurden ${tokens} davon gefragt: jede Währung in den ${v4Pools} v4-Pools (${chain}) mit dem größten Handel der letzten sieben Tage, das Ether der Chain selbst darunter. Was außerhalb dieser Menge gehalten wird, fehlt auf dieser Seite nicht deshalb, weil die Adresse es nicht hält.`,
  },
  es: {
    network: "Red",
    unknown: "LiquidityWise no lee esa red. Lee Ethereum, Base, Arbitrum One y Unichain.",
    v4NotRead: (chain) =>
      `LiquidityWise todavía no lee pools de Uniswap v4 en ${chain}.`,
    v3NotRead: (chain) =>
      `LiquidityWise lee pools de Uniswap v4 en ${chain}, no de v3: ninguna fuente responde por sus pools v3.`,
    holdingsV4Only: (tokens, v4Pools, chain) =>
      `El saldo de un token vive dentro del contrato del propio token, así que no existe una lista de lo que posee una dirección — solo tokens a los que se puede preguntar, de uno en uno. Aquí se preguntó a ${tokens} de ellos: todas las monedas de los ${v4Pools} pools v4 (${chain}) que más se negociaron en los últimos siete días, el ether propio de la cadena entre ellas. Algo que se tenga fuera de ese conjunto no falta en esta página porque la dirección no lo tenga.`,
  },
  ar: {
    network: "الشبكة",
    unknown: "لا يقرأ LiquidityWise هذه الشبكة. الشبكات التي يقرؤها: Ethereum وBase وArbitrum One وUnichain.",
    v4NotRead: (chain) =>
      `لا يقرأ LiquidityWise مجمعات Uniswap v4 على ${chain} بعد.`,
    v3NotRead: (chain) =>
      `يقرأ LiquidityWise مجمعات Uniswap v4 على ${chain}، لا مجمعات v3: لا يوجد مصدر يجيب عن مجمعات v3 هناك.`,
    holdingsV4Only: (tokens, v4Pools, chain) =>
      `رصيد الرمز موجود داخل عقد الرمز نفسه، فلا توجد قائمة بما يملكه عنوان — بل رموز يمكن سؤالها، واحدًا واحدًا. وقد سُئل هنا ${tokens} منها: كل عملة في تجمّعات v4 الـ ${v4Pools} الأكثر تداولًا على ${chain} خلال الأيام السبعة الماضية، ومنها الإيثر الأصلي للسلسلة. وما يُملك خارج تلك المجموعة ليس غائبًا عن هذه الصفحة لأن العنوان لا يملكه.`,
  },
  hi: {
    network: "नेटवर्क",
    unknown: "LiquidityWise यह नेटवर्क नहीं पढ़ता। यह Ethereum, Base, Arbitrum One और Unichain पढ़ता है।",
    v4NotRead: (chain) =>
      `LiquidityWise अभी ${chain} पर Uniswap v4 पूल नहीं पढ़ता।`,
    v3NotRead: (chain) =>
      `LiquidityWise ${chain} पर Uniswap v4 पूल पढ़ता है, v3 पूल नहीं: वहाँ के v3 पूलों के लिए कोई स्रोत जवाब नहीं देता।`,
    holdingsV4Only: (tokens, v4Pools, chain) =>
      `किसी टोकन का शेष उसी टोकन के अपने कॉन्ट्रैक्ट में रहता है, इसलिए इसकी कोई सूची नहीं होती कि कोई पता क्या रखता है — केवल ऐसे टोकन होते हैं जिनसे एक-एक करके पूछा जा सके। यहाँ उनमें से ${tokens} से पूछा गया: ${chain} पर पिछले सात दिनों में सबसे अधिक कारोबार करने वाले ${v4Pools} v4 पूलों की हर मुद्रा, जिनमें चेन का अपना ether भी है। उस समूह के बाहर रखी कोई चीज़ इस पृष्ठ से इसलिए ग़ायब नहीं है कि पता उसे नहीं रखता।`,
  },
  zh: {
    network: "网络",
    unknown: "LiquidityWise 不读取该网络。它读取 Ethereum、Base、Arbitrum One 和 Unichain。",
    v4NotRead: (chain) =>
      `LiquidityWise 尚未读取 ${chain} 上的 Uniswap v4 池。`,
    v3NotRead: (chain) =>
      `LiquidityWise 在 ${chain} 上读取 Uniswap v4 池，不读取 v3 池：没有数据源能提供那里的 v3 池。`,
    holdingsV4Only: (tokens, v4Pools, chain) =>
      `一个代币的余额存放在这个代币自己的合约里，所以并不存在一份“某地址拥有什么”的清单——只有可以被逐个询问的代币。这次询问了其中 ${tokens} 个：${chain}上最近七天成交最多的 ${v4Pools} 个 v4 资金池里的每一种货币，其中也包括链自己的以太币。持有在这个集合之外的东西，之所以没有出现在这一页上，并不是因为这个地址没有它。`,
  },
  ru: {
    network: "Сеть",
    unknown: "LiquidityWise не читает эту сеть. Он читает Ethereum, Base, Arbitrum One и Unichain.",
    v4NotRead: (chain) =>
      `LiquidityWise пока не читает пулы Uniswap v4 в ${chain}.`,
    v3NotRead: (chain) =>
      `LiquidityWise читает в ${chain} пулы Uniswap v4, но не v3: ни один источник не отвечает за его пулы v3.`,
    holdingsV4Only: (tokens, v4Pools, chain) =>
      `Баланс токена живёт внутри контракта самого токена, поэтому списка того, чем владеет адрес, не существует — есть только токены, которые можно спросить по одному. Спросили ${tokens}: каждую валюту из ${v4Pools} пулов v4 (${chain}), торговавших больше всего за последние семь дней, включая собственный эфир сети. Если что-то держится вне этого набора, оно отсутствует на этой странице не потому, что адрес этого не держит.`,
  },
  pt: {
    network: "Rede",
    unknown: "O LiquidityWise não lê essa rede. Ele lê Ethereum, Base, Arbitrum One e Unichain.",
    v4NotRead: (chain) =>
      `O LiquidityWise ainda não lê pools do Uniswap v4 em ${chain}.`,
    v3NotRead: (chain) =>
      `O LiquidityWise lê pools do Uniswap v4 em ${chain}, não os do v3: nenhuma fonte responde pelos pools v3 de lá.`,
    holdingsV4Only: (tokens, v4Pools, chain) =>
      `O saldo de um token mora dentro do contrato do próprio token, então não existe uma lista do que um endereço possui — só tokens que podem ser perguntados, um de cada vez. Foram perguntados ${tokens} deles: cada moeda dos ${v4Pools} pools v4 (${chain}) que mais negociaram nos últimos sete dias, incluindo o ether da própria rede. Se algo é mantido fora desse conjunto, ele não falta nesta página porque o endereço não o tenha.`,
  },
  "zh-Hant": {
    network: "網路",
    unknown: "LiquidityWise 不讀取該網路。它讀取 Ethereum、Base、Arbitrum One 和 Unichain。",
    v4NotRead: (chain) =>
      `LiquidityWise 尚未讀取 ${chain} 上的 Uniswap v4 池。`,
    v3NotRead: (chain) =>
      `LiquidityWise 在 ${chain} 上讀取 Uniswap v4 池，不讀取 v3 池：沒有資料來源能提供那裡的 v3 池。`,
    holdingsV4Only: (tokens, v4Pools, chain) =>
      `一個代幣的餘額存放在這個代幣自己的合約裡，所以並不存在一份「某地址擁有什麼」的清單——只有可以被逐個詢問的代幣。這次詢問了其中 ${tokens} 個：${chain}上最近七天成交最多的 ${v4Pools} 個 v4 資金池裡的每一種貨幣，其中也包括鏈自己的以太幣。持有在這個集合之外的東西，之所以沒有出現在這一頁上，並不是因為這個地址沒有它。`,
  },
};

export const getChainCopy = (locale: Locale): ChainCopy => COPY[locale];

const SITE_SUFFIX = " · LiquidityWise";

/**
 * A page's title on a chain: the chain named before the site's name, in any
 * language, since every title ends the same way.
 */
export const titleOnChain = (title: string, chainName: string): string =>
  title.endsWith(SITE_SUFFIX)
    ? `${title.slice(0, -SITE_SUFFIX.length)} · ${chainName}${SITE_SUFFIX}`
    : `${title} · ${chainName}`;
