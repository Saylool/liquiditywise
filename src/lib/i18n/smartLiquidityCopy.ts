import type { Locale } from "./locales";

/*
 * The smart-money page's own words.
 *
 * The page makes one claim — these positions earned the most fees for their
 * size — and the words keep it to that. "Smart" is defined where it is used,
 * in every language, and so is everything the figure leaves out: what a
 * position gave up against holding the two tokens, and anything about the
 * future. A list sorted by yield reads as a tip unless it says otherwise.
 */

export type SmartLiquidityCopy = {
  /** Where the page is linked from. */
  readonly link: string;
  readonly title: string;
  readonly titleOn: (chain: string) => string;
  readonly description: string;
  readonly heading: string;
  readonly intro: (chain: string, pools: string) => string;
  /** How "smart" is decided, and what the figure leaves out. */
  readonly method: (minimum: string, days: string, share: string) => string;
  readonly summary: (measured: string, smart: string, from: string, median: string) => string;
  readonly poolsRead: (read: string, asked: string) => string;
  readonly pairsHeading: string;
  readonly positions: (count: string) => string;
  readonly value: string;
  readonly range: string;
  /** One position's own range. */
  readonly ownRange: string;
  /** A typical range, as how far below and above the price its edges sit. */
  readonly rangeValue: (below: string, above: string) => string;
  readonly medianYield: string;
  readonly topHeading: string;
  readonly owner: string;
  readonly earned: (fees: string, days: string) => string;
  readonly yearly: string;
  readonly ownerPositions: string;
  readonly measuredAt: (time: string) => string;
  /** On a chain whose source keeps no positions. */
  readonly notRead: (chain: string, chains: string) => string;
  readonly unavailable: string;
  readonly empty: string;
  readonly loading: string;
};

const COPY: Record<Locale, SmartLiquidityCopy> = {
  en: {
    link: "Where smart liquidity sits",
    title: "Where the best-earning Uniswap liquidity providers put their money",
    titleOn: (chain) => `Where the best-earning Uniswap v3 liquidity providers on ${chain} put their money`,
    description:
      "The pairs and price ranges of the Uniswap v3 positions that have earned the most fees for their size, measured from the chain. Updated every six hours.",
    heading: "Smart liquidity",
    intro: (chain, pools) =>
      `Which pairs and which ranges the best-earning liquidity on ${chain} sits in right now, among the positions in range in the ${pools} most traded Uniswap v3 pools of the week.`,
    method: (minimum, days, share) =>
      `"Smart" is measured, not assumed: each position's fees since it was last changed, read from the chain, against what it is worth now, per year. Positions under ${minimum}, or changed less than ${days} days ago, are left out as too small or too new to say anything. The ${share} with the highest yield are the smart ones. This is fees only: what a position gave up against simply holding the two tokens is not in it, and none of it says what any position will earn next. Nothing here is a recommendation.`,
    summary: (measured, smart, from, median) =>
      `${measured} positions measured. The smart ones — ${smart} of them — earned at least ${from} a year in fees, against a median of ${median} for all of them.`,
    poolsRead: (read, asked) => `${read} of ${asked} pools could be read this time.`,
    pairsHeading: "Where they are",
    positions: (count) => `Smart positions: ${count}`,
    value: "Worth now",
    range: "Typical range",
    ownRange: "Range",
    rangeValue: (below, above) => `${below} to ${above} around the price`,
    medianYield: "Median fee yield, a year",
    topHeading: "The smart positions",
    owner: "Held by",
    earned: (fees, days) => `${fees} in fees over ${days} days`,
    yearly: "a year",
    ownerPositions: "This address's positions",
    measuredAt: (time) => `Measured ${time}.`,
    notRead: (chain, chains) =>
      `Positions cannot be listed on ${chain}: its data source keeps none. This page reads ${chains}.`,
    unavailable: "The positions could not be measured just now.",
    empty: "No position met the floors this time.",
    loading: "Measuring what each position has earned…",
  },
  tr: {
    link: "Akıllı likidite nerede",
    title: "En çok kazanan Uniswap likidite sağlayıcıları paralarını nereye koyuyor",
    titleOn: (chain) => `${chain} üzerinde en çok kazanan Uniswap v3 likidite sağlayıcıları paralarını nereye koyuyor`,
    description:
      "Büyüklüğüne göre en çok komisyon kazanmış Uniswap v3 pozisyonlarının çiftleri ve fiyat aralıkları, zincirden ölçülerek. Altı saatte bir güncellenir.",
    heading: "Akıllı likidite",
    intro: (chain, pools) =>
      `${chain} üzerinde en çok kazanan likiditenin şu an hangi çiftlerde ve hangi aralıklarda durduğu; haftanın en çok işlem gören ${pools} Uniswap v3 havuzunda aralık içindeki pozisyonlar arasından.`,
    method: (minimum, days, share) =>
      `"Akıllı" varsayılmıyor, ölçülüyor: her pozisyonun son değiştirildiğinden beri kazandığı komisyon zincirden okunuyor ve pozisyonun bugünkü değerine göre yıllığa çevriliyor. ${minimum} altındaki ya da ${days} günden kısa süre önce değiştirilmiş pozisyonlar, bir şey söylemek için fazla küçük ya da fazla yeni oldukları için dışarıda. Verimi en yüksek ${share} akıllı sayılıyor. Bu yalnızca komisyon: pozisyonun iki tokenı elde tutmaya göre kaybettiği bunun içinde değil ve hiçbiri bir pozisyonun bundan sonra ne kazanacağını söylemiyor. Buradaki hiçbir şey bir öneri değil.`,
    summary: (measured, smart, from, median) =>
      `${measured} pozisyon ölçüldü. Akıllı olanlar — ${smart} tanesi — yılda en az ${from} komisyon kazanmış; tümünün medyanı ${median}.`,
    poolsRead: (read, asked) => `Bu sefer ${asked} havuzdan ${read} tanesi okunabildi.`,
    pairsHeading: "Nerede duruyorlar",
    positions: (count) => `${count} akıllı pozisyon`,
    value: "Bugünkü değer",
    range: "Tipik aralık",
    ownRange: "Aralık",
    rangeValue: (below, above) => `fiyatın ${below} ile ${above} çevresi`,
    medianYield: "Medyan komisyon verimi, yıllık",
    topHeading: "Akıllı pozisyonlar",
    owner: "Sahibi",
    earned: (fees, days) => `${days} günde ${fees} komisyon`,
    yearly: "yıllık",
    ownerPositions: "Bu adresin pozisyonları",
    measuredAt: (time) => `Ölçüm: ${time}.`,
    notRead: (chain, chains) =>
      `${chain} üzerinde pozisyonlar listelenemiyor: veri kaynağı hiç pozisyon tutmuyor. Bu sayfa ${chains} ağlarını okuyor.`,
    unavailable: "Pozisyonlar şu an ölçülemedi.",
    empty: "Bu sefer hiçbir pozisyon eşikleri geçmedi.",
    loading: "Her pozisyonun kazancı ölçülüyor…",
  },
  de: {
    link: "Wo die klügste Liquidität liegt",
    title: "Wo die bestverdienenden Uniswap-Liquiditätsanbieter ihr Geld anlegen",
    titleOn: (chain) => `Wo die bestverdienenden Uniswap-v3-Liquiditätsanbieter auf ${chain} ihr Geld anlegen`,
    description:
      "Die Paare und Preisbereiche der Uniswap-v3-Positionen, die für ihre Größe die meisten Gebühren verdient haben, von der Chain gemessen. Alle sechs Stunden aktualisiert.",
    heading: "Kluge Liquidität",
    intro: (chain, pools) =>
      `In welchen Paaren und Bereichen die bestverdienende Liquidität auf ${chain} gerade liegt, unter den Positionen, deren Bereich den Preis einschließt, in den ${pools} meistgehandelten Uniswap-v3-Pools der Woche.`,
    method: (minimum, days, share) =>
      `„Klug" wird gemessen, nicht angenommen: die Gebühren jeder Position seit ihrer letzten Änderung, von der Chain gelesen, gegen ihren heutigen Wert, aufs Jahr gerechnet. Positionen unter ${minimum} oder vor weniger als ${days} Tagen geändert bleiben außen vor, weil sie zu klein oder zu neu sind, um etwas zu sagen. Die ${share} mit der höchsten Rendite sind die klugen. Es sind nur Gebühren: was eine Position gegenüber dem bloßen Halten der beiden Token aufgegeben hat, steckt nicht darin, und nichts davon sagt, was eine Position künftig verdient. Nichts hier ist eine Empfehlung.`,
    summary: (measured, smart, from, median) =>
      `${measured} Positionen gemessen. Die klugen — ${smart} davon — verdienten mindestens ${from} im Jahr an Gebühren, gegenüber einem Median von ${median} für alle.`,
    poolsRead: (read, asked) => `${read} von ${asked} Pools ließen sich diesmal lesen.`,
    pairsHeading: "Wo sie liegen",
    positions: (count) => `${count} kluge Positionen`,
    value: "Heutiger Wert",
    range: "Typischer Bereich",
    ownRange: "Bereich",
    rangeValue: (below, above) => `${below} bis ${above} um den Preis`,
    medianYield: "Median-Gebührenrendite, pro Jahr",
    topHeading: "Die klugen Positionen",
    owner: "Gehalten von",
    earned: (fees, days) => `${fees} an Gebühren in ${days} Tagen`,
    yearly: "pro Jahr",
    ownerPositions: "Positionen dieser Adresse",
    measuredAt: (time) => `Gemessen ${time}.`,
    notRead: (chain, chains) =>
      `Auf ${chain} lassen sich keine Positionen auflisten: ihre Datenquelle führt keine. Diese Seite liest ${chains}.`,
    unavailable: "Die Positionen ließen sich gerade nicht messen.",
    empty: "Diesmal hat keine Position die Schwellen erreicht.",
    loading: "Was jede Position verdient hat, wird gemessen…",
  },
  es: {
    link: "Dónde está la liquidez inteligente",
    title: "Dónde ponen su dinero los proveedores de liquidez de Uniswap que más ganan",
    titleOn: (chain) => `Dónde ponen su dinero los proveedores de liquidez de Uniswap v3 que más ganan en ${chain}`,
    description:
      "Los pares y rangos de precio de las posiciones de Uniswap v3 que más comisiones han ganado para su tamaño, medidos desde la cadena. Se actualiza cada seis horas.",
    heading: "Liquidez inteligente",
    intro: (chain, pools) =>
      `En qué pares y en qué rangos está ahora la liquidez que más gana en ${chain}, entre las posiciones dentro de rango en los ${pools} pools de Uniswap v3 más negociados de la semana.`,
    method: (minimum, days, share) =>
      `"Inteligente" se mide, no se supone: las comisiones de cada posición desde su último cambio, leídas de la cadena, frente a lo que vale ahora, por año. Las posiciones de menos de ${minimum}, o cambiadas hace menos de ${days} días, quedan fuera por ser demasiado pequeñas o demasiado nuevas para decir algo. El ${share} con mayor rendimiento son las inteligentes. Son solo comisiones: lo que una posición cedió frente a simplemente mantener los dos tokens no está incluido, y nada de esto dice lo que una posición ganará después. Nada aquí es una recomendación.`,
    summary: (measured, smart, from, median) =>
      `${measured} posiciones medidas. Las inteligentes — ${smart} de ellas — ganaron al menos ${from} al año en comisiones, frente a una mediana de ${median} para todas.`,
    poolsRead: (read, asked) => `Esta vez se pudieron leer ${read} de ${asked} pools.`,
    pairsHeading: "Dónde están",
    positions: (count) => `${count} posiciones inteligentes`,
    value: "Valor actual",
    range: "Rango típico",
    ownRange: "Rango",
    rangeValue: (below, above) => `de ${below} a ${above} en torno al precio`,
    medianYield: "Rendimiento mediano en comisiones, al año",
    topHeading: "Las posiciones inteligentes",
    owner: "En manos de",
    earned: (fees, days) => `${fees} en comisiones en ${days} días`,
    yearly: "al año",
    ownerPositions: "Posiciones de esta dirección",
    measuredAt: (time) => `Medido ${time}.`,
    notRead: (chain, chains) =>
      `No se pueden listar posiciones en ${chain}: su fuente de datos no guarda ninguna. Esta página lee ${chains}.`,
    unavailable: "No se pudieron medir las posiciones en este momento.",
    empty: "Esta vez ninguna posición superó los umbrales.",
    loading: "Midiendo lo que ha ganado cada posición…",
  },
  ar: {
    link: "أين تقع السيولة الذكية",
    title: "أين يضع مزوّدو السيولة الأعلى ربحًا في Uniswap أموالهم",
    titleOn: (chain) => `أين يضع مزوّدو السيولة الأعلى ربحًا في Uniswap v3 على ${chain} أموالهم`,
    description:
      "أزواج ونطاقات أسعار مراكز Uniswap v3 التي حقّقت أكبر رسوم نسبةً إلى حجمها، مقيسةً من السلسلة. تُحدَّث كل ست ساعات.",
    heading: "السيولة الذكية",
    intro: (chain, pools) =>
      `في أي الأزواج وأي النطاقات تقع السيولة الأعلى ربحًا على ${chain} الآن، من بين المراكز الواقعة داخل النطاق في أكثر ${pools} تجمّعًا تداولًا في Uniswap v3 هذا الأسبوع.`,
    method: (minimum, days, share) =>
      `"الذكاء" هنا يُقاس ولا يُفترض: رسوم كل مركز منذ آخر تغيير له، مقروءة من السلسلة، مقابل قيمته الآن، على أساس سنوي. تُستبعد المراكز التي تقل عن ${minimum} أو التي تغيّرت قبل أقل من ${days} أيام لأنها أصغر أو أحدث من أن تدل على شيء. و${share} الأعلى عائدًا هي المراكز الذكية. هذه رسوم فقط: ما تخلّى عنه المركز مقارنةً بمجرد الاحتفاظ بالرمزين ليس فيها، ولا شيء منها يقول ما سيربحه أي مركز لاحقًا. لا شيء هنا توصية.`,
    summary: (measured, smart, from, median) =>
      `قيس ${measured} مركزًا. المراكز الذكية — ${smart} منها — ربحت ${from} على الأقل سنويًا من الرسوم، مقابل وسيط قدره ${median} لجميعها.`,
    poolsRead: (read, asked) => `أمكن قراءة ${read} من أصل ${asked} تجمّعًا هذه المرة.`,
    pairsHeading: "أين هي",
    positions: (count) => `${count} مراكز ذكية`,
    value: "القيمة الآن",
    range: "النطاق المعتاد",
    ownRange: "النطاق",
    rangeValue: (below, above) => `من ${below} إلى ${above} حول السعر`,
    medianYield: "العائد الوسيط من الرسوم، سنويًا",
    topHeading: "المراكز الذكية",
    owner: "يملكه",
    earned: (fees, days) => `${fees} رسومًا خلال ${days} أيام`,
    yearly: "سنويًا",
    ownerPositions: "مراكز هذا العنوان",
    measuredAt: (time) => `قيس في ${time}.`,
    notRead: (chain, chains) =>
      `لا يمكن سرد المراكز على ${chain}: مصدر بياناتها لا يحتفظ بأي منها. تقرأ هذه الصفحة ${chains}.`,
    unavailable: "تعذّر قياس المراكز الآن.",
    empty: "لم يتجاوز أي مركز الحدود هذه المرة.",
    loading: "جارٍ قياس ما ربحه كل مركز…",
  },
  hi: {
    link: "स्मार्ट लिक्विडिटी कहाँ है",
    title: "सबसे ज़्यादा कमाने वाले Uniswap लिक्विडिटी प्रदाता अपना पैसा कहाँ लगाते हैं",
    titleOn: (chain) => `${chain} पर सबसे ज़्यादा कमाने वाले Uniswap v3 लिक्विडिटी प्रदाता अपना पैसा कहाँ लगाते हैं`,
    description:
      "उन Uniswap v3 पोज़िशनों की जोड़ियाँ और मूल्य-सीमाएँ जिन्होंने अपने आकार के हिसाब से सबसे ज़्यादा शुल्क कमाया, चेन से मापी गईं। हर छह घंटे में अपडेट।",
    heading: "स्मार्ट लिक्विडिटी",
    intro: (chain, pools) =>
      `${chain} पर सबसे ज़्यादा कमाने वाली लिक्विडिटी इस समय किन जोड़ियों और किन सीमाओं में है — इस सप्ताह के ${pools} सबसे अधिक कारोबार वाले Uniswap v3 पूलों में सीमा के भीतर की पोज़िशनों में से।`,
    method: (minimum, days, share) =>
      `"स्मार्ट" माना नहीं जाता, मापा जाता है: हर पोज़िशन का पिछले बदलाव के बाद से कमाया शुल्क, चेन से पढ़ा गया, उसके अभी के मूल्य के मुक़ाबले, सालाना। ${minimum} से छोटी या ${days} दिन से कम पहले बदली गई पोज़िशनें कुछ कहने के लिए बहुत छोटी या बहुत नई होने के कारण बाहर हैं। सबसे ऊँची आय वाली ${share} स्मार्ट मानी जाती हैं। यह केवल शुल्क है: दोनों टोकन यूँ ही रखने की तुलना में पोज़िशन ने जो गँवाया वह इसमें नहीं है, और इसमें से कुछ भी नहीं बताता कि कोई पोज़िशन आगे क्या कमाएगी। यहाँ कुछ भी सिफ़ारिश नहीं है।`,
    summary: (measured, smart, from, median) =>
      `${measured} पोज़िशनें मापी गईं। स्मार्ट पोज़िशनों — ${smart} — ने सालाना कम से कम ${from} शुल्क कमाया, जबकि सबकी माध्यिका ${median} है।`,
    poolsRead: (read, asked) => `इस बार ${asked} में से ${read} पूल पढ़े जा सके।`,
    pairsHeading: "वे कहाँ हैं",
    positions: (count) => `${count} स्मार्ट पोज़िशनें`,
    value: "अभी का मूल्य",
    range: "आम सीमा",
    ownRange: "सीमा",
    rangeValue: (below, above) => `मूल्य के आसपास ${below} से ${above}`,
    medianYield: "माध्यिका शुल्क आय, सालाना",
    topHeading: "स्मार्ट पोज़िशनें",
    owner: "धारक",
    earned: (fees, days) => `${days} दिनों में ${fees} शुल्क`,
    yearly: "सालाना",
    ownerPositions: "इस पते की पोज़िशनें",
    measuredAt: (time) => `मापा गया ${time}.`,
    notRead: (chain, chains) =>
      `${chain} पर पोज़िशनें सूचीबद्ध नहीं की जा सकतीं: उसका डेटा स्रोत कोई पोज़िशन नहीं रखता। यह पृष्ठ ${chains} पढ़ता है।`,
    unavailable: "इस समय पोज़िशनें मापी नहीं जा सकीं।",
    empty: "इस बार कोई पोज़िशन सीमाएँ पार नहीं कर सकी।",
    loading: "हर पोज़िशन की कमाई मापी जा रही है…",
  },
  zh: {
    link: "聪明的流动性在哪里",
    title: "收益最高的 Uniswap 流动性提供者把钱放在哪里",
    titleOn: (chain) => `${chain} 上收益最高的 Uniswap v3 流动性提供者把钱放在哪里`,
    description: "按规模计赚取手续费最多的 Uniswap v3 仓位所在的交易对和价格区间，直接从链上测量。每六小时更新一次。",
    heading: "聪明的流动性",
    intro: (chain, pools) =>
      `${chain} 上收益最高的流动性此刻位于哪些交易对、哪些区间——范围是本周成交最活跃的 ${pools} 个 Uniswap v3 资金池中处于区间内的仓位。`,
    method: (minimum, days, share) =>
      `“聪明”是测出来的，不是假定的：每个仓位自上次变动以来赚取的手续费，从链上读取，除以它现在的价值，再折算成年化。低于 ${minimum} 或不到 ${days} 天前变动过的仓位被排除在外，因为它们太小或太新，说明不了什么。收益最高的 ${share} 被视为聪明的仓位。这里只有手续费：仓位相对于单纯持有两种代币所放弃的部分不在其中，也没有任何一项说明某个仓位今后会赚多少。这里的一切都不是推荐。`,
    summary: (measured, smart, from, median) =>
      `共测量了 ${measured} 个仓位。聪明的仓位——共 ${smart} 个——每年至少赚取 ${from} 的手续费，而全部仓位的中位数是 ${median}。`,
    poolsRead: (read, asked) => `这次 ${asked} 个资金池中有 ${read} 个可以读取。`,
    pairsHeading: "它们在哪里",
    positions: (count) => `${count} 个聪明仓位`,
    value: "当前价值",
    range: "典型区间",
    ownRange: "区间",
    rangeValue: (below, above) => `价格附近 ${below} 至 ${above}`,
    medianYield: "手续费收益中位数，年化",
    topHeading: "聪明的仓位",
    owner: "持有者",
    earned: (fees, days) => `${days} 天内赚取 ${fees} 手续费`,
    yearly: "年化",
    ownerPositions: "该地址的仓位",
    measuredAt: (time) => `测量时间 ${time}。`,
    notRead: (chain, chains) => `${chain} 上无法列出仓位：它的数据源不保存任何仓位。本页读取 ${chains}。`,
    unavailable: "现在无法测量这些仓位。",
    empty: "这次没有仓位达到门槛。",
    loading: "正在测量每个仓位赚了多少…",
  },
  ru: {
    link: "Где стоит умная ликвидность",
    title: "Куда вкладывают деньги самые доходные поставщики ликвидности Uniswap",
    titleOn: (chain) => `Куда вкладывают деньги самые доходные поставщики ликвидности Uniswap v3 в ${chain}`,
    description:
      "Пары и ценовые диапазоны позиций Uniswap v3, заработавших больше всего комиссий для своего размера, измеренные по данным сети. Обновляется каждые шесть часов.",
    heading: "Умная ликвидность",
    intro: (chain, pools) =>
      `В каких парах и в каких диапазонах сейчас стоит самая доходная ликвидность в ${chain} — среди позиций в диапазоне в ${pools} самых торгуемых пулах Uniswap v3 за неделю.`,
    method: (minimum, days, share) =>
      `«Умность» измеряется, а не предполагается: комиссии каждой позиции с её последнего изменения, прочитанные из сети, против её нынешней стоимости, в пересчёте на год. Позиции меньше ${minimum} или изменённые менее ${days} дней назад не учитываются: они слишком малы или слишком новы, чтобы что-то говорить. ${share} с наибольшей доходностью считаются умными. Это только комиссии: то, что позиция потеряла по сравнению с простым хранением двух токенов, сюда не входит, и ничто здесь не говорит, сколько позиция заработает дальше. Ничто здесь не является рекомендацией.`,
    summary: (measured, smart, from, median) =>
      `Измерено позиций: ${measured}. Умные — ${smart} из них — заработали не менее ${from} в год комиссиями, при медиане ${median} по всем.`,
    poolsRead: (read, asked) => `На этот раз удалось прочитать ${read} из ${asked} пулов.`,
    pairsHeading: "Где они стоят",
    positions: (count) => `Умных позиций: ${count}`,
    value: "Стоимость сейчас",
    range: "Типичный диапазон",
    ownRange: "Диапазон",
    rangeValue: (below, above) => `от ${below} до ${above} вокруг цены`,
    medianYield: "Медианная доходность от комиссий, в год",
    topHeading: "Умные позиции",
    owner: "Владелец",
    earned: (fees, days) => `${fees} комиссий за ${days} дн.`,
    yearly: "в год",
    ownerPositions: "Позиции этого адреса",
    measuredAt: (time) => `Измерено ${time}.`,
    notRead: (chain, chains) =>
      `В ${chain} позиции нельзя перечислить: её источник данных их не хранит. Эта страница читает ${chains}.`,
    unavailable: "Сейчас позиции измерить не удалось.",
    empty: "На этот раз ни одна позиция не прошла пороги.",
    loading: "Измеряем, сколько заработала каждая позиция…",
  },
  pt: {
    link: "Onde está a liquidez inteligente",
    title: "Onde os provedores de liquidez da Uniswap que mais ganham colocam seu dinheiro",
    titleOn: (chain) => `Onde os provedores de liquidez da Uniswap v3 que mais ganham na ${chain} colocam seu dinheiro`,
    description:
      "Os pares e faixas de preço das posições da Uniswap v3 que mais ganharam taxas para o seu tamanho, medidos a partir da rede. Atualizado a cada seis horas.",
    heading: "Liquidez inteligente",
    intro: (chain, pools) =>
      `Em quais pares e em quais faixas a liquidez que mais ganha na ${chain} está agora, entre as posições dentro da faixa nos ${pools} pools da Uniswap v3 mais negociados da semana.`,
    method: (minimum, days, share) =>
      `"Inteligente" é medido, não suposto: as taxas de cada posição desde a última alteração, lidas da rede, contra o que ela vale agora, por ano. Posições abaixo de ${minimum}, ou alteradas há menos de ${days} dias, ficam de fora por serem pequenas ou novas demais para dizer algo. Os ${share} com maior rendimento são as inteligentes. São só taxas: o que uma posição abriu mão em relação a simplesmente manter os dois tokens não está incluído, e nada disso diz o que uma posição vai ganhar daqui em diante. Nada aqui é uma recomendação.`,
    summary: (measured, smart, from, median) =>
      `${measured} posições medidas. As inteligentes — ${smart} delas — ganharam pelo menos ${from} por ano em taxas, contra uma mediana de ${median} para todas.`,
    poolsRead: (read, asked) => `Desta vez foi possível ler ${read} de ${asked} pools.`,
    pairsHeading: "Onde elas estão",
    positions: (count) => `${count} posições inteligentes`,
    value: "Valor agora",
    range: "Faixa típica",
    ownRange: "Faixa",
    rangeValue: (below, above) => `de ${below} a ${above} em torno do preço`,
    medianYield: "Rendimento mediano em taxas, por ano",
    topHeading: "As posições inteligentes",
    owner: "Em posse de",
    earned: (fees, days) => `${fees} em taxas em ${days} dias`,
    yearly: "por ano",
    ownerPositions: "Posições deste endereço",
    measuredAt: (time) => `Medido ${time}.`,
    notRead: (chain, chains) =>
      `Não é possível listar posições na ${chain}: a fonte de dados dela não guarda nenhuma. Esta página lê ${chains}.`,
    unavailable: "Não foi possível medir as posições agora.",
    empty: "Desta vez nenhuma posição passou dos limites.",
    loading: "Medindo o que cada posição ganhou…",
  },
  "zh-Hant": {
    link: "聰明的流動性在哪裡",
    title: "收益最高的 Uniswap 流動性提供者把錢放在哪裡",
    titleOn: (chain) => `${chain} 上收益最高的 Uniswap v3 流動性提供者把錢放在哪裡`,
    description: "按規模計賺取手續費最多的 Uniswap v3 倉位所在的交易對和價格區間，直接從鏈上測量。每六小時更新一次。",
    heading: "聰明的流動性",
    intro: (chain, pools) =>
      `${chain} 上收益最高的流動性此刻位於哪些交易對、哪些區間——範圍是本週成交最活躍的 ${pools} 個 Uniswap v3 資金池中處於區間內的倉位。`,
    method: (minimum, days, share) =>
      `「聰明」是測出來的，不是假定的：每個倉位自上次變動以來賺取的手續費，從鏈上讀取，除以它現在的價值，再折算成年化。低於 ${minimum} 或不到 ${days} 天前變動過的倉位被排除在外，因為它們太小或太新，說明不了什麼。收益最高的 ${share} 被視為聰明的倉位。這裡只有手續費：倉位相對於單純持有兩種代幣所放棄的部分不在其中，也沒有任何一項說明某個倉位今後會賺多少。這裡的一切都不是推薦。`,
    summary: (measured, smart, from, median) =>
      `共測量了 ${measured} 個倉位。聰明的倉位——共 ${smart} 個——每年至少賺取 ${from} 的手續費，而全部倉位的中位數是 ${median}。`,
    poolsRead: (read, asked) => `這次 ${asked} 個資金池中有 ${read} 個可以讀取。`,
    pairsHeading: "它們在哪裡",
    positions: (count) => `${count} 個聰明倉位`,
    value: "目前價值",
    range: "典型區間",
    ownRange: "區間",
    rangeValue: (below, above) => `價格附近 ${below} 至 ${above}`,
    medianYield: "手續費收益中位數，年化",
    topHeading: "聰明的倉位",
    owner: "持有者",
    earned: (fees, days) => `${days} 天內賺取 ${fees} 手續費`,
    yearly: "年化",
    ownerPositions: "該地址的倉位",
    measuredAt: (time) => `測量時間 ${time}。`,
    notRead: (chain, chains) => `${chain} 上無法列出倉位：它的資料來源不保存任何倉位。本頁讀取 ${chains}。`,
    unavailable: "現在無法測量這些倉位。",
    empty: "這次沒有倉位達到門檻。",
    loading: "正在測量每個倉位賺了多少…",
  },
};

export const getSmartLiquidityCopy = (locale: Locale): SmartLiquidityCopy => COPY[locale];
