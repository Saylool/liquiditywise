import type { Locale } from "./locales";

/*
 * The words of the re-centring panel on a pool's page: one simple active
 * strategy — re-centre the range whenever a day closes outside it — replayed
 * over the month "opened thirty days ago" replays, and set beside it.
 *
 * Labels and sentences, never a figure with a noun that would have to agree
 * with it: every count, date, price and dollar amount arrives written. The
 * figures the panel shares with the month replayed — days inside, worth
 * against holding, the fees on the deposit, why fees are withheld or unread —
 * keep that panel's own words from the dictionary, so the two panels cannot
 * name one figure two ways. Every other term is the one the rest of the site
 * uses in that language for a range, a position, fees, liquidity, a pool and
 * a swap.
 *
 * What it leaves out is said beside it every time, not left to the method
 * page: that only daily closes are read, so a day that left and came back is
 * not a re-centre and a re-centre happens at the close rather than at the
 * edge; that price impact is not modelled; that gas is not counted unless set;
 * that dollars are at today's rate; and that it is a measurement of days that
 * already happened, not advice.
 */

export type RecentringCopy = {
  readonly heading: string;
  readonly intro: string;
  /** The history cannot open the month replayed, so it cannot open this either. */
  readonly noHistory: string;
  /** The month replayed exists and this could not be run beside it. */
  readonly unreplayed: string;
  /** The dates it was re-centred on, already written as a list. */
  readonly recentredOn: (dates: string) => string;
  /** No day closed outside: it is the month replayed, figure for figure. */
  readonly never: string;
  /** What each swap is charged, as the pool's terms state it. */
  readonly feeStated: (fee: string) => string;
  /** What each swap is charged where nothing fixed says, as measured. */
  readonly feeMeasured: (fee: string) => string;
  /** Only where a hook may change what a swap costs. */
  readonly hookMayAlter: string;
  readonly tableCaption: string;
  readonly columnFigure: string;
  readonly columnRecentred: string;
  readonly columnNever: string;
  readonly recentres: string;
  readonly swapFees: string;
  readonly gas: string;
  /** Count × cost each = total, all already written. */
  readonly gasValue: (count: string, each: string, total: string) => string;
  readonly gasNotCounted: string;
  readonly endValue: string;
  readonly endValueBeforeFees: string;
  readonly vsHeld: string;
  readonly endValueNote: string;
  readonly held: (amount: string) => string;
  /** Re-centred less never re-centred, signed and written. */
  readonly difference: (amount: string) => string;
  readonly differenceBeforeFees: (amount: string) => string;
  readonly gasLabel: string;
  readonly apply: string;
  readonly gasNote: string;
  readonly gasUnusable: string;
  readonly showRecentres: string;
  readonly recentresCaption: string;
  readonly columnDay: string;
  readonly columnClose: string;
  readonly columnRange: string;
  readonly columnSwapped: string;
  readonly columnSwapFee: string;
  /** What one swap sold and for what: a dollar amount and two token symbols. */
  readonly swapped: (amount: string, sold: string, bought: string) => string;
  readonly closesOnly: string;
  readonly noImpact: string;
  readonly caveat: string;
};

const COPY: Record<Locale, RecentringCopy> = {
  en: {
    heading: "Re-centre when the price leaves",
    intro:
      "One simple active strategy, replayed over the same thirty days and from the same opening as the month above. The deposit opens in the same range, and whenever a day closes outside the range the position is re-centred at that close: what it holds is swapped into the mix a range of the same width, centred on the close, needs, and the swap pays the pool's fee. Fees are shared out exactly as above, by the liquidity of the range held each day, and kept aside.",
    noHistory:
      "There are not enough daily closes before the last thirty days to open this strategy where the suggested range would have been drawn, so nothing is replayed.",
    unreplayed:
      "This strategy could not be replayed for this pool: what a swap here pays is neither stated by the pool's own terms nor measurable from its month of swaps.",
    recentredOn: (dates) => `Re-centred at the close of ${dates}.`,
    never:
      "Never re-centred: every day closed inside the range, so this is the month above, unchanged — the same range all month and the same figures. No swap was paid for, and no gas would have been.",
    feeStated: (fee) => `Each re-centre's swap is charged ${fee}, what a swap pays by the pool's own terms.`,
    feeMeasured: (fee) =>
      `Nothing fixed says what a swap pays on this pool — its hook sets the fee swap by swap — so each re-centre's swap is charged ${fee}, what the month's swaps paid on average, measured. A re-centre on its day may have paid more or less.`,
    hookMayAlter:
      "This pool's hook is permitted to change what a swap costs, so the swap fees here are the fee alone, and a real re-centre may have paid something else. Nothing read here can tell.",
    tableCaption: "Re-centred beside never re-centred",
    columnFigure: "Figure",
    columnRecentred: "Re-centred",
    columnNever: "Never re-centred",
    recentres: "Re-centres",
    swapFees: "Swap fees paid",
    gas: "Gas cost",
    gasValue: (count, each, total) => `${count} × ${each} = ${total}`,
    gasNotCounted: "Not counted",
    endValue: "End value, everything counted",
    endValueBeforeFees: "End value, before fees",
    vsHeld: "Against holding",
    endValueNote:
      "End value is the position's worth at the last close, after every swap fee, plus the fees it took where they are counted, less gas. Against holding sets it beside what the deposit's opening tokens would be worth, simply held.",
    held: (amount) => `Simply holding the deposit's opening tokens instead would be worth ${amount} at the last close.`,
    difference: (amount) => `What re-centring changed, everything counted: ${amount}.`,
    differenceBeforeFees: (amount) => `What re-centring changed, before fees: ${amount}.`,
    gasLabel: "Gas per re-centre",
    apply: "Recount",
    gasNote:
      "Gas is not counted unless a cost per re-centre is set here, in dollars like the deposit; it is paid from outside the position. Opening costs both strategies the same and is counted in neither.",
    gasUnusable:
      "The gas cost asked for could not be read — it has to be a plain decimal from zero up — so gas is not counted.",
    showRecentres: "Show each re-centre",
    recentresCaption: "Each re-centre, oldest first",
    columnDay: "Day",
    columnClose: "Close",
    columnRange: "New range",
    columnSwapped: "Swapped",
    columnSwapFee: "Swap fee",
    swapped: (amount, sold, bought) => `${amount} of ${sold} for ${bought}`,
    closesOnly:
      "Daily closes are all this sees. A day that left the range and came back before its close is not a re-centre, and a re-centre happens at the close, not at the edge — usually past it, at a worse price than an order sitting at the edge would have had.",
    noImpact:
      "Price impact is not modelled: each swap is priced at the close, as if the pool were deep enough to take it whole.",
    caveat:
      "Every dollar figure is at today's dollar rate, with the deposit sized as the deposit panel sizes it. Nobody held this position: it is one strategy replayed over days that already happened, and a strategy that did better or worse over them says nothing about the days to come. A measurement, not advice.",
  },
  tr: {
    heading: "Fiyat çıkınca yeniden ortala",
    intro:
      "Basit bir aktif strateji, yukarıdaki ayla aynı otuz günde ve aynı açılıştan yeniden oynatıldı. Yatırım aynı aralıkta açılır ve bir gün aralığın dışında kapandığında pozisyon o kapanışta yeniden ortalanır: elindekiler, o kapanışı ortalayan aynı genişlikteki bir aralığın gerektirdiği karışıma takasla çevrilir ve takas havuzun komisyonunu öder. Komisyon yukarıdaki gibi, her gün tutulan aralığın likiditesine göre paylaştırılır ve kenara konur.",
    noHistory:
      "Son otuz günden önce, bu stratejiyi önerilen aralığın çizileceği yerde açmaya yetecek kadar günlük kapanış yok; bu yüzden hiçbir şey yeniden oynatılmadı.",
    unreplayed:
      "Bu strateji bu havuz için yeniden oynatılamadı: burada bir takasın ne ödediğini ne havuzun kendi koşulları söylüyor ne de bir aylık takaslarından ölçülebiliyor.",
    recentredOn: (dates) => `Şu günlerin kapanışında yeniden ortalandı: ${dates}.`,
    never:
      "Hiç yeniden ortalanmadı: her gün aralığın içinde kapandı, yani bu yukarıdaki ayın ta kendisi — bütün ay aynı aralık, aynı rakamlar. Hiçbir takas ödenmedi, gas da ödenmeyecekti.",
    feeStated: (fee) => `Her yeniden ortalamanın takasından ${fee} alınır: havuzun kendi koşullarına göre bir takasın ödediği.`,
    feeMeasured: (fee) =>
      `Bu havuzda bir takasın ne ödediğini sabit hiçbir şey söylemiyor — komisyonu hook'u takas takas belirliyor — bu yüzden her yeniden ortalamanın takasından ${fee} alınır: ayın takaslarının ortalamada ödediği, ölçülmüş oran. O gün bir yeniden ortalama daha fazla ya da daha az ödemiş olabilir.`,
    hookMayAlter:
      "Bu havuzun hook'u bir takasın maliyetini değiştirmeye izinli; bu yüzden buradaki takas komisyonları yalnızca komisyondur ve gerçek bir yeniden ortalama başka bir tutar ödemiş olabilir. Burada okunan hiçbir şey bunu söyleyemez.",
    tableCaption: "Yeniden ortalanan, hiç ortalanmayanın yanında",
    columnFigure: "Rakam",
    columnRecentred: "Yeniden ortalanan",
    columnNever: "Hiç ortalanmayan",
    recentres: "Yeniden ortalama",
    swapFees: "Ödenen takas komisyonu",
    gas: "Gas maliyeti",
    gasValue: (count, each, total) => `${count} × ${each} = ${total}`,
    gasNotCounted: "Sayılmadı",
    endValue: "Son değer, her şey sayılınca",
    endValueBeforeFees: "Son değer, komisyon hariç",
    vsHeld: "Elde tutmaya göre",
    endValueNote:
      "Son değer, pozisyonun son kapanıştaki değeridir — her takas komisyonundan sonra — artı sayıldığı yerde aldığı komisyon, eksi gas. Elde tutmaya göre, bunu yatırımın açılıştaki tokenları sadece tutulsaydı edecekleri değerin yanına koyar.",
    held: (amount) => `Yatırımın açılıştaki tokenları bunun yerine sadece tutulsaydı, son kapanışta ${amount} ederdi.`,
    difference: (amount) => `Yeniden ortalamanın yarattığı fark, her şey sayılınca: ${amount}.`,
    differenceBeforeFees: (amount) => `Yeniden ortalamanın yarattığı fark, komisyon hariç: ${amount}.`,
    gasLabel: "Yeniden ortalama başına gas",
    apply: "Yeniden hesapla",
    gasNote:
      "Gas, burada yeniden ortalama başına bir maliyet girilmedikçe sayılmaz; yatırım gibi dolar cinsindendir ve pozisyonun dışından ödenir. Açılış iki stratejiye de aynı maliyettedir ve hiçbirinde sayılmaz.",
    gasUnusable:
      "İstenen gas maliyeti okunamadı — sıfırdan başlayan düz bir ondalık sayı olmalı — bu yüzden gas sayılmadı.",
    showRecentres: "Her yeniden ortalamayı göster",
    recentresCaption: "Her yeniden ortalama, en eskiden",
    columnDay: "Gün",
    columnClose: "Kapanış",
    columnRange: "Yeni aralık",
    columnSwapped: "Takas edilen",
    columnSwapFee: "Takas komisyonu",
    swapped: (amount, sold, bought) => `${amount} değerinde ${sold}, ${bought} karşılığında`,
    closesOnly:
      "Bu yalnızca günlük kapanışları görür. Aralıktan çıkıp kapanıştan önce geri dönen bir gün yeniden ortalama değildir; yeniden ortalama kenarda değil kapanışta olur — çoğu zaman kenarın ötesinde, kenarda bekleyen bir emrin alacağından daha kötü bir fiyattan.",
    noImpact:
      "Fiyat etkisi modellenmedi: her takas, havuz onu bütünüyle karşılayacak kadar derinmiş gibi kapanış fiyatından fiyatlandı.",
    caveat:
      "Dolar cinsinden her rakam bugünkü dolar kuruyladır ve yatırım, yatırım panelinin hesapladığı gibi hesaplandı. Bu pozisyonu kimse tutmadı: zaten yaşanmış günlerde yeniden oynatılan tek bir stratejidir ve o günlerde daha iyi ya da daha kötü giden bir strateji gelecek günler hakkında hiçbir şey söylemez. Bir ölçümdür, yatırım tavsiyesi değildir.",
  },
  de: {
    heading: "Neu zentrieren, sobald der Preis den Bereich verlässt",
    intro:
      "Eine einfache aktive Strategie, über dieselben dreißig Tage und ab derselben Eröffnung nachgespielt wie der Monat oben. Die Einlage startet im selben Bereich, und wann immer ein Tag außerhalb des Bereichs schließt, wird die Position zu diesem Schlusskurs neu zentriert: Was sie hält, wird per Tausch in die Mischung gebracht, die ein gleich breiter Bereich um diesen Schlusskurs braucht, und der Tausch zahlt die Gebühr des Pools. Die Gebühren werden genau wie oben aufgeteilt, nach der Liquidität des an jedem Tag gehaltenen Bereichs, und beiseitegelegt.",
    noHistory:
      "Vor den letzten dreißig Tagen gibt es nicht genug Schlusskurse, um diese Strategie dort zu eröffnen, wo der vorgeschlagene Bereich gezogen worden wäre; deshalb wird nichts nachgespielt.",
    unreplayed:
      "Diese Strategie ließ sich für diesen Pool nicht nachspielen: Was ein Tausch hier zahlt, nennen weder die eigenen Bedingungen des Pools, noch lässt es sich aus seinem Monat an Tauschen messen.",
    recentredOn: (dates) => `Neu zentriert zum Schlusskurs vom ${dates}.`,
    never:
      "Nie neu zentriert: Jeder Tag schloss innerhalb des Bereichs, also ist das der Monat oben, unverändert — den ganzen Monat derselbe Bereich und dieselben Zahlen. Kein Tausch wurde bezahlt, und auch kein Gas wäre angefallen.",
    feeStated: (fee) => `Der Tausch jeder Neuzentrierung zahlt ${fee} — so viel, wie ein Tausch nach den eigenen Bedingungen des Pools zahlt.`,
    feeMeasured: (fee) =>
      `Nichts Festes sagt, was ein Tausch in diesem Pool zahlt — sein Hook legt die Gebühr Tausch für Tausch fest —, deshalb zahlt der Tausch jeder Neuzentrierung ${fee}: so viel haben die Tausche des Monats im Schnitt gezahlt, gemessen. Eine Neuzentrierung an ihrem Tag kann mehr oder weniger gezahlt haben.`,
    hookMayAlter:
      "Der Hook dieses Pools darf ändern, was ein Tausch kostet; die Tauschgebühren hier sind also nur die Gebühr, und eine echte Neuzentrierung kann etwas anderes gezahlt haben. Nichts, was hier gelesen wurde, kann das sagen.",
    tableCaption: "Neu zentriert neben nie neu zentriert",
    columnFigure: "Kennzahl",
    columnRecentred: "Neu zentriert",
    columnNever: "Nie neu zentriert",
    recentres: "Neuzentrierungen",
    swapFees: "Gezahlte Tauschgebühren",
    gas: "Gaskosten",
    gasValue: (count, each, total) => `${count} × ${each} = ${total}`,
    gasNotCounted: "Nicht gezählt",
    endValue: "Endwert, alles gezählt",
    endValueBeforeFees: "Endwert, vor Gebühren",
    vsHeld: "Gegenüber dem Halten",
    endValueNote:
      "Der Endwert ist der Wert der Position zum letzten Schlusskurs, nach jeder Tauschgebühr, plus die Gebühren, die sie erhielt, wo sie gezählt werden, minus Gas. „Gegenüber dem Halten“ stellt ihn neben das, was die Token der Einlage bei der Eröffnung wert wären, einfach gehalten.",
    held: (amount) => `Die Token der Einlage bei der Eröffnung stattdessen einfach zu halten, wäre zum letzten Schlusskurs ${amount} wert.`,
    difference: (amount) => `Was das Neuzentrieren geändert hat, alles gezählt: ${amount}.`,
    differenceBeforeFees: (amount) => `Was das Neuzentrieren geändert hat, vor Gebühren: ${amount}.`,
    gasLabel: "Gas je Neuzentrierung",
    apply: "Neu rechnen",
    gasNote:
      "Gas wird nicht gezählt, solange hier keine Kosten je Neuzentrierung eingetragen sind, in Dollar wie die Einlage; es wird von außerhalb der Position bezahlt. Die Eröffnung kostet beide Strategien dasselbe und wird bei keiner gezählt.",
    gasUnusable:
      "Die angegebenen Gaskosten ließen sich nicht lesen — es muss eine einfache Dezimalzahl ab null sein —, deshalb wird kein Gas gezählt.",
    showRecentres: "Jede Neuzentrierung zeigen",
    recentresCaption: "Jede Neuzentrierung, die älteste zuerst",
    columnDay: "Tag",
    columnClose: "Schlusskurs",
    columnRange: "Neuer Bereich",
    columnSwapped: "Getauscht",
    columnSwapFee: "Tauschgebühr",
    swapped: (amount, sold, bought) => `${amount} in ${sold} gegen ${bought}`,
    closesOnly:
      "Sie sieht nur Tagesschlusskurse. Ein Tag, der den Bereich verließ und vor seinem Schluss zurückkam, ist keine Neuzentrierung, und eine Neuzentrierung geschieht zum Schlusskurs, nicht an der Grenze — meist jenseits davon, zu einem schlechteren Preis, als ihn eine Order an der Grenze bekommen hätte.",
    noImpact:
      "Der Preiseinfluss ist nicht modelliert: Jeder Tausch wird zum Schlusskurs bewertet, als wäre der Pool tief genug, ihn ganz aufzunehmen.",
    caveat:
      "Jede Dollarzahl steht zum heutigen Dollarkurs, die Einlage so bemessen wie im Einlage-Panel. Niemand hat diese Position gehalten: Es ist eine Strategie, nachgespielt über Tage, die schon vergangen sind, und eine Strategie, die an ihnen besser oder schlechter abschnitt, sagt nichts über die kommenden. Eine Messung, keine Finanzberatung.",
  },
  es: {
    heading: "Recentrar cuando el precio sale",
    intro:
      "Una estrategia activa sencilla, repetida sobre los mismos treinta días y desde la misma apertura que el mes de arriba. El depósito se abre en el mismo rango y, cada vez que un día cierra fuera del rango, la posición se recentra en ese cierre: lo que tiene se lleva, mediante un intercambio, a la mezcla que necesita un rango del mismo ancho centrado en ese cierre, y el intercambio paga la comisión del pool. Las comisiones se reparten exactamente como arriba, según la liquidez del rango que se tiene cada día, y se apartan.",
    noHistory:
      "No hay suficientes cierres diarios antes de los últimos treinta días para abrir esta estrategia donde se habría trazado el rango sugerido, así que no se repite nada.",
    unreplayed:
      "No se pudo repetir esta estrategia para este pool: lo que paga aquí un intercambio no lo dicen las propias condiciones del pool ni puede medirse con su mes de intercambios.",
    recentredOn: (dates) => `Recentrada en el cierre de ${dates}.`,
    never:
      "Nunca se recentró: cada día cerró dentro del rango, así que esto es el mes de arriba sin cambios — el mismo rango todo el mes y las mismas cifras. No se pagó ningún intercambio, y tampoco habría habido gas.",
    feeStated: (fee) => `El intercambio de cada recentrado paga ${fee}, lo que paga un intercambio según las propias condiciones del pool.`,
    feeMeasured: (fee) =>
      `Nada fijo dice lo que paga un intercambio en este pool — su hook fija la comisión intercambio a intercambio —, así que el intercambio de cada recentrado paga ${fee}: lo que pagaron de media los intercambios del mes, medido. Un recentrado en su día pudo pagar más o menos.`,
    hookMayAlter:
      "El hook de este pool tiene permitido cambiar lo que cuesta un intercambio, así que las comisiones de intercambio de aquí son solo la comisión, y un recentrado real pudo pagar otra cosa. Nada de lo leído aquí puede decirlo.",
    tableCaption: "Recentrada junto a nunca recentrada",
    columnFigure: "Cifra",
    columnRecentred: "Recentrada",
    columnNever: "Nunca recentrada",
    recentres: "Recentrados",
    swapFees: "Comisiones de intercambio pagadas",
    gas: "Coste de gas",
    gasValue: (count, each, total) => `${count} × ${each} = ${total}`,
    gasNotCounted: "No contado",
    endValue: "Valor final, todo contado",
    endValueBeforeFees: "Valor final, antes de comisiones",
    vsHeld: "Frente a mantener",
    endValueNote:
      "El valor final es lo que vale la posición en el último cierre, después de cada comisión de intercambio, más las comisiones que cobró, donde se cuentan, menos el gas. Frente a mantener lo pone junto a lo que valdrían los tokens con que se abrió el depósito, simplemente mantenidos.",
    held: (amount) => `Mantener en su lugar los tokens con que se abrió el depósito valdría ${amount} en el último cierre.`,
    difference: (amount) => `Lo que cambió recentrar, todo contado: ${amount}.`,
    differenceBeforeFees: (amount) => `Lo que cambió recentrar, antes de comisiones: ${amount}.`,
    gasLabel: "Gas por recentrado",
    apply: "Recalcular",
    gasNote:
      "El gas no se cuenta salvo que aquí se fije un coste por recentrado, en dólares como el depósito; se paga desde fuera de la posición. La apertura cuesta lo mismo a las dos estrategias y no se cuenta en ninguna.",
    gasUnusable:
      "No se pudo leer el coste de gas pedido — debe ser un decimal simple desde cero —, así que el gas no se cuenta.",
    showRecentres: "Mostrar cada recentrado",
    recentresCaption: "Cada recentrado, del más antiguo al más reciente",
    columnDay: "Día",
    columnClose: "Cierre",
    columnRange: "Rango nuevo",
    columnSwapped: "Intercambiado",
    columnSwapFee: "Comisión de intercambio",
    swapped: (amount, sold, bought) => `${amount} en ${sold} por ${bought}`,
    closesOnly:
      "Solo ve cierres diarios. Un día que salió del rango y volvió antes de su cierre no es un recentrado, y un recentrado ocurre en el cierre, no en el borde — normalmente más allá, a un precio peor del que habría tenido una orden puesta en el borde.",
    noImpact:
      "No se modela el impacto en el precio: cada intercambio se valora al cierre, como si el pool fuera lo bastante profundo para absorberlo entero.",
    caveat:
      "Toda cifra en dólares está a la tasa en dólares de hoy, con el depósito dimensionado como lo dimensiona el panel del depósito. Nadie mantuvo esta posición: es una estrategia repetida sobre días que ya ocurrieron, y una estrategia a la que le fue mejor o peor en ellos no dice nada de los que vienen. Es una medición, no asesoramiento financiero.",
  },
  ar: {
    heading: "إعادة التوسيط حين يخرج السعر",
    intro:
      "استراتيجية نشطة بسيطة واحدة، مُعادة على الأيام الثلاثين نفسها ومن الافتتاح نفسه كالشهر أعلاه. يُفتح الإيداع في النطاق نفسه، وكلما أُغلق يوم خارج النطاق أُعيد توسيط المركز عند ذلك الإغلاق: يُحوَّل ما يحمله بتبادلٍ إلى المزيج الذي يحتاجه نطاق بالاتساع نفسه يتوسّطه ذلك الإغلاق، ويدفع التبادل رسوم التجمّع. وتوزَّع الرسوم تمامًا كما في الأعلى، بحسب سيولة النطاق المحتفَظ به في كل يوم، وتوضع جانبًا.",
    noHistory:
      "لا توجد إغلاقات يومية كافية قبل الأيام الثلاثين الأخيرة لفتح هذه الاستراتيجية حيث كان النطاق المقترح سيُرسم، فلا يُعاد شيء.",
    unreplayed:
      "تعذّرت إعادة هذه الاستراتيجية لهذا التجمّع: ما يدفعه التبادل هنا لا تذكره شروط التجمّع نفسه، ولا يمكن قياسه من شهر تبادلاته.",
    recentredOn: (dates) => `أُعيد توسيطه عند إغلاق ${dates}.`,
    never:
      "لم يُعَد توسيطه قط: أُغلق كل يوم داخل النطاق، فهذا هو الشهر أعلاه بلا تغيير — النطاق نفسه طوال الشهر والأرقام نفسها. لم يُدفع ثمن أي تبادل، ولم يكن ليُدفع أي غاز.",
    feeStated: (fee) => `يدفع تبادل كل إعادة توسيط ${fee}، وهو ما يدفعه التبادل بحسب شروط التجمّع نفسه.`,
    feeMeasured: (fee) =>
      `لا شيء ثابت يذكر ما يدفعه التبادل في هذا التجمّع — فخطّافه يحدّد الرسوم تبادلًا بتبادل — لذا يدفع تبادل كل إعادة توسيط ${fee}، وهو ما دفعته تبادلات الشهر في المتوسط، مقيسًا. وقد تكون إعادة توسيط في يومها دفعت أكثر أو أقل.`,
    hookMayAlter:
      "يُسمح للخطّاف في هذا التجمّع بتغيير تكلفة التبادل، فرسوم التبادل هنا هي الرسوم وحدها، وربما دفعت إعادة توسيط حقيقية شيئًا آخر. لا شيء مما قُرئ هنا يستطيع أن يقول ذلك.",
    tableCaption: "مع إعادة التوسيط بجانب بدونها",
    columnFigure: "الرقم",
    columnRecentred: "مع إعادة التوسيط",
    columnNever: "بلا إعادة توسيط",
    recentres: "مرات إعادة التوسيط",
    swapFees: "رسوم التبادل المدفوعة",
    gas: "الغاز",
    gasValue: (count, each, total) => `${count} × ${each} = ${total}`,
    gasNotCounted: "غير محتسب",
    endValue: "القيمة النهائية، مع احتساب كل شيء",
    endValueBeforeFees: "القيمة النهائية، قبل الرسوم",
    vsHeld: "مقارنةً بالاحتفاظ",
    endValueNote:
      "القيمة النهائية هي قيمة المركز عند آخر إغلاق، بعد كل رسوم تبادل، مضافًا إليها الرسوم التي حصّلها حيث تُحتسب، مطروحًا منها الغاز. و«مقارنةً بالاحتفاظ» تضعها بجانب ما كانت ستساويه الرموز التي فُتح بها الإيداع لو احتُفظ بها ببساطة.",
    held: (amount) => `لو احتُفظ بدلًا من ذلك بالرموز التي فُتح بها الإيداع ببساطة، لكانت تساوي ${amount} عند آخر إغلاق.`,
    difference: (amount) => `ما غيّرته إعادة التوسيط، مع احتساب كل شيء: ${amount}.`,
    differenceBeforeFees: (amount) => `ما غيّرته إعادة التوسيط، قبل الرسوم: ${amount}.`,
    gasLabel: "الغاز لكل إعادة توسيط",
    apply: "أعد الحساب",
    gasNote:
      "لا يُحتسب الغاز ما لم تُحدَّد هنا تكلفة لكل إعادة توسيط، بالدولار كالإيداع؛ ويُدفع من خارج المركز. والافتتاح يكلّف الاستراتيجيتين القدر نفسه ولا يُحتسب في أيّ منهما.",
    gasUnusable:
      "تعذّرت قراءة تكلفة الغاز المطلوبة — يجب أن تكون عددًا عشريًا بسيطًا من الصفر فما فوق — فلا يُحتسب الغاز.",
    showRecentres: "اعرض كل إعادة توسيط",
    recentresCaption: "كل إعادة توسيط، الأقدم أولًا",
    columnDay: "اليوم",
    columnClose: "الإغلاق",
    columnRange: "النطاق الجديد",
    columnSwapped: "ما بُدِّل",
    columnSwapFee: "رسوم التبادل",
    swapped: (amount, sold, bought) => `${amount} من ${sold} مقابل ${bought}`,
    closesOnly:
      "لا يرى هذا إلا الإغلاقات اليومية. اليوم الذي خرج فيه السعر من النطاق وعاد قبل إغلاقه ليس إعادة توسيط، وإعادة التوسيط تحدث عند الإغلاق لا عند الحافة — وغالبًا بعدها، بسعر أسوأ مما كان سيناله أمرٌ موضوع عند الحافة.",
    noImpact:
      "أثر السعر غير منمذج: يُسعَّر كل تبادل عند الإغلاق، كأن التجمّع عميق بما يكفي لاستيعابه كاملًا.",
    caveat:
      "كل رقم بالدولار محسوب بسعر الدولار اليوم، مع تقدير الإيداع كما تقدّره لوحة الإيداع. لم يحتفظ أحد بهذا المركز: إنها استراتيجية واحدة مُعادة على أيام مضت، والاستراتيجية التي كان أداؤها فيها أفضل أو أسوأ لا تقول شيئًا عن الأيام المقبلة. إنه قياس، وليس نصيحة مالية.",
  },
  hi: {
    heading: "बाहर जाने पर फिर से केंद्रित करें",
    intro:
      "एक सरल सक्रिय रणनीति, ऊपर वाले महीने जैसे ही तीस दिनों पर और उसी शुरुआत से दोहराई गई। जमा उसी दायरे में खुलती है, और जब भी कोई दिन दायरे के बाहर बंद होता है, पोज़िशन उस बंद भाव पर फिर से केंद्रित की जाती है: उसके पास जो है, उसे स्वैप करके उस मिश्रण में बदला जाता है जो उस बंद भाव पर केंद्रित, उतनी ही चौड़ाई वाले दायरे को चाहिए, और स्वैप पूल का शुल्क चुकाता है। शुल्क ठीक ऊपर की तरह बाँटा जाता है, हर दिन रखे गए दायरे की तरलता के हिसाब से, और अलग रखा जाता है।",
    noHistory:
      "पिछले तीस दिनों से पहले इतने दैनिक बंद भाव नहीं हैं कि यह रणनीति वहाँ खोली जा सके जहाँ सुझाया गया दायरा खींचा जाता, इसलिए कुछ नहीं दोहराया गया।",
    unreplayed:
      "यह रणनीति इस पूल के लिए दोहराई नहीं जा सकी: यहाँ एक स्वैप क्या चुकाता है, यह न पूल की अपनी शर्तें बताती हैं और न उसके महीने भर के स्वैप से मापा जा सकता है।",
    recentredOn: (dates) => `${dates} के बंद भाव पर फिर से केंद्रित की गई।`,
    never:
      "कभी फिर से केंद्रित नहीं की गई: हर दिन दायरे के भीतर बंद हुआ, इसलिए यह ऊपर वाला महीना ही है, बिना बदलाव — पूरे महीने वही दायरा और वही आँकड़े। कोई स्वैप नहीं चुकाया गया, और कोई गैस भी नहीं लगती।",
    feeStated: (fee) => `हर पुनःकेंद्रण का स्वैप ${fee} चुकाता है — पूल की अपनी शर्तों के अनुसार एक स्वैप जितना चुकाता है।`,
    feeMeasured: (fee) =>
      `इस पूल में एक स्वैप क्या चुकाता है, यह कोई तय चीज़ नहीं बताती — इसका hook हर स्वैप पर शुल्क तय करता है — इसलिए हर पुनःकेंद्रण का स्वैप ${fee} चुकाता है: महीने के स्वैप ने औसतन जितना चुकाया, मापा हुआ। अपने दिन पर कोई पुनःकेंद्रण ज़्यादा या कम चुका सकता था।`,
    hookMayAlter:
      "इस पूल के hook को यह बदलने की अनुमति है कि स्वैप की लागत क्या हो, इसलिए यहाँ के स्वैप शुल्क बस शुल्क हैं, और असल पुनःकेंद्रण ने कुछ और चुकाया हो सकता है। यहाँ पढ़ी गई कोई चीज़ यह नहीं बता सकती।",
    tableCaption: "पुनःकेंद्रण के साथ, बिना पुनःकेंद्रण के बगल में",
    columnFigure: "आँकड़ा",
    columnRecentred: "पुनःकेंद्रण के साथ",
    columnNever: "बिना पुनःकेंद्रण",
    recentres: "पुनःकेंद्रण",
    swapFees: "चुकाया गया स्वैप शुल्क",
    gas: "गैस",
    gasValue: (count, each, total) => `${count} × ${each} = ${total}`,
    gasNotCounted: "नहीं गिना गया",
    endValue: "अंतिम मूल्य, सब कुछ गिनकर",
    endValueBeforeFees: "अंतिम मूल्य, शुल्क से पहले",
    vsHeld: "रखे रहने की तुलना में",
    endValueNote:
      "अंतिम मूल्य आख़िरी बंद भाव पर पोज़िशन का मूल्य है, हर स्वैप शुल्क के बाद, जहाँ गिना जाता है वहाँ उसे मिला शुल्क जोड़कर और गैस घटाकर। रखे रहने की तुलना इसे उसके बगल में रखती है जो जमा के शुरुआती टोकन बस रखे रहने पर होते।",
    held: (amount) => `इसके बजाय जमा के शुरुआती टोकन बस रखे रहते, तो आख़िरी बंद भाव पर उनका मूल्य ${amount} होता।`,
    difference: (amount) => `पुनःकेंद्रण से क्या बदला, सब कुछ गिनकर: ${amount}।`,
    differenceBeforeFees: (amount) => `पुनःकेंद्रण से क्या बदला, शुल्क से पहले: ${amount}।`,
    gasLabel: "प्रति पुनःकेंद्रण गैस",
    apply: "फिर से गिनें",
    gasNote:
      "जब तक इस पृष्ठ पर प्रति पुनःकेंद्रण कोई लागत तय न की जाए, गैस नहीं गिनी जाती — जमा की तरह डॉलर में; यह पोज़िशन के बाहर से चुकाई जाती है। शुरुआत दोनों रणनीतियों को बराबर पड़ती है और किसी में नहीं गिनी जाती।",
    gasUnusable:
      "माँगी गई गैस लागत पढ़ी नहीं जा सकी — यह शून्य से ऊपर का सादा दशमलव अंक होना चाहिए — इसलिए गैस नहीं गिनी गई।",
    showRecentres: "हर पुनःकेंद्रण दिखाएँ",
    recentresCaption: "हर पुनःकेंद्रण, सबसे पुराना पहले",
    columnDay: "दिन",
    columnClose: "बंद भाव",
    columnRange: "नया दायरा",
    columnSwapped: "स्वैप किया गया",
    columnSwapFee: "स्वैप शुल्क",
    swapped: (amount, sold, bought) => `${amount} का ${sold}, ${bought} के बदले`,
    closesOnly:
      "यह बस दैनिक बंद भाव देखता है। जो दिन दायरे से बाहर जाकर अपने बंद होने से पहले लौट आया, वह पुनःकेंद्रण नहीं है, और पुनःकेंद्रण किनारे पर नहीं, बंद भाव पर होता है — अक्सर उसके पार, उस कीमत से बदतर पर जो किनारे पर रखा ऑर्डर पाता।",
    noImpact:
      "कीमत पर असर का मॉडल नहीं बनाया गया: हर स्वैप बंद भाव पर आँका जाता है, मानो पूल उसे पूरा सँभालने लायक़ गहरा हो।",
    caveat:
      "डॉलर का हर आँकड़ा आज की डॉलर दर पर है, और जमा वैसे ही आँकी गई है जैसे जमा वाला पैनल आँकता है। यह पोज़िशन किसी ने नहीं रखी: यह बीत चुके दिनों पर दोहराई गई एक रणनीति है, और जो रणनीति उन दिनों बेहतर या बदतर रही, वह आने वाले दिनों के बारे में कुछ नहीं कहती। यह एक माप है, सलाह नहीं।",
  },
  zh: {
    heading: "价格离开时重新居中",
    intro:
      "一个简单的主动策略，在与上面那个月相同的三十天里、从同一个开仓点重演。存入的资金在同一个区间开仓；每当某天收盘在区间之外，就在那个收盘价上把仓位重新居中：把它持有的代币通过兑换调成以该收盘价为中心、同样宽度的区间所需的比例，兑换支付资金池的手续费。手续费的分配与上面完全相同，按每天所持区间的流动性计算，并单独存放。",
    noHistory: "最近三十天之前的每日收盘价不够，无法在建议区间当时会被画出的位置开这个策略，因此没有重演任何内容。",
    unreplayed: "无法为这个资金池重演这个策略：这里一笔兑换要付多少，资金池自己的条款没有写明，也无法从它一个月的兑换中测出。",
    recentredOn: (dates) => `在 ${dates} 的收盘价上重新居中。`,
    never:
      "从未重新居中：每天都收在区间之内，所以这就是上面那个月，原封不动——整月同一个区间，同样的数字。没有付过任何兑换费用，也不会产生 gas。",
    feeStated: (fee) => `每次重新居中的兑换按 ${fee} 收费，即按资金池自己的条款一笔兑换所付的费率。`,
    feeMeasured: (fee) =>
      `这个资金池没有任何固定的东西说明一笔兑换要付多少——它的 hook 逐笔设定费率——所以每次重新居中的兑换按 ${fee} 收费，即本月的兑换平均实际支付的费率，是测出来的。某次重新居中在当天付的可能更多或更少。`,
    hookMayAlter:
      "这个资金池的 hook 被允许改变一笔兑换的成本，所以这里的兑换手续费只是费率本身，真实的重新居中可能付了别的数目。这里读到的任何东西都无法说明。",
    tableCaption: "重新居中与从不重新居中并列",
    columnFigure: "数字",
    columnRecentred: "重新居中",
    columnNever: "从不重新居中",
    recentres: "重新居中次数",
    swapFees: "支付的兑换手续费",
    gas: "gas 费用",
    gasValue: (count, each, total) => `${count} × ${each} = ${total}`,
    gasNotCounted: "未计入",
    endValue: "期末价值，全部计入",
    endValueBeforeFees: "期末价值，未计手续费收入",
    vsHeld: "相对持有",
    endValueNote:
      "期末价值是仓位在最后一个收盘价时的价值，已扣除每一笔兑换手续费，加上计入时它获得的手续费，再减去 gas。相对持有，则是把它与存入时的代币单纯持有到最后的价值放在一起比较。",
    held: (amount) => `如果改为单纯持有存入时的代币，在最后一个收盘价时值 ${amount}。`,
    difference: (amount) => `重新居中带来的变化，全部计入：${amount}。`,
    differenceBeforeFees: (amount) => `重新居中带来的变化，未计手续费收入：${amount}。`,
    gasLabel: "每次重新居中的 gas",
    apply: "重新计算",
    gasNote:
      "除非在这里设定每次重新居中的成本，否则不计 gas——和存入金额一样以美元计；它从仓位之外支付。开仓对两种策略的成本相同，两边都不计。",
    gasUnusable: "无法读取所要求的 gas 成本——必须是从零起的普通小数——因此不计 gas。",
    showRecentres: "显示每次重新居中",
    recentresCaption: "每次重新居中，从最早开始",
    columnDay: "日期",
    columnClose: "收盘价",
    columnRange: "新区间",
    columnSwapped: "兑换",
    columnSwapFee: "兑换手续费",
    swapped: (amount, sold, bought) => `${amount} 的 ${sold} 换成 ${bought}`,
    closesOnly:
      "它只看每日收盘价。某天价格离开区间又在收盘前回来，不算一次重新居中；而重新居中发生在收盘价上，而不是在边界上——通常已经越过边界，价格比挂在边界上的订单更差。",
    noImpact: "没有模拟价格冲击：每笔兑换都按收盘价计价，仿佛资金池深到足以整笔吃下。",
    caveat:
      "所有美元数字都按今天的美元汇率计算，存入金额按存入面板的方式折算。没有人真的持有过这个仓位：这是一个策略在已经发生的日子上的重演，一个在这些日子里表现更好或更差的策略，对未来的日子什么也没说。这是一次测量，不构成财务建议。",
  },
  ru: {
    heading: "Перецентрировать, когда цена выходит",
    intro:
      "Одна простая активная стратегия, повторённая на тех же тридцати днях и с того же открытия, что и месяц выше. Вклад открывается в том же диапазоне, и всякий раз, когда день закрывается вне диапазона, позиция перецентрируется по этому закрытию: то, что она держит, через своп приводится к соотношению, которое нужно диапазону той же ширины с центром на этом закрытии, и своп платит комиссию пула. Комиссии распределяются точно как выше, по ликвидности диапазона, который держали в тот день, и откладываются в сторону.",
    noHistory:
      "До последних тридцати дней недостаточно дневных закрытий, чтобы открыть эту стратегию там, где был бы нарисован предлагаемый диапазон, поэтому ничего не повторяется.",
    unreplayed:
      "Эту стратегию не удалось повторить для этого пула: сколько здесь платит своп, не говорят ни собственные условия пула, ни его месяц свопов.",
    recentredOn: (dates) => `Перецентрирована на закрытии ${dates}.`,
    never:
      "Ни разу не перецентрирована: каждый день закрывался внутри диапазона, так что это месяц выше без изменений — весь месяц тот же диапазон и те же цифры. Ни одного свопа не оплачено, и gas тоже не понадобился бы.",
    feeStated: (fee) => `Своп при каждом перецентрировании платит ${fee} — столько, сколько платит своп по собственным условиям пула.`,
    feeMeasured: (fee) =>
      `Ничто фиксированное не говорит, сколько платит своп в этом пуле — комиссию задаёт его hook, своп за свопом, — поэтому своп при каждом перецентрировании платит ${fee}: столько в среднем платили свопы за месяц, измерено. Перецентрирование в свой день могло заплатить больше или меньше.`,
    hookMayAlter:
      "Hook’у этого пула разрешено менять то, сколько стоит своп, поэтому комиссии за свопы здесь — только комиссия, и настоящее перецентрирование могло заплатить иначе. Ничто прочитанное здесь не может этого сказать.",
    tableCaption: "С перецентрированием и без него",
    columnFigure: "Показатель",
    columnRecentred: "С перецентрированием",
    columnNever: "Без перецентрирования",
    recentres: "Перецентрирования",
    swapFees: "Уплаченные комиссии за свопы",
    gas: "Расходы на gas",
    gasValue: (count, each, total) => `${count} × ${each} = ${total}`,
    gasNotCounted: "Не учитывается",
    endValue: "Итоговая стоимость, всё учтено",
    endValueBeforeFees: "Итоговая стоимость, без комиссий",
    vsHeld: "Относительно хранения",
    endValueNote:
      "Итоговая стоимость — это стоимость позиции на последнем закрытии, после всех комиссий за свопы, плюс полученные ею комиссии там, где они учитываются, минус gas. «Относительно хранения» ставит её рядом с тем, сколько стоили бы токены, с которыми открылся вклад, если их просто держать.",
    held: (amount) => `Если бы вместо этого просто держали токены, с которыми открылся вклад, на последнем закрытии они стоили бы ${amount}.`,
    difference: (amount) => `Что изменило перецентрирование, всё учтено: ${amount}.`,
    differenceBeforeFees: (amount) => `Что изменило перецентрирование, без комиссий: ${amount}.`,
    gasLabel: "Gas за перецентрирование",
    apply: "Пересчитать",
    gasNote:
      "Gas не учитывается, пока здесь не задана стоимость одного перецентрирования — в долларах, как вклад; он оплачивается не из позиции. Открытие стоит обеим стратегиям одинаково и не учитывается ни в одной.",
    gasUnusable:
      "Запрошенную стоимость gas не удалось прочитать — это должно быть простое десятичное число от нуля, — поэтому gas не учитывается.",
    showRecentres: "Показать каждое перецентрирование",
    recentresCaption: "Каждое перецентрирование, начиная с самого раннего",
    columnDay: "День",
    columnClose: "Закрытие",
    columnRange: "Новый диапазон",
    columnSwapped: "Обменяно",
    columnSwapFee: "Комиссия за своп",
    swapped: (amount, sold, bought) => `${amount} в ${sold} на ${bought}`,
    closesOnly:
      "Она видит только дневные закрытия. День, когда цена вышла из диапазона и вернулась до закрытия, — не перецентрирование, а перецентрирование происходит на закрытии, а не на границе, — обычно за ней, по цене хуже той, что получил бы ордер, стоящий на границе.",
    noImpact:
      "Влияние на цену не моделируется: каждый своп оценивается по закрытию, как будто пул достаточно глубок, чтобы принять его целиком.",
    caveat:
      "Каждая долларовая цифра — по сегодняшнему курсу к доллару, а вклад пересчитан так же, как в панели вклада. Никто не держал эту позицию: это одна стратегия, повторённая на уже прошедших днях, и стратегия, которая показала себя на них лучше или хуже, ничего не говорит о будущих. Это измерение, а не финансовый совет.",
  },
  pt: {
    heading: "Recentralizar quando o preço sai",
    intro:
      "Uma estratégia ativa simples, repetida sobre os mesmos trinta dias e a partir da mesma abertura que o mês acima. O depósito abre na mesma faixa e, sempre que um dia fecha fora da faixa, a posição é recentralizada nesse fechamento: o que ela tem é levado, por um swap, à mistura de que precisa uma faixa da mesma largura centrada nesse fechamento, e o swap paga a taxa do pool. As taxas são repartidas exatamente como acima, pela liquidez da faixa mantida em cada dia, e postas de lado.",
    noHistory:
      "Não há fechamentos diários suficientes antes dos últimos trinta dias para abrir esta estratégia onde a faixa sugerida teria sido traçada, então nada é repetido.",
    unreplayed:
      "Não foi possível repetir esta estratégia para este pool: o que um swap paga aqui não é dito pelas próprias condições do pool nem pode ser medido pelo seu mês de swaps.",
    recentredOn: (dates) => `Recentralizada no fechamento de ${dates}.`,
    never:
      "Nunca recentralizada: todo dia fechou dentro da faixa, então isto é o mês acima sem mudança — a mesma faixa o mês todo e os mesmos números. Nenhum swap foi pago, e nenhum gas teria sido.",
    feeStated: (fee) => `O swap de cada recentralização paga ${fee}, o que um swap paga pelas próprias condições do pool.`,
    feeMeasured: (fee) =>
      `Nada fixo diz o que um swap paga neste pool — o hook dele define a taxa swap a swap —, então o swap de cada recentralização paga ${fee}: o que os swaps do mês pagaram em média, medido. Uma recentralização no dia dela pode ter pago mais ou menos.`,
    hookMayAlter:
      "O hook deste pool tem permissão para mudar quanto um swap custa, então as taxas de swap aqui são só a taxa, e uma recentralização de verdade pode ter pago outra coisa. Nada do que foi lido aqui consegue dizer.",
    tableCaption: "Recentralizada ao lado de nunca recentralizada",
    columnFigure: "Número",
    columnRecentred: "Recentralizada",
    columnNever: "Nunca recentralizada",
    recentres: "Recentralizações",
    swapFees: "Taxas de swap pagas",
    gas: "Custo de gas",
    gasValue: (count, each, total) => `${count} × ${each} = ${total}`,
    gasNotCounted: "Não contado",
    endValue: "Valor final, tudo contado",
    endValueBeforeFees: "Valor final, antes das taxas",
    vsHeld: "Contra manter",
    endValueNote:
      "O valor final é quanto vale a posição no último fechamento, depois de cada taxa de swap, mais as taxas que recebeu, onde são contadas, menos o gas. Contra manter o coloca ao lado do que valeriam os tokens com que o depósito abriu, simplesmente mantidos.",
    held: (amount) => `Manter, em vez disso, os tokens com que o depósito abriu valeria ${amount} no último fechamento.`,
    difference: (amount) => `O que recentralizar mudou, tudo contado: ${amount}.`,
    differenceBeforeFees: (amount) => `O que recentralizar mudou, antes das taxas: ${amount}.`,
    gasLabel: "Gas por recentralização",
    apply: "Recalcular",
    gasNote:
      "O gas não é contado a menos que aqui se defina um custo por recentralização, em dólar como o depósito; ele é pago de fora da posição. A abertura custa o mesmo às duas estratégias e não é contada em nenhuma.",
    gasUnusable:
      "Não foi possível ler o custo de gas pedido — deve ser um decimal simples a partir de zero —, então o gas não é contado.",
    showRecentres: "Mostrar cada recentralização",
    recentresCaption: "Cada recentralização, da mais antiga à mais recente",
    columnDay: "Dia",
    columnClose: "Fechamento",
    columnRange: "Faixa nova",
    columnSwapped: "Trocado",
    columnSwapFee: "Taxa de swap",
    swapped: (amount, sold, bought) => `${amount} em ${sold} por ${bought}`,
    closesOnly:
      "Ela só vê fechamentos diários. Um dia que saiu da faixa e voltou antes do fechamento não é uma recentralização, e uma recentralização acontece no fechamento, não na borda — em geral além dela, a um preço pior do que uma ordem parada na borda teria conseguido.",
    noImpact:
      "O impacto no preço não é modelado: cada swap é avaliado no fechamento, como se o pool fosse fundo o bastante para absorvê-lo inteiro.",
    caveat:
      "Todo número em dólar está pela taxa em dólar de hoje, com o depósito dimensionado como o painel do depósito o dimensiona. Ninguém manteve esta posição: é uma estratégia repetida sobre dias que já aconteceram, e uma estratégia que foi melhor ou pior neles não diz nada sobre os próximos. É uma medição, não uma recomendação de investimento.",
  },
  "zh-Hant": {
    heading: "價格離開時重新置中",
    intro:
      "一個簡單的主動策略，在與上面那個月相同的三十天期間裡、從同一個開倉點重演。存入的資金在同一個區間開倉；每當某天收盤在區間之外，就在那個收盤價上把倉位重新置中：把它持有的代幣透過兌換調成以該收盤價為中心、同樣寬度的區間所需的比例，兌換支付資金池的手續費。手續費的分配與上面完全相同，按每天所持區間的流動性計算，並另外存放。",
    noHistory: "最近三十天之前的每日收盤價不夠，無法在建議區間當時會被畫出的位置開這個策略，因此沒有重演任何內容。",
    unreplayed: "無法為這個資金池重演這個策略：這裡一筆兌換要付多少，資金池自己的條款沒有寫明，也無法從它一個月的兌換中測出。",
    recentredOn: (dates) => `在 ${dates} 的收盤價上重新置中。`,
    never:
      "從未重新置中：每天都收在區間之內，所以這就是上面那個月，原封不動——整個期間同一個區間，同樣的數字。沒有付過任何兌換費用，也不會產生 gas。",
    feeStated: (fee) => `每次重新置中的兌換按 ${fee} 收費，也就是依資金池自己的條款一筆兌換所付的費率。`,
    feeMeasured: (fee) =>
      `這個資金池沒有任何固定的東西說明一筆兌換要付多少——它的 hook 逐筆設定費率——所以每次重新置中的兌換按 ${fee} 收費，也就是這段期間的兌換平均實際支付的費率，是測出來的。某次重新置中在當天付的可能更多或更少。`,
    hookMayAlter:
      "這個資金池的 hook 被允許改變一筆兌換的成本，所以這裡的兌換手續費只是費率本身，真實的重新置中可能付了別的數目。這裡讀到的任何東西都無法說明。",
    tableCaption: "重新置中與從不重新置中並列",
    columnFigure: "項目",
    columnRecentred: "重新置中",
    columnNever: "從不重新置中",
    recentres: "重新置中次數",
    swapFees: "支付的兌換手續費",
    gas: "gas 費用",
    gasValue: (count, each, total) => `${count} × ${each} = ${total}`,
    gasNotCounted: "未計入",
    endValue: "期末價值，全部計入",
    endValueBeforeFees: "期末價值，未計手續費收入",
    vsHeld: "相對持有",
    endValueNote:
      "期末價值是倉位在最後一個收盤價時的價值，已扣除每一筆兌換手續費，加上計入時它獲得的手續費，再減去 gas。相對持有，則是把它與存入時的代幣單純持有到最後的價值放在一起比較。",
    held: (amount) => `如果改為單純持有存入時的代幣，在最後一個收盤價時值 ${amount}。`,
    difference: (amount) => `重新置中帶來的變化，全部計入：${amount}。`,
    differenceBeforeFees: (amount) => `重新置中帶來的變化，未計手續費收入：${amount}。`,
    gasLabel: "每次重新置中的 gas",
    apply: "重新計算",
    gasNote:
      "除非在這裡設定每次重新置中的成本，否則不計 gas——和存入金額一樣以美元計；它從倉位之外支付。開倉對兩種策略的成本相同，兩邊都不計。",
    gasUnusable: "無法讀取所要求的 gas 成本——必須是從零起的一般小數——因此不計 gas。",
    showRecentres: "顯示每次重新置中",
    recentresCaption: "每次重新置中，從最早開始",
    columnDay: "日期",
    columnClose: "收盤價",
    columnRange: "新區間",
    columnSwapped: "兌換",
    columnSwapFee: "兌換手續費",
    swapped: (amount, sold, bought) => `${amount} 的 ${sold} 換成 ${bought}`,
    closesOnly:
      "它只看每日收盤價。某天價格離開區間又在收盤前回來，不算一次重新置中；而重新置中發生在收盤價上，而不是在邊界上——通常已經越過邊界，價格比掛在邊界上的訂單更差。",
    noImpact: "沒有模擬價格衝擊：每筆兌換都按收盤價計價，彷彿資金池深到足以整筆吃下。",
    caveat:
      "所有美元數字都按今天的美元匯率計算，存入金額按存入面板的方式折算。沒有人真的持有過這個倉位：這是一個策略在已經發生的日子上的重演，一個在這些日子裡表現更好或更差的策略，對未來的日子什麼也沒說明。這是一次測量，不構成財務建議。",
  },
};

export const getRecentringCopy = (locale: Locale): RecentringCopy => COPY[locale];
