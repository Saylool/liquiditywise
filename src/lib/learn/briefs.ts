import type { Locale } from "../i18n/locales";

/*
 * The quick guide: six things worth knowing before providing liquidity, each
 * in three sentences. Short on purpose — the pool pages show every one of
 * them on real data, and this page is where somebody who has not yet looked
 * at a pool can start.
 *
 * Written in the interface's own words for each language (the terms the
 * dictionaries and the model's TERMINOLOGY use: Turkish "komisyon", "takas",
 * "geçici kayıp", "fiyat adımı"; German "Tausch", "Einlage", "Bereich"; and so
 * on), so a reader meets one vocabulary across the site. A test holds each
 * language to its word for impermanent loss.
 *
 * Nothing here is a figure about any pool, and nothing is advice: the fee
 * tiers are the protocol's, and every trade-off is stated as a trade-off.
 */

export const BRIEF_IDS = ["concentrated", "in-range", "divergence", "width", "fee-tiers", "hooks"] as const;

export type BriefId = (typeof BRIEF_IDS)[number];

export type Brief = {
  readonly id: BriefId;
  readonly title: string;
  readonly points: readonly [string, string, string];
};

export type LearnCopy = {
  /** Where the page is linked from: the front page and the footer. */
  readonly link: string;
  readonly title: string;
  readonly description: string;
  readonly heading: string;
  readonly intro: string;
  readonly briefs: readonly Brief[];
};

const brief = (id: BriefId, title: string, points: readonly [string, string, string]): Brief => ({ id, title, points });

const en: LearnCopy = {
  link: "Quick guide",
  title: "Uniswap liquidity in brief: ranges, fees, impermanent loss",
  description:
    "Six things worth knowing before providing liquidity on Uniswap v3 and v4: ranges, fee tiers, impermanent loss and v4 hooks, briefly.",
  heading: "Quick guide",
  intro:
    "Six things worth knowing before you provide liquidity on Uniswap. Short on purpose; the pool pages show each of them on real data.",
  briefs: [
    brief("concentrated", "Liquidity in a range", [
      "In Uniswap v3 and v4 you choose a price range, and your liquidity works only inside it.",
      "The same deposit in a narrower range is more liquidity at each price, so it takes a larger share of the fees charged there.",
      "In v2, liquidity was spread over every price; most of it sat at prices nobody traded at.",
    ]),
    brief("in-range", "Inside and outside the range", [
      "While the price is inside your range, your position earns a share of the fees on every swap.",
      "When the price leaves it, the position earns nothing and holds only one of the two tokens.",
      "It earns again only if the price comes back — or you move the range, which is a new position.",
    ]),
    brief("divergence", "Impermanent loss", [
      "As the price moves, the pool sells the token that is rising and buys the one that is falling.",
      "So a position ends up worth less than simply holding the two tokens; the further the price moves, the larger the gap.",
      "It is only impermanent if the price comes back. Fees are what a liquidity provider is paid for carrying it.",
    ]),
    brief("width", "Narrow or wide", [
      "A narrow range takes a larger share of the fees on the days it holds, and nothing on the days it does not.",
      "A wide range stays inside on more days, with a smaller share on each of them.",
      "Which suits depends on what the position is for. Past days describe the past, not the ones to come.",
    ]),
    brief("fee-tiers", "Fee tiers", [
      "The same pair can have several pools, each charging a different fee on every swap: commonly 0.01%, 0.05%, 0.3% or 1%.",
      "Each tier is a separate pool with its own liquidity and its own price step — the smallest price gap a range edge can sit on.",
      "A higher fee is not more income by itself: it also depends on how much trading that pool attracts.",
    ]),
    brief("hooks", "v4 hooks", [
      "A v4 pool may name a hook: a contract called at fixed moments of a swap, a deposit or a withdrawal.",
      "Which moments is written into the hook's address, and the protocol enforces it.",
      "A hook allowed to act on swaps can change what they cost, so figures read from the curve alone may not hold for that pool.",
    ]),
  ],
};

const tr: LearnCopy = {
  link: "Kısa bilgiler",
  title: "Uniswap likiditesi kısaca: aralık, komisyon, geçici kayıp",
  description:
    "Uniswap v3 ve v4'te likidite sağlamadan önce bilmeye değer altı şey: aralık, komisyon kademeleri, geçici kayıp ve v4 hook'ları, kısaca.",
  heading: "Kısa bilgiler",
  intro:
    "Uniswap'te likidite sağlamadan önce bilmeye değer altı şey. Bilerek kısa tutuldu; havuz sayfaları her birini gerçek veriyle gösteriyor.",
  briefs: [
    brief("concentrated", "Bir aralıkta likidite", [
      "Uniswap v3 ve v4'te bir fiyat aralığı seçersin; likiditen yalnızca bu aralığın içinde çalışır.",
      "Aynı yatırım daha dar bir aralıkta her fiyatta daha fazla likidite demektir, bu yüzden orada alınan komisyondan daha büyük pay alır.",
      "v2'de likidite her fiyata yayılırdı; çoğu, kimsenin işlem yapmadığı fiyatlarda dururdu.",
    ]),
    brief("in-range", "Aralığın içi ve dışı", [
      "Fiyat aralığının içindeyken pozisyonun her takasta alınan komisyondan pay alır.",
      "Fiyat aralıktan çıkınca pozisyon hiçbir şey kazanmaz ve iki tokendan yalnızca birini tutar.",
      "Yeniden kazanması için fiyatın geri gelmesi gerekir — ya da aralığı taşırsın, bu da yeni bir pozisyon demektir.",
    ]),
    brief("divergence", "Geçici kayıp", [
      "Fiyat hareket ettikçe havuz, yükselen tokenı satar, düşeni alır.",
      "Bu yüzden pozisyon, iki tokenı sadece elde tutmaktan daha az eder; fiyat ne kadar uzaklaşırsa fark o kadar büyür.",
      "Yalnızca fiyat geri gelirse geçicidir. Likidite sağlayana bu farkı taşıdığı için ödenen şey komisyondur.",
    ]),
    brief("width", "Dar mı, geniş mi", [
      "Dar bir aralık, fiyatın içinde kaldığı günlerde komisyondan daha büyük pay alır, dışına çıktığı günlerde hiçbir şey almaz.",
      "Geniş bir aralık daha çok gün içeride kalır, ama her gün daha küçük bir pay alır.",
      "Hangisinin uygun olduğu pozisyonun amacına bağlıdır. Geçmiş günler geçmişi anlatır, gelecek günleri değil.",
    ]),
    brief("fee-tiers", "Komisyon kademeleri", [
      "Aynı parite birden fazla havuzda işlem görebilir; her biri her takasta farklı bir komisyon alır: genellikle %0,01, %0,05, %0,3 ya da %1.",
      "Her kademe kendi likiditesi ve kendi fiyat adımı olan ayrı bir havuzdur; fiyat adımı, aralık kenarlarının oturabildiği en küçük fiyat farkıdır.",
      "Yüksek komisyon tek başına daha fazla gelir demek değildir; o havuzun ne kadar işlem çektiğine de bağlıdır.",
    ]),
    brief("hooks", "v4 hook'ları", [
      "Bir v4 havuzu bir hook belirleyebilir: takas, yatırma ya da çekme sırasında belirli anlarda çağrılan bir sözleşme.",
      "Hangi anlarda çağrılacağı hook'un adresine yazılıdır ve protokol buna uyulmasını zorunlu kılar.",
      "Takasa müdahale edebilen bir hook takasın maliyetini değiştirebilir; bu yüzden yalnızca eğriden okunan rakamlar o havuz için geçerli olmayabilir.",
    ]),
  ],
};

const de: LearnCopy = {
  link: "Kurz erklärt",
  title: "Uniswap-Liquidität kurz erklärt: Bereiche, Gebühren, Impermanent Loss",
  description:
    "Sechs Dinge, die man vor dem Bereitstellen von Liquidität auf Uniswap v3 und v4 wissen sollte: Bereiche, Gebührenstufen, Impermanent Loss und v4-Hooks, kurz erklärt.",
  heading: "Kurz erklärt",
  intro:
    "Sechs Dinge, die man wissen sollte, bevor man auf Uniswap Liquidität bereitstellt. Mit Absicht kurz; die Pool-Seiten zeigen jedes davon an echten Daten.",
  briefs: [
    brief("concentrated", "Liquidität in einem Bereich", [
      "In Uniswap v3 und v4 wählst du einen Preisbereich, und deine Liquidität arbeitet nur darin.",
      "Dieselbe Einlage in einem engeren Bereich ist bei jedem Preis mehr Liquidität und erhält dort deshalb einen größeren Anteil der Gebühren.",
      "In v2 war Liquidität über alle Preise verteilt; das meiste lag bei Preisen, zu denen niemand handelte.",
    ]),
    brief("in-range", "Innerhalb und außerhalb des Bereichs", [
      "Solange der Preis in deinem Bereich liegt, erhält deine Position einen Anteil der Gebühren jedes Tauschs.",
      "Verlässt der Preis den Bereich, verdient die Position nichts und hält nur noch einen der beiden Token.",
      "Sie verdient erst wieder, wenn der Preis zurückkommt – oder du verschiebst den Bereich, was eine neue Position ist.",
    ]),
    brief("divergence", "Impermanent Loss", [
      "Bewegt sich der Preis, verkauft der Pool den steigenden Token und kauft den fallenden.",
      "Deshalb ist eine Position am Ende weniger wert als das bloße Halten beider Token; je weiter sich der Preis bewegt, desto größer der Abstand.",
      "Unbeständig ist er nur, wenn der Preis zurückkommt. Die Gebühren sind das, wofür ein Liquiditätsanbieter ihn trägt.",
    ]),
    brief("width", "Eng oder weit", [
      "Ein enger Bereich erhält an den Tagen, an denen er hält, einen größeren Anteil der Gebühren – und an den anderen nichts.",
      "Ein weiter Bereich bleibt an mehr Tagen innerhalb, mit einem kleineren Anteil an jedem davon.",
      "Was passt, hängt davon ab, wofür die Position gedacht ist. Vergangene Tage beschreiben die Vergangenheit, nicht die kommenden.",
    ]),
    brief("fee-tiers", "Gebührenstufen", [
      "Dasselbe Paar kann mehrere Pools haben, die bei jedem Tausch eine andere Gebühr erheben: üblich sind 0,01 %, 0,05 %, 0,3 % oder 1 %.",
      "Jede Stufe ist ein eigener Pool mit eigener Liquidität und eigenem Preisschritt – dem kleinsten Preisabstand, auf dem eine Bereichsgrenze liegen kann.",
      "Eine höhere Gebühr bedeutet für sich allein keinen höheren Ertrag: Es kommt auch darauf an, wie viel Handel dieser Pool anzieht.",
    ]),
    brief("hooks", "v4-Hooks", [
      "Ein v4-Pool kann einen Hook nennen: einen Vertrag, der zu festen Zeitpunkten eines Tauschs, einer Einlage oder einer Abhebung aufgerufen wird.",
      "Welche Zeitpunkte das sind, steht in der Adresse des Hooks, und das Protokoll setzt es durch.",
      "Ein Hook, der in Tausche eingreifen darf, kann ihre Kosten ändern – Zahlen, die nur aus der Kurve gelesen werden, gelten für diesen Pool dann womöglich nicht.",
    ]),
  ],
};

const es: LearnCopy = {
  link: "En breve",
  title: "La liquidez en Uniswap en breve: rangos, comisiones, pérdida impermanente",
  description:
    "Seis cosas que conviene saber antes de aportar liquidez en Uniswap v3 y v4: rangos, niveles de comisión, pérdida impermanente y hooks de v4, en pocas palabras.",
  heading: "En breve",
  intro:
    "Seis cosas que conviene saber antes de aportar liquidez en Uniswap. Breves a propósito; las páginas de pools muestran cada una con datos reales.",
  briefs: [
    brief("concentrated", "Liquidez en un rango", [
      "En Uniswap v3 y v4 eliges un rango de precios, y tu liquidez solo trabaja dentro de él.",
      "El mismo depósito en un rango más estrecho es más liquidez en cada precio, así que se lleva una parte mayor de las comisiones cobradas allí.",
      "En v2 la liquidez se repartía entre todos los precios; la mayor parte estaba en precios a los que nadie operaba.",
    ]),
    brief("in-range", "Dentro y fuera del rango", [
      "Mientras el precio está dentro de tu rango, tu posición gana una parte de las comisiones de cada intercambio.",
      "Cuando el precio sale, la posición no gana nada y solo tiene uno de los dos tokens.",
      "Vuelve a ganar solo si el precio regresa, o si mueves el rango, lo que es una posición nueva.",
    ]),
    brief("divergence", "Pérdida impermanente", [
      "Cuando el precio se mueve, el pool vende el token que sube y compra el que baja.",
      "Por eso una posición acaba valiendo menos que simplemente mantener los dos tokens; cuanto más se mueve el precio, mayor es la diferencia.",
      "Solo es impermanente si el precio vuelve. Las comisiones son lo que se le paga a un proveedor de liquidez por asumirla.",
    ]),
    brief("width", "¿Estrecho o amplio?", [
      "Un rango estrecho se lleva una parte mayor de las comisiones los días en que se mantiene, y nada los días en que no.",
      "Un rango amplio se mantiene dentro más días, con una parte menor en cada uno.",
      "Cuál conviene depende de para qué es la posición. Los días pasados describen el pasado, no los que vienen.",
    ]),
    brief("fee-tiers", "Niveles de comisión", [
      "El mismo par puede tener varios pools, cada uno con una comisión distinta en cada intercambio: normalmente 0,01 %, 0,05 %, 0,3 % o 1 %.",
      "Cada nivel es un pool aparte con su propia liquidez y su propio escalón de precio: la menor distancia de precio en la que puede situarse un borde del rango.",
      "Una comisión más alta no significa por sí sola más ingresos: también depende de cuánto volumen atraiga ese pool.",
    ]),
    brief("hooks", "Hooks de v4", [
      "Un pool de v4 puede nombrar un hook: un contrato al que se llama en momentos fijos de un intercambio, un depósito o una retirada.",
      "Qué momentos son está escrito en la dirección del hook, y el protocolo lo hace cumplir.",
      "Un hook que puede intervenir en los intercambios puede cambiar lo que cuestan, así que las cifras leídas solo de la curva pueden no valer para ese pool.",
    ]),
  ],
};

const ar: LearnCopy = {
  link: "باختصار",
  title: "السيولة في Uniswap باختصار: النطاقات والرسوم والخسارة غير الدائمة",
  description:
    "ستة أمور تستحق المعرفة قبل توفير السيولة في Uniswap v3 وv4: النطاقات ومستويات الرسوم والخسارة غير الدائمة وخطافات v4، باختصار.",
  heading: "باختصار",
  intro:
    "ستة أمور تستحق المعرفة قبل توفير السيولة في Uniswap. مختصرة عن قصد؛ وصفحات التجمّعات تعرض كلًّا منها على بيانات حقيقية.",
  briefs: [
    brief("concentrated", "السيولة داخل نطاق", [
      "في Uniswap v3 وv4 تختار نطاقًا سعريًا، ولا تعمل سيولتك إلا داخله.",
      "الإيداع نفسه في نطاق أضيق يعني سيولة أكبر عند كل سعر، فيأخذ حصة أكبر من الرسوم المحصّلة هناك.",
      "في v2 كانت السيولة موزّعة على كل الأسعار، وكان معظمها عند أسعار لا يتداول عندها أحد.",
    ]),
    brief("in-range", "داخل النطاق وخارجه", [
      "ما دام السعر داخل نطاقك، يكسب مركزك حصة من رسوم كل تبادل.",
      "وعندما يخرج السعر منه، لا يكسب المركز شيئًا ويحتفظ بواحد فقط من الرمزين.",
      "ولا يعود إلى الكسب إلا إذا عاد السعر، أو إذا نقلت النطاق، وهذا مركز جديد.",
    ]),
    brief("divergence", "الخسارة غير الدائمة", [
      "حين يتحرك السعر، يبيع التجمّع الرمز الصاعد ويشتري الهابط.",
      "لذلك تصبح قيمة المركز أقل من مجرد الاحتفاظ بالرمزين، وكلما ابتعد السعر كبر الفرق.",
      "وهي غير دائمة فقط إن عاد السعر. والرسوم هي ما يُدفع لمزوّد السيولة مقابل تحمّلها.",
    ]),
    brief("width", "ضيّق أم واسع", [
      "النطاق الضيّق يأخذ حصة أكبر من الرسوم في الأيام التي يصمد فيها، ولا شيء في الأيام التي لا يصمد فيها.",
      "والنطاق الواسع يبقى في الداخل أيامًا أكثر، بحصة أصغر في كل منها.",
      "أيّهما يناسب يتوقف على الغرض من المركز. الأيام الماضية تصف الماضي، لا الأيام المقبلة.",
    ]),
    brief("fee-tiers", "مستويات الرسوم", [
      "قد يكون للزوج نفسه عدة تجمّعات، يفرض كل منها رسمًا مختلفًا على كل تبادل: غالبًا 0.01% أو 0.05% أو 0.3% أو 1%.",
      "كل مستوى تجمّع مستقل بسيولته وبخطوته السعرية، وهي أصغر فرق سعري يمكن أن تقع عليه حافة النطاق.",
      "الرسم الأعلى لا يعني وحده دخلًا أكبر، فالأمر يتوقف أيضًا على حجم التداول الذي يجذبه ذلك التجمّع.",
    ]),
    brief("hooks", "خطافات v4", [
      "قد يسمّي تجمّع v4 خطافًا (hook): عقدًا يُستدعى في لحظات محددة من التبادل أو الإيداع أو السحب.",
      "وأيّ اللحظات هي مكتوب في عنوان الخطاف، والبروتوكول يفرض ذلك.",
      "والخطاف المسموح له بالتدخل في التبادلات قد يغيّر كلفتها، لذا قد لا تصحّ لذلك التجمّع الأرقام المقروءة من المنحنى وحده.",
    ]),
  ],
};

const hi: LearnCopy = {
  link: "संक्षेप में",
  title: "Uniswap में तरलता संक्षेप में: दायरे, शुल्क, अस्थायी हानि",
  description:
    "Uniswap v3 और v4 पर तरलता देने से पहले जानने लायक छह बातें: दायरे, शुल्क स्तर, अस्थायी हानि और v4 हुक, संक्षेप में।",
  heading: "संक्षेप में",
  intro:
    "Uniswap पर तरलता देने से पहले जानने लायक छह बातें। जान-बूझकर छोटी रखी गई हैं; पूल वाले पन्ने इनमें से हर एक को असली आँकड़ों पर दिखाते हैं।",
  briefs: [
    brief("concentrated", "एक दायरे में तरलता", [
      "Uniswap v3 और v4 में आप एक कीमत-दायरा चुनते हैं, और आपकी तरलता केवल उसी के भीतर काम करती है।",
      "वही जमा किसी संकरे दायरे में हर कीमत पर अधिक तरलता है, इसलिए वहाँ लिए गए शुल्कों में उसका हिस्सा बड़ा होता है।",
      "v2 में तरलता हर कीमत पर फैली रहती थी; उसका अधिकांश हिस्सा उन कीमतों पर पड़ा रहता था जिन पर कोई कारोबार नहीं करता था।",
    ]),
    brief("in-range", "दायरे के भीतर और बाहर", [
      "जब तक कीमत आपके दायरे के भीतर है, आपकी पोज़िशन हर स्वैप के शुल्क में से हिस्सा कमाती है।",
      "कीमत बाहर निकलते ही पोज़िशन कुछ नहीं कमाती और दोनों में से केवल एक टोकन रखती है।",
      "वह फिर से तभी कमाती है जब कीमत लौट आए — या आप दायरा खिसकाएँ, जो एक नई पोज़िशन है।",
    ]),
    brief("divergence", "अस्थायी हानि", [
      "कीमत हिलने पर पूल चढ़ते टोकन को बेचता है और गिरते टोकन को ख़रीदता है।",
      "इसलिए पोज़िशन का मूल्य दोनों टोकन केवल रखे रहने से कम रह जाता है; कीमत जितनी दूर जाती है, अंतर उतना बड़ा होता है।",
      "वह अस्थायी तभी है जब कीमत लौट आए। शुल्क ही वह है जो तरलता देने वाले को इसे उठाने के बदले मिलता है।",
    ]),
    brief("width", "संकरा या चौड़ा", [
      "संकरा दायरा उन दिनों शुल्क का बड़ा हिस्सा लेता है जिन दिनों वह टिकता है, और उन दिनों कुछ नहीं जिन दिनों नहीं टिकता।",
      "चौड़ा दायरा अधिक दिन भीतर रहता है, पर हर दिन छोटे हिस्से के साथ।",
      "कौन-सा ठीक है, यह इस पर निर्भर है कि पोज़िशन किसलिए है। बीते दिन बीते हुए का वर्णन करते हैं, आने वाले दिनों का नहीं।",
    ]),
    brief("fee-tiers", "शुल्क स्तर", [
      "एक ही जोड़ी के कई पूल हो सकते हैं, और हर एक हर स्वैप पर अलग शुल्क लेता है: आमतौर पर 0.01%, 0.05%, 0.3% या 1%।",
      "हर स्तर अपनी तरलता और अपने कीमत-क़दम वाला अलग पूल है — वह सबसे छोटा कीमत-अंतर जिस पर दायरे का किनारा बैठ सकता है।",
      "ऊँचा शुल्क अपने-आप में अधिक आमदनी नहीं है: यह इस पर भी निर्भर है कि वह पूल कितना कारोबार खींचता है।",
    ]),
    brief("hooks", "v4 हुक", [
      "कोई v4 पूल एक hook का नाम दे सकता है: एक कॉन्ट्रैक्ट जिसे स्वैप, जमा या निकासी के तय क्षणों पर बुलाया जाता है।",
      "कौन-से क्षण, यह hook के पते में लिखा होता है, और प्रोटोकॉल इसे लागू करता है।",
      "जिस hook को स्वैप में दख़ल की अनुमति है वह उनकी लागत बदल सकता है, इसलिए केवल वक्र से पढ़े गए आँकड़े उस पूल पर शायद लागू न हों।",
    ]),
  ],
};

const zh: LearnCopy = {
  link: "简明要点",
  title: "Uniswap 流动性要点：区间、手续费、无常损失",
  description: "在 Uniswap v3 和 v4 提供流动性之前值得知道的六件事：区间、费率档、无常损失和 v4 钩子，简明扼要。",
  heading: "简明要点",
  intro: "在 Uniswap 提供流动性之前值得知道的六件事。刻意写得很短；资金池页面会用真实数据展示每一条。",
  briefs: [
    brief("concentrated", "区间里的流动性", [
      "在 Uniswap v3 和 v4 中，你选择一个价格区间，你的流动性只在这个区间内起作用。",
      "同样的存入放在更窄的区间里，在每个价格上就是更多的流动性，因此能分到那里收取的手续费中更大的份额。",
      "在 v2 中流动性分布在所有价格上；大部分停留在没人交易的价格上。",
    ]),
    brief("in-range", "区间内与区间外", [
      "只要价格在你的区间内，你的仓位就从每一笔兑换的手续费中分得一份。",
      "价格一离开区间，仓位就什么也不赚，并且只持有两种代币中的一种。",
      "只有价格回来它才会重新赚取手续费——或者你移动区间，而那就是一个新仓位。",
    ]),
    brief("divergence", "无常损失", [
      "价格变动时，资金池会卖出上涨的代币、买入下跌的代币。",
      "所以仓位的价值最终会低于单纯持有两种代币；价格走得越远，差距越大。",
      "只有价格回来它才是“无常”的。手续费就是流动性提供者承担它所得到的报酬。",
    ]),
    brief("width", "窄还是宽", [
      "窄区间在守住的日子里分得更大份额的手续费，在守不住的日子里一分也没有。",
      "宽区间有更多日子留在区间内，但每天分得的份额更小。",
      "哪一种合适取决于仓位的用途。过去的日子描述的是过去，而不是接下来的日子。",
    ]),
    brief("fee-tiers", "费率档", [
      "同一交易对可以有多个资金池，每个在每笔兑换中收取不同的手续费：常见的是 0.01%、0.05%、0.3% 或 1%。",
      "每个费率档都是独立的资金池，有自己的流动性和自己的价格步长——区间边界可以落在的最小价格间距。",
      "费率更高本身并不意味着收入更多：还取决于这个资金池吸引了多少交易。",
    ]),
    brief("hooks", "v4 钩子", [
      "v4 资金池可以指定一个 hook：一个在兑换、存入或取出的固定时刻被调用的合约。",
      "是哪些时刻写在 hook 的地址里，并由协议强制执行。",
      "被允许介入兑换的 hook 可以改变兑换的成本，所以仅从曲线读出的数字对那个资金池未必成立。",
    ]),
  ],
};

const ru: LearnCopy = {
  link: "Коротко",
  title: "Ликвидность в Uniswap коротко: диапазоны, комиссии, непостоянные потери",
  description:
    "Шесть вещей, которые стоит знать, прежде чем предоставлять ликвидность в Uniswap v3 и v4: диапазоны, уровни комиссии, непостоянные потери и hook’и v4, коротко.",
  heading: "Коротко",
  intro:
    "Шесть вещей, которые стоит знать, прежде чем предоставлять ликвидность в Uniswap. Коротко намеренно; страницы пулов показывают каждую на реальных данных.",
  briefs: [
    brief("concentrated", "Ликвидность в диапазоне", [
      "В Uniswap v3 и v4 вы выбираете ценовой диапазон, и ваша ликвидность работает только внутри него.",
      "Тот же вклад в более узком диапазоне — это больше ликвидности на каждой цене, поэтому он забирает большую долю взятых там комиссий.",
      "В v2 ликвидность была распределена по всем ценам; большая её часть стояла на ценах, по которым никто не торговал.",
    ]),
    brief("in-range", "Внутри и вне диапазона", [
      "Пока цена внутри вашего диапазона, позиция получает долю комиссий с каждого свопа.",
      "Когда цена выходит за него, позиция ничего не зарабатывает и держит только один из двух токенов.",
      "Снова зарабатывать она начнёт, только если цена вернётся, — или если вы передвинете диапазон, а это уже новая позиция.",
    ]),
    brief("divergence", "Непостоянные потери", [
      "Когда цена движется, пул продаёт дорожающий токен и покупает дешевеющий.",
      "Поэтому позиция в итоге стоит меньше, чем простое хранение двух токенов, и чем дальше ушла цена, тем больше разница.",
      "Непостоянны они только если цена вернётся. Комиссии — это то, что поставщик ликвидности получает за то, что несёт их.",
    ]),
    brief("width", "Узкий или широкий", [
      "Узкий диапазон забирает большую долю комиссий в дни, когда держится, и ничего — в дни, когда нет.",
      "Широкий диапазон остаётся внутри больше дней, но с меньшей долей в каждый из них.",
      "Что подходит, зависит от того, для чего нужна позиция. Прошедшие дни описывают прошлое, а не будущие дни.",
    ]),
    brief("fee-tiers", "Уровни комиссии", [
      "У одной пары может быть несколько пулов, и каждый берёт свою комиссию с каждого свопа: обычно 0,01%, 0,05%, 0,3% или 1%.",
      "Каждый уровень — отдельный пул со своей ликвидностью и своим ценовым шагом: наименьшим расстоянием по цене, на котором может стоять граница диапазона.",
      "Более высокая комиссия сама по себе не означает больший доход: он зависит и от того, сколько торговли привлекает этот пул.",
    ]),
    brief("hooks", "Hook’и v4", [
      "Пул v4 может назвать hook: контракт, который вызывается в определённые моменты свопа, вклада или вывода.",
      "Какие это моменты, записано в адресе hook’а, и протокол обеспечивает это сам.",
      "Hook, которому разрешено вмешиваться в свопы, может менять их стоимость, поэтому цифры, прочитанные только по кривой, для такого пула могут не выполняться.",
    ]),
  ],
};

const pt: LearnCopy = {
  link: "Em resumo",
  title: "Liquidez na Uniswap em resumo: faixas, taxas, perda impermanente",
  description:
    "Seis coisas para saber antes de fornecer liquidez na Uniswap v3 e v4: faixas, níveis de taxa, perda impermanente e hooks do v4, em poucas palavras.",
  heading: "Em resumo",
  intro:
    "Seis coisas que vale saber antes de fornecer liquidez na Uniswap. Curtas de propósito; as páginas de pools mostram cada uma com dados reais.",
  briefs: [
    brief("concentrated", "Liquidez em uma faixa", [
      "Na Uniswap v3 e v4 você escolhe uma faixa de preço, e sua liquidez só trabalha dentro dela.",
      "O mesmo depósito em uma faixa mais estreita é mais liquidez em cada preço, e por isso fica com uma parte maior das taxas cobradas ali.",
      "No v2 a liquidez ficava espalhada por todos os preços; a maior parte ficava em preços em que ninguém negociava.",
    ]),
    brief("in-range", "Dentro e fora da faixa", [
      "Enquanto o preço está dentro da sua faixa, sua posição ganha uma parte das taxas de cada swap.",
      "Quando o preço sai, a posição não ganha nada e fica com apenas um dos dois tokens.",
      "Ela só volta a ganhar se o preço voltar — ou se você mover a faixa, o que é uma nova posição.",
    ]),
    brief("divergence", "Perda impermanente", [
      "Quando o preço se move, o pool vende o token que sobe e compra o que cai.",
      "Por isso uma posição acaba valendo menos do que simplesmente manter os dois tokens; quanto mais o preço se move, maior a diferença.",
      "Ela só é impermanente se o preço voltar. As taxas são o que um provedor de liquidez recebe por carregá-la.",
    ]),
    brief("width", "Estreita ou larga", [
      "Uma faixa estreita fica com uma parte maior das taxas nos dias em que se mantém, e nada nos dias em que não.",
      "Uma faixa larga fica dentro por mais dias, com uma parte menor em cada um.",
      "Qual serve depende do objetivo da posição. Dias passados descrevem o passado, não os próximos.",
    ]),
    brief("fee-tiers", "Níveis de taxa", [
      "O mesmo par pode ter vários pools, cada um cobrando uma taxa diferente em cada swap: normalmente 0,01%, 0,05%, 0,3% ou 1%.",
      "Cada nível é um pool separado, com liquidez própria e passo de preço próprio — a menor distância de preço em que uma borda da faixa pode ficar.",
      "Uma taxa maior não significa, sozinha, mais renda: depende também de quanto volume aquele pool atrai.",
    ]),
    brief("hooks", "Hooks do v4", [
      "Um pool do v4 pode nomear um hook: um contrato chamado em momentos fixos de um swap, de um depósito ou de um saque.",
      "Quais momentos são está gravado no endereço do hook, e o protocolo garante isso.",
      "Um hook que pode agir nos swaps pode mudar o custo deles, então números lidos apenas da curva podem não valer para aquele pool.",
    ]),
  ],
};

const zhHant: LearnCopy = {
  link: "簡明要點",
  title: "Uniswap 流動性要點：區間、手續費、無常損失",
  description: "在 Uniswap v3 和 v4 提供流動性之前值得知道的六件事：區間、費率檔、無常損失和 v4 鉤子，簡明扼要。",
  heading: "簡明要點",
  intro: "在 Uniswap 提供流動性之前值得知道的六件事。刻意寫得很短；資金池頁面會用真實資料展示每一條。",
  briefs: [
    brief("concentrated", "區間裡的流動性", [
      "在 Uniswap v3 和 v4 中，你選擇一個價格區間，你的流動性只在這個區間內發揮作用。",
      "同樣的存入放在更窄的區間裡，在每個價格上就是更多的流動性，因此能分到那裡收取的手續費中更大的份額。",
      "在 v2 中流動性分布在所有價格上；大部分停留在沒人交易的價格上。",
    ]),
    brief("in-range", "區間內與區間外", [
      "只要價格在你的區間內，你的倉位就從每一筆兌換的手續費中分得一份。",
      "價格一離開區間，倉位就什麼也不賺，並且只持有兩種代幣中的一種。",
      "只有價格回來它才會重新賺取手續費——或者你移動區間，而那就是一個新倉位。",
    ]),
    brief("divergence", "無常損失", [
      "價格變動時，資金池會賣出上漲的代幣、買入下跌的代幣。",
      "所以倉位的價值最終會低於單純持有兩種代幣；價格走得越遠，差距越大。",
      "只有價格回來它才是「無常」的。手續費就是流動性提供者承擔它所得到的報酬。",
    ]),
    brief("width", "窄還是寬", [
      "窄區間在守住的日子裡分得更大份額的手續費，在守不住的日子裡一分也沒有。",
      "寬區間有更多日子留在區間內，但每天分得的份額更小。",
      "哪一種合適取決於倉位的用途。過去的日子描述的是過去，而不是接下來的日子。",
    ]),
    brief("fee-tiers", "費率檔", [
      "同一交易對可以有多個資金池，每個在每筆兌換中收取不同的手續費：常見的是 0.01%、0.05%、0.3% 或 1%。",
      "每個費率檔都是獨立的資金池，有自己的流動性和自己的價格步長——區間邊界可以落在的最小價格間距。",
      "費率更高本身並不代表收入更多：還取決於這個資金池吸引了多少交易。",
    ]),
    brief("hooks", "v4 鉤子", [
      "v4 資金池可以指定一個 hook：一個在兌換、存入或取出的固定時刻被呼叫的合約。",
      "是哪些時刻寫在 hook 的位址裡，並由協議強制執行。",
      "被允許介入兌換的 hook 可以改變兌換的成本，所以僅從曲線讀出的數字對那個資金池未必成立。",
    ]),
  ],
};

const COPY: Record<Locale, LearnCopy> = { en, tr, de, es, ar, hi, zh, ru, pt, "zh-Hant": zhHant };

export const getLearnCopy = (locale: Locale): LearnCopy => COPY[locale];
