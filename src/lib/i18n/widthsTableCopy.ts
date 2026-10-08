import type { Locale } from "./locales";

/*
 * The words of the "narrow or wide?" table on a pool's page: the same month,
 * replayed at every width the form offers, one row each (advisor/widthsTable.ts).
 *
 * Labels and sentences, never a figure with a noun that would have to agree
 * with it: every count, date, price and dollar amount arrives written. The
 * figures the table shares with the panels it is drawn from — the width's
 * name, days inside, worth against holding, why fees are withheld or unread,
 * what a hook may do to a swap — keep those panels' own words, so one figure
 * is never named two ways on one page. Every other term is the one the rest
 * of the site uses in that language for a range, a width, fees, a position
 * and a swap.
 *
 * Two templates are arithmetic rather than prose and read the same in every
 * language: three day counts separated by slashes, and two end values with an
 * arrow from never re-centred to re-centred. The arrow between the figures
 * points right in Arabic too — the panel lays that pair out left to right, as
 * every figure on the site is — while the arrow between the Arabic *words* of
 * the column's label follows the reading direction and points left.
 *
 * What the table leaves out is said under it every time: gas unless a cost
 * was set, price impact, a hook that may alter swaps; and that it is the past
 * month replayed, not a forecast, and no recommendation.
 */

export type WidthsTableCopy = {
  readonly heading: string;
  readonly intro: string;
  /** The history cannot hold a month to replay, so there is nothing to compare. */
  readonly noHistory: string;
  /** The close every row opens at, already written. */
  readonly openedOn: (date: string) => string;
  readonly tableCaption: string;
  readonly columnWidth: string;
  /** The range each width was drawn to at the opening, not today's. */
  readonly columnRange: string;
  /** Three counts: wholly inside, across an edge, wholly outside. */
  readonly columnDays: string;
  /** Three counts, already written, in that order. */
  readonly daysValue: (inside: string, crossing: string, outside: string) => string;
  readonly columnFees: (deposit: string) => string;
  readonly columnWorth: string;
  readonly columnRecentres: string;
  readonly columnEndValue: string;
  readonly columnEndValueBeforeFees: string;
  /** Never re-centred → re-centred, both already written. */
  readonly endValues: (never: string, recentred: string) => string;
  readonly columnDifference: string;
  readonly share: string;
  readonly columnsNote: string;
  /** Gas counted at this cost per re-centre, already written. */
  readonly gasCounted: (each: string) => string;
  readonly gasNotCounted: string;
  readonly noImpact: string;
  readonly caveat: string;
};

const COPY: Record<Locale, WidthsTableCopy> = {
  en: {
    heading: "Narrow or wide? Every width, the same month",
    intro:
      "The month replayed above, once per width the form offers. Every row opens at the same close, in the range this method would have drawn then at that width, and is read over the same thirty days: how the days sat against it, the fees the same deposit would have taken, the worth against holding, and what re-centring at that width would have done. Each row is what the panels above would say with that width chosen — computed by the same functions, not re-estimated.",
    noHistory:
      "There are not enough daily closes before the last thirty days to draw a range at any width where the month replayed opens, so there is nothing to compare here.",
    openedOn: (date) => `Every row opens at the close of ${date}.`,
    tableCaption: "The same month at every width",
    columnWidth: "Width",
    columnRange: "Range at the opening",
    columnDays: "Days inside / across an edge / outside",
    daysValue: (inside, crossing, outside) => `${inside} / ${crossing} / ${outside}`,
    columnFees: (deposit) => `Fees on ${deposit}`,
    columnWorth: "Against holding",
    columnRecentres: "Re-centres",
    columnEndValue: "End value, never → re-centred",
    columnEndValueBeforeFees: "End value before fees, never → re-centred",
    endValues: (never, recentred) => `${never} → ${recentred}`,
    columnDifference: "What re-centring changed",
    share: "Share this table",
    columnsNote:
      "The range is the one drawn at the opening at that width, not today's — today's is in the table above. The days, the fees and the worth against holding are the month replayed's figures for that range; the fees are the deposit's share of what the pool charged on the days the price stayed wholly inside, as the deposit panel shares them, with the deposit sized at today's dollar rate. The last three columns are the re-centring strategy's: how many closes outside there were to re-centre on, what the position ends worth never re-centred and re-centred, and the difference between the two.",
    gasCounted: (each) => `Gas is counted at ${each} per re-centre, as set in the re-centring panel.`,
    gasNotCounted:
      "Gas is not counted: no cost per re-centre has been set. Set one in the re-centring panel and it is counted here too.",
    noImpact:
      "Price impact is not modelled: every re-centre's swap is priced at the day's close, as if the pool were deep enough for it, and a real swap would have moved the price against itself.",
    caveat:
      "This is the past month replayed, not a forecast: it says what each width did on days that already happened, and nothing about the days to come. None of these rows is a recommendation — a narrower range takes more on the days it holds and nothing on the days it does not, and which matters more depends on what the position is for, which nothing here knows.",
  },

  tr: {
    heading: "Dar mı geniş mi? Her genişlik, aynı ay",
    intro:
      "Yukarıda yeniden oynatılan ay, formun sunduğu her genişlik için bir kez. Her satır aynı kapanışta, bu yöntemin o gün o genişlikte çizeceği aralıkta açılır ve aynı otuz gün üzerinde okunur: günlerin aralığa göre nerede durduğu, aynı yatırımın alacağı komisyon, elde tutmaya göre değer ve o genişlikte yeniden ortalamanın ne yapacağı. Her satır, o genişlik seçilseydi yukarıdaki panellerin söyleyeceği şeydir — aynı fonksiyonlarla hesaplanmış, yeniden tahmin edilmemiş.",
    noHistory:
      "Son otuz günden önce, yeniden oynatılan ayın açıldığı yerde herhangi bir genişlikte aralık çizmeye yetecek günlük kapanış yok; burada karşılaştırılacak bir şey yok.",
    openedOn: (date) => `Her satır ${date} kapanışında açılır.`,
    tableCaption: "Her genişlikte aynı ay",
    columnWidth: "Genişlik",
    columnRange: "Açılıştaki aralık",
    columnDays: "Gün: içeride / kenarı geçen / dışarıda",
    daysValue: (inside, crossing, outside) => `${inside} / ${crossing} / ${outside}`,
    columnFees: (deposit) => `${deposit} ile komisyon`,
    columnWorth: "Elde tutmaya göre",
    columnRecentres: "Yeniden ortalama",
    columnEndValue: "Son değer, hiç ortalanmayan → ortalanan",
    columnEndValueBeforeFees: "Komisyon hariç son değer, hiç ortalanmayan → ortalanan",
    endValues: (never, recentred) => `${never} → ${recentred}`,
    columnDifference: "Yeniden ortalamanın değiştirdiği",
    share: "Bu tabloyu paylaş",
    columnsNote:
      "Aralık, o genişlikte açılışta çizilen aralıktır, bugünkü değil — bugünkü yukarıdaki tabloda. Günler, komisyon ve elde tutmaya göre değer, yeniden oynatılan ayın o aralık için verdiği rakamlardır; komisyon, fiyatın tamamen içeride kaldığı günlerde havuzun aldığından yatırımın payıdır, yatırım panelinin paylaştırdığı gibi, yatırım bugünkü dolar kuruyla ölçülür. Son üç sütun yeniden ortalama stratejisinin: üzerinde yeniden ortalanacak kaç dışarıda kapanış olduğu, pozisyonun hiç ortalanmadan ve ortalanarak kaça kapandığı ve ikisi arasındaki fark.",
    gasCounted: (each) => `Gas, yeniden ortalama panelinde ayarlandığı gibi, yeniden ortalama başına ${each} olarak sayılır.`,
    gasNotCounted:
      "Gas sayılmadı: yeniden ortalama başına bir maliyet ayarlanmadı. Yeniden ortalama panelinde ayarlanırsa burada da sayılır.",
    noImpact:
      "Fiyat etkisi modellenmedi: her yeniden ortalamanın takası, havuz ona yetecek kadar derinmiş gibi günün kapanışıyla fiyatlanır; gerçek bir takas fiyatı kendi aleyhine oynatırdı.",
    caveat:
      "Bu, geçen ayın yeniden oynatılmasıdır, bir tahmin değil: her genişliğin zaten yaşanmış günlerde ne yaptığını söyler, gelecek günler hakkında hiçbir şey söylemez. Bu satırların hiçbiri bir tavsiye değildir — daha dar bir aralık tuttuğu günlerde daha çok, tutmadığı günlerde hiç komisyon alır; hangisinin daha önemli olduğu pozisyonun ne için olduğuna bağlıdır, bunu da burada hiçbir şey bilmez.",
  },

  de: {
    heading: "Eng oder breit? Jede Breite, derselbe Monat",
    intro:
      "Der oben nachgespielte Monat, einmal je Breite, die das Formular anbietet. Jede Zeile eröffnet am selben Schlusskurs, in dem Bereich, den die Methode damals in dieser Breite gezogen hätte, und wird über dieselben dreißig Tage gelesen: wie die Tage zum Bereich lagen, welche Gebühren dieselbe Einlage eingenommen hätte, der Wert gegenüber dem Halten und was Neuzentrieren in dieser Breite bewirkt hätte. Jede Zeile ist, was die Panels oben sagen würden, wäre diese Breite gewählt — mit denselben Funktionen berechnet, nicht neu geschätzt.",
    noHistory:
      "Vor den letzten dreißig Tagen gibt es nicht genug Tagesschlusskurse, um dort, wo der nachgespielte Monat eröffnet, in irgendeiner Breite einen Bereich zu ziehen; hier gibt es nichts zu vergleichen.",
    openedOn: (date) => `Jede Zeile eröffnet zum Schlusskurs vom ${date}.`,
    tableCaption: "Derselbe Monat in jeder Breite",
    columnWidth: "Breite",
    columnRange: "Bereich bei Eröffnung",
    columnDays: "Tage innerhalb / über eine Kante / außerhalb",
    daysValue: (inside, crossing, outside) => `${inside} / ${crossing} / ${outside}`,
    columnFees: (deposit) => `Gebühren bei ${deposit}`,
    columnWorth: "Gegenüber dem Halten",
    columnRecentres: "Neuzentrierungen",
    columnEndValue: "Endwert, nie → neu zentriert",
    columnEndValueBeforeFees: "Endwert vor Gebühren, nie → neu zentriert",
    endValues: (never, recentred) => `${never} → ${recentred}`,
    columnDifference: "Was Neuzentrieren änderte",
    share: "Diese Tabelle teilen",
    columnsNote:
      "Der Bereich ist der bei Eröffnung in dieser Breite gezogene, nicht der heutige — der heutige steht in der Tabelle darüber. Tage, Gebühren und Wert gegenüber dem Halten sind die Zahlen des nachgespielten Monats für diesen Bereich; die Gebühren sind der Anteil der Einlage an dem, was der Pool an den Tagen einnahm, an denen der Preis ganz innerhalb blieb, verteilt wie im Einlage-Panel, mit der Einlage zum heutigen Dollarkurs bemessen. Die letzten drei Spalten gehören der Neuzentrierungs-Strategie: wie viele Schlusskurse außerhalb es zum Neuzentrieren gab, womit die Position nie neu zentriert und neu zentriert endet, und die Differenz der beiden.",
    gasCounted: (each) => `Gas wird mit ${each} je Neuzentrierung gezählt, wie im Neuzentrierungs-Panel gesetzt.`,
    gasNotCounted:
      "Gas wird nicht gezählt: es ist kein Preis je Neuzentrierung gesetzt. Wird im Neuzentrierungs-Panel einer gesetzt, zählt er auch hier.",
    noImpact:
      "Preiseinfluss ist nicht modelliert: der Tausch jeder Neuzentrierung wird zum Tagesschluss bepreist, als wäre der Pool tief genug dafür; ein echter Tausch hätte den Preis gegen sich bewegt.",
    caveat:
      "Dies ist der vergangene Monat nachgespielt, keine Vorhersage: es sagt, was jede Breite an Tagen getan hat, die schon vorbei sind, und nichts über die kommenden. Keine dieser Zeilen ist eine Empfehlung — ein engerer Bereich nimmt an den Tagen, die er hält, mehr ein und an den anderen nichts, und was davon mehr zählt, hängt davon ab, wofür die Position da ist, was hier nichts weiß.",
  },

  es: {
    heading: "¿Estrecho o ancho? Cada amplitud, el mismo mes",
    intro:
      "El mes reproducido arriba, una vez por cada amplitud que ofrece el formulario. Cada fila abre en el mismo cierre, en el rango que este método habría trazado entonces con esa amplitud, y se lee sobre los mismos treinta días: cómo quedaron los días respecto al rango, las comisiones que habría cobrado el mismo depósito, el valor frente a mantener y lo que habría hecho recentrar con esa amplitud. Cada fila es lo que dirían los paneles de arriba con esa amplitud elegida — calculada con las mismas funciones, no estimada de nuevo.",
    noHistory:
      "No hay suficientes cierres diarios antes de los últimos treinta días para trazar un rango de ninguna amplitud donde abre el mes reproducido, así que aquí no hay nada que comparar.",
    openedOn: (date) => `Cada fila abre en el cierre del ${date}.`,
    tableCaption: "El mismo mes en cada amplitud",
    columnWidth: "Amplitud",
    columnRange: "Rango en la apertura",
    columnDays: "Días dentro / cruzando un borde / fuera",
    daysValue: (inside, crossing, outside) => `${inside} / ${crossing} / ${outside}`,
    columnFees: (deposit) => `Comisiones con ${deposit}`,
    columnWorth: "Frente a mantener",
    columnRecentres: "Recentrados",
    columnEndValue: "Valor final, nunca → recentrada",
    columnEndValueBeforeFees: "Valor final antes de comisiones, nunca → recentrada",
    endValues: (never, recentred) => `${never} → ${recentred}`,
    columnDifference: "Lo que cambió recentrar",
    share: "Compartir esta tabla",
    columnsNote:
      "El rango es el trazado en la apertura con esa amplitud, no el de hoy — el de hoy está en la tabla de arriba. Los días, las comisiones y el valor frente a mantener son las cifras del mes reproducido para ese rango; las comisiones son la parte del depósito en lo que cobró el pool los días en que el precio se mantuvo enteramente dentro, repartidas como las reparte el panel del depósito, con el depósito dimensionado al tipo en dólares de hoy. Las tres últimas columnas son de la estrategia de recentrar: cuántos cierres fuera hubo para recentrar, en cuánto acaba la posición nunca recentrada y recentrada, y la diferencia entre ambas.",
    gasCounted: (each) => `El gas se cuenta a ${each} por recentrado, como se fijó en el panel de recentrar.`,
    gasNotCounted:
      "El gas no se cuenta: no se ha fijado un coste por recentrado. Fíjalo en el panel de recentrar y se contará también aquí.",
    noImpact:
      "No se modela el impacto en el precio: el intercambio de cada recentrado se valora al cierre del día, como si el pool fuera lo bastante profundo, y un intercambio real habría movido el precio en su contra.",
    caveat:
      "Esto es el mes pasado reproducido, no una previsión: dice lo que hizo cada amplitud en días que ya ocurrieron y nada sobre los que vienen. Ninguna de estas filas es una recomendación — un rango más estrecho cobra más los días que aguanta y nada los días que no, y cuál pesa más depende de para qué sea la posición, que aquí nada sabe.",
  },

  ar: {
    heading: "ضيّق أم واسع؟ كل اتساع، الشهر نفسه",
    intro:
      "الشهر المُعاد تطبيقه أعلاه، مرةً لكل اتساع يعرضه النموذج. كل صف يُفتح عند الإغلاق نفسه، في النطاق الذي كانت هذه الطريقة سترسمه حينها بذلك الاتساع، ويُقرأ على الأيام الثلاثين نفسها: كيف وقعت الأيام بالنسبة إلى النطاق، والرسوم التي كان الإيداع نفسه سيحصّلها، والقيمة مقارنةً بالاحتفاظ، وما كانت إعادة التوسيط بذلك الاتساع ستفعله. كل صف هو ما كانت اللوحات أعلاه ستقوله لو اختير ذلك الاتساع — محسوبًا بالدوال نفسها، لا مُقدَّرًا من جديد.",
    noHistory:
      "لا توجد إغلاقات يومية كافية قبل الأيام الثلاثين الأخيرة لرسم نطاق بأي اتساع حيث يُفتح الشهر المُعاد تطبيقه، فلا شيء هنا يُقارَن.",
    openedOn: (date) => `كل صف يُفتح عند إغلاق ${date}.`,
    tableCaption: "الشهر نفسه بكل اتساع",
    columnWidth: "الاتساع",
    columnRange: "النطاق عند الافتتاح",
    columnDays: "أيام داخل / عبرت حافة / خارج",
    daysValue: (inside, crossing, outside) => `${inside} / ${crossing} / ${outside}`,
    columnFees: (deposit) => `الرسوم بإيداع ${deposit}`,
    columnWorth: "مقارنةً بالاحتفاظ",
    columnRecentres: "مرات إعادة التوسيط",
    /* Between Arabic words the arrow follows the reading direction; between the figures below it stays → (see the module comment). */
    columnEndValue: "القيمة النهائية، بلا إعادة توسيط ← مع إعادة التوسيط",
    columnEndValueBeforeFees: "القيمة النهائية قبل الرسوم، بلا إعادة توسيط ← مع إعادة التوسيط",
    endValues: (never, recentred) => `${never} → ${recentred}`,
    columnDifference: "ما غيّرته إعادة التوسيط",
    share: "شارك هذا الجدول",
    columnsNote:
      "النطاق هو المرسوم عند الافتتاح بذلك الاتساع، لا نطاق اليوم — نطاق اليوم في الجدول أعلاه. الأيام والرسوم والقيمة مقارنةً بالاحتفاظ هي أرقام الشهر المُعاد تطبيقه لذلك النطاق؛ والرسوم هي حصة الإيداع ممّا حصّله التجمّع في الأيام التي بقي فيها السعر داخل النطاق بالكامل، موزَّعةً كما توزّعها لوحة الإيداع، والإيداع مقدَّر بسعر الدولار اليوم. والأعمدة الثلاثة الأخيرة لاستراتيجية إعادة التوسيط: كم إغلاقًا خارج النطاق كان هناك لإعادة التوسيط عنده، وبكم ينتهي المركز بلا إعادة توسيط ومعها، والفرق بينهما.",
    gasCounted: (each) => `يُحتسب الغاز بـ ${each} لكل إعادة توسيط، كما ضُبط في لوحة إعادة التوسيط.`,
    gasNotCounted:
      "لا يُحتسب الغاز: لم تُضبط تكلفة لكل إعادة توسيط. اضبطها في لوحة إعادة التوسيط فتُحتسب هنا أيضًا.",
    noImpact:
      "أثر السعر غير منمذج: تبادل كل إعادة توسيط يُسعَّر بإغلاق اليوم كما لو كان التجمّع عميقًا بما يكفي له، والتبادل الحقيقي كان سيحرّك السعر ضدّ نفسه.",
    caveat:
      "هذا هو الشهر الماضي مُعادًا تطبيقه، لا توقّع: يقول ما فعله كل اتساع في أيام مضت، ولا شيء عن الأيام المقبلة. ليس أيّ من هذه الصفوف نصيحة — النطاق الأضيق يأخذ أكثر في الأيام التي يصمد فيها ولا شيء في الأيام التي لا يصمد فيها، وأيّهما أهم يعتمد على الغرض من المركز، وهو ما لا يعرفه شيء هنا.",
  },

  hi: {
    heading: "संकरा या चौड़ा? हर चौड़ाई, वही महीना",
    intro:
      "ऊपर दोबारा चलाया गया महीना, फ़ॉर्म की हर चौड़ाई के लिए एक बार। हर पंक्ति उसी बंद भाव पर, उस दायरे में खुलती है जो यह विधि तब उस चौड़ाई पर बनाती, और उन्हीं तीस दिनों पर पढ़ी जाती है: दिन दायरे के मुक़ाबले कहाँ रहे, उसी जमा को कितना शुल्क मिलता, रखे रहने की तुलना में मूल्य, और उस चौड़ाई पर पुनःकेंद्रण क्या करता। हर पंक्ति वही है जो ऊपर के पैनल उस चौड़ाई को चुनने पर कहते — उन्हीं फ़ंक्शनों से गिनी गई, दोबारा अनुमानित नहीं।",
    noHistory:
      "पिछले तीस दिनों से पहले इतने दैनिक बंद भाव नहीं हैं कि जहाँ दोबारा चलाया गया महीना खुलता है वहाँ किसी भी चौड़ाई का दायरा बनाया जा सके, इसलिए यहाँ तुलना के लिए कुछ नहीं है।",
    openedOn: (date) => `हर पंक्ति ${date} के बंद भाव पर खुलती है।`,
    tableCaption: "हर चौड़ाई पर वही महीना",
    columnWidth: "चौड़ाई",
    columnRange: "खुलने पर दायरा",
    columnDays: "दिन भीतर / किनारा पार / बाहर",
    daysValue: (inside, crossing, outside) => `${inside} / ${crossing} / ${outside}`,
    columnFees: (deposit) => `${deposit} पर शुल्क`,
    columnWorth: "रखे रहने की तुलना में",
    columnRecentres: "पुनःकेंद्रण",
    columnEndValue: "अंतिम मूल्य, बिना → पुनःकेंद्रण के साथ",
    columnEndValueBeforeFees: "शुल्क से पहले अंतिम मूल्य, बिना → पुनःकेंद्रण के साथ",
    endValues: (never, recentred) => `${never} → ${recentred}`,
    columnDifference: "पुनःकेंद्रण ने क्या बदला",
    share: "यह तालिका साझा करें",
    columnsNote:
      "दायरा वह है जो खुलने पर उस चौड़ाई पर बना था, आज का नहीं — आज का ऊपर की तालिका में है। दिन, शुल्क और रखे रहने की तुलना में मूल्य उस दायरे के लिए दोबारा चलाए गए महीने के अंक हैं; शुल्क उन दिनों पूल ने जो लिया उसमें जमा का हिस्सा है जब कीमत पूरी तरह भीतर रही, जैसे जमा पैनल उसे बाँटता है, जमा आज की डॉलर दर पर मापी गई। आख़िरी तीन कॉलम पुनःकेंद्रण रणनीति के हैं: बाहर कितने बंद भाव थे जिन पर पुनःकेंद्रण हुआ, पोज़िशन बिना और पुनःकेंद्रण के साथ कितने पर समाप्त होती है, और दोनों का अंतर।",
    gasCounted: (each) => `गैस प्रति पुनःकेंद्रण ${each} गिनी जाती है, जैसा पुनःकेंद्रण पैनल में तय किया गया।`,
    gasNotCounted:
      "गैस नहीं गिनी जाती: प्रति पुनःकेंद्रण कोई लागत तय नहीं है। पुनःकेंद्रण पैनल में तय करें तो यहाँ भी गिनी जाएगी।",
    noImpact:
      "कीमत पर असर का मॉडल नहीं है: हर पुनःकेंद्रण का स्वैप दिन के बंद भाव पर गिना जाता है, मानो पूल उसके लिए काफ़ी गहरा हो; असली स्वैप कीमत को अपने विरुद्ध हिला देता।",
    caveat:
      "यह बीता महीना दोबारा चलाया गया है, पूर्वानुमान नहीं: यह बताता है कि हर चौड़ाई ने बीत चुके दिनों में क्या किया, आने वाले दिनों के बारे में कुछ नहीं। इनमें से कोई पंक्ति सलाह नहीं है — संकरा दायरा जिन दिनों टिकता है उनमें ज़्यादा लेता है और बाक़ी दिनों में कुछ नहीं, और कौन-सा ज़्यादा मायने रखता है यह इस पर निर्भर है कि पोज़िशन किसलिए है, जो यहाँ कोई नहीं जानता।",
  },

  zh: {
    heading: "窄还是宽？每种宽度，同一个月",
    intro:
      "上面重放的那个月，按表单提供的每种宽度各算一次。每一行都在同一个收盘价开仓，区间是这个方法当时按那种宽度会画出的区间，并在同样的三十天上读取：这些天相对区间的位置、同一笔资金本可以收到的手续费、相对持有的价值，以及按那种宽度重新居中会怎样。每一行就是选了那种宽度后上面各面板会说的内容——用同样的函数算出，不是重新估计。",
    noHistory: "最近三十天之前的日收盘价不够，无法在重放的那个月开仓的位置画出任何宽度的区间，所以这里没有可比较的内容。",
    openedOn: (date) => `每一行都在 ${date} 的收盘价开仓。`,
    tableCaption: "每种宽度下的同一个月",
    columnWidth: "宽度",
    columnRange: "开仓时的区间",
    columnDays: "天数：在内 / 越过边界 / 在外",
    daysValue: (inside, crossing, outside) => `${inside} / ${crossing} / ${outside}`,
    columnFees: (deposit) => `存入 ${deposit} 的手续费`,
    columnWorth: "相对持有",
    columnRecentres: "重新居中次数",
    columnEndValue: "期末价值，从不 → 重新居中",
    columnEndValueBeforeFees: "未计手续费收入的期末价值，从不 → 重新居中",
    endValues: (never, recentred) => `${never} → ${recentred}`,
    columnDifference: "重新居中改变了多少",
    share: "分享这张表",
    columnsNote:
      "区间是开仓时按那种宽度画出的区间，不是今天的——今天的在上面那张表里。天数、手续费和相对持有的价值是重放的那个月对该区间给出的数字；手续费是价格全天在区间内的那些天里，这笔资金在池子收取的手续费中的份额，分配方式与资金面板相同，资金按今天的美元汇率换算。最后三列属于重新居中策略：有多少次收盘在区间外可供重新居中，仓位在从不重新居中和重新居中两种情况下各以多少收尾，以及两者之差。",
    gasCounted: (each) => `gas 按每次重新居中 ${each} 计入，与重新居中面板中的设置一致。`,
    gasNotCounted: "不计 gas：没有设置每次重新居中的成本。在重新居中面板里设置后，这里也会计入。",
    noImpact: "没有模拟价格冲击：每次重新居中的兑换都按当天收盘价计价，好像池子足够深；真实的兑换会把价格推向对自己不利的方向。",
    caveat:
      "这是对过去一个月的重放，不是预测：它说的是每种宽度在已经过去的日子里做了什么，对接下来的日子什么也说明不了。这些行中没有一行是建议——更窄的区间在它守住的日子里拿得更多，在守不住的日子里一分不拿，哪一个更重要取决于这个仓位是为了什么，而这里没有任何东西知道这一点。",
  },

  ru: {
    heading: "Узкий или широкий? Каждая ширина, тот же месяц",
    intro:
      "Месяц, воспроизведённый выше, — по одному разу на каждую ширину, которую предлагает форма. Каждая строка открывается на том же закрытии, в диапазоне, который этот метод тогда провёл бы при такой ширине, и читается на тех же тридцати днях: как дни легли относительно диапазона, какие комиссии получил бы тот же вклад, стоимость относительно хранения и что дало бы перецентрирование при такой ширине. Каждая строка — то, что сказали бы панели выше, будь выбрана эта ширина: посчитано теми же функциями, а не оценено заново.",
    noHistory:
      "Перед последними тридцатью днями недостаточно дневных закрытий, чтобы там, где открывается воспроизведённый месяц, провести диапазон любой ширины, так что сравнивать здесь нечего.",
    openedOn: (date) => `Каждая строка открывается на закрытии ${date}.`,
    tableCaption: "Тот же месяц при каждой ширине",
    columnWidth: "Ширина",
    columnRange: "Диапазон при открытии",
    columnDays: "Дней внутри / через границу / снаружи",
    daysValue: (inside, crossing, outside) => `${inside} / ${crossing} / ${outside}`,
    columnFees: (deposit) => `Комиссии при ${deposit}`,
    columnWorth: "Относительно хранения",
    columnRecentres: "Перецентрирования",
    columnEndValue: "Итоговая стоимость, без → с перецентрированием",
    columnEndValueBeforeFees: "Итоговая стоимость без комиссий, без → с перецентрированием",
    endValues: (never, recentred) => `${never} → ${recentred}`,
    columnDifference: "Что изменило перецентрирование",
    share: "Поделиться этой таблицей",
    columnsNote:
      "Диапазон — тот, что проведён при открытии при этой ширине, а не сегодняшний; сегодняшний — в таблице выше. Дни, комиссии и стоимость относительно хранения — цифры воспроизведённого месяца для этого диапазона; комиссии — доля вклада в том, что пул взял в дни, когда цена целиком оставалась внутри, разделённая так же, как в панели вклада, при вкладе по сегодняшнему курсу доллара. Последние три колонки — стратегии перецентрирования: сколько закрытий снаружи было, чтобы перецентрировать, сколько позиция стоит в итоге без перецентрирования и с ним, и разница между ними.",
    gasCounted: (each) => `Gas учитывается по ${each} за перецентрирование, как задано в панели перецентрирования.`,
    gasNotCounted:
      "Gas не учитывается: стоимость одного перецентрирования не задана. Задайте её в панели перецентрирования, и она будет учтена и здесь.",
    noImpact:
      "Влияние на цену не моделируется: обмен при каждом перецентрировании оценивается по закрытию дня, как если бы пулу хватало глубины; настоящий обмен сдвинул бы цену против себя.",
    caveat:
      "Это воспроизведение прошлого месяца, а не прогноз: оно говорит, что каждая ширина сделала в уже прошедшие дни, и ничего — о предстоящих. Ни одна из этих строк не рекомендация: более узкий диапазон берёт больше в дни, когда держится, и ничего в остальные, а что важнее, зависит от того, для чего позиция, чего здесь ничто не знает.",
  },

  pt: {
    heading: "Estreita ou larga? Cada largura, o mesmo mês",
    intro:
      "O mês reproduzido acima, uma vez para cada largura que o formulário oferece. Cada linha abre no mesmo fechamento, na faixa que este método teria traçado então com essa largura, e é lida sobre os mesmos trinta dias: como os dias ficaram em relação à faixa, as taxas que o mesmo depósito teria recebido, o valor contra manter e o que recentralizar com essa largura teria feito. Cada linha é o que os painéis acima diriam com essa largura escolhida — calculada pelas mesmas funções, não estimada de novo.",
    noHistory:
      "Não há fechamentos diários suficientes antes dos últimos trinta dias para traçar uma faixa de qualquer largura onde o mês reproduzido abre, então não há nada a comparar aqui.",
    openedOn: (date) => `Cada linha abre no fechamento de ${date}.`,
    tableCaption: "O mesmo mês em cada largura",
    columnWidth: "Largura",
    columnRange: "Faixa na abertura",
    columnDays: "Dias dentro / cruzando uma borda / fora",
    daysValue: (inside, crossing, outside) => `${inside} / ${crossing} / ${outside}`,
    columnFees: (deposit) => `Taxas com ${deposit}`,
    columnWorth: "Contra manter",
    columnRecentres: "Recentralizações",
    columnEndValue: "Valor final, nunca → recentralizada",
    columnEndValueBeforeFees: "Valor final antes das taxas, nunca → recentralizada",
    endValues: (never, recentred) => `${never} → ${recentred}`,
    columnDifference: "O que recentralizar mudou",
    share: "Compartilhar esta tabela",
    columnsNote:
      "A faixa é a traçada na abertura com essa largura, não a de hoje — a de hoje está na tabela acima. Os dias, as taxas e o valor contra manter são os números do mês reproduzido para essa faixa; as taxas são a parte do depósito no que o pool cobrou nos dias em que o preço ficou inteiramente dentro, repartidas como o painel do depósito as reparte, com o depósito dimensionado pela cotação do dólar de hoje. As três últimas colunas são da estratégia de recentralizar: quantos fechamentos fora houve para recentralizar, em quanto a posição termina nunca recentralizada e recentralizada, e a diferença entre as duas.",
    gasCounted: (each) => `O gas é contado a ${each} por recentralização, como definido no painel de recentralizar.`,
    gasNotCounted:
      "O gas não é contado: nenhum custo por recentralização foi definido. Defina um no painel de recentralizar e ele será contado aqui também.",
    noImpact:
      "O impacto no preço não é modelado: a troca de cada recentralização é precificada no fechamento do dia, como se o pool fosse fundo o bastante, e uma troca real teria movido o preço contra si mesma.",
    caveat:
      "Isto é o mês passado reproduzido, não uma previsão: diz o que cada largura fez em dias que já aconteceram e nada sobre os que vêm. Nenhuma destas linhas é uma recomendação — uma faixa mais estreita recebe mais nos dias em que se mantém e nada nos dias em que não, e qual pesa mais depende de para que a posição serve, o que nada aqui sabe.",
  },

  "zh-Hant": {
    heading: "窄還是寬？每種寬度，同一個月",
    intro:
      "上面重演的那個月，依表單提供的每種寬度各算一次。每一列都在同一個收盤價開倉，區間是這個方法當時依那種寬度會畫出的區間，並在同樣的三十天上讀取：這些天相對區間的位置、同一筆資金本可以收到的手續費、相對持有的價值，以及依那種寬度重新置中會怎樣。每一列就是選了那種寬度後上面各面板會說的內容——用同樣的函式算出，不是重新估計。",
    noHistory: "最近三十天之前的日收盤價不夠，無法在重演的那個月開倉的位置畫出任何寬度的區間，所以這裡沒有可比較的內容。",
    openedOn: (date) => `每一列都在 ${date} 的收盤價開倉。`,
    tableCaption: "每種寬度下的同一個月",
    columnWidth: "寬度",
    columnRange: "開倉時的區間",
    columnDays: "天數：在內 / 越過邊界 / 在外",
    daysValue: (inside, crossing, outside) => `${inside} / ${crossing} / ${outside}`,
    columnFees: (deposit) => `存入 ${deposit} 的手續費`,
    columnWorth: "相對持有",
    columnRecentres: "重新置中次數",
    columnEndValue: "期末價值，從不 → 重新置中",
    columnEndValueBeforeFees: "未計手續費收入的期末價值，從不 → 重新置中",
    endValues: (never, recentred) => `${never} → ${recentred}`,
    columnDifference: "重新置中改變了多少",
    share: "分享這張表",
    columnsNote:
      "區間是開倉時依那種寬度畫出的區間，不是今天的——今天的在上面那張表裡。天數、手續費和相對持有的價值是重演的那個月對該區間給出的數字；手續費是價格全天在區間內的那些天裡，這筆資金在池子收取的手續費中的份額，分配方式與資金面板相同，資金依今天的美元匯率換算。最後三欄屬於重新置中策略：有多少次收盤在區間外可供重新置中，倉位在從不重新置中和重新置中兩種情況下各以多少收尾，以及兩者之差。",
    gasCounted: (each) => `gas 依每次重新置中 ${each} 計入，與重新置中面板中的設定一致。`,
    gasNotCounted: "不計 gas：沒有設定每次重新置中的成本。在重新置中面板裡設定後，這裡也會計入。",
    noImpact: "沒有模擬價格衝擊：每次重新置中的兌換都依當天收盤價計價，好像池子足夠深；真實的兌換會把價格推向對自己不利的方向。",
    caveat:
      "這是對過去一個月的重演，不是預測：它說的是每種寬度在已經過去的日子裡做了什麼，對接下來的日子什麼也說明不了。這些列中沒有一列是建議——更窄的區間在它守住的日子裡拿得更多，在守不住的日子裡一分不拿，哪一個更重要取決於這個倉位是為了什麼，而這裡沒有任何東西知道這一點。",
  },
};

export const getWidthsTableCopy = (locale: Locale): WidthsTableCopy => COPY[locale];
