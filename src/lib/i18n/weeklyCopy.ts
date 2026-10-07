import type { Locale } from "./locales";

/*
 * The weekly page's own words: the Monday digest, as a page anybody can open.
 *
 * Only the frame is here — what the page is, which week it read, what to say
 * when there is no week yet or a quiet one, and where to go next. The digest
 * itself — the headings over the movers and the ranges, each line of them,
 * and the note that it is a measurement and not a suggestion — is written in
 * the dictionary's `telegram.weekly*` strings and shown here unchanged, so the
 * page and the message a chat gets on Monday say the same thing in the same
 * words. Those strings already follow the smart-money page's terms in every
 * language (messages.test.ts holds them to it), and so does what is here:
 * "smart money", "typical range", "measured", each as that page says it.
 */

export type WeeklyCopy = {
  /** Where the page is linked from: the footer and the front page. */
  readonly link: string;
  readonly title: string;
  readonly titleOn: (chain: string) => string;
  readonly description: string;
  readonly heading: string;
  readonly intro: (chain: string) => string;
  /** The week read: the first measurement compared, the latest, and the days between. */
  readonly window: (from: string, to: string, days: string) => string;
  /** Before a day of measurements is kept on a chain. */
  readonly notYet: (chain: string) => string;
  /** A week in which nothing moved enough to name. */
  readonly quiet: string;
  /** The pairs whose smart positions' median earns the most. */
  readonly topHeading: string;
  readonly topYield: (yearlyYield: string, positions: string) => string;
  /** The link to the smart-money page on the same chain. */
  readonly detail: string;
  /** That the bot sends the same digest, and what to send it. */
  readonly bot: string;
  /** When the kept series could not be read. */
  readonly unavailable: string;
  readonly loading: string;
};

const COPY: Record<Locale, WeeklyCopy> = {
  en: {
    link: "The week in smart liquidity",
    title: "Where the smart money moved this week",
    titleOn: (chain) => `Where the smart money on ${chain} moved this week`,
    description:
      "The week's digest of the best-earning Uniswap v3 liquidity: the pairs gaining and losing a share of it, and the typical ranges that shifted, measured from the chain. The same digest the Telegram bot sends every Monday.",
    heading: "The week's digest",
    intro: (chain) =>
      `Where the smart money on ${chain} moved over the week — the pairs gaining and losing a share of it, and the typical ranges that shifted — read off the measurements the smart-liquidity page keeps, four a day.`,
    window: (from, to, days) => `From ${from} to ${to}: ${days} days between the first measurement compared and the latest.`,
    notYet: (chain) => `There is not yet a day of measurements on ${chain} to compare. The digest appears once there is.`,
    quiet: "No pair's share of the smart money and no typical range moved enough this week to name.",
    topHeading: "Highest median fee yield",
    topYield: (yearlyYield, positions) => `${yearlyYield} a year, the median of ${positions} smart positions`,
    detail: "The full picture, pair by pair, on the smart-liquidity page",
    bot: "The Telegram bot sends this digest every Monday to any chat that asked for it with /weekly.",
    unavailable: "The kept measurements could not be read just now.",
    loading: "Reading the week's measurements…",
  },
  tr: {
    link: "Akıllı likiditede bu hafta",
    title: "Akıllı para bu hafta nereye kaydı",
    titleOn: (chain) => `${chain} üzerinde akıllı para bu hafta nereye kaydı`,
    description:
      "En çok kazanan Uniswap v3 likiditesinin haftalık özeti: akıllı paradaki payı artan ve azalan pariteler ile kayan tipik aralıklar, zincirden ölçülerek. Telegram botunun her pazartesi gönderdiği özetin aynısı.",
    heading: "Haftalık özet",
    intro: (chain) =>
      `${chain} üzerinde akıllı para hafta boyunca nereye kaydı — akıllı paradan pay kazanan ve kaybeden pariteler ile kayan tipik aralıklar — akıllı likidite sayfasının günde dört kez sakladığı ölçümlerden okunarak.`,
    window: (from, to, days) => `${from} ile ${to} arası: karşılaştırılan ilk ölçümle sonuncusu arasında ${days} gün.`,
    notYet: (chain) => `${chain} üzerinde karşılaştırılacak bir günlük ölçüm henüz yok. Özet, bir gün saklanınca görünür.`,
    quiet: "Bu hafta hiçbir paritenin akıllı paradaki payı ve hiçbir tipik aralık adını anmaya yetecek kadar kaymadı.",
    topHeading: "En yüksek medyan komisyon verimi",
    topYield: (yearlyYield, positions) => `yıllık ${yearlyYield}, ${positions} akıllı pozisyonun medyanı`,
    detail: "Tamamı, parite parite, akıllı likidite sayfasında",
    bot: "Telegram botu bu özeti her pazartesi, /weekly ile isteyen her sohbete gönderir.",
    unavailable: "Saklanan ölçümler şu an okunamadı.",
    loading: "Haftanın ölçümleri okunuyor…",
  },
  de: {
    link: "Die Woche der klugen Liquidität",
    title: "Wohin sich das kluge Geld diese Woche bewegt hat",
    titleOn: (chain) => `Wohin sich das kluge Geld auf ${chain} diese Woche bewegt hat`,
    description:
      "Der Wochenüberblick über die bestverdienende Uniswap-v3-Liquidität: die Paare, die einen Anteil daran gewinnen und verlieren, und die typischen Bereiche, die sich verschoben haben, von der Chain gemessen. Derselbe Überblick, den der Telegram-Bot jeden Montag schickt.",
    heading: "Der Wochenüberblick",
    intro: (chain) =>
      `Wohin sich das kluge Geld auf ${chain} in der Woche bewegt hat — die Paare, die einen Anteil daran gewinnen und verlieren, und die typischen Bereiche, die sich verschoben haben — abgelesen an den Messungen, die die Seite zur klugen Liquidität viermal täglich speichert.`,
    window: (from, to, days) => `Von ${from} bis ${to}: ${days} Tage zwischen der ersten verglichenen Messung und der letzten.`,
    notYet: (chain) => `Auf ${chain} liegt noch kein Tag an Messungen zum Vergleichen vor. Der Überblick erscheint, sobald es einen gibt.`,
    quiet: "Diese Woche hat sich weder der Anteil eines Paares am klugen Geld noch ein typischer Bereich so weit bewegt, dass es zu nennen wäre.",
    topHeading: "Höchste Median-Gebührenrendite",
    topYield: (yearlyYield, positions) => `${yearlyYield} pro Jahr, der Median von ${positions} klugen Positionen`,
    detail: "Das ganze Bild, Paar für Paar, auf der Seite zur klugen Liquidität",
    bot: "Der Telegram-Bot schickt diesen Überblick jeden Montag an jeden Chat, der ihn mit /weekly bestellt hat.",
    unavailable: "Die gespeicherten Messungen ließen sich gerade nicht lesen.",
    loading: "Die Messungen der Woche werden gelesen…",
  },
  es: {
    link: "La semana en liquidez inteligente",
    title: "Adónde se movió el dinero inteligente esta semana",
    titleOn: (chain) => `Adónde se movió el dinero inteligente en ${chain} esta semana`,
    description:
      "El resumen semanal de la liquidez de Uniswap v3 que más gana: los pares que ganan y pierden parte de ella y los rangos típicos que se desplazaron, medidos en la cadena. El mismo resumen que el bot de Telegram envía cada lunes.",
    heading: "El resumen de la semana",
    intro: (chain) =>
      `Adónde se movió el dinero inteligente en ${chain} durante la semana — los pares que ganan y pierden parte de él y los rangos típicos que se desplazaron — leído de las mediciones que la página de liquidez inteligente guarda cuatro veces al día.`,
    window: (from, to, days) => `De ${from} a ${to}: ${days} días entre la primera medición comparada y la última.`,
    notYet: (chain) => `Todavía no hay un día de mediciones en ${chain} que comparar. El resumen aparece cuando lo haya.`,
    quiet: "Esta semana ni la parte de ningún par en el dinero inteligente ni ningún rango típico se movieron lo bastante para nombrarlos.",
    topHeading: "Mayor rendimiento mediano en comisiones",
    topYield: (yearlyYield, positions) => `${yearlyYield} al año, la mediana de ${positions} posiciones inteligentes`,
    detail: "El cuadro completo, par por par, en la página de liquidez inteligente",
    bot: "El bot de Telegram envía este resumen cada lunes a cualquier chat que lo pidió con /weekly.",
    unavailable: "No se pudieron leer las mediciones guardadas en este momento.",
    loading: "Leyendo las mediciones de la semana…",
  },
  /*
   * The dates and figures the Arabic sentences take are Latin digits and lay
   * out left to right inside the right-to-left line, as they do on the
   * smart-money page; the arrows between figures come from the dictionary's
   * weekly strings, which already point right for that reason.
   */
  ar: {
    link: "أسبوع السيولة الذكية",
    title: "إلى أين انتقل المال الذكي هذا الأسبوع",
    titleOn: (chain) => `إلى أين انتقل المال الذكي على ${chain} هذا الأسبوع`,
    description:
      "الملخص الأسبوعي للسيولة الأعلى ربحًا في Uniswap v3: الأزواج التي تكسب حصة منها والتي تفقدها، والنطاقات المعتادة التي انتقلت، مقيسة على السلسلة. وهو الملخص نفسه الذي يرسله بوت تيليغرام كل يوم اثنين.",
    heading: "ملخص الأسبوع",
    intro: (chain) =>
      `إلى أين انتقل المال الذكي على ${chain} خلال الأسبوع — الأزواج التي تكسب حصة منه والتي تفقدها، والنطاقات المعتادة التي انتقلت — مقروءًا من القياسات التي تحفظها صفحة السيولة الذكية أربع مرات في اليوم.`,
    window: (from, to, days) => `من ${from} إلى ${to}: ${days} أيام بين أول قياس قورن وآخره.`,
    notYet: (chain) => `لا يوجد بعد يوم من القياسات على ${chain} للمقارنة. يظهر الملخص متى وُجد.`,
    quiet: "هذا الأسبوع لم تنتقل حصة أي زوج من المال الذكي ولا أي نطاق معتاد بما يكفي لذكره.",
    topHeading: "أعلى عائد وسيط من الرسوم",
    topYield: (yearlyYield, positions) => `${yearlyYield} سنويًا، الوسيط لـ ${positions} مراكز ذكية`,
    detail: "الصورة كاملة، زوجًا زوجًا، في صفحة السيولة الذكية",
    bot: "يرسل بوت تيليغرام هذا الملخص كل يوم اثنين إلى أي محادثة طلبته بالأمر /weekly.",
    unavailable: "تعذّرت قراءة القياسات المحفوظة الآن.",
    loading: "تُقرأ قياسات الأسبوع…",
  },
  hi: {
    link: "स्मार्ट तरलता का यह हफ़्ता",
    title: "इस हफ़्ते स्मार्ट पैसा कहाँ खिसका",
    titleOn: (chain) => `${chain} पर इस हफ़्ते स्मार्ट पैसा कहाँ खिसका`,
    description:
      "सबसे ज़्यादा कमाने वाली Uniswap v3 तरलता का साप्ताहिक सारांश: कौन-सी जोड़ियाँ उसमें हिस्सा पा रही हैं और कौन-सी खो रही हैं, और कौन-से आम दायरे खिसके — चेन से मापा हुआ। वही सारांश जो Telegram बॉट हर सोमवार भेजता है।",
    heading: "हफ़्ते का सारांश",
    intro: (chain) =>
      `${chain} पर हफ़्ते भर में स्मार्ट पैसा कहाँ खिसका — कौन-सी जोड़ियाँ उसमें हिस्सा पा रही हैं और कौन-सी खो रही हैं, और कौन-से आम दायरे खिसके — उन मापों से पढ़ा हुआ जो स्मार्ट तरलता पृष्ठ दिन में चार बार रखता है।`,
    window: (from, to, days) => `${from} से ${to} तक: तुलना किए गए पहले माप और आख़िरी के बीच ${days} दिन।`,
    notYet: (chain) => `${chain} पर तुलना के लिए अभी एक दिन के माप नहीं हैं। जैसे ही होंगे, सारांश दिखेगा।`,
    quiet: "इस हफ़्ते न किसी जोड़ी का स्मार्ट पैसे में हिस्सा और न कोई आम दायरा इतना खिसका कि उसका नाम लिया जाए।",
    topHeading: "सबसे ऊँची माध्यिका शुल्क आय",
    topYield: (yearlyYield, positions) => `सालाना ${yearlyYield}, ${positions} स्मार्ट पोज़िशनों की माध्यिका`,
    detail: "पूरी तस्वीर, जोड़ी-दर-जोड़ी, स्मार्ट तरलता पृष्ठ पर",
    bot: "Telegram बॉट यह सारांश हर सोमवार उस हर चैट को भेजता है जिसने /weekly से इसे माँगा है।",
    unavailable: "रखे गए माप इस समय पढ़े नहीं जा सके।",
    loading: "हफ़्ते के माप पढ़े जा रहे हैं…",
  },
  zh: {
    link: "聪明的流动性：本周",
    title: "本周聪明资金流向了哪里",
    titleOn: (chain) => `本周 ${chain} 上的聪明资金流向了哪里`,
    description:
      "收益最高的 Uniswap v3 流动性的每周摘要：哪些交易对有聪明资金流入、哪些流出，以及哪些典型区间移动了，直接从链上测量。与 Telegram 机器人每周一发送的摘要相同。",
    heading: "本周摘要",
    intro: (chain) =>
      `这一周 ${chain} 上的聪明资金流向了哪里——哪些交易对有聪明资金流入、哪些流出，以及哪些典型区间移动了——读自聪明的流动性页面每天保存四次的测量。`,
    window: (from, to, days) => `从 ${from} 到 ${to}：所比较的第一次测量与最近一次之间相隔 ${days} 天。`,
    notYet: (chain) => `${chain} 上还没有满一天的测量可供比较。有了之后，摘要才会出现。`,
    quiet: "本周没有哪个交易对占聪明资金的比例、也没有哪个典型区间移动到值得一提的程度。",
    topHeading: "手续费收益中位数最高",
    topYield: (yearlyYield, positions) => `年化 ${yearlyYield}，${positions} 个聪明仓位的中位数`,
    detail: "完整情况，逐个交易对，见聪明的流动性页面",
    bot: "Telegram 机器人每周一把这份摘要发给每一个用 /weekly 要过它的对话。",
    unavailable: "现在无法读取保存的测量。",
    loading: "正在读取本周的测量…",
  },
  /* "дн." for the days, the form every number takes (see countedDays.test.ts). */
  ru: {
    link: "Неделя умной ликвидности",
    title: "Куда за эту неделю переместились умные деньги",
    titleOn: (chain) => `Куда за эту неделю переместились умные деньги в сети ${chain}`,
    description:
      "Еженедельная сводка по самой доходной ликвидности Uniswap v3: пары, в которых умных денег прибывает и убывает, и типичные диапазоны, которые сместились, — измерено по цепочке. Та же сводка, которую бот в Telegram присылает каждый понедельник.",
    heading: "Сводка за неделю",
    intro: (chain) =>
      `Куда за неделю переместились умные деньги в сети ${chain} — пары, в которых их прибывает и убывает, и типичные диапазоны, которые сместились, — по измерениям, которые страница умной ликвидности сохраняет четыре раза в день.`,
    window: (from, to, days) => `С ${from} по ${to}: ${days} дн. между первым сравниваемым измерением и последним.`,
    notYet: (chain) => `В сети ${chain} пока нет дня измерений для сравнения. Сводка появится, когда он накопится.`,
    quiet: "За эту неделю ни доля какой-либо пары в умных деньгах, ни один типичный диапазон не сместились настолько, чтобы об этом сказать.",
    topHeading: "Самая высокая медианная доходность от комиссий",
    topYield: (yearlyYield, positions) => `${yearlyYield} в год, медиана ${positions} умных позиций`,
    detail: "Полная картина, пара за парой, на странице умной ликвидности",
    bot: "Бот в Telegram присылает эту сводку каждый понедельник в каждый чат, который попросил о ней командой /weekly.",
    unavailable: "Сохранённые измерения сейчас прочитать не удалось.",
    loading: "Читаем измерения за неделю…",
  },
  /* "1 dia", "7 dias": the noun agrees with the count (see countedDays.test.ts). */
  pt: {
    link: "A semana em liquidez inteligente",
    title: "Para onde o dinheiro inteligente se moveu nesta semana",
    titleOn: (chain) => `Para onde o dinheiro inteligente se moveu em ${chain} nesta semana`,
    description:
      "O resumo semanal da liquidez da Uniswap v3 que mais ganha: os pares ganhando e perdendo parte dela e as faixas típicas que se deslocaram, medidos na cadeia. O mesmo resumo que o bot do Telegram envia toda segunda-feira.",
    heading: "O resumo da semana",
    intro: (chain) =>
      `Para onde o dinheiro inteligente em ${chain} se moveu na semana — os pares ganhando e perdendo parte dele e as faixas típicas que se deslocaram — lido das medições que a página de liquidez inteligente guarda quatro vezes por dia.`,
    window: (from, to, days) =>
      `De ${from} a ${to}: ${days} ${days === "1" ? "dia" : "dias"} entre a primeira medição comparada e a última.`,
    notYet: (chain) => `Ainda não há um dia de medições em ${chain} para comparar. O resumo aparece quando houver.`,
    quiet: "Nesta semana nem a parte de algum par no dinheiro inteligente nem alguma faixa típica se moveu o bastante para ser nomeada.",
    topHeading: "Maior rendimento mediano em taxas",
    topYield: (yearlyYield, positions) => `${yearlyYield} por ano, a mediana de ${positions} posições inteligentes`,
    detail: "O quadro completo, par por par, na página de liquidez inteligente",
    bot: "O bot do Telegram envia este resumo toda segunda-feira a qualquer chat que o pediu com /weekly.",
    unavailable: "Não foi possível ler as medições guardadas agora.",
    loading: "Lendo as medições da semana…",
  },
  "zh-Hant": {
    link: "聰明的流動性：本週",
    title: "本週聰明資金流向了哪裡",
    titleOn: (chain) => `本週 ${chain} 上的聰明資金流向了哪裡`,
    description:
      "收益最高的 Uniswap v3 流動性的每週摘要：哪些交易對有聰明資金流入、哪些流出，以及哪些典型區間移動了，直接從鏈上測量。與 Telegram 機器人每週一傳送的摘要相同。",
    heading: "本週摘要",
    intro: (chain) =>
      `這一週 ${chain} 上的聰明資金流向了哪裡——哪些交易對有聰明資金流入、哪些流出，以及哪些典型區間移動了——讀自聰明的流動性頁面每天儲存四次的測量。`,
    window: (from, to, days) => `從 ${from} 到 ${to}：所比較的第一次測量與最近一次之間相隔 ${days} 天。`,
    notYet: (chain) => `${chain} 上還沒有滿一天的測量可供比較。有了之後，摘要才會出現。`,
    quiet: "本週沒有哪個交易對佔聰明資金的比例、也沒有哪個典型區間移動到值得一提的程度。",
    topHeading: "手續費收益中位數最高",
    topYield: (yearlyYield, positions) => `年化 ${yearlyYield}，${positions} 個聰明倉位的中位數`,
    detail: "完整情況，逐個交易對，見聰明的流動性頁面",
    bot: "Telegram 機器人每週一把這份摘要傳給每一個用 /weekly 要過它的對話。",
    unavailable: "現在無法讀取儲存的測量。",
    loading: "正在讀取本週的測量…",
  },
};

export const getWeeklyCopy = (locale: Locale): WeeklyCopy => COPY[locale];
