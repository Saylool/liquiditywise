import type { Locale } from "./locales";

/*
 * The about page's own words: what the project is, what it will not do, and
 * the plain facts a writer or a team looking at it would want in one place.
 *
 * Everything on it is something the code does and a test holds: the figures
 * are computed (a model never states one), the wallet is only ever asked for
 * an address and has no path to a signature or a transaction, and nothing is
 * kept about who reads. It makes no claim about users, volume or partners.
 */

export type AboutPoint = { readonly title: string; readonly body: string };
export type AboutFact = { readonly label: string; readonly value: string };

export type AboutCopy = {
  /** Where the page is linked from. */
  readonly link: string;
  readonly title: string;
  readonly description: string;
  readonly heading: string;
  readonly lead: string;
  readonly points: readonly [AboutPoint, AboutPoint, AboutPoint, AboutPoint];
  readonly limitsHeading: string;
  readonly limits: readonly [string, string, string];
  readonly factsHeading: string;
  readonly facts: readonly [AboutFact, AboutFact, AboutFact, AboutFact, AboutFact];
  readonly tryHeading: string;
  readonly tryLinks: { readonly pools: string; readonly smart: string; readonly guide: string };
};

const COPY: Record<Locale, AboutCopy> = {
  en: {
    link: "About",
    title: "About",
    description:
      "LiquidityWise is an independent, educational advisor for Uniswap v3 and v4 liquidity providers: every figure computed by code, explained by a model that is never allowed to state one, in ten languages.",
    heading: "About LiquidityWise",
    lead: "An independent educational advisor for people who provide liquidity on Uniswap v3 and v4. It works out a price range from how far a pair has actually moved, measures what the best-earning positions did, and explains both in plain language.",
    points: [
      {
        title: "The numbers come from code",
        body: "Every figure — a range, a fee, an impermanent loss — is computed from the pool's own data and cross-checked. Only then is a language model allowed to describe it, and it is never allowed to state a number itself.",
      },
      {
        title: "Measured, not guessed",
        body: "Where the best-earning liquidity sits is read from the chain: the fees each position earned since it last changed, divided by what it is worth now. The page says what that figure leaves out.",
      },
      {
        title: "Ten languages, one vocabulary",
        body: "The interface and the explanations are written in ten languages, each in the terms its readers use for liquidity, fees and impermanent loss, and a test holds them to it.",
      },
      {
        title: "Alerts you choose, nothing kept about you",
        body: "An optional Telegram bot tells you when a position leaves its range. Nothing is kept about who reads the site, and the bot stores only what you link yourself.",
      },
    ],
    limitsHeading: "What it does not do",
    limits: [
      "It does not predict prices, promise returns or give financial advice.",
      "It never asks a wallet for a signature or a transaction: the only thing it asks for is a public address, and you can type one instead.",
      "It is not affiliated with Uniswap Labs or the Uniswap Foundation.",
    ],
    factsHeading: "The facts, in one place",
    facts: [
      { label: "Name and address", value: "LiquidityWise · liquiditywise.com" },
      { label: "Covers", value: "Uniswap v3 and v4" },
      { label: "Networks", value: "Ethereum, Base, Arbitrum, Unichain, OP Mainnet, Polygon" },
      { label: "Languages", value: "English, Turkish, German, Spanish, Arabic, Hindi, Chinese (simplified and traditional), Russian, Portuguese" },
      { label: "Status", value: "Independent and educational; free to use" },
    ],
    tryHeading: "Try it",
    tryLinks: { pools: "Find a pool", smart: "Where the best-earning liquidity sits", guide: "The quick guide" },
  },
  tr: {
    link: "Hakkında",
    title: "Hakkında",
    description:
      "LiquidityWise, Uniswap v3 ve v4 likidite sağlayıcıları için bağımsız bir eğitim danışmanıdır: her rakamı kod hesaplar, sayı söylemesine hiç izin verilmeyen bir model açıklar, on dilde.",
    heading: "LiquidityWise hakkında",
    lead: "Uniswap v3 ve v4'te likidite sağlayanlar için bağımsız bir eğitim danışmanı. Bir çiftin gerçekte ne kadar hareket ettiğinden bir fiyat aralığı çıkarır, en çok kazanan pozisyonların ne yaptığını ölçer ve ikisini de sade bir dille anlatır.",
    points: [
      {
        title: "Rakamlar koddan gelir",
        body: "Her rakam — aralık, komisyon, geçici kayıp — havuzun kendi verisinden hesaplanır ve çapraz kontrol edilir. Ancak ondan sonra bir dil modeli anlatabilir ve modelin kendi başına bir sayı söylemesine asla izin verilmez.",
      },
      {
        title: "Tahmin değil, ölçüm",
        body: "En çok kazandıran likiditenin nerede durduğu zincirden okunur: her pozisyonun son değişiminden beri kazandığı komisyon, şimdiki değerine bölünür. Sayfa, bu rakamın neyi dışarıda bıraktığını da söyler.",
      },
      {
        title: "On dil, tek söz dağarcığı",
        body: "Arayüz ve açıklamalar on dilde yazılır; her biri likidite, komisyon ve geçici kayıp için okurlarının kullandığı terimleri kullanır ve bir test bunu denetler.",
      },
      {
        title: "Seçtiğin uyarılar, senin hakkında hiçbir şey saklanmaz",
        body: "İsteğe bağlı bir Telegram botu, bir pozisyon aralığından çıktığında haber verir. Siteyi kimin okuduğu hakkında hiçbir şey saklanmaz; bot yalnızca senin kendi bağladığını saklar.",
      },
    ],
    limitsHeading: "Yapmadıkları",
    limits: [
      "Fiyat tahmin etmez, getiri vaat etmez, yatırım tavsiyesi vermez.",
      "Cüzdandan hiçbir zaman imza ya da işlem istemez: istediği tek şey herkese açık bir adrestir, istersen onu elle de yazabilirsin.",
      "Uniswap Labs veya Uniswap Foundation ile bağlantısı yoktur.",
    ],
    factsHeading: "Bilgiler tek yerde",
    facts: [
      { label: "Ad ve adres", value: "LiquidityWise · liquiditywise.com" },
      { label: "Kapsam", value: "Uniswap v3 ve v4" },
      { label: "Ağlar", value: "Ethereum, Base, Arbitrum, Unichain, OP Mainnet, Polygon" },
      { label: "Diller", value: "İngilizce, Türkçe, Almanca, İspanyolca, Arapça, Hintçe, Çince (basitleştirilmiş ve geleneksel), Rusça, Portekizce" },
      { label: "Durum", value: "Bağımsız ve eğitim amaçlı; kullanımı ücretsiz" },
    ],
    tryHeading: "Dene",
    tryLinks: { pools: "Bir havuz bul", smart: "En çok kazandıran likidite nerede", guide: "Kısa rehber" },
  },
  de: {
    link: "Über uns",
    title: "Über uns",
    description:
      "LiquidityWise ist ein unabhängiger Lernberater für Liquiditätsanbieter auf Uniswap v3 und v4: jede Zahl vom Code berechnet, erklärt von einem Modell, das nie eine Zahl nennen darf, in zehn Sprachen.",
    heading: "Über LiquidityWise",
    lead: "Ein unabhängiger Lernberater für alle, die auf Uniswap v3 und v4 Liquidität bereitstellen. Er leitet einen Preisbereich daraus ab, wie weit sich ein Paar tatsächlich bewegt hat, misst, was die ertragreichsten Positionen getan haben, und erklärt beides in einfacher Sprache.",
    points: [
      {
        title: "Die Zahlen kommen aus dem Code",
        body: "Jede Zahl – ein Bereich, eine Gebühr, ein temporärer Verlust – wird aus den Daten des Pools berechnet und gegengeprüft. Erst dann darf ein Sprachmodell sie beschreiben, und selbst eine Zahl nennen darf es nie.",
      },
      {
        title: "Gemessen, nicht geraten",
        body: "Wo die ertragreichste Liquidität liegt, wird aus der Chain gelesen: die Gebühren, die jede Position seit ihrer letzten Änderung verdient hat, geteilt durch ihren heutigen Wert. Die Seite sagt auch, was diese Zahl auslässt.",
      },
      {
        title: "Zehn Sprachen, ein Vokabular",
        body: "Oberfläche und Erklärungen gibt es in zehn Sprachen, jeweils in den Begriffen, die die Leser für Liquidität, Gebühren und temporären Verlust nutzen; ein Test prüft das.",
      },
      {
        title: "Hinweise nach Wahl, nichts über dich gespeichert",
        body: "Ein optionaler Telegram-Bot meldet, wenn eine Position ihren Bereich verlässt. Über die Leser der Seite wird nichts gespeichert, und der Bot behält nur, was du selbst verknüpfst.",
      },
    ],
    limitsHeading: "Was es nicht tut",
    limits: [
      "Es sagt keine Kurse voraus, verspricht keine Erträge und gibt keine Finanzberatung.",
      "Es verlangt von einer Wallet nie eine Signatur oder Transaktion: Es fragt nur nach einer öffentlichen Adresse, und die kannst du auch selbst eintippen.",
      "Es ist weder mit Uniswap Labs noch mit der Uniswap Foundation verbunden.",
    ],
    factsHeading: "Die Fakten an einem Ort",
    facts: [
      { label: "Name und Adresse", value: "LiquidityWise · liquiditywise.com" },
      { label: "Deckt ab", value: "Uniswap v3 und v4" },
      { label: "Netzwerke", value: "Ethereum, Base, Arbitrum, Unichain, OP Mainnet, Polygon" },
      { label: "Sprachen", value: "Englisch, Türkisch, Deutsch, Spanisch, Arabisch, Hindi, Chinesisch (vereinfacht und traditionell), Russisch, Portugiesisch" },
      { label: "Status", value: "Unabhängig und zum Lernen; kostenlos nutzbar" },
    ],
    tryHeading: "Ausprobieren",
    tryLinks: { pools: "Einen Pool finden", smart: "Wo die ertragreichste Liquidität liegt", guide: "Der Kurzleitfaden" },
  },
  es: {
    link: "Acerca de",
    title: "Acerca de",
    description:
      "LiquidityWise es un asesor educativo independiente para proveedores de liquidez de Uniswap v3 y v4: cada cifra la calcula el código, la explica un modelo al que nunca se le permite dar una, en diez idiomas.",
    heading: "Acerca de LiquidityWise",
    lead: "Un asesor educativo independiente para quienes aportan liquidez en Uniswap v3 y v4. Calcula un rango de precios a partir de cuánto se ha movido realmente un par, mide lo que hicieron las posiciones que más ganan y explica ambas cosas en lenguaje sencillo.",
    points: [
      {
        title: "Las cifras salen del código",
        body: "Cada cifra —un rango, una comisión, una pérdida impermanente— se calcula con los datos del propio pool y se contrasta. Solo entonces un modelo de lenguaje puede describirla, y nunca se le permite decir una cifra por su cuenta.",
      },
      {
        title: "Medido, no adivinado",
        body: "Dónde está la liquidez que más gana se lee de la cadena: las comisiones que cada posición ganó desde su último cambio, divididas entre lo que vale ahora. La página dice también qué deja fuera esa cifra.",
      },
      {
        title: "Diez idiomas, un vocabulario",
        body: "La interfaz y las explicaciones están escritas en diez idiomas, cada uno con los términos que sus lectores usan para liquidez, comisiones y pérdida impermanente, y una prueba lo comprueba.",
      },
      {
        title: "Alertas a tu elección, nada guardado sobre ti",
        body: "Un bot opcional de Telegram avisa cuando una posición sale de su rango. No se guarda nada sobre quién lee el sitio, y el bot solo conserva lo que tú mismo enlazas.",
      },
    ],
    limitsHeading: "Lo que no hace",
    limits: [
      "No predice precios, no promete rendimientos ni da asesoramiento financiero.",
      "Nunca pide a una cartera una firma ni una transacción: solo pide una dirección pública, y puedes escribirla tú.",
      "No está afiliado a Uniswap Labs ni a la Uniswap Foundation.",
    ],
    factsHeading: "Los datos, en un solo sitio",
    facts: [
      { label: "Nombre y dirección", value: "LiquidityWise · liquiditywise.com" },
      { label: "Cubre", value: "Uniswap v3 y v4" },
      { label: "Redes", value: "Ethereum, Base, Arbitrum, Unichain, OP Mainnet, Polygon" },
      { label: "Idiomas", value: "Inglés, turco, alemán, español, árabe, hindi, chino (simplificado y tradicional), ruso, portugués" },
      { label: "Estado", value: "Independiente y educativo; de uso gratuito" },
    ],
    tryHeading: "Pruébalo",
    tryLinks: { pools: "Buscar un pool", smart: "Dónde está la liquidez que más gana", guide: "La guía rápida" },
  },
  ar: {
    link: "حول الموقع",
    title: "حول الموقع",
    description:
      "LiquidityWise مستشار تعليمي مستقل لمزوّدي السيولة في Uniswap v3 وv4: كل رقم يحسبه الكود ويشرحه نموذج لا يُسمح له أبدًا بذكر رقم، بعشر لغات.",
    heading: "حول LiquidityWise",
    lead: "مستشار تعليمي مستقل لمن يوفّرون السيولة في Uniswap v3 وv4. يستخرج نطاق سعر من مقدار ما تحرّك الزوج فعلًا، ويقيس ما فعلته المراكز الأعلى ربحًا، ويشرح الأمرين بلغة بسيطة.",
    points: [
      {
        title: "الأرقام تأتي من الكود",
        body: "كل رقم — نطاق أو رسوم أو خسارة غير دائمة — يُحسب من بيانات المجمّع نفسه ويُدقَّق. وعندها فقط يُسمح لنموذج لغوي بوصفه، ولا يُسمح له أبدًا بذكر رقم بنفسه.",
      },
      {
        title: "مقيس لا مُخمَّن",
        body: "مكان السيولة الأعلى ربحًا يُقرأ من السلسلة: الرسوم التي ربحها كل مركز منذ آخر تغيير له مقسومة على قيمته الآن. وتذكر الصفحة ما يتركه هذا الرقم خارجه.",
      },
      {
        title: "عشر لغات، مفردات واحدة",
        body: "الواجهة والشروح مكتوبة بعشر لغات، وكل لغة بالمصطلحات التي يستخدمها قراؤها للسيولة والرسوم والخسارة غير الدائمة، واختبار يتحقق من ذلك.",
      },
      {
        title: "تنبيهات تختارها، ولا يُحفظ شيء عنك",
        body: "بوت تيليغرام اختياري يخبرك عندما يخرج مركز من نطاقه. لا يُحفظ شيء عمّن يقرأ الموقع، ولا يحتفظ البوت إلا بما تربطه أنت.",
      },
    ],
    limitsHeading: "ما لا يفعله",
    limits: [
      "لا يتنبأ بالأسعار ولا يعد بعوائد ولا يقدّم نصيحة مالية.",
      "لا يطلب من المحفظة توقيعًا ولا معاملة أبدًا: كل ما يطلبه عنوان عام، ويمكنك كتابته بنفسك.",
      "لا ارتباط له بـ Uniswap Labs ولا بمؤسسة Uniswap.",
    ],
    factsHeading: "الحقائق في مكان واحد",
    facts: [
      { label: "الاسم والعنوان", value: "LiquidityWise · liquiditywise.com" },
      { label: "يغطي", value: "Uniswap v3 وv4" },
      { label: "الشبكات", value: "Ethereum وBase وArbitrum وUnichain وOP Mainnet وPolygon" },
      { label: "اللغات", value: "الإنجليزية والتركية والألمانية والإسبانية والعربية والهندية والصينية (المبسطة والتقليدية) والروسية والبرتغالية" },
      { label: "الحالة", value: "مستقل وتعليمي؛ الاستخدام مجاني" },
    ],
    tryHeading: "جرّبه",
    tryLinks: { pools: "ابحث عن مجمّع", smart: "أين توجد السيولة الأعلى ربحًا", guide: "الدليل السريع" },
  },
  hi: {
    link: "परिचय",
    title: "परिचय",
    description:
      "LiquidityWise Uniswap v3 और v4 के लिक्विडिटी प्रदाताओं के लिए एक स्वतंत्र शैक्षिक सलाहकार है: हर आँकड़ा कोड गिनता है, उसे ऐसा मॉडल समझाता है जिसे कभी कोई संख्या बताने की अनुमति नहीं है, दस भाषाओं में।",
    heading: "LiquidityWise के बारे में",
    lead: "Uniswap v3 और v4 पर लिक्विडिटी देने वालों के लिए एक स्वतंत्र शैक्षिक सलाहकार। यह इस आधार पर कीमत का दायरा निकालता है कि जोड़ी असल में कितनी चली है, सबसे ज़्यादा कमाने वाली पोज़िशनों ने क्या किया यह मापता है, और दोनों को सरल भाषा में समझाता है।",
    points: [
      {
        title: "आँकड़े कोड से आते हैं",
        body: "हर आँकड़ा — दायरा, शुल्क, अस्थायी हानि — पूल के अपने डेटा से गिना और दोबारा जाँचा जाता है। उसके बाद ही कोई भाषा मॉडल उसे बता सकता है, और खुद कोई संख्या बताने की उसे कभी अनुमति नहीं है।",
      },
      {
        title: "मापा हुआ, अंदाज़ा नहीं",
        body: "सबसे ज़्यादा कमाने वाली लिक्विडिटी कहाँ है, यह चेन से पढ़ा जाता है: हर पोज़िशन ने पिछले बदलाव के बाद जो शुल्क कमाया, उसे उसके अभी के मूल्य से भाग देकर। पेज यह भी बताता है कि यह आँकड़ा क्या छोड़ देता है।",
      },
      {
        title: "दस भाषाएँ, एक शब्दावली",
        body: "इंटरफ़ेस और व्याख्याएँ दस भाषाओं में लिखी हैं, हर एक में वही शब्द जो उसके पाठक लिक्विडिटी, शुल्क और अस्थायी हानि के लिए इस्तेमाल करते हैं, और एक टेस्ट इसे जाँचता है।",
      },
      {
        title: "अलर्ट आपकी पसंद के, आपके बारे में कुछ संग्रहित नहीं",
        body: "एक वैकल्पिक Telegram बॉट बताता है जब कोई पोज़िशन अपने दायरे से बाहर जाती है। साइट कौन पढ़ता है इसके बारे में कुछ संग्रहित नहीं होता, और बॉट सिर्फ़ वही रखता है जो आप खुद जोड़ते हैं।",
      },
    ],
    limitsHeading: "यह क्या नहीं करता",
    limits: [
      "यह कीमतों का अनुमान नहीं लगाता, मुनाफ़े का वादा नहीं करता, और वित्तीय सलाह नहीं देता।",
      "यह वॉलेट से कभी हस्ताक्षर या लेन-देन नहीं माँगता: वह सिर्फ़ एक सार्वजनिक पता माँगता है, और आप उसे खुद भी लिख सकते हैं।",
      "इसका Uniswap Labs या Uniswap Foundation से कोई संबंध नहीं है।",
    ],
    factsHeading: "तथ्य, एक जगह",
    facts: [
      { label: "नाम और पता", value: "LiquidityWise · liquiditywise.com" },
      { label: "दायरा", value: "Uniswap v3 और v4" },
      { label: "नेटवर्क", value: "Ethereum, Base, Arbitrum, Unichain, OP Mainnet, Polygon" },
      { label: "भाषाएँ", value: "अंग्रेज़ी, तुर्की, जर्मन, स्पेनिश, अरबी, हिंदी, चीनी (सरलीकृत और पारंपरिक), रूसी, पुर्तगाली" },
      { label: "स्थिति", value: "स्वतंत्र और शैक्षिक; इस्तेमाल मुफ़्त" },
    ],
    tryHeading: "आज़माएँ",
    tryLinks: { pools: "पूल खोजें", smart: "सबसे ज़्यादा कमाने वाली लिक्विडिटी कहाँ है", guide: "संक्षिप्त मार्गदर्शिका" },
  },
  zh: {
    link: "关于",
    title: "关于",
    description:
      "LiquidityWise 是面向 Uniswap v3 和 v4 流动性提供者的独立教育顾问：每个数字都由代码计算，由一个永远不允许自己说出数字的模型来解释，支持十种语言。",
    heading: "关于 LiquidityWise",
    lead: "一个面向在 Uniswap v3 和 v4 上提供流动性的人的独立教育顾问。它根据交易对实际的波动幅度算出价格区间，测量收益最高的仓位做了什么，并用通俗的语言解释这两件事。",
    points: [
      {
        title: "数字来自代码",
        body: "每个数字——区间、手续费、无常损失——都由资金池自己的数据计算并交叉核对。只有这之后，语言模型才可以描述它，而且它永远不允许自己说出一个数字。",
      },
      {
        title: "测出来的，不是猜的",
        body: "收益最高的流动性在哪里，是从链上读取的：每个仓位自上次变动以来赚取的手续费，除以它现在的价值。页面也会说明这个数字遗漏了什么。",
      },
      {
        title: "十种语言，同一套用语",
        body: "界面和解释以十种语言写成，每种都使用其读者对流动性、手续费和无常损失的惯用说法，并有测试来保证。",
      },
      {
        title: "提醒由你选择，不保存关于你的任何信息",
        body: "可选的 Telegram 机器人会在仓位离开区间时通知你。不保存任何关于谁在阅读本站的信息，机器人只保存你自己关联的内容。",
      },
    ],
    limitsHeading: "它不做什么",
    limits: [
      "它不预测价格，不承诺收益，也不提供财务建议。",
      "它从不向钱包索要签名或交易：它只要一个公开地址，你也可以自己输入。",
      "它与 Uniswap Labs 或 Uniswap Foundation 没有任何关联。",
    ],
    factsHeading: "基本信息，一处看全",
    facts: [
      { label: "名称与网址", value: "LiquidityWise · liquiditywise.com" },
      { label: "覆盖", value: "Uniswap v3 和 v4" },
      { label: "网络", value: "Ethereum、Base、Arbitrum、Unichain、OP Mainnet、Polygon" },
      { label: "语言", value: "英语、土耳其语、德语、西班牙语、阿拉伯语、印地语、中文（简体和繁体）、俄语、葡萄牙语" },
      { label: "性质", value: "独立、教育性质；免费使用" },
    ],
    tryHeading: "试一试",
    tryLinks: { pools: "查找资金池", smart: "收益最高的流动性在哪里", guide: "快速指南" },
  },
  ru: {
    link: "О проекте",
    title: "О проекте",
    description:
      "LiquidityWise — независимый обучающий советник для поставщиков ликвидности Uniswap v3 и v4: каждую цифру считает код, объясняет модель, которой никогда не разрешено называть число, на десяти языках.",
    heading: "О LiquidityWise",
    lead: "Независимый обучающий советник для тех, кто предоставляет ликвидность на Uniswap v3 и v4. Он выводит ценовой диапазон из того, насколько пара реально двигалась, измеряет, что делали самые прибыльные позиции, и объясняет и то и другое простым языком.",
    points: [
      {
        title: "Цифры берутся из кода",
        body: "Каждая цифра — диапазон, комиссия, временная потеря — считается по данным самого пула и перепроверяется. Только после этого языковой модели разрешено её описать, а назвать число самой ей не разрешено никогда.",
      },
      {
        title: "Измерено, а не угадано",
        body: "Где лежит самая прибыльная ликвидность, читается из сети: комиссии, которые каждая позиция заработала с последнего изменения, делённые на её текущую стоимость. Страница говорит и о том, что эта цифра не учитывает.",
      },
      {
        title: "Десять языков, одна терминология",
        body: "Интерфейс и объяснения написаны на десяти языках, каждый — теми словами, которыми его читатели называют ликвидность, комиссии и временную потерю, и это проверяет тест.",
      },
      {
        title: "Уведомления по вашему выбору, о вас ничего не хранится",
        body: "Необязательный Telegram-бот сообщает, когда позиция выходит из диапазона. О том, кто читает сайт, ничего не хранится, а бот держит только то, что вы привязали сами.",
      },
    ],
    limitsHeading: "Чего он не делает",
    limits: [
      "Он не предсказывает цены, не обещает доходность и не даёт финансовых советов.",
      "Он никогда не просит у кошелька подпись или транзакцию: нужен лишь публичный адрес, и его можно ввести вручную.",
      "Он не связан с Uniswap Labs и Uniswap Foundation.",
    ],
    factsHeading: "Факты в одном месте",
    facts: [
      { label: "Название и адрес", value: "LiquidityWise · liquiditywise.com" },
      { label: "Охват", value: "Uniswap v3 и v4" },
      { label: "Сети", value: "Ethereum, Base, Arbitrum, Unichain, OP Mainnet, Polygon" },
      { label: "Языки", value: "английский, турецкий, немецкий, испанский, арабский, хинди, китайский (упрощённый и традиционный), русский, португальский" },
      { label: "Статус", value: "Независимый и обучающий; пользоваться бесплатно" },
    ],
    tryHeading: "Попробуйте",
    tryLinks: { pools: "Найти пул", smart: "Где лежит самая прибыльная ликвидность", guide: "Краткое руководство" },
  },
  pt: {
    link: "Sobre",
    title: "Sobre",
    description:
      "O LiquidityWise é um consultor educativo independente para provedores de liquidez da Uniswap v3 e v4: cada número é calculado pelo código, explicado por um modelo a quem nunca é permitido dizer um, em dez idiomas.",
    heading: "Sobre o LiquidityWise",
    lead: "Um consultor educativo independente para quem fornece liquidez na Uniswap v3 e v4. Ele calcula uma faixa de preço a partir do quanto um par realmente se moveu, mede o que fizeram as posições que mais rendem e explica as duas coisas em linguagem simples.",
    points: [
      {
        title: "Os números vêm do código",
        body: "Cada número — uma faixa, uma taxa, uma perda impermanente — é calculado a partir dos dados do próprio pool e conferido. Só então um modelo de linguagem pode descrevê-lo, e nunca lhe é permitido dizer um número por conta própria.",
      },
      {
        title: "Medido, não adivinhado",
        body: "Onde está a liquidez que mais rende é lido da cadeia: as taxas que cada posição ganhou desde a última alteração, divididas pelo que vale agora. A página diz também o que esse número deixa de fora.",
      },
      {
        title: "Dez idiomas, um vocabulário",
        body: "A interface e as explicações são escritas em dez idiomas, cada um com os termos que seus leitores usam para liquidez, taxas e perda impermanente, e um teste confere isso.",
      },
      {
        title: "Alertas à sua escolha, nada guardado sobre você",
        body: "Um bot opcional do Telegram avisa quando uma posição sai da faixa. Nada é guardado sobre quem lê o site, e o bot só guarda o que você mesmo vincula.",
      },
    ],
    limitsHeading: "O que ele não faz",
    limits: [
      "Não prevê preços, não promete retornos e não dá aconselhamento financeiro.",
      "Nunca pede a uma carteira uma assinatura ou uma transação: só pede um endereço público, e você pode digitá-lo.",
      "Não tem ligação com a Uniswap Labs nem com a Uniswap Foundation.",
    ],
    factsHeading: "Os fatos num só lugar",
    facts: [
      { label: "Nome e endereço", value: "LiquidityWise · liquiditywise.com" },
      { label: "Cobre", value: "Uniswap v3 e v4" },
      { label: "Redes", value: "Ethereum, Base, Arbitrum, Unichain, OP Mainnet, Polygon" },
      { label: "Idiomas", value: "inglês, turco, alemão, espanhol, árabe, hindi, chinês (simplificado e tradicional), russo, português" },
      { label: "Situação", value: "Independente e educativo; uso gratuito" },
    ],
    tryHeading: "Experimente",
    tryLinks: { pools: "Encontrar um pool", smart: "Onde está a liquidez que mais rende", guide: "O guia rápido" },
  },
  "zh-Hant": {
    link: "關於",
    title: "關於",
    description:
      "LiquidityWise 是為 Uniswap v3 與 v4 流動性提供者打造的獨立教育顧問：每個數字都由程式碼計算，由一個永遠不被允許說出數字的模型來解釋，支援十種語言。",
    heading: "關於 LiquidityWise",
    lead: "一個為在 Uniswap v3 與 v4 上提供流動性的人打造的獨立教育顧問。它根據交易對實際的波動幅度算出價格區間，測量收益最高的倉位做了什麼，並用淺白的語言解釋這兩件事。",
    points: [
      {
        title: "數字來自程式碼",
        body: "每個數字——區間、手續費、無常損失——都由資金池自己的資料計算並交叉核對。只有這之後，語言模型才可以描述它，而且它永遠不被允許自己說出一個數字。",
      },
      {
        title: "測出來的，不是猜的",
        body: "收益最高的流動性在哪裡，是從鏈上讀取的：每個倉位自上次變動以來賺取的手續費，除以它現在的價值。頁面也會說明這個數字遺漏了什麼。",
      },
      {
        title: "十種語言，同一套用語",
        body: "介面與解釋以十種語言寫成，每種都使用其讀者對流動性、手續費和無常損失的慣用說法，並有測試來保證。",
      },
      {
        title: "提醒由你選擇，不儲存關於你的任何資訊",
        body: "可選的 Telegram 機器人會在倉位離開區間時通知你。不儲存任何關於誰在閱讀本站的資訊，機器人只保存你自己關聯的內容。",
      },
    ],
    limitsHeading: "它不做什麼",
    limits: [
      "它不預測價格，不承諾收益，也不提供財務建議。",
      "它從不向錢包索取簽名或交易：它只要一個公開地址，你也可以自己輸入。",
      "它與 Uniswap Labs 或 Uniswap Foundation 沒有任何關聯。",
    ],
    factsHeading: "基本資訊，一處看全",
    facts: [
      { label: "名稱與網址", value: "LiquidityWise · liquiditywise.com" },
      { label: "涵蓋", value: "Uniswap v3 與 v4" },
      { label: "網路", value: "Ethereum、Base、Arbitrum、Unichain、OP Mainnet、Polygon" },
      { label: "語言", value: "英語、土耳其語、德語、西班牙語、阿拉伯語、印地語、中文（簡體與繁體）、俄語、葡萄牙語" },
      { label: "性質", value: "獨立、教育性質；免費使用" },
    ],
    tryHeading: "試一試",
    tryLinks: { pools: "尋找資金池", smart: "收益最高的流動性在哪裡", guide: "快速指南" },
  },
};

export const getAboutCopy = (locale: Locale): AboutCopy => COPY[locale];
