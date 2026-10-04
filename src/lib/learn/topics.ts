import type { Locale } from "../i18n/locales";
import type { BriefId } from "./briefs";

/*
 * Each brief's own page: the three sentences of the quick guide, then three
 * more that say where the idea leads and where the site shows it on real
 * data. One address per topic, per language, so somebody searching for one
 * idea in their own language lands on that idea rather than on seven.
 *
 * Held to the guide's vocabulary for each language, as briefs.ts is, and to
 * its rules: no figure about any pool, and every trade-off stated as one.
 */

export type TopicCopy = {
  /** Three more sentences per brief, after the guide's own three. */
  readonly more: Readonly<Record<BriefId, readonly [string, string, string]>>;
  /** Above the links to the other six briefs. */
  readonly otherTopics: string;
  /** Back to the guide with all seven. */
  readonly backToGuide: string;
};

const en: TopicCopy = {
  more: {
    concentrated: [
      "Your deposit is split between the two tokens in whatever proportion the current price and your range call for.",
      "Below the range it is entirely one of the tokens; above it, entirely the other.",
      "The pool pages here draw a range from how far the price has actually moved, so the width is a measurement rather than a guess.",
    ],
    "in-range": [
      "Fees are paid only to the liquidity active at the price where a swap happens, so a position out of range shares in none of them.",
      "Leaving the range is not a loss by itself: it is the pool having converted the position fully into one token along the way.",
      "Each pool page here counts how many of the last days the price stayed inside the suggested range.",
    ],
    divergence: [
      "The gap is measured against holding: what the same two tokens would be worth had they never been deposited.",
      "A narrower range turns the same price move into a larger gap, because the position converts faster.",
      "Each pool page here draws the gap at every price across the range, next to the fees the pool actually charged.",
    ],
    width: [
      "A range is a trade-off between how much of the fees it collects and how often it stays in play.",
      "A narrower range also turns into a single token sooner when the price moves, which widens the gap against holding.",
      "Each pool page here shows what the other widths would have done on the same past days, side by side.",
    ],
    "fee-tiers": [
      "Swappers go where the price is best after the fee, so the busiest tier of a pair is often one with a lower fee.",
      "Liquidity follows fees in turn, and a tier with little of it gives each deposit a larger share of what it charges.",
      "The pool pages here list every tier of a pair beside the one being read, with how deep each is.",
    ],
    hooks: [
      "A hook's permissions are fixed when the pool is created; the pool cannot change which hook it names.",
      "What a hook does with a permission is in its code, which this site does not read and does not vouch for.",
      "The hook directory here lists the hooks behind the week's busiest v4 pools, with what each is permitted to do.",
    ],
    "smart-money": [
      "A position changed only recently has no window to measure yet, so it is left out until it has one.",
      "Very small positions are left out too, because a few cents of fees on a few dollars of liquidity says more about rounding than about skill.",
      "The smart-money page here ranks the week's busiest pools this way and shows the pair and the range that those positions share.",
    ],
  },
  otherTopics: "Other topics",
  backToGuide: "All seven on one page",
};

const tr: TopicCopy = {
  more: {
    concentrated: [
      "Yatırımın, o anki fiyatın ve aralığının gerektirdiği oranda iki token arasında bölünür.",
      "Fiyat aralığın altındayken tamamen bir token, üstündeyken tamamen diğer token olur.",
      "Buradaki havuz sayfaları aralığı fiyatın gerçekte ne kadar hareket ettiğinden çizer; yani genişlik bir tahmin değil, bir ölçümdür.",
    ],
    "in-range": [
      "Komisyon yalnızca takasın gerçekleştiği fiyatta çalışan likiditeye ödenir; aralık dışındaki bir pozisyon hiçbirinden pay almaz.",
      "Aralıktan çıkmak tek başına bir kayıp değildir: havuz yol boyunca pozisyonu tamamen tek bir tokena çevirmiştir.",
      "Buradaki her havuz sayfası, son günlerin kaçında fiyatın önerilen aralıkta kaldığını sayar.",
    ],
    divergence: [
      "Fark, sadece elde tutmaya göre ölçülür: aynı iki token hiç yatırılmasaydı ne ederdi.",
      "Daha dar bir aralık aynı fiyat hareketini daha büyük bir farka çevirir, çünkü pozisyon daha hızlı dönüşür.",
      "Buradaki her havuz sayfası farkı aralık boyunca her fiyatta, havuzun gerçekten aldığı komisyonun yanında gösterir.",
    ],
    width: [
      "Bir aralık, komisyondan ne kadar pay aldığı ile ne sıklıkla devrede kaldığı arasında bir tercihtir.",
      "Dar bir aralık fiyat hareket ettiğinde daha erken tek bir tokena da döner; bu da elde tutmaya göre farkı büyütür.",
      "Buradaki her havuz sayfası, diğer genişliklerin aynı geçmiş günlerde ne yapacağını yan yana gösterir.",
    ],
    "fee-tiers": [
      "Takas yapanlar komisyon sonrası fiyatın en iyi olduğu yere gider; bu yüzden bir paritenin en işlek kademesi çoğu zaman komisyonu daha düşük olandır.",
      "Likidite de komisyonun peşinden gider; likiditesi az olan bir kademe her yatırıma, aldığı komisyondan daha büyük pay verir.",
      "Buradaki havuz sayfaları bir paritenin her kademesini, okunan havuzun yanında, her birinin derinliğiyle listeler.",
    ],
    hooks: [
      "Bir hook'un izinleri havuz oluşturulurken sabitlenir; havuz belirlediği hook'u değiştiremez.",
      "Bir hook'un bu izinlerle ne yaptığı kodundadır; bu site kodu okumaz ve hiçbir hook için kefil olmaz.",
      "Buradaki hook listesi, haftanın en işlek v4 havuzlarının arkasındaki hook'ları, her birinin ne yapmasına izin verildiğiyle birlikte gösterir.",
    ],
    "smart-money": [
      "Yakın zamanda değiştirilmiş bir pozisyonun henüz ölçülecek bir süresi yoktur; bu yüzden süresi oluşana kadar dışarıda bırakılır.",
      "Çok küçük pozisyonlar da dışarıda kalır, çünkü birkaç dolarlık likiditede birkaç kuruş komisyon, beceriden çok yuvarlamayı anlatır.",
      "Buradaki akıllı para sayfası haftanın en işlek havuzlarını bu şekilde sıralar ve o pozisyonların paylaştığı pariteyi ve aralığı gösterir.",
    ],
  },
  otherTopics: "Diğer konular",
  backToGuide: "Yedisi bir arada",
};

const de: TopicCopy = {
  more: {
    concentrated: [
      "Deine Einlage wird in dem Verhältnis auf die beiden Token aufgeteilt, das der aktuelle Preis und dein Bereich verlangen.",
      "Unterhalb des Bereichs besteht sie ganz aus einem Token, oberhalb ganz aus dem anderen.",
      "Die Pool-Seiten hier leiten den Bereich daraus ab, wie weit sich der Preis tatsächlich bewegt hat – die Breite ist also eine Messung, keine Schätzung.",
    ],
    "in-range": [
      "Gebühren gehen nur an die Liquidität, die bei dem Preis aktiv ist, zu dem ein Tausch stattfindet; eine Position außerhalb ihres Bereichs erhält davon nichts.",
      "Den Bereich zu verlassen ist für sich kein Verlust: Der Pool hat die Position unterwegs vollständig in einen Token umgewandelt.",
      "Jede Pool-Seite hier zählt, an wie vielen der letzten Tage der Preis im vorgeschlagenen Bereich blieb.",
    ],
    divergence: [
      "Der Abstand wird am Halten gemessen: daran, was dieselben beiden Token wert wären, wären sie nie eingezahlt worden.",
      "Ein engerer Bereich macht aus derselben Preisbewegung einen größeren Abstand, weil die Position schneller umgewandelt wird.",
      "Jede Pool-Seite hier zeigt den Abstand bei jedem Preis im Bereich, neben den Gebühren, die der Pool tatsächlich erhoben hat.",
    ],
    width: [
      "Ein Bereich ist eine Abwägung zwischen seinem Anteil an den Gebühren und der Zahl der Tage, an denen er im Spiel bleibt.",
      "Ein engerer Bereich wandelt sich bei einer Preisbewegung auch früher in einen einzigen Token um, was den Abstand zum Halten vergrößert.",
      "Jede Pool-Seite hier zeigt nebeneinander, was die anderen Breiten an denselben vergangenen Tagen getan hätten.",
    ],
    "fee-tiers": [
      "Wer tauscht, geht dorthin, wo der Preis nach der Gebühr am besten ist – die meistgehandelte Stufe eines Paars ist deshalb oft eine mit niedrigerer Gebühr.",
      "Liquidität folgt wiederum den Gebühren, und eine Stufe mit wenig davon gibt jeder Einlage einen größeren Anteil an dem, was sie erhebt.",
      "Die Pool-Seiten hier listen jede Stufe eines Paars neben dem gelesenen Pool auf, mit der Tiefe jeder einzelnen.",
    ],
    hooks: [
      "Die Berechtigungen eines Hooks stehen fest, wenn der Pool angelegt wird; der Pool kann nicht ändern, welchen Hook er nennt.",
      "Was ein Hook mit einer Berechtigung tut, steht in seinem Code, den diese Seite nicht liest und für den sie nicht bürgt.",
      "Das Hook-Verzeichnis hier listet die Hooks hinter den meistgehandelten v4-Pools der Woche auf, mit dem, was jeder tun darf.",
    ],
    "smart-money": [
      "Eine erst kürzlich geänderte Position hat noch kein Zeitfenster zum Messen und bleibt außen vor, bis sie eines hat.",
      "Sehr kleine Positionen bleiben ebenfalls außen vor, denn ein paar Cent Gebühren auf ein paar Dollar Liquidität sagen mehr über Rundung als über Geschick.",
      "Die Seite zur klugen Liquidität hier reiht die meistgehandelten Pools der Woche so ein und zeigt das Paar und den Bereich, den diese Positionen teilen.",
    ],
  },
  otherTopics: "Weitere Themen",
  backToGuide: "Alle sieben auf einer Seite",
};

const es: TopicCopy = {
  more: {
    concentrated: [
      "Tu depósito se reparte entre los dos tokens en la proporción que piden el precio actual y tu rango.",
      "Por debajo del rango es todo uno de los tokens; por encima, todo el otro.",
      "Las páginas de pools de este sitio trazan el rango a partir de cuánto se ha movido realmente el precio, así que la amplitud es una medición, no una suposición.",
    ],
    "in-range": [
      "Las comisiones se pagan solo a la liquidez activa en el precio donde ocurre un intercambio; una posición fuera de rango no participa de ninguna.",
      "Salir del rango no es una pérdida por sí mismo: es el pool, que en el camino ha convertido la posición por completo en un solo token.",
      "Cada página de pool de este sitio cuenta en cuántos de los últimos días el precio se quedó dentro del rango sugerido.",
    ],
    divergence: [
      "La diferencia se mide frente a mantener: lo que valdrían los mismos dos tokens si nunca se hubieran depositado.",
      "Un rango más estrecho convierte el mismo movimiento de precio en una diferencia mayor, porque la posición se convierte más rápido.",
      "Cada página de pool de este sitio muestra la diferencia en cada precio del rango, junto a las comisiones que el pool cobró de verdad.",
    ],
    width: [
      "Un rango es un equilibrio entre cuánto de las comisiones recoge y con qué frecuencia sigue en juego.",
      "Un rango más estrecho también se convierte antes en un solo token cuando el precio se mueve, lo que agranda la diferencia frente a mantener.",
      "Cada página de pool de este sitio muestra, lado a lado, lo que habrían hecho las otras amplitudes en los mismos días pasados.",
    ],
    "fee-tiers": [
      "Quien intercambia va adonde el precio es mejor tras la comisión, así que el nivel más activo de un par suele ser uno de comisión más baja.",
      "La liquidez, a su vez, sigue a las comisiones, y un nivel con poca da a cada depósito una parte mayor de lo que cobra.",
      "Las páginas de pools de este sitio listan cada nivel de un par junto al pool que se está leyendo, con la profundidad de cada uno.",
    ],
    hooks: [
      "Los permisos de un hook quedan fijados al crear el pool; el pool no puede cambiar el hook que nombra.",
      "Lo que un hook hace con un permiso está en su código, que este sitio no lee y del que no responde.",
      "El directorio de hooks de este sitio lista los hooks de los pools v4 más activos de la semana, con lo que cada uno tiene permitido hacer.",
    ],
    "smart-money": [
      "Una posición cambiada hace poco aún no tiene una ventana que medir, así que se deja fuera hasta que la tenga.",
      "Las posiciones muy pequeñas también se dejan fuera, porque unos centavos de comisiones sobre unos dólares de liquidez dicen más del redondeo que de la habilidad.",
      "La página de liquidez inteligente de aquí ordena así los pools más negociados de la semana y muestra el par y el rango que comparten esas posiciones.",
    ],
  },
  otherTopics: "Otros temas",
  backToGuide: "Los siete en una página",
};

const ar: TopicCopy = {
  more: {
    concentrated: [
      "يُقسَم إيداعك بين الرمزين بالنسبة التي يقتضيها السعر الحالي ونطاقك.",
      "تحت النطاق يكون كله من أحد الرمزين، وفوقه يكون كله من الآخر.",
      "ترسم صفحات التجمّعات هنا النطاق انطلاقًا من مقدار تحرّك السعر فعلًا، فيكون الاتساع قياسًا لا تخمينًا.",
    ],
    "in-range": [
      "تُدفع الرسوم فقط للسيولة النشطة عند السعر الذي يجري عنده التبادل، فلا يشارك المركز الخارج عن نطاقه في شيء منها.",
      "الخروج من النطاق ليس خسارة في حد ذاته: فالتجمّع قد حوّل المركز في الطريق بالكامل إلى رمز واحد.",
      "تعدّ كل صفحة تجمّع هنا عدد الأيام الأخيرة التي بقي فيها السعر داخل النطاق المقترح.",
    ],
    divergence: [
      "يُقاس الفرق مقارنةً بالاحتفاظ: أي بما كانت ستساويه الرموز نفسها لو لم تُودَع قط.",
      "النطاق الأضيق يحوّل حركة السعر نفسها إلى فرق أكبر، لأن المركز يتحوّل أسرع.",
      "تعرض كل صفحة تجمّع هنا الفرق عند كل سعر عبر النطاق، بجانب الرسوم التي حصّلها التجمّع فعلًا.",
    ],
    width: [
      "النطاق موازنة بين حجم ما يجمعه من الرسوم وعدد المرات التي يبقى فيها فاعلًا.",
      "والنطاق الأضيق يتحوّل أيضًا أبكر إلى رمز واحد حين يتحرك السعر، مما يوسّع الفرق مقارنةً بالاحتفاظ.",
      "تعرض كل صفحة تجمّع هنا جنبًا إلى جنب ما كانت الاتساعات الأخرى ستفعله في الأيام الماضية نفسها.",
    ],
    "fee-tiers": [
      "يتّجه المبادلون إلى حيث يكون السعر أفضل بعد الرسوم، لذا كثيرًا ما يكون المستوى الأنشط لزوجٍ ما مستوى برسوم أقل.",
      "والسيولة بدورها تتبع الرسوم، والمستوى الذي فيه سيولة قليلة يعطي كل إيداع حصة أكبر مما يحصّله.",
      "تسرد صفحات التجمّعات هنا كل مستوى للزوج بجانب التجمّع المقروء، مع عمق كل منها.",
    ],
    hooks: [
      "تُثبَّت صلاحيات الخطّاف عند إنشاء التجمّع، ولا يستطيع التجمّع تغيير الخطّاف الذي يسمّيه.",
      "ما يفعله الخطّاف بصلاحية ما موجود في شيفرته، وهذا الموقع لا يقرأ الشيفرة ولا يكفلها.",
      "يسرد دليل الخطّافات هنا الخطّافات التي تقف وراء أنشط تجمّعات v4 هذا الأسبوع، مع ما يُسمح لكل منها بفعله.",
    ],
    "smart-money": [
      "المركز الذي تغيّر حديثًا ليس له بعدُ مدة تُقاس، فيُستبعد إلى أن تصير له.",
      "وتُستبعد المراكز الصغيرة جدًّا كذلك، لأن بضعة سنتات من الرسوم على بضعة دولارات من السيولة تقول عن التقريب أكثر مما تقول عن المهارة.",
      "وتُرتّب صفحة السيولة الذكية هنا أنشط تجمّعات الأسبوع بهذه الطريقة، وتعرض الزوج والنطاق اللذين تشترك فيهما تلك المراكز.",
    ],
  },
  otherTopics: "مواضيع أخرى",
  backToGuide: "السبعة في صفحة واحدة",
};

const hi: TopicCopy = {
  more: {
    concentrated: [
      "आपकी जमा दोनों टोकनों में उस अनुपात में बँटती है जो मौजूदा कीमत और आपका दायरा माँगते हैं।",
      "दायरे के नीचे वह पूरी तरह एक टोकन होती है, और ऊपर पूरी तरह दूसरा।",
      "यहाँ के पूल वाले पृष्ठ दायरा इस बात से खींचते हैं कि कीमत असल में कितनी हिली है, इसलिए चौड़ाई अंदाज़ा नहीं, माप है।",
    ],
    "in-range": [
      "शुल्क केवल उस तरलता को मिलता है जो उस कीमत पर सक्रिय है जहाँ स्वैप होता है; दायरे से बाहर की पोज़िशन को उसमें से कुछ नहीं मिलता।",
      "दायरे से बाहर जाना अपने-आप में नुकसान नहीं है: रास्ते में पूल ने पोज़िशन को पूरी तरह एक टोकन में बदल दिया होता है।",
      "यहाँ का हर पूल वाला पृष्ठ गिनता है कि पिछले दिनों में से कितने दिन कीमत सुझाए गए दायरे के भीतर रही।",
    ],
    divergence: [
      "अंतर रखे रहने की तुलना में मापा जाता है: वही दोनों टोकन कितने के होते अगर उन्हें कभी जमा न किया गया होता।",
      "संकरा दायरा उसी कीमत-हलचल को बड़े अंतर में बदल देता है, क्योंकि पोज़िशन तेज़ी से बदलती है।",
      "यहाँ का हर पूल वाला पृष्ठ दायरे की हर कीमत पर अंतर दिखाता है, पूल द्वारा असल में लिए गए शुल्क के साथ।",
    ],
    width: [
      "दायरा इस बीच का संतुलन है कि वह शुल्क में से कितना इकट्ठा करता है और कितनी बार खेल में बना रहता है।",
      "कीमत हिलने पर संकरा दायरा एक ही टोकन में जल्दी बदल भी जाता है, जिससे रखे रहने की तुलना में अंतर बढ़ता है।",
      "यहाँ का हर पूल वाला पृष्ठ साथ-साथ दिखाता है कि उन्हीं बीते दिनों में दूसरी चौड़ाइयाँ क्या करतीं।",
    ],
    "fee-tiers": [
      "स्वैप करने वाले वहाँ जाते हैं जहाँ शुल्क के बाद कीमत सबसे अच्छी हो, इसलिए किसी जोड़ी का सबसे व्यस्त स्तर अक्सर कम शुल्क वाला होता है।",
      "तरलता भी शुल्क के पीछे चलती है, और जिस स्तर में तरलता कम है वह हर जमा को उसके लिए गए शुल्क का बड़ा हिस्सा देता है।",
      "यहाँ के पूल वाले पृष्ठ किसी जोड़ी के हर स्तर को पढ़े जा रहे पूल के साथ, हर एक की गहराई सहित, दिखाते हैं।",
    ],
    hooks: [
      "किसी hook की अनुमतियाँ पूल बनते समय तय हो जाती हैं; पूल अपना बताया hook बदल नहीं सकता।",
      "hook किसी अनुमति के साथ क्या करता है, यह उसके कोड में है, जिसे यह साइट न पढ़ती है और न ही उसकी ज़मानत देती है।",
      "यहाँ की hook सूची इस हफ़्ते के सबसे व्यस्त v4 पूलों के पीछे के hook दिखाती है, हर एक को क्या करने की अनुमति है उसके साथ।",
    ],
    "smart-money": [
      "हाल ही में बदली गई पोज़िशन के पास मापने के लिए अभी कोई खिड़की नहीं होती, इसलिए खिड़की बनने तक उसे बाहर रखा जाता है।",
      "बहुत छोटी पोज़िशनें भी बाहर रखी जाती हैं, क्योंकि कुछ डॉलर की तरलता पर कुछ पैसे का शुल्क हुनर से ज़्यादा पूर्णांकन के बारे में बताता है।",
      "यहाँ का स्मार्ट तरलता पृष्ठ हफ़्ते के सबसे व्यस्त पूलों को इसी तरह क्रम देता है और वह जोड़ी व दायरा दिखाता है जो उन पोज़िशनों में साझा है।",
    ],
  },
  otherTopics: "दूसरे विषय",
  backToGuide: "सातों एक पृष्ठ पर",
};

const zh: TopicCopy = {
  more: {
    concentrated: [
      "你的存入会按当前价格和你的区间所要求的比例，分配到两种代币上。",
      "低于区间时它全部是其中一种代币，高于区间时全部是另一种。",
      "本站的资金池页面根据价格实际移动了多远来画出区间，所以宽度是测量结果，而不是猜测。",
    ],
    "in-range": [
      "手续费只付给在兑换发生的价格上处于活跃状态的流动性；区间外的仓位一分也分不到。",
      "离开区间本身并不是损失：只是资金池在途中已把仓位完全换成了一种代币。",
      "本站每个资金池页面都会统计最近的日子里，价格有多少天留在建议区间内。",
    ],
    divergence: [
      "差距是相对于持有来衡量的：也就是同样两种代币如果从未存入，会值多少。",
      "更窄的区间会把同样的价格变动变成更大的差距，因为仓位转换得更快。",
      "本站每个资金池页面都会画出区间内每个价格上的差距，并与资金池实际收取的手续费放在一起。",
    ],
    width: [
      "区间是在分得多少手续费与多常留在场内之间的取舍。",
      "价格变动时，更窄的区间也会更早变成单一代币，这会拉大相对于持有的差距。",
      "本站每个资金池页面都会并排显示其他宽度在同样的过去日子里会有什么表现。",
    ],
    "fee-tiers": [
      "兑换的人会去扣除手续费后价格最好的地方，所以一个交易对最活跃的费率档往往是费率较低的那个。",
      "流动性反过来也追随手续费，流动性少的费率档会让每笔存入分到它所收手续费中更大的份额。",
      "本站的资金池页面会把一个交易对的每个费率档与正在查看的资金池并列，并注明各自的深度。",
    ],
    hooks: [
      "hook 的权限在资金池创建时就已固定；资金池无法更改它所指定的 hook。",
      "hook 用这些权限做什么写在它的代码里，本站不读取代码，也不为任何 hook 担保。",
      "本站的 hook 目录列出本周最活跃的 v4 资金池背后的 hook，以及每个 hook 被允许做什么。",
    ],
    "smart-money": [
      "刚刚变动过的仓位还没有可以测量的时间窗口，所以在有窗口之前会被排除在外。",
      "非常小的仓位也会被排除，因为几美元的流动性上几分钱的手续费，说明的更多是舍入，而不是水平。",
      "这里的聪明流动性页面用这种方式给本周最活跃的池子排序，并显示这些仓位共同所在的交易对和区间。",
    ],
  },
  otherTopics: "其他主题",
  backToGuide: "七条合在一页",
};

const ru: TopicCopy = {
  more: {
    concentrated: [
      "Ваш вклад делится между двумя токенами в той пропорции, которую задают текущая цена и ваш диапазон.",
      "Ниже диапазона он целиком состоит из одного токена, выше — целиком из другого.",
      "Страницы пулов на этом сайте строят диапазон из того, насколько цена действительно двигалась, так что ширина — это измерение, а не догадка.",
    ],
    "in-range": [
      "Комиссии платятся только ликвидности, активной на той цене, где происходит своп; позиция вне диапазона не получает ничего.",
      "Выход из диапазона сам по себе не убыток: просто пул по пути целиком перевёл позицию в один токен.",
      "Каждая страница пула на этом сайте считает, сколько из последних дней цена оставалась в предложенном диапазоне.",
    ],
    divergence: [
      "Разница измеряется относительно хранения: сколько стоили бы те же два токена, если бы их никогда не вносили.",
      "Более узкий диапазон превращает то же движение цены в большую разницу, потому что позиция конвертируется быстрее.",
      "Каждая страница пула на этом сайте показывает разницу при каждой цене диапазона рядом с комиссиями, которые пул действительно взял.",
    ],
    width: [
      "Диапазон — это компромисс между тем, какую долю комиссий он собирает, и тем, как часто он остаётся в игре.",
      "При движении цены узкий диапазон ещё и раньше превращается в один токен, что увеличивает разницу относительно хранения.",
      "Каждая страница пула на этом сайте показывает рядом, что сделали бы другие ширины в те же прошедшие дни.",
    ],
    "fee-tiers": [
      "Те, кто делает свопы, идут туда, где цена после комиссии лучше, поэтому самый активный уровень пары часто — уровень с меньшей комиссией.",
      "Ликвидность, в свою очередь, идёт за комиссиями, и уровень, где её мало, даёт каждому вкладу большую долю того, что он берёт.",
      "Страницы пулов на этом сайте показывают каждый уровень пары рядом с читаемым пулом, с глубиной каждого.",
    ],
    hooks: [
      "Разрешения hook’а фиксируются при создании пула; пул не может сменить названный им hook.",
      "Что hook делает с разрешением, записано в его коде, который этот сайт не читает и за который не ручается.",
      "Каталог hook’ов на этом сайте перечисляет hook’и самых активных пулов v4 за неделю вместе с тем, что каждому разрешено делать.",
    ],
    "smart-money": [
      "У недавно изменённой позиции ещё нет окна для измерения, поэтому её не учитывают, пока оно не появится.",
      "Совсем маленькие позиции тоже не учитываются: несколько центов комиссий на несколько долларов ликвидности говорят больше об округлении, чем об умении.",
      "Страница умной ликвидности на этом сайте так ранжирует самые торгуемые пулы недели и показывает пару и диапазон, общие для этих позиций.",
    ],
  },
  otherTopics: "Другие темы",
  backToGuide: "Все семь на одной странице",
};

const pt: TopicCopy = {
  more: {
    concentrated: [
      "Seu depósito é dividido entre os dois tokens na proporção que o preço atual e sua faixa pedem.",
      "Abaixo da faixa ele é todo um dos tokens; acima, todo o outro.",
      "As páginas de pools deste site traçam a faixa a partir de quanto o preço realmente se moveu, então a largura é uma medida, não um palpite.",
    ],
    "in-range": [
      "As taxas são pagas só à liquidez ativa no preço em que um swap acontece; uma posição fora da faixa não participa de nenhuma.",
      "Sair da faixa não é uma perda por si só: é o pool que, no caminho, converteu a posição inteira em um só token.",
      "Cada página de pool deste site conta em quantos dos últimos dias o preço ficou dentro da faixa sugerida.",
    ],
    divergence: [
      "A diferença é medida contra manter: quanto valeriam os mesmos dois tokens se nunca tivessem sido depositados.",
      "Uma faixa mais estreita transforma o mesmo movimento de preço em uma diferença maior, porque a posição se converte mais rápido.",
      "Cada página de pool deste site mostra a diferença em cada preço da faixa, ao lado das taxas que o pool de fato cobrou.",
    ],
    width: [
      "Uma faixa é um equilíbrio entre quanto das taxas ela recolhe e com que frequência continua em jogo.",
      "Uma faixa mais estreita também vira um só token mais cedo quando o preço se move, o que aumenta a diferença contra manter.",
      "Cada página de pool deste site mostra lado a lado o que as outras larguras teriam feito nos mesmos dias passados.",
    ],
    "fee-tiers": [
      "Quem faz swap vai aonde o preço é melhor depois da taxa, então o nível mais movimentado de um par costuma ser um de taxa menor.",
      "A liquidez, por sua vez, segue as taxas, e um nível com pouca liquidez dá a cada depósito uma parte maior do que cobra.",
      "As páginas de pools deste site listam cada nível de um par ao lado do pool em leitura, com a profundidade de cada um.",
    ],
    hooks: [
      "As permissões de um hook ficam fixas quando o pool é criado; o pool não pode trocar o hook que nomeia.",
      "O que um hook faz com uma permissão está no código dele, que este site não lê e pelo qual não responde.",
      "O diretório de hooks deste site lista os hooks dos pools v4 mais movimentados da semana, com o que cada um tem permissão de fazer.",
    ],
    "smart-money": [
      "Uma posição alterada há pouco ainda não tem uma janela para medir, então fica de fora até ter uma.",
      "Posições muito pequenas também ficam de fora, porque alguns centavos de taxas sobre alguns dólares de liquidez dizem mais sobre arredondamento do que sobre habilidade.",
      "A página de liquidez inteligente daqui ordena assim os pools mais negociados da semana e mostra o par e a faixa que essas posições compartilham.",
    ],
  },
  otherTopics: "Outros temas",
  backToGuide: "Os sete em uma página",
};

const zhHant: TopicCopy = {
  more: {
    concentrated: [
      "你的存入會按當前價格和你的區間所要求的比例，分配到兩種代幣上。",
      "低於區間時它全部是其中一種代幣，高於區間時全部是另一種。",
      "本站的資金池頁面根據價格實際移動了多遠來畫出區間，所以寬度是測量結果，而不是猜測。",
    ],
    "in-range": [
      "手續費只付給在兌換發生的價格上處於活躍狀態的流動性；區間外的倉位一分也分不到。",
      "離開區間本身並不是損失：只是資金池在途中已把倉位完全換成了一種代幣。",
      "本站每個資金池頁面都會統計最近的日子裡，價格有多少天留在建議區間內。",
    ],
    divergence: [
      "差距是相對於持有來衡量的：也就是同樣兩種代幣如果從未存入，會值多少。",
      "更窄的區間會把同樣的價格變動變成更大的差距，因為倉位轉換得更快。",
      "本站每個資金池頁面都會畫出區間內每個價格上的差距，並與資金池實際收取的手續費放在一起。",
    ],
    width: [
      "區間是在分得多少手續費與多常留在場內之間的取捨。",
      "價格變動時，更窄的區間也會更早變成單一代幣，這會拉大相對於持有的差距。",
      "本站每個資金池頁面都會並排顯示其他寬度在同樣的過去日子裡會有什麼表現。",
    ],
    "fee-tiers": [
      "兌換的人會去扣除手續費後價格最好的地方，所以一個交易對最活躍的費率檔往往是費率較低的那個。",
      "流動性反過來也追隨手續費，流動性少的費率檔會讓每筆存入分到它所收手續費中更大的份額。",
      "本站的資金池頁面會把一個交易對的每個費率檔與正在查看的資金池並列，並註明各自的深度。",
    ],
    hooks: [
      "hook 的權限在資金池建立時就已固定；資金池無法更改它所指定的 hook。",
      "hook 用這些權限做什麼寫在它的程式碼裡，本站不讀取程式碼，也不為任何 hook 擔保。",
      "本站的 hook 名錄列出本週最活躍的 v4 資金池背後的 hook，以及每個 hook 被允許做什麼。",
    ],
    "smart-money": [
      "剛剛變動過的倉位還沒有可以測量的期間，所以在有了這段期間之前會被排除在外。",
      "非常小的倉位也會被排除，因為幾美元的流動性上幾分錢的手續費，說明的更多是捨入，而不是水準。",
      "這裡的「聰明的流動性」頁面用這種方式給本週最活躍的資金池排序，並顯示這些倉位共同所在的交易對和區間。",
    ],
  },
  otherTopics: "其他主題",
  backToGuide: "七條合在一頁",
};

const COPY: Record<Locale, TopicCopy> = { en, tr, de, es, ar, hi, zh, ru, pt, "zh-Hant": zhHant };

export const getTopicCopy = (locale: Locale): TopicCopy => COPY[locale];
