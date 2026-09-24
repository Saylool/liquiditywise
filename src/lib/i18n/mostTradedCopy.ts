import type { Locale } from "./locales";

/*
 * The most-traded page's own words. Everything it shares with the comparison
 * page — "On Uniswap v3", the hook note, a dynamic fee, the link to a pool's
 * analysis — comes from the dictionary, so the two pages say those things the
 * same way.
 *
 * The introduction says what the order is and what it is not, in every
 * language: a list sorted by volume is read as a leaderboard unless it says
 * otherwise, and this one is not a recommendation of anything.
 */

export type MostTradedCopy = {
  /** Where the page is linked from. */
  readonly link: string;
  readonly title: string;
  readonly description: string;
  readonly heading: string;
  readonly intro: string;
  readonly volume: string;
  readonly fees: string;
  /** Under the figures: how many of the window's days they add up. */
  readonly days: (counted: string, total: string) => string;
  readonly feesUnknown: string;
  readonly unavailable: string;
  readonly empty: string;
  readonly loading: string;
};

const COPY: Record<Locale, MostTradedCopy> = {
  en: {
    link: "Most traded pools",
    title: "The most traded Uniswap pools this week, on v3 and v4",
    description:
      "The Uniswap v3 and v4 pools on Ethereum with the most trading over the last seven days, with what each traded and charged. Updated every ten minutes.",
    heading: "Most traded this week",
    intro:
      "The pools with the most trading on Ethereum over the last seven days, today so far included. The order is trading volume and nothing else: it is not what a position would have earned, and none of these is a recommendation. Each pool's own page shows the rest.",
    volume: "Traded, 7 days",
    fees: "Fees charged, 7 days",
    days: (counted, total) => `${counted} of ${total} days`,
    feesUnknown: "could not be read",
    unavailable: "This week's pools could not be read just now.",
    empty: "No pool traded in this window.",
    loading: "Reading this week's busiest pools…",
  },
  tr: {
    link: "En çok işlem gören havuzlar",
    title: "Bu hafta en çok işlem gören Uniswap havuzları, v3 ve v4",
    description:
      "Ethereum'da son yedi günde en çok işlem gören Uniswap v3 ve v4 havuzları; her birinin işlem hacmi ve aldığı komisyon. On dakikada bir güncellenir.",
    heading: "Bu hafta en çok işlem görenler",
    intro:
      "Ethereum'da son yedi günde, bugün dahil, en çok işlem gören havuzlar. Sıralama yalnızca işlem hacmine göre: bir pozisyonun ne kazanacağını göstermez ve hiçbiri bir öneri değildir. Geri kalanı her havuzun kendi sayfasında.",
    volume: "İşlem hacmi, 7 gün",
    fees: "Alınan komisyon, 7 gün",
    days: (counted, total) => `${counted} / ${total} gün`,
    feesUnknown: "okunamadı",
    unavailable: "Bu haftanın havuzları şu an okunamadı.",
    empty: "Bu aralıkta işlem gören havuz yok.",
    loading: "Bu haftanın en işlek havuzları okunuyor…",
  },
  de: {
    link: "Meistgehandelte Pools",
    title: "Die meistgehandelten Uniswap-Pools dieser Woche, auf v3 und v4",
    description:
      "Die Uniswap-v3- und -v4-Pools auf Ethereum mit dem meisten Handel der letzten sieben Tage, mit Volumen und erhobenen Gebühren. Alle zehn Minuten aktualisiert.",
    heading: "Diese Woche am meisten gehandelt",
    intro:
      "Die Pools mit dem meisten Handel auf Ethereum in den letzten sieben Tagen, der heutige Tag bis jetzt eingeschlossen. Sortiert ist allein nach Handelsvolumen: Das ist nicht, was eine Position verdient hätte, und keiner davon ist eine Empfehlung. Den Rest zeigt die Seite jedes Pools.",
    volume: "Gehandelt, 7 Tage",
    fees: "Erhobene Gebühren, 7 Tage",
    days: (counted, total) => `${counted} von ${total} Tagen`,
    feesUnknown: "nicht lesbar",
    unavailable: "Die Pools dieser Woche konnten gerade nicht gelesen werden.",
    empty: "In diesem Zeitraum wurde in keinem Pool gehandelt.",
    loading: "Die Pools mit dem meisten Handel dieser Woche werden gelesen…",
  },
  es: {
    link: "Pools más negociados",
    title: "Los pools de Uniswap más negociados esta semana, en v3 y v4",
    description:
      "Los pools de Uniswap v3 y v4 en Ethereum con más volumen en los últimos siete días, con lo que negoció y cobró cada uno. Se actualiza cada diez minutos.",
    heading: "Los más negociados esta semana",
    intro:
      "Los pools con más volumen en Ethereum en los últimos siete días, incluido lo que va de hoy. El orden es solo por volumen: no es lo que habría ganado una posición, y ninguno es una recomendación. La página de cada pool muestra el resto.",
    volume: "Volumen, 7 días",
    fees: "Comisiones cobradas, 7 días",
    days: (counted, total) => `${counted} de ${total} días`,
    feesUnknown: "no se pudo leer",
    unavailable: "Los pools de esta semana no se pudieron leer ahora.",
    empty: "Ningún pool tuvo operaciones en este periodo.",
    loading: "Leyendo los pools más activos de esta semana…",
  },
  ar: {
    link: "التجمّعات الأكثر تداولًا",
    title: "تجمّعات Uniswap الأكثر تداولًا هذا الأسبوع، على v3 وv4",
    description:
      "تجمّعات Uniswap v3 وv4 على Ethereum الأكثر تداولًا خلال الأيام السبعة الماضية، مع حجم تداول كل منها والرسوم التي حصّلها. يُحدَّث كل عشر دقائق.",
    heading: "الأكثر تداولًا هذا الأسبوع",
    intro:
      "التجمّعات الأكثر تداولًا على Ethereum خلال الأيام السبعة الماضية، بما فيها ما مضى من اليوم. الترتيب حسب حجم التداول وحده: ليس ما كان سيكسبه مركز، ولا شيء منها توصية. وصفحة كل تجمّع تعرض الباقي.",
    volume: "حجم التداول، 7 أيام",
    fees: "الرسوم المحصّلة، 7 أيام",
    days: (counted, total) => `${counted} من ${total} أيام`,
    feesUnknown: "تعذّرت قراءتها",
    unavailable: "تعذّرت قراءة تجمّعات هذا الأسبوع الآن.",
    empty: "لم يُتداول في أي تجمّع خلال هذه الفترة.",
    loading: "جارٍ قراءة أنشط تجمّعات هذا الأسبوع…",
  },
  hi: {
    link: "सबसे ज़्यादा कारोबार वाले पूल",
    title: "इस हफ़्ते सबसे ज़्यादा कारोबार वाले Uniswap पूल, v3 और v4 पर",
    description:
      "Ethereum पर पिछले सात दिनों में सबसे ज़्यादा कारोबार वाले Uniswap v3 और v4 पूल, हर एक का कारोबार और लिया गया शुल्क। हर दस मिनट में अपडेट।",
    heading: "इस हफ़्ते सबसे ज़्यादा कारोबार",
    intro:
      "Ethereum पर पिछले सात दिनों में, आज का अब तक का समय मिलाकर, सबसे ज़्यादा कारोबार वाले पूल। क्रम केवल कारोबार की मात्रा का है: यह वह नहीं है जो कोई पोज़िशन कमाती, और इनमें से कोई सिफ़ारिश नहीं है। बाकी हर पूल के अपने पन्ने पर है।",
    volume: "कारोबार, 7 दिन",
    fees: "लिया गया शुल्क, 7 दिन",
    days: (counted, total) => `${total} में से ${counted} दिन`,
    feesUnknown: "पढ़ा नहीं जा सका",
    unavailable: "इस हफ़्ते के पूल अभी पढ़े नहीं जा सके।",
    empty: "इस अवधि में किसी पूल में कारोबार नहीं हुआ।",
    loading: "इस हफ़्ते के सबसे व्यस्त पूल पढ़े जा रहे हैं…",
  },
  zh: {
    link: "交易最活跃的资金池",
    title: "本周交易最活跃的 Uniswap 资金池（v3 与 v4）",
    description: "Ethereum 上过去七天交易量最大的 Uniswap v3 和 v4 资金池，以及每个池的交易量和收取的手续费。每十分钟更新一次。",
    heading: "本周交易最活跃",
    intro:
      "Ethereum 上过去七天（含今天截至目前）交易量最大的资金池。排序只看交易量：它不是一个仓位本来能赚多少，其中任何一个都不是推荐。其余内容见每个资金池自己的页面。",
    volume: "交易量，7 天",
    fees: "收取的手续费，7 天",
    days: (counted, total) => `${total} 天中的 ${counted} 天`,
    feesUnknown: "无法读取",
    unavailable: "本周的资金池暂时无法读取。",
    empty: "这段时间内没有资金池发生交易。",
    loading: "正在读取本周最活跃的资金池…",
  },
  ru: {
    link: "Самые торгуемые пулы",
    title: "Самые торгуемые пулы Uniswap на этой неделе, в v3 и v4",
    description:
      "Пулы Uniswap v3 и v4 в Ethereum с наибольшим объёмом торгов за последние семь дней — с объёмом и взятыми комиссиями каждого. Обновляется каждые десять минут.",
    heading: "Больше всего торгов на этой неделе",
    intro:
      "Пулы с наибольшим объёмом торгов в Ethereum за последние семь дней, включая сегодняшний день на текущий момент. Порядок — только по объёму: это не то, что заработала бы позиция, и ни один из них не рекомендация. Остальное — на странице каждого пула.",
    volume: "Объём, 7 дней",
    fees: "Взятые комиссии, 7 дней",
    days: (counted, total) => `${counted} из ${total} дней`,
    feesUnknown: "не удалось прочитать",
    unavailable: "Пулы этой недели сейчас не удалось прочитать.",
    empty: "За этот период ни в одном пуле не было торгов.",
    loading: "Читаем самые активные пулы этой недели…",
  },
  pt: {
    link: "Pools mais negociados",
    title: "Os pools da Uniswap mais negociados nesta semana, no v3 e no v4",
    description:
      "Os pools da Uniswap v3 e v4 na Ethereum com mais volume nos últimos sete dias, com o que cada um negociou e cobrou. Atualizado a cada dez minutos.",
    heading: "Os mais negociados nesta semana",
    intro:
      "Os pools com mais volume na Ethereum nos últimos sete dias, incluindo o dia de hoje até agora. A ordem é só por volume: não é o que uma posição teria ganho, e nenhum deles é uma recomendação. A página de cada pool mostra o resto.",
    volume: "Volume, 7 dias",
    fees: "Taxas cobradas, 7 dias",
    days: (counted, total) => `${counted} de ${total} dias`,
    feesUnknown: "não foi possível ler",
    unavailable: "Não foi possível ler os pools desta semana agora.",
    empty: "Nenhum pool teve negociação neste período.",
    loading: "Lendo os pools mais movimentados desta semana…",
  },
  "zh-Hant": {
    link: "交易最活躍的資金池",
    title: "本週交易最活躍的 Uniswap 資金池（v3 與 v4）",
    description: "Ethereum 上過去七天交易量最大的 Uniswap v3 和 v4 資金池，以及每個池的交易量和收取的手續費。每十分鐘更新一次。",
    heading: "本週交易最活躍",
    intro:
      "Ethereum 上過去七天（含今天截至目前）交易量最大的資金池。排序只看交易量：它不是一個倉位本來能賺多少，其中任何一個都不是推薦。其餘內容見每個資金池自己的頁面。",
    volume: "交易量，7 天",
    fees: "收取的手續費，7 天",
    days: (counted, total) => `${total} 天中的 ${counted} 天`,
    feesUnknown: "無法讀取",
    unavailable: "本週的資金池暫時無法讀取。",
    empty: "這段時間內沒有資金池發生交易。",
    loading: "正在讀取本週最活躍的資金池…",
  },
};

export const getMostTradedCopy = (locale: Locale): MostTradedCopy => COPY[locale];
