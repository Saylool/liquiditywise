import type { Locale } from "./locales";

/*
 * The words of the record under each open v3 position on the holdings page:
 * how it has done since it was opened, valued at today's price.
 *
 * Labels and a few sentences, so that no figure has a noun beside it that
 * would have to agree with it in any language; the figures arrive written,
 * each with its token's symbol. Every term is the one the rest of the site
 * uses for the same thing in that language — the position, its range, its
 * liquidity, the fees and what is usually called impermanent loss — and the
 * fee arithmetic is described in the words the method page uses for the
 * smart-liquidity yield, which is the same arithmetic over a shorter window.
 *
 * What it leaves out is said every time it is shown, not left to the method
 * page: gas, and that every deposit and withdrawal is valued at today's price
 * rather than at the price on its day. And that it is a measurement, not
 * advice, like every other figure here.
 */

export type PositionRecordCopy = {
  /** Over the record: since when, and in which token it is valued. */
  readonly heading: (openedOn: string, symbol: string) => string;
  readonly deposited: string;
  readonly withdrawn: string;
  readonly now: string;
  readonly fees: string;
  /** What the deposits would be worth today, had they simply been held. */
  readonly held: string;
  readonly result: string;
  /** The result's two parts, each already signed and written with its token. */
  readonly parts: (fees: string, rangeEffect: string) => string;
  /** How the fees are counted, what the range effect is, and what it all leaves out. */
  readonly note: string;
  /** A history that was read and did not reach the chain's present. */
  readonly unverified: string;
  /**
   * Something it needs that could not be read: the history, the fees, the
   * price. Not "just now" — a fee figure past what the protocol can record
   * will not be readable later either.
   */
  readonly unread: string;
  /** Under a v4 position, which has no history to read. */
  readonly v4: string;
};

const COPY: Record<Locale, PositionRecordCopy> = {
  en: {
    heading: (openedOn, symbol) => `Since it was opened on ${openedOn}, at today's price in ${symbol}`,
    deposited: "Deposited",
    withdrawn: "Withdrawn, as principal",
    now: "In the position now",
    fees: "Fees earned over its whole life",
    held: "Had the deposits simply been held",
    result: "Result",
    parts: (fees, rangeEffect) => `fees ${fees}, range effect ${rangeEffect}`,
    note: "Fees come from the chain's own fee accounting: between each change to the position and the next, its liquidity times the fee growth inside its range, as the position manager counts it, collected or not. The range effect is the position against simply holding the deposits, before fees — what is usually called impermanent loss. This covers the position's whole life, under every owner it has had. It leaves out the gas paid, and it values every deposit and withdrawal at today's price rather than the price on its day. A measurement, not advice.",
    unverified: "This position's history could not be checked against the chain, so its figures are not shown here.",
    unread: "Not everything this record needs could be read, so its figures are not shown here.",
    v4: "The v4 indexers keep no history for each position, so this is not worked out here for a v4 position.",
  },
  tr: {
    heading: (openedOn, symbol) => `${openedOn} tarihinde açıldığından beri, bugünkü fiyatla ${symbol} cinsinden`,
    deposited: "Yatırılan",
    withdrawn: "Anapara olarak çekilen",
    now: "Şu an pozisyonda olan",
    fees: "Bütün ömrü boyunca kazanılan komisyon",
    held: "Yatırılanlar sadece tutulsaydı",
    result: "Sonuç",
    parts: (fees, rangeEffect) => `komisyon ${fees}, aralık etkisi ${rangeEffect}`,
    note: "Komisyon, zincirin kendi komisyon hesabından gelir: pozisyonun her değişikliğinden bir sonrakine kadar, likiditesi çarpı aralığı içindeki komisyon büyümesi — pozisyon yöneticisinin saydığı gibi, çekilmiş olsun olmasın. Aralık etkisi, komisyondan önce pozisyonun yatırılanları sadece tutmaya kıyasla durumudur: genelde geçici kayıp denen şey. Pozisyonun bütün ömrünü kapsar; başka bir adreste durduğu zamanlar da buna dahildir. Ödenen gas hesaba katılmaz ve her yatırma ile her çekme, kendi günündeki fiyatla değil bugünkü fiyatla değerlenir. Bir ölçümdür, yatırım tavsiyesi değildir.",
    unverified: "Bu pozisyonun geçmişi zincirle doğrulanamadı, bu yüzden rakamları burada gösterilmiyor.",
    unread: "Bu hesabın ihtiyaç duyduğu her şey okunamadı, bu yüzden rakamları burada gösterilmiyor.",
    v4: "Uniswap v4 indeksleyicileri pozisyon başına bir geçmiş tutmuyor; bu yüzden bir v4 pozisyonu için bu hesap burada yapılamıyor.",
  },
  de: {
    heading: (openedOn, symbol) => `Seit der Eröffnung am ${openedOn}, zum heutigen Preis in ${symbol}`,
    deposited: "Einlagen",
    withdrawn: "Als Kapital entnommen",
    now: "Jetzt in der Position",
    fees: "Gebühren über die ganze Laufzeit",
    held: "Hätte man die Einlagen einfach gehalten",
    result: "Ergebnis",
    parts: (fees, rangeEffect) => `Gebühren ${fees}, Bereichseffekt ${rangeEffect}`,
    note: "Die Gebühren stammen aus der Gebührenbuchhaltung der Chain selbst: zwischen jeder Änderung der Position und der nächsten ihre Liquidität mal das Gebührenwachstum innerhalb ihres Bereichs, so wie der Positionsmanager es zählt, eingesammelt oder nicht. Der Bereichseffekt ist die Position gegenüber dem bloßen Halten der Einlagen, vor Gebühren — das, was man gewöhnlich Impermanent Loss nennt. Erfasst ist die ganze Laufzeit der Position, unter jedem Eigentümer, den sie hatte. Das gezahlte Gas ist nicht mitgezählt, und jede Einlage und jede Entnahme wird zum heutigen Preis bewertet statt zum Preis an ihrem Tag. Eine Messung, keine Finanzberatung.",
    unverified: "Der Verlauf dieser Position ließ sich nicht gegen die Chain prüfen, deshalb stehen ihre Zahlen hier nicht.",
    unread: "Nicht alles, was diese Rechnung braucht, ließ sich lesen, deshalb stehen ihre Zahlen hier nicht.",
    v4: "Die v4-Indexer führen keinen Verlauf je Position, deshalb wird das für eine v4-Position hier nicht berechnet.",
  },
  es: {
    heading: (openedOn, symbol) => `Desde que se abrió, el ${openedOn}, al precio de hoy en ${symbol}`,
    deposited: "Depositado",
    withdrawn: "Retirado como principal",
    now: "En la posición ahora",
    fees: "Comisiones ganadas en toda su vida",
    held: "Si lo depositado simplemente se hubiera mantenido",
    result: "Resultado",
    parts: (fees, rangeEffect) => `comisiones ${fees}, efecto del rango ${rangeEffect}`,
    note: "Las comisiones salen de la propia contabilidad de comisiones de la cadena: entre cada cambio de la posición y el siguiente, su liquidez por el crecimiento de comisiones dentro de su rango, tal como lo cuenta el gestor de posiciones, cobradas o no. El efecto del rango es la posición frente a simplemente mantener lo depositado, antes de comisiones: lo que se suele llamar pérdida impermanente. Abarca toda la vida de la posición, con cada dueño que haya tenido. Deja fuera el gas pagado, y valora cada depósito y cada retiro al precio de hoy y no al de su día. Es una medición, no asesoramiento financiero.",
    unverified: "El historial de esta posición no pudo comprobarse contra la cadena, así que sus cifras no se muestran aquí.",
    unread: "No pudo leerse todo lo que este cálculo necesita, así que sus cifras no se muestran aquí.",
    v4: "Los indexadores de v4 no guardan un historial por posición, así que para una posición v4 esto no se calcula aquí.",
  },
  ar: {
    heading: (openedOn, symbol) => `منذ فُتح في ${openedOn}، بسعر اليوم ومقوّمًا بـ ${symbol}`,
    deposited: "المودَع",
    withdrawn: "المسحوب من رأس المال",
    now: "في المركز الآن",
    fees: "الرسوم المكتسبة طوال عمره",
    held: "لو احتُفظ بالمودَع ببساطة",
    result: "النتيجة",
    parts: (fees, rangeEffect) => `الرسوم ${fees}، وأثر النطاق ${rangeEffect}`,
    note: "تأتي الرسوم من حساب الرسوم الذي تمسكه السلسلة نفسها: بين كل تغيير في المركز والذي يليه، سيولته مضروبةً في نمو الرسوم داخل نطاقه، كما يحسبه مدير المراكز، سواء سُحبت أم لا. وأثر النطاق هو المركز مقابل الاحتفاظ بالمودَع ببساطة، قبل الرسوم — وهو ما يُسمّى عادةً الخسارة غير الدائمة. ويشمل هذا عمر المركز كله، مع كل مالك كان له. ولا يحتسب الغاز المدفوع، ويقوّم كل إيداع وكل سحب بسعر اليوم لا بسعر يومه. إنه قياس، وليس نصيحة مالية.",
    unverified: "تعذّر التحقق من سجل هذا المركز مقابل السلسلة، فلا تُعرض أرقامه هنا.",
    unread: "تعذّرت قراءة كل ما يحتاجه هذا الحساب، فلا تُعرض أرقامه هنا.",
    v4: "لا تحتفظ مفهرسات v4 بسجل لكل مركز، لذلك لا يُجرى هذا الحساب هنا لمركز في v4.",
  },
  hi: {
    heading: (openedOn, symbol) => `${openedOn} को खुलने के बाद से, आज की कीमत पर ${symbol} में`,
    deposited: "जमा किया गया",
    withdrawn: "मूलधन के रूप में निकाला गया",
    now: "अभी पोज़िशन में",
    fees: "पूरे जीवनकाल में कमाया गया शुल्क",
    held: "अगर जमा की गई राशि बस रखी रहती",
    result: "नतीजा",
    parts: (fees, rangeEffect) => `शुल्क ${fees}, दायरे का असर ${rangeEffect}`,
    note: "शुल्क चेन के अपने शुल्क-हिसाब से आता है: पोज़िशन के हर बदलाव से अगले बदलाव तक, उसकी तरलता गुणा उसके दायरे के भीतर शुल्क की बढ़त, जैसे पोज़िशन मैनेजर उसे गिनता है, निकाला गया हो या नहीं। दायरे का असर शुल्क से पहले पोज़िशन बनाम जमा की गई राशि को बस रखे रहना है — इसी को आमतौर पर अस्थायी हानि कहते हैं। यह पोज़िशन के पूरे जीवनकाल को समेटता है, उसके हर मालिक के दौर समेत। इसमें चुकाई गई गैस नहीं गिनी जाती, और हर जमा और हर निकासी को उसके दिन की कीमत पर नहीं, आज की कीमत पर आँका जाता है। यह एक माप है, वित्तीय सलाह नहीं।",
    unverified: "इस पोज़िशन का इतिहास चेन से जाँचा नहीं जा सका, इसलिए इसके आँकड़े यहाँ नहीं दिखाए गए।",
    unread: "इस हिसाब के लिए ज़रूरी सब कुछ पढ़ा नहीं जा सका, इसलिए इसके आँकड़े यहाँ नहीं दिखाए गए।",
    v4: "v4 के इंडेक्सर हर पोज़िशन का इतिहास नहीं रखते, इसलिए v4 पोज़िशन के लिए यह हिसाब यहाँ नहीं होता।",
  },
  zh: {
    heading: (openedOn, symbol) => `自 ${openedOn} 开仓以来，按今天的价格以 ${symbol} 计`,
    deposited: "存入",
    withdrawn: "作为本金取出",
    now: "现在仓位里",
    fees: "整个存续期间赚到的手续费",
    held: "若只是持有存入的代币",
    result: "结果",
    parts: (fees, rangeEffect) => `手续费 ${fees}，区间影响 ${rangeEffect}`,
    note: "手续费来自链上自己的手续费记账：在仓位每一次变动到下一次变动之间，它的流动性乘以其区间内的手续费增长，和仓位管理器的计算方式一样，不论是否已经取出。区间影响是在不计手续费时，仓位相对单纯持有存入的代币的差额——也就是通常所说的无常损失。它涵盖这个仓位的整个存续期间，包括它在之前每一位持有者手中的时候。它不计入付出的 gas，而且每一笔存入和取出都按今天的价格计算，而不是按当天的价格。这是一项测量，不构成财务建议。",
    unverified: "这个仓位的历史无法与链上核对，因此这里不显示它的数字。",
    unread: "这份计算所需的数据没能全部读到，因此这里不显示它的数字。",
    v4: "v4 的索引器不为每个仓位保留历史，因此这里不为 v4 仓位做这项计算。",
  },
  ru: {
    heading: (openedOn, symbol) => `С открытия ${openedOn}, по сегодняшней цене в ${symbol}`,
    deposited: "Внесено",
    withdrawn: "Выведено как основная сумма",
    now: "Сейчас в позиции",
    fees: "Комиссии за всё время",
    held: "Если бы внесённое просто держали",
    result: "Итог",
    parts: (fees, rangeEffect) => `комиссии ${fees}, эффект диапазона ${rangeEffect}`,
    note: "Комиссии берутся из собственного учёта комиссий в сети: между каждым изменением позиции и следующим — её ликвидность, умноженная на рост комиссий внутри её диапазона, так, как его считает менеджер позиций, выведены они или нет. Эффект диапазона — это позиция против простого хранения внесённого, до комиссий: то, что обычно называют непостоянными потерями. Учтена вся жизнь позиции, при каждом её владельце. Уплаченный gas не учтён, а каждый взнос и каждый вывод оценены по сегодняшней цене, а не по цене своего дня. Это измерение, а не финансовый совет.",
    unverified: "Историю этой позиции не удалось сверить с сетью, поэтому её цифры здесь не показаны.",
    unread: "Не всё, что нужно для этого расчёта, удалось прочитать, поэтому его цифры здесь не показаны.",
    v4: "Индексаторы v4 не хранят историю каждой позиции, поэтому для позиции v4 этот расчёт здесь не делается.",
  },
  pt: {
    heading: (openedOn, symbol) => `Desde que foi aberta, em ${openedOn}, ao preço de hoje em ${symbol}`,
    deposited: "Depositado",
    withdrawn: "Retirado como principal",
    now: "Na posição agora",
    fees: "Taxas ganhas em toda a vida dela",
    held: "Se o depositado tivesse sido só segurado",
    result: "Resultado",
    parts: (fees, rangeEffect) => `taxas ${fees}, efeito da faixa ${rangeEffect}`,
    note: "As taxas vêm da própria contabilidade de taxas da rede: entre cada mudança da posição e a seguinte, a liquidez dela vezes o crescimento das taxas dentro da sua faixa, do jeito que o gerenciador de posições o conta, retiradas ou não. O efeito da faixa é a posição contra simplesmente segurar o que foi depositado, antes das taxas — o que costuma ser chamado de perda impermanente. Cobre a vida inteira da posição, com cada dono que ela teve. Deixa de fora o gas pago, e avalia cada depósito e cada retirada ao preço de hoje, não ao do dia deles. É uma medição, não uma recomendação financeira.",
    unverified: "O histórico desta posição não pôde ser conferido com a rede, então os números dela não aparecem aqui.",
    unread: "Nem tudo de que este cálculo precisa pôde ser lido, então os números dele não aparecem aqui.",
    v4: "Os indexadores do v4 não guardam um histórico por posição, então isso não é calculado aqui para uma posição v4.",
  },
  "zh-Hant": {
    heading: (openedOn, symbol) => `自 ${openedOn} 開倉以來，按今天的價格以 ${symbol} 計`,
    deposited: "存入",
    withdrawn: "作為本金取出",
    now: "現在倉位裡",
    fees: "整個存續期間賺到的手續費",
    held: "若只是持有存入的代幣",
    result: "結果",
    parts: (fees, rangeEffect) => `手續費 ${fees}，區間影響 ${rangeEffect}`,
    note: "手續費來自鏈上自己的手續費記帳：在倉位每一次變動到下一次變動之間，它的流動性乘以其區間內的手續費成長，和倉位管理器的計算方式一樣，不論是否已經取出。區間影響是在不計手續費時，倉位相對單純持有存入的代幣的差額——也就是通常所說的無常損失。它涵蓋這個倉位的整個存續期間，包括它在之前每一位持有者手中的時候。它不計入付出的 gas，而且每一筆存入和取出都按今天的價格計算，而不是按當天的價格。這是一項測量，不構成財務建議。",
    unverified: "這個倉位的歷史無法與鏈上核對，因此這裡不顯示它的數字。",
    unread: "這份計算所需的資料沒能全部讀到，因此這裡不顯示它的數字。",
    v4: "v4 的索引器不為每個倉位保留歷史，因此這裡不為 v4 倉位做這項計算。",
  },
};

export const getPositionRecordCopy = (locale: Locale): PositionRecordCopy => COPY[locale];
