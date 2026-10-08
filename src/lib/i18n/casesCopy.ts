import type { Locale } from "./locales";

/*
 * The cases page's own words: the month that already happened, pool by pool,
 * as the site's own replays measured it.
 *
 * Only the frame is here — what the page is, how its order is decided, when
 * it was measured, what to say when nothing is yet, and the sentences a card
 * writes around its figures. The labels a card shares with the pool page —
 * days inside and outside, worth against holding, the fees on the deposit —
 * are the dictionary's own `backtest` and `outOfSample` words, so a figure is
 * never named one way on a pool's page and another way on its case. Every
 * other term is the one the rest of the site uses in that language for a
 * range, a pool, fees and re-centring (recentringCopy.ts).
 *
 * Every sentence that carries a figure is a template, so no language has to
 * agree a noun with a number it has not seen. And every language says, on
 * the page and on each card, what the whole thing is: a measurement of days
 * that are over, not a forecast and not a recommendation — a list of "best"
 * and "worst" is read as a tip unless it says otherwise.
 */

export type CasesCopy = {
  /** Where the page is linked from: the footer, the most-traded page, the front page. */
  readonly link: string;
  readonly title: string;
  readonly titleOn: (chain: string) => string;
  readonly description: string;
  readonly descriptionOn: (chain: string) => string;
  readonly heading: string;
  /** What each case is, and that an incomplete month is left out. */
  readonly intro: (chain: string, deposit: string) => string;
  /** The one figure the order follows, stated plainly. */
  readonly criterion: (deposit: string) => string;
  readonly measuredAt: (time: string) => string;
  /** Before the warmer's first measurement of a chain is kept. */
  readonly notYet: (chain: string) => string;
  /** The week's pools could not be read when the chain was last measured. */
  readonly unavailable: string;
  /** Pools were read and none had a whole month. */
  readonly empty: (chain: string) => string;
  /** How many pools became cases, and why the rest did not. */
  readonly poolsRead: (cases: string, asked: string) => string;
  readonly best: string;
  readonly worst: string;
  /** The label over the range a case was replayed in. */
  readonly range: string;
  /** The window: the close it opened at, the close it was read to. */
  readonly window: (from: string, to: string) => string;
  /** The label over the ordering figure. */
  readonly result: string;
  /** The re-centring verdict: how often, and better or worse than never re-centring. */
  readonly recentres: (count: string) => string;
  readonly neverRecentred: string;
  readonly recentringBetter: (amount: string) => string;
  readonly recentringWorse: (amount: string) => string;
  readonly recentringSame: string;
  /** Under every card: a measurement of a month that already happened. */
  readonly note: string;
};

const COPY: Record<Locale, CasesCopy> = {
  en: {
    link: "This month, measured",
    title: "This month, measured: what the busiest Uniswap pools' ranges did over the last thirty days",
    titleOn: (chain) =>
      `This month on ${chain}, measured: what the busiest Uniswap pools' ranges did over the last thirty days`,
    description:
      "Case by case, the week's most traded Uniswap pools on Ethereum, each replayed over the last thirty days in the range this site would have drawn: days inside, fees on a deposit, the result against holding, and what re-centring would have changed. Measured from what happened, not forecast. Updated every six hours.",
    descriptionOn: (chain) =>
      `Case by case, the week's most traded Uniswap pools on ${chain}, each replayed over the last thirty days in the range this site would have drawn: days inside, fees on a deposit, the result against holding, and what re-centring would have changed. Measured from what happened, not forecast. Updated every six hours.`,
    heading: "This month, measured",
    intro: (chain, deposit) =>
      `Each of the week's most traded pools on ${chain}, replayed over the last thirty days exactly as its own page replays it: a position opened at the start of the window, in the range this method would have drawn then, read day by day against what followed, with ${deposit} in it. The figures are the pool page's own, at its default settings. A pool whose month could not be replayed in full is not here.`,
    criterion: (deposit) =>
      `Best to worst by one figure and nothing else: what the position, never re-centred, ended the month worth with its fees, against simply holding the two tokens it opened with — in dollars, on ${deposit}. The order is that number, and the number is on every card.`,
    measuredAt: (time) => `Measured ${time}.`,
    notYet: (chain) =>
      `The month on ${chain} has not been measured yet. The cases are measured every six hours on the server, never when a page is opened; this page fills once the first measurement is kept.`,
    unavailable: "The week's pools could not be read when this was last measured, so there are no cases to show.",
    empty: (chain) => `None of the week's most traded pools on ${chain} had a whole month to replay this time.`,
    poolsRead: (cases, asked) =>
      `${cases} cases from ${asked} pools read. The rest had no whole month: a history too short to open a position thirty days ago, a hook that may change what swaps pay, or a day whose fees or dollar rate the source did not publish.`,
    best: "Best of the month",
    worst: "Worst of the month",
    range: "Suggested range",
    window: (from, to) => `Opened at the close of ${from}, read to the close of ${to}.`,
    result: "Against holding, fees in",
    recentres: (count) => `Re-centres over the same month: ${count}.`,
    neverRecentred: "Never re-centred: every day closed inside the range, so re-centring would have changed nothing.",
    recentringBetter: (amount) => `Re-centring would have ended ${amount} better than never re-centring.`,
    recentringWorse: (amount) => `Re-centring would have ended ${amount} worse than never re-centring.`,
    recentringSame: "Re-centring would have ended exactly where never re-centring did.",
    note: "A measurement of a month that already happened — the method replayed over days that are over, with the deposit sized at today's dollar rate and no gas counted. Not a forecast, and not a recommendation of any pool or range.",
  },
  tr: {
    link: "Bu ay, ölçüldü",
    title: "Bu ay, ölçüldü: en işlek Uniswap havuzlarının aralıkları son otuz günde ne yaptı",
    titleOn: (chain) => `${chain} üzerinde bu ay, ölçüldü: en işlek Uniswap havuzlarının aralıkları son otuz günde ne yaptı`,
    description:
      "Ethereum'da haftanın en çok işlem gören Uniswap havuzları, vaka vaka: her biri bu sitenin çizeceği aralıkta son otuz gün boyunca yeniden oynatıldı — içeride geçen günler, bir yatırımın komisyonu, elde tutmaya göre sonuç ve yeniden ortalamanın neyi değiştireceği. Olandan ölçüldü, tahmin değil. Altı saatte bir güncellenir.",
    descriptionOn: (chain) =>
      `${chain} üzerinde haftanın en çok işlem gören Uniswap havuzları, vaka vaka: her biri bu sitenin çizeceği aralıkta son otuz gün boyunca yeniden oynatıldı — içeride geçen günler, bir yatırımın komisyonu, elde tutmaya göre sonuç ve yeniden ortalamanın neyi değiştireceği. Olandan ölçüldü, tahmin değil. Altı saatte bir güncellenir.`,
    heading: "Bu ay, ölçüldü",
    intro: (chain, deposit) =>
      `${chain} üzerinde haftanın en çok işlem gören havuzlarının her biri, kendi sayfasının yeniden oynattığı gibi son otuz günde yeniden oynatıldı: pencerenin başında, bu yöntemin o gün çizeceği aralıkta, içinde ${deposit} ile açılan bir pozisyon; sonrasında olanlara karşı gün gün okundu. Rakamlar havuz sayfasının kendi rakamları, varsayılan ayarlarıyla. Ayı tam olarak yeniden oynatılamayan havuz burada yok.`,
    criterion: (deposit) =>
      `En iyiden en kötüye tek bir rakama göre, başka hiçbir şeye göre değil: hiç yeniden ortalanmayan pozisyonun ayı komisyonuyla birlikte ne değerde bitirdiği, açıldığı iki tokenı sadece elde tutmaya göre — dolar olarak, ${deposit} ile. Sıralama o rakamdır ve rakam her kartın üstündedir.`,
    measuredAt: (time) => `Ölçüm: ${time}.`,
    notYet: (chain) =>
      `${chain} üzerindeki ay henüz ölçülmedi. Vakalar altı saatte bir sunucuda ölçülür, sayfa açıldığında asla; ilk ölçüm saklandığında bu sayfa dolar.`,
    unavailable: "Son ölçümde haftanın havuzları okunamadı; bu yüzden gösterilecek vaka yok.",
    empty: (chain) => `${chain} üzerinde haftanın en çok işlem gören havuzlarından hiçbirinin bu sefer yeniden oynatılacak tam bir ayı yoktu.`,
    poolsRead: (cases, asked) =>
      `Okunan ${asked} havuzdan ${cases} vaka. Geri kalanının tam bir ayı yoktu: otuz gün önce pozisyon açmaya yetmeyecek kadar kısa bir geçmiş, takasların ödediğini değiştirebilen bir hook ya da kaynağın komisyonunu veya dolar kurunu yayımlamadığı bir gün.`,
    best: "Ayın en iyisi",
    worst: "Ayın en kötüsü",
    range: "Önerilen aralık",
    window: (from, to) => `${from} kapanışında açıldı, ${to} kapanışına kadar okundu.`,
    result: "Elde tutmaya göre, komisyon dahil",
    recentres: (count) => `Aynı ayda yeniden ortalama: ${count}.`,
    neverRecentred: "Hiç yeniden ortalanmadı: her gün aralığın içinde kapandı; yani yeniden ortalama hiçbir şeyi değiştirmezdi.",
    recentringBetter: (amount) => `Yeniden ortalama, hiç ortalamamaya göre ${amount} daha iyi bitirirdi.`,
    recentringWorse: (amount) => `Yeniden ortalama, hiç ortalamamaya göre ${amount} daha kötü bitirirdi.`,
    recentringSame: "Yeniden ortalama, hiç ortalamamayla tam aynı yerde bitirirdi.",
    note: "Zaten yaşanmış bir ayın ölçümü: yöntem, bitmiş günlerde yeniden oynatıldı; yatırım bugünkü dolar kuruyla hesaplandı ve gas sayılmadı. Tahmin değil, hiçbir havuz ya da aralık için bir öneri değil.",
  },
  de: {
    link: "Dieser Monat, gemessen",
    title: "Dieser Monat, gemessen: was die Bereiche der meistgehandelten Uniswap-Pools in den letzten dreißig Tagen taten",
    titleOn: (chain) =>
      `Dieser Monat auf ${chain}, gemessen: was die Bereiche der meistgehandelten Uniswap-Pools in den letzten dreißig Tagen taten`,
    description:
      "Fall für Fall die meistgehandelten Uniswap-Pools der Woche auf Ethereum, jeder über die letzten dreißig Tage in dem Bereich nachgespielt, den diese Seite gezeichnet hätte: Tage innerhalb, Gebühren auf eine Einlage, das Ergebnis gegenüber dem Halten und was Neuzentrieren geändert hätte. Gemessen an dem, was geschah, nicht vorhergesagt. Alle sechs Stunden aktualisiert.",
    descriptionOn: (chain) =>
      `Fall für Fall die meistgehandelten Uniswap-Pools der Woche auf ${chain}, jeder über die letzten dreißig Tage in dem Bereich nachgespielt, den diese Seite gezeichnet hätte: Tage innerhalb, Gebühren auf eine Einlage, das Ergebnis gegenüber dem Halten und was Neuzentrieren geändert hätte. Gemessen an dem, was geschah, nicht vorhergesagt. Alle sechs Stunden aktualisiert.`,
    heading: "Dieser Monat, gemessen",
    intro: (chain, deposit) =>
      `Jeder der meistgehandelten Pools der Woche auf ${chain}, über die letzten dreißig Tage genau so nachgespielt, wie seine eigene Seite es tut: eine Position, zu Beginn des Fensters in dem Bereich eröffnet, den diese Methode damals gezeichnet hätte, Tag für Tag gegen das gelesen, was folgte, mit ${deposit} darin. Die Zahlen sind die der Pool-Seite selbst, mit ihren Standardeinstellungen. Ein Pool, dessen Monat sich nicht vollständig nachspielen ließ, fehlt hier.`,
    criterion: (deposit) =>
      `Vom Besten zum Schlechtesten nach einer einzigen Zahl und sonst nichts: was die nie neu zentrierte Position am Monatsende mit ihren Gebühren wert war, gegenüber dem bloßen Halten der beiden Token, mit denen sie eröffnet wurde — in Dollar, bei ${deposit}. Die Reihenfolge ist diese Zahl, und die Zahl steht auf jeder Karte.`,
    measuredAt: (time) => `Gemessen ${time}.`,
    notYet: (chain) =>
      `Der Monat auf ${chain} ist noch nicht gemessen. Die Fälle werden alle sechs Stunden auf dem Server gemessen, nie beim Öffnen einer Seite; diese Seite füllt sich, sobald die erste Messung aufbewahrt ist.`,
    unavailable: "Die Pools der Woche ließen sich bei der letzten Messung nicht lesen, also gibt es keine Fälle zu zeigen.",
    empty: (chain) => `Keiner der meistgehandelten Pools der Woche auf ${chain} hatte diesmal einen ganzen Monat zum Nachspielen.`,
    poolsRead: (cases, asked) =>
      `${cases} Fälle aus ${asked} gelesenen Pools. Die übrigen hatten keinen ganzen Monat: eine zu kurze Historie, um vor dreißig Tagen eine Position zu eröffnen, einen Hook, der ändern darf, was Swaps zahlen, oder einen Tag, für den die Quelle keine Gebühren oder keinen Dollarkurs veröffentlicht hat.`,
    best: "Bester des Monats",
    worst: "Schlechtester des Monats",
    range: "Vorgeschlagener Bereich",
    window: (from, to) => `Eröffnet zum Schlusskurs vom ${from}, gelesen bis zum Schlusskurs vom ${to}.`,
    result: "Gegenüber dem Halten, mit Gebühren",
    recentres: (count) => `Neuzentrierungen im selben Monat: ${count}.`,
    neverRecentred: "Nie neu zentriert: jeder Tag schloss innerhalb des Bereichs, Neuzentrieren hätte also nichts geändert.",
    recentringBetter: (amount) => `Neuzentrieren hätte ${amount} besser geendet als nie neu zu zentrieren.`,
    recentringWorse: (amount) => `Neuzentrieren hätte ${amount} schlechter geendet als nie neu zu zentrieren.`,
    recentringSame: "Neuzentrieren hätte genau dort geendet, wo nie neu zu zentrieren endete.",
    note: "Eine Messung eines Monats, der schon vorbei ist — die Methode über vergangene Tage nachgespielt, die Einlage zum heutigen Dollarkurs bemessen und kein Gas gezählt. Keine Vorhersage und keine Empfehlung für irgendeinen Pool oder Bereich.",
  },
  es: {
    link: "Este mes, medido",
    title: "Este mes, medido: qué hicieron los rangos de los pools de Uniswap más negociados en los últimos treinta días",
    titleOn: (chain) =>
      `Este mes en ${chain}, medido: qué hicieron los rangos de los pools de Uniswap más negociados en los últimos treinta días`,
    description:
      "Caso por caso, los pools de Uniswap más negociados de la semana en Ethereum, cada uno reproducido durante los últimos treinta días en el rango que este sitio habría trazado: días dentro, comisiones sobre un depósito, el resultado frente a mantener y qué habría cambiado recentrar. Medido a partir de lo que pasó, no pronosticado. Se actualiza cada seis horas.",
    descriptionOn: (chain) =>
      `Caso por caso, los pools de Uniswap más negociados de la semana en ${chain}, cada uno reproducido durante los últimos treinta días en el rango que este sitio habría trazado: días dentro, comisiones sobre un depósito, el resultado frente a mantener y qué habría cambiado recentrar. Medido a partir de lo que pasó, no pronosticado. Se actualiza cada seis horas.`,
    heading: "Este mes, medido",
    intro: (chain, deposit) =>
      `Cada uno de los pools más negociados de la semana en ${chain}, reproducido durante los últimos treinta días exactamente como lo reproduce su propia página: una posición abierta al inicio de la ventana, en el rango que este método habría trazado entonces, leída día a día frente a lo que siguió, con ${deposit} dentro. Las cifras son las de la página del pool, con sus ajustes por defecto. Un pool cuyo mes no pudo reproducirse completo no está aquí.`,
    criterion: (deposit) =>
      `De mejor a peor por una sola cifra y nada más: cuánto valía al final del mes la posición nunca recentrada, con sus comisiones, frente a simplemente mantener los dos tokens con los que abrió — en dólares, con ${deposit}. El orden es ese número, y el número está en cada tarjeta.`,
    measuredAt: (time) => `Medido ${time}.`,
    notYet: (chain) =>
      `El mes en ${chain} todavía no se ha medido. Los casos se miden cada seis horas en el servidor, nunca al abrir una página; esta página se llena cuando se guarda la primera medición.`,
    unavailable: "Los pools de la semana no pudieron leerse en la última medición, así que no hay casos que mostrar.",
    empty: (chain) => `Ninguno de los pools más negociados de la semana en ${chain} tuvo esta vez un mes completo que reproducir.`,
    poolsRead: (cases, asked) =>
      `${cases} casos de ${asked} pools leídos. El resto no tenía un mes completo: un historial demasiado corto para abrir una posición hace treinta días, un hook que puede cambiar lo que pagan los intercambios, o un día cuyas comisiones o tipo en dólares la fuente no publicó.`,
    best: "El mejor del mes",
    worst: "El peor del mes",
    range: "Rango sugerido",
    window: (from, to) => `Abierta al cierre del ${from}, leída hasta el cierre del ${to}.`,
    result: "Frente a mantener, con comisiones",
    recentres: (count) => `Recentrados en el mismo mes: ${count}.`,
    neverRecentred: "Nunca recentrada: todos los días cerraron dentro del rango, así que recentrar no habría cambiado nada.",
    recentringBetter: (amount) => `Recentrar habría terminado ${amount} mejor que no recentrar nunca.`,
    recentringWorse: (amount) => `Recentrar habría terminado ${amount} peor que no recentrar nunca.`,
    recentringSame: "Recentrar habría terminado exactamente donde terminó no recentrar nunca.",
    note: "Una medición de un mes que ya pasó: el método reproducido sobre días que terminaron, con el depósito dimensionado al tipo en dólares de hoy y sin contar el gas. No es un pronóstico ni una recomendación de ningún pool ni rango.",
  },
  ar: {
    link: "هذا الشهر، مقيسًا",
    title: "هذا الشهر، مقيسًا: ما فعلته نطاقات أنشط تجمّعات Uniswap خلال الثلاثين يومًا الأخيرة",
    titleOn: (chain) =>
      `هذا الشهر على ${chain}، مقيسًا: ما فعلته نطاقات أنشط تجمّعات Uniswap خلال الثلاثين يومًا الأخيرة`,
    description:
      "حالةً حالة، تجمّعات Uniswap الأكثر تداولًا هذا الأسبوع على Ethereum، أعيد تشغيل كلٍّ منها خلال الثلاثين يومًا الأخيرة في النطاق الذي كان هذا الموقع سيرسمه: الأيام داخل النطاق، الرسوم على إيداع، النتيجة مقارنةً بالاحتفاظ، وما كانت إعادة التوسيط ستغيّره. مقيس ممّا حدث، لا توقّع. يُحدَّث كل ست ساعات.",
    descriptionOn: (chain) =>
      `حالةً حالة، تجمّعات Uniswap الأكثر تداولًا هذا الأسبوع على ${chain}، أعيد تشغيل كلٍّ منها خلال الثلاثين يومًا الأخيرة في النطاق الذي كان هذا الموقع سيرسمه: الأيام داخل النطاق، الرسوم على إيداع، النتيجة مقارنةً بالاحتفاظ، وما كانت إعادة التوسيط ستغيّره. مقيس ممّا حدث، لا توقّع. يُحدَّث كل ست ساعات.`,
    heading: "هذا الشهر، مقيسًا",
    intro: (chain, deposit) =>
      `كلّ تجمّع من تجمّعات الأسبوع الأكثر تداولًا على ${chain}، أعيد تشغيله خلال الثلاثين يومًا الأخيرة تمامًا كما تعيد صفحته تشغيله: مركز فُتح في بداية النافذة، في النطاق الذي كانت هذه الطريقة سترسمه حينها، وقُرئ يومًا بيوم مقابل ما تلا، وفيه ${deposit}. الأرقام هي أرقام صفحة التجمّع نفسها بإعداداتها الافتراضية. التجمّع الذي تعذّر إعادة تشغيل شهره كاملًا ليس هنا.`,
    criterion: (deposit) =>
      `من الأفضل إلى الأسوأ وفق رقم واحد لا غير: ما كان المركز الذي لم يُعَد توسيطه قط يساويه في نهاية الشهر مع رسومه، مقارنةً بمجرّد الاحتفاظ بالرمزين اللذين فُتح بهما — بالدولار، على ${deposit}. الترتيب هو ذلك الرقم، والرقم مكتوب على كلّ بطاقة.`,
    measuredAt: (time) => `قيس في ${time}.`,
    notYet: (chain) =>
      `لم يُقَس الشهر على ${chain} بعد. تُقاس الحالات كلّ ست ساعات على الخادم، ولا تُقاس أبدًا عند فتح صفحة؛ تمتلئ هذه الصفحة حين يُحفظ أوّل قياس.`,
    unavailable: "تعذّرت قراءة تجمّعات الأسبوع عند آخر قياس، فلا حالات لعرضها.",
    empty: (chain) => `لم يكن لأيٍّ من تجمّعات الأسبوع الأكثر تداولًا على ${chain} شهر كامل يُعاد تشغيله هذه المرة.`,
    poolsRead: (cases, asked) =>
      `${cases} حالة من ${asked} تجمّعًا قُرئت. لم يكن للبقية شهر كامل: تاريخ أقصر من أن يُفتح فيه مركز قبل ثلاثين يومًا، أو خطّاف قد يغيّر ما تدفعه التبادلات، أو يوم لم ينشر المصدر رسومه أو سعر الدولار فيه.`,
    best: "أفضل الشهر",
    worst: "أسوأ الشهر",
    range: "النطاق المقترح",
    window: (from, to) => `فُتح عند إغلاق ${from}، وقُرئ حتى إغلاق ${to}.`,
    result: "مقارنةً بالاحتفاظ، مع الرسوم",
    recentres: (count) => `مرات إعادة التوسيط في الشهر نفسه: ${count}.`,
    neverRecentred: "بلا إعادة توسيط: أُغلق كلّ يوم داخل النطاق، فما كانت إعادة التوسيط لتغيّر شيئًا.",
    recentringBetter: (amount) => `كانت إعادة التوسيط ستنتهي أفضل بمقدار ${amount} من عدم إعادة التوسيط قط.`,
    recentringWorse: (amount) => `كانت إعادة التوسيط ستنتهي أسوأ بمقدار ${amount} من عدم إعادة التوسيط قط.`,
    recentringSame: "كانت إعادة التوسيط ستنتهي حيث انتهى عدم إعادة التوسيط تمامًا.",
    note: "قياس لشهر حدث فعلًا: الطريقة أعيد تشغيلها على أيام انقضت، والإيداع محسوب بسعر الدولار اليوم، ولم يُحتسب غاز. ليس توقّعًا، وليس توصية بأيّ تجمّع أو نطاق.",
  },
  hi: {
    link: "यह महीना, मापा हुआ",
    title: "यह महीना, मापा हुआ: सबसे व्यस्त Uniswap पूलों के दायरों ने पिछले तीस दिनों में क्या किया",
    titleOn: (chain) =>
      `${chain} पर यह महीना, मापा हुआ: सबसे व्यस्त Uniswap पूलों के दायरों ने पिछले तीस दिनों में क्या किया`,
    description:
      "मामला-दर-मामला, Ethereum पर हफ़्ते के सबसे ज़्यादा कारोबार वाले Uniswap पूल, हर एक पिछले तीस दिनों में उस दायरे में दोबारा चलाया गया जो यह साइट खींचती: भीतर के दिन, एक जमा पर शुल्क, रखे रहने की तुलना में नतीजा, और पुनःकेंद्रण से क्या बदलता। जो हुआ उससे मापा गया, अनुमान नहीं। हर छह घंटे में अपडेट।",
    descriptionOn: (chain) =>
      `मामला-दर-मामला, ${chain} पर हफ़्ते के सबसे ज़्यादा कारोबार वाले Uniswap पूल, हर एक पिछले तीस दिनों में उस दायरे में दोबारा चलाया गया जो यह साइट खींचती: भीतर के दिन, एक जमा पर शुल्क, रखे रहने की तुलना में नतीजा, और पुनःकेंद्रण से क्या बदलता। जो हुआ उससे मापा गया, अनुमान नहीं। हर छह घंटे में अपडेट।`,
    heading: "यह महीना, मापा हुआ",
    intro: (chain, deposit) =>
      `${chain} पर हफ़्ते के सबसे ज़्यादा कारोबार वाले हर पूल को पिछले तीस दिनों में ठीक वैसे ही दोबारा चलाया गया जैसे उसका अपना पेज चलाता है: खिड़की की शुरुआत में, उस दायरे में जो यह तरीक़ा तब खींचता, ${deposit} के साथ खोली गई एक पोज़िशन, जो आगे हुआ उसके सामने दिन-ब-दिन पढ़ी गई। आँकड़े पूल पेज के अपने हैं, उसकी डिफ़ॉल्ट सेटिंग पर। जिस पूल का महीना पूरा दोबारा नहीं चल सका, वह यहाँ नहीं है।`,
    criterion: (deposit) =>
      `सबसे अच्छे से सबसे बुरे तक सिर्फ़ एक आँकड़े के आधार पर, और किसी के नहीं: बिना पुनःकेंद्रण वाली पोज़िशन महीने के अंत में अपने शुल्क समेत कितनी मूल्य की रही, उन दो टोकनों को बस रखे रहने की तुलना में जिनसे वह खुली थी — डॉलर में, ${deposit} पर। क्रम वही संख्या है, और वह संख्या हर कार्ड पर है।`,
    measuredAt: (time) => `मापा गया ${time}.`,
    notYet: (chain) =>
      `${chain} पर यह महीना अभी मापा नहीं गया है। मामले हर छह घंटे में सर्वर पर मापे जाते हैं, पेज खुलने पर कभी नहीं; पहला माप सहेजे जाते ही यह पेज भर जाता है।`,
    unavailable: "पिछले माप के समय हफ़्ते के पूल पढ़े नहीं जा सके, इसलिए दिखाने को कोई मामला नहीं है।",
    empty: (chain) => `${chain} पर हफ़्ते के सबसे ज़्यादा कारोबार वाले किसी भी पूल के पास इस बार दोबारा चलाने को पूरा महीना नहीं था।`,
    poolsRead: (cases, asked) =>
      `पढ़े गए ${asked} पूलों में से ${cases} मामले। बाक़ी के पास पूरा महीना नहीं था: तीस दिन पहले पोज़िशन खोलने के लिए बहुत छोटा इतिहास, एक हुक जो स्वैप की लागत बदल सकता है, या ऐसा दिन जिसका शुल्क या डॉलर दर स्रोत ने प्रकाशित नहीं किया।`,
    best: "महीने का सबसे अच्छा",
    worst: "महीने का सबसे बुरा",
    range: "सुझाया गया दायरा",
    window: (from, to) => `${from} के बंद भाव पर खोली गई, ${to} के बंद भाव तक पढ़ी गई।`,
    result: "रखे रहने की तुलना में, शुल्क समेत",
    recentres: (count) => `उसी महीने में पुनःकेंद्रण: ${count}.`,
    neverRecentred: "कभी पुनःकेंद्रित नहीं: हर दिन दायरे के भीतर बंद हुआ, इसलिए पुनःकेंद्रण से कुछ नहीं बदलता।",
    recentringBetter: (amount) => `पुनःकेंद्रण का अंत कभी न करने से ${amount} बेहतर होता।`,
    recentringWorse: (amount) => `पुनःकेंद्रण का अंत कभी न करने से ${amount} बदतर होता।`,
    recentringSame: "पुनःकेंद्रण ठीक वहीं ख़त्म होता जहाँ कभी न करना ख़त्म हुआ।",
    note: "एक ऐसे महीने का माप जो बीत चुका है: तरीक़ा बीते दिनों पर दोबारा चलाया गया, जमा आज की डॉलर दर पर आँकी गई और गैस नहीं गिनी गई। न अनुमान, न किसी पूल या दायरे की सिफ़ारिश।",
  },
  zh: {
    link: "本月实测",
    title: "本月实测：最活跃的 Uniswap 资金池的区间在过去三十天里表现如何",
    titleOn: (chain) => `${chain} 上的本月实测：最活跃的 Uniswap 资金池的区间在过去三十天里表现如何`,
    description:
      "逐例呈现以太坊上本周交易最多的 Uniswap 资金池：每个池都在本站会画出的区间里回放过去三十天——区间内的天数、一笔存入的手续费、相对持有的结果，以及重新居中会带来的变化。依据已发生的事实测量，而非预测。每六小时更新。",
    descriptionOn: (chain) =>
      `逐例呈现 ${chain} 上本周交易最多的 Uniswap 资金池：每个池都在本站会画出的区间里回放过去三十天——区间内的天数、一笔存入的手续费、相对持有的结果，以及重新居中会带来的变化。依据已发生的事实测量，而非预测。每六小时更新。`,
    heading: "本月实测",
    intro: (chain, deposit) =>
      `${chain} 上本周交易最多的每个资金池，都按其页面的方式回放过去三十天：一个在窗口起点、以本方法当时会画出的区间开仓、存入 ${deposit} 的仓位，逐日对照随后发生的情况读取。数字就是资金池页面在默认设置下的数字。这个月无法完整回放的池不在此列。`,
    criterion: (deposit) =>
      `仅按一个数字从最好排到最差，别无其他：从不重新居中的仓位在月末连同手续费的价值，相对于单纯持有开仓时的两种代币——以美元计，基于 ${deposit}。顺序就是这个数字，而这个数字印在每张卡片上。`,
    measuredAt: (time) => `测量时间 ${time}。`,
    notYet: (chain) => `${chain} 上的这个月尚未测量。案例每六小时在服务器上测量一次，从不在打开页面时测量；第一次测量保存后，本页即会填满。`,
    unavailable: "上次测量时无法读取本周的资金池，因此没有案例可显示。",
    empty: (chain) => `这次 ${chain} 上本周交易最多的资金池中，没有一个拥有可完整回放的月份。`,
    poolsRead: (cases, asked) =>
      `读取了 ${asked} 个资金池，得到 ${cases} 个案例。其余的没有完整的月份：历史太短，无法在三十天前开仓；hook 可能改变兑换的费用；或者某一天的手续费或美元汇率未被数据源发布。`,
    best: "本月最佳",
    worst: "本月最差",
    range: "建议区间",
    window: (from, to) => `于 ${from} 收盘时开仓，读取至 ${to} 收盘。`,
    result: "相对持有，含手续费",
    recentres: (count) => `同一个月内的重新居中次数：${count}。`,
    neverRecentred: "从不重新居中：每一天都在区间内收盘，所以重新居中不会改变任何东西。",
    recentringBetter: (amount) => `重新居中的结果会比从不重新居中好 ${amount}。`,
    recentringWorse: (amount) => `重新居中的结果会比从不重新居中差 ${amount}。`,
    recentringSame: "重新居中的结果会与从不重新居中完全相同。",
    note: "这是对一个已经过去的月份的测量：把方法回放在已结束的日子上，存入按今天的美元汇率计算，且不计 gas。不是预测，也不是对任何资金池或区间的推荐。",
  },
  ru: {
    link: "Этот месяц, измеренный",
    title: "Этот месяц, измеренный: что делали диапазоны самых активных пулов Uniswap за последние тридцать дней",
    titleOn: (chain) =>
      `Этот месяц в сети ${chain}, измеренный: что делали диапазоны самых активных пулов Uniswap за последние тридцать дней`,
    description:
      "Случай за случаем: самые торгуемые пулы Uniswap недели в Ethereum, каждый проигран за последние тридцать дней в диапазоне, который нарисовал бы этот сайт — дни внутри, комиссии на вклад, результат относительно хранения и что изменило бы перецентрирование. Измерено по тому, что произошло, а не предсказано. Обновляется каждые шесть часов.",
    descriptionOn: (chain) =>
      `Случай за случаем: самые торгуемые пулы Uniswap недели в сети ${chain}, каждый проигран за последние тридцать дней в диапазоне, который нарисовал бы этот сайт — дни внутри, комиссии на вклад, результат относительно хранения и что изменило бы перецентрирование. Измерено по тому, что произошло, а не предсказано. Обновляется каждые шесть часов.`,
    heading: "Этот месяц, измеренный",
    intro: (chain, deposit) =>
      `Каждый из самых торгуемых пулов недели в сети ${chain}, проигранный за последние тридцать дней ровно так, как это делает его собственная страница: позиция, открытая в начале окна в диапазоне, который этот метод нарисовал бы тогда, с ${deposit} внутри, прочитанная день за днём против того, что последовало. Цифры — цифры страницы пула с её настройками по умолчанию. Пула, чей месяц не удалось проиграть целиком, здесь нет.`,
    criterion: (deposit) =>
      `От лучшего к худшему по одной цифре и ничему больше: сколько ни разу не перецентрированная позиция стоила в конце месяца вместе с комиссиями относительно простого хранения двух токенов, с которыми она открылась, — в долларах, при ${deposit}. Порядок — это число, и число стоит на каждой карточке.`,
    measuredAt: (time) => `Измерено ${time}.`,
    notYet: (chain) =>
      `Месяц в сети ${chain} ещё не измерен. Случаи измеряются каждые шесть часов на сервере и никогда — при открытии страницы; эта страница заполнится, как только будет сохранено первое измерение.`,
    unavailable: "При последнем измерении не удалось прочитать пулы недели, так что показывать нечего.",
    empty: (chain) => `Ни у одного из самых торгуемых пулов недели в сети ${chain} на этот раз не было целого месяца для проигрывания.`,
    poolsRead: (cases, asked) =>
      `${cases} случаев из ${asked} прочитанных пулов. У остальных не было целого месяца: слишком короткая история, чтобы открыть позицию тридцать дней назад, хук, который может менять плату за свопы, или день, для которого источник не опубликовал комиссии или курс доллара.`,
    best: "Лучший за месяц",
    worst: "Худший за месяц",
    range: "Предложенный диапазон",
    window: (from, to) => `Открыта на закрытии ${from}, прочитана до закрытия ${to}.`,
    result: "Относительно хранения, с комиссиями",
    recentres: (count) => `Перецентрирований за тот же месяц: ${count}.`,
    neverRecentred: "Без перецентрирования: каждый день закрывался внутри диапазона, так что перецентрирование ничего бы не изменило.",
    recentringBetter: (amount) => `Перецентрирование закончилось бы на ${amount} лучше, чем без него.`,
    recentringWorse: (amount) => `Перецентрирование закончилось бы на ${amount} хуже, чем без него.`,
    recentringSame: "Перецентрирование закончилось бы ровно там же, где и без него.",
    note: "Измерение месяца, который уже прошёл: метод проигран на завершившихся днях, вклад рассчитан по сегодняшнему курсу доллара, газ не учтён. Не прогноз и не рекомендация какого-либо пула или диапазона.",
  },
  pt: {
    link: "Este mês, medido",
    title: "Este mês, medido: o que as faixas dos pools mais movimentados da Uniswap fizeram nos últimos trinta dias",
    titleOn: (chain) =>
      `Este mês na ${chain}, medido: o que as faixas dos pools mais movimentados da Uniswap fizeram nos últimos trinta dias`,
    description:
      "Caso a caso, os pools da Uniswap mais negociados da semana na Ethereum, cada um reproduzido nos últimos trinta dias na faixa que este site teria traçado: dias dentro, taxas sobre um depósito, o resultado contra manter e o que recentralizar teria mudado. Medido a partir do que aconteceu, não previsto. Atualizado a cada seis horas.",
    descriptionOn: (chain) =>
      `Caso a caso, os pools da Uniswap mais negociados da semana na ${chain}, cada um reproduzido nos últimos trinta dias na faixa que este site teria traçado: dias dentro, taxas sobre um depósito, o resultado contra manter e o que recentralizar teria mudado. Medido a partir do que aconteceu, não previsto. Atualizado a cada seis horas.`,
    heading: "Este mês, medido",
    intro: (chain, deposit) =>
      `Cada um dos pools mais negociados da semana na ${chain}, reproduzido nos últimos trinta dias exatamente como a sua própria página o reproduz: uma posição aberta no início da janela, na faixa que este método teria traçado então, lida dia a dia contra o que se seguiu, com ${deposit} dentro. Os números são os da página do pool, com as suas configurações padrão. Um pool cujo mês não pôde ser reproduzido por inteiro não está aqui.`,
    criterion: (deposit) =>
      `Do melhor ao pior por um único número e nada mais: quanto a posição nunca recentralizada valia no fim do mês, com as suas taxas, contra simplesmente manter os dois tokens com que abriu — em dólares, com ${deposit}. A ordem é esse número, e o número está em cada cartão.`,
    measuredAt: (time) => `Medido ${time}.`,
    notYet: (chain) =>
      `O mês na ${chain} ainda não foi medido. Os casos são medidos a cada seis horas no servidor, nunca ao abrir uma página; esta página se preenche assim que a primeira medição é guardada.`,
    unavailable: "Os pools da semana não puderam ser lidos na última medição, então não há casos a mostrar.",
    empty: (chain) => `Nenhum dos pools mais negociados da semana na ${chain} tinha desta vez um mês inteiro para reproduzir.`,
    poolsRead: (cases, asked) =>
      `${cases} casos de ${asked} pools lidos. Os demais não tinham um mês inteiro: um histórico curto demais para abrir uma posição trinta dias atrás, um hook que pode mudar o que os swaps pagam, ou um dia cujas taxas ou cotação em dólar a fonte não publicou.`,
    best: "O melhor do mês",
    worst: "O pior do mês",
    range: "Faixa sugerida",
    window: (from, to) => `Aberta no fechamento de ${from}, lida até o fechamento de ${to}.`,
    result: "Contra manter, com taxas",
    recentres: (count) => `Recentralizações no mesmo mês: ${count}.`,
    neverRecentred: "Nunca recentralizada: todos os dias fecharam dentro da faixa, então recentralizar não teria mudado nada.",
    recentringBetter: (amount) => `Recentralizar teria terminado ${amount} melhor do que nunca recentralizar.`,
    recentringWorse: (amount) => `Recentralizar teria terminado ${amount} pior do que nunca recentralizar.`,
    recentringSame: "Recentralizar teria terminado exatamente onde nunca recentralizar terminou.",
    note: "Uma medição de um mês que já passou: o método reproduzido sobre dias encerrados, com o depósito dimensionado à cotação do dólar de hoje e sem contar gás. Não é previsão nem recomendação de nenhum pool ou faixa.",
  },
  "zh-Hant": {
    link: "本月實測",
    title: "本月實測：最活躍的 Uniswap 資金池的區間在過去三十天裡表現如何",
    titleOn: (chain) => `${chain} 上的本月實測：最活躍的 Uniswap 資金池的區間在過去三十天裡表現如何`,
    description:
      "逐例呈現以太坊上本週交易最多的 Uniswap 資金池：每個池都在本站會畫出的區間裡回放過去三十天——區間內的天數、一筆存入的手續費、相對持有的結果，以及重新置中會帶來的變化。依據已發生的事實測量，而非預測。每六小時更新。",
    descriptionOn: (chain) =>
      `逐例呈現 ${chain} 上本週交易最多的 Uniswap 資金池：每個池都在本站會畫出的區間裡回放過去三十天——區間內的天數、一筆存入的手續費、相對持有的結果，以及重新置中會帶來的變化。依據已發生的事實測量，而非預測。每六小時更新。`,
    heading: "本月實測",
    intro: (chain, deposit) =>
      `${chain} 上本週交易最多的每個資金池，都按其頁面的方式回放過去三十天：一個在視窗起點、以本方法當時會畫出的區間開倉、存入 ${deposit} 的倉位，逐日對照隨後發生的情況讀取。數字就是資金池頁面在預設設定下的數字。這個月無法完整回放的池不在此列。`,
    criterion: (deposit) =>
      `僅按一個數字從最好排到最差，別無其他：從不重新置中的倉位在月底連同手續費的價值，相對於單純持有開倉時的兩種代幣——以美元計，基於 ${deposit}。順序就是這個數字，而這個數字印在每張卡片上。`,
    measuredAt: (time) => `測量時間 ${time}。`,
    notYet: (chain) => `${chain} 上的這個月尚未測量。案例每六小時在伺服器上測量一次，從不在開啟頁面時測量；第一次測量儲存後，本頁即會填滿。`,
    unavailable: "上次測量時無法讀取本週的資金池，因此沒有案例可顯示。",
    empty: (chain) => `這次 ${chain} 上本週交易最多的資金池中，沒有一個擁有可完整回放的月份。`,
    poolsRead: (cases, asked) =>
      `讀取了 ${asked} 個資金池，得到 ${cases} 個案例。其餘的沒有完整的月份：歷史太短，無法在三十天前開倉；hook 可能改變兌換的費用；或者某一天的手續費或美元匯率未被資料來源發布。`,
    best: "本月最佳",
    worst: "本月最差",
    range: "建議區間",
    window: (from, to) => `於 ${from} 收盤時開倉，讀取至 ${to} 收盤。`,
    result: "相對持有，含手續費",
    recentres: (count) => `同一個月內的重新置中次數：${count}。`,
    neverRecentred: "從不重新置中：每一天都在區間內收盤，所以重新置中不會改變任何東西。",
    recentringBetter: (amount) => `重新置中的結果會比從不重新置中好 ${amount}。`,
    recentringWorse: (amount) => `重新置中的結果會比從不重新置中差 ${amount}。`,
    recentringSame: "重新置中的結果會與從不重新置中完全相同。",
    note: "這是對一個已經過去的月份的測量：把方法回放在已結束的日子上，存入按今天的美元匯率計算，且不計 gas。不是預測，也不是對任何資金池或區間的推薦。",
  },
};

export const getCasesCopy = (locale: Locale): CasesCopy => COPY[locale];
