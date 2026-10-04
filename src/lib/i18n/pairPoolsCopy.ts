import type { Locale } from "./locales";

/*
 * The pair page's own words. What it shares with the other pages — "On
 * Uniswap v3", "Holds", depth at the current price, the hook note, a week's
 * volume and fees and how many days they are made of — comes from the
 * dictionary and the most-traded copy, so the pages say those things the same
 * way.
 *
 * What is its own is the one figure it ranks by, and the words keep that
 * figure to what it is, in every language: fees already charged, over what is
 * in the pool now, scaled to a year — not a forecast, not what a position
 * would earn, and not a recommendation. A list sorted by a yield reads as a
 * tip unless it says otherwise, and says so where the number is.
 */

export type PairPoolsCopy = {
  /** Where the page is linked from: a pool's fee tiers, the comparison, a search. */
  readonly link: string;
  readonly title: string;
  /** The title once a pair has been typed. */
  readonly titleFor: (pair: string) => string;
  readonly description: string;
  readonly heading: string;
  /** In the network chip: this page reads them all. */
  readonly network: string;
  /** Above the box, naming the networks read. */
  readonly intro: (chains: string) => string;
  readonly label: string;
  readonly submit: string;
  /** For one symbol, the same one twice, or a pool's own id. */
  readonly notAPair: string;
  readonly resultsFor: (pair: string) => string;
  /** What the yield is and is not, the floor under the ranking, and that it is no recommendation. */
  readonly method: (floor: string) => string;
  /** Why v3 and v4 are ranked apart. */
  readonly apart: string;
  /** Exact symbols, ether against wrapped ether, and where the contracts are shown. */
  readonly symbols: string;
  /** Where the week's figures come from, and what a pool outside them is listed without. */
  readonly window: string;
  readonly feeYield: string;
  readonly ranked: string;
  readonly unranked: string;
  readonly thin: (floor: string) => string;
  /** Beside the hook note: why a swap-altering hook's pool has no yield. */
  readonly hook: string;
  readonly quiet: string;
  readonly weekUnread: string;
  readonly liquidityUnread: string;
  readonly chainsHeading: string;
  readonly chainRead: (chain: string, pools: string) => string;
  readonly chainUnread: (chain: string) => string;
  readonly none: string;
  readonly loading: string;
};

const COPY: Record<Locale, PairPoolsCopy> = {
  en: {
    link: "This pair on every network",
    title: "Every Uniswap pool of a pair, on every network",
    titleFor: (pair) => `Every Uniswap pool of ${pair}, on every network`,
    description:
      "Where a token pair trades on Uniswap v3 and v4 across Ethereum, Base, Arbitrum One, Unichain, OP Mainnet, Polygon, BNB Chain, Avalanche and Celo, with each pool's last week of volume and fees set against what is in it.",
    heading: "One pair, every pool",
    network: "All networks",
    intro: (chains) =>
      `Type a pair, such as USDC/WETH, to see every Uniswap v3 and v4 pool that trades it on ${chains}: its fee tier, what is in it, and its last week of trading and fees.`,
    label: "A pair of token symbols",
    submit: "Find every pool",
    notAPair:
      "Type two different token symbols, such as USDC/WETH. A pool's address or a v4 pool id has a page of its own: paste it into the pool search.",
    resultsFor: (pair) => `Every pool whose two tokens are exactly ${pair}.`,
    method: (floor) =>
      `Fee yield is the fees a pool charged over the last seven days, today so far included, against what is in the pool now, scaled to a year. It is past fees over current liquidity: not a forecast, and not what a position would earn — a position earns only while the price is inside its range, shares the fees with all the other liquidity there, and gives up something against simply holding the two tokens. Only pools worth at least ${floor} are ranked: below that, one large swap can make the yield meaningless, so smaller pools are listed after the ranking without one. Nothing here is a recommendation.`,
    apart:
      "v3 and v4 are ranked separately. On v3 a pool's liquidity is what its token contracts hold for it; on v4 it is the pool's depth at the current price, because every v4 pool's tokens sit in one contract and nothing on chain says what a single pool holds. Fees over holdings and fees over depth are not one scale.",
    symbols:
      "Only pools whose two symbols are exactly the two typed are listed. ETH and WETH are different tokens to a pool: search for each. A symbol is whatever a token's contract says — each pool's own page shows the contracts.",
    window:
      "The week's figures come from each network's thousand busiest pool-days of the last seven days, as on the most-traded page. A pool quieter than that is listed without them, and a total made of fewer than seven days is a floor.",
    feeYield: "Past fees over liquidity, a year",
    ranked: "Ranked by fee yield",
    unranked: "Not ranked",
    thin: (floor) => `Worth less than ${floor}: not ranked.`,
    hook: "Part of these fees may go to the hook rather than to liquidity providers, and nothing in the data separates the two, so no yield is worked out.",
    quiet: "Not among this network's busiest pools this week: no weekly figures.",
    weekUnread: "This network's weekly figures could not be read just now.",
    liquidityUnread: "What is in this pool could not be valued just now.",
    chainsHeading: "Networks read",
    chainRead: (chain, pools) => `${chain}: ${pools} ${pools === "1" ? "pool" : "pools"}`,
    chainUnread: (chain) => `${chain}: could not be read`,
    none: "No pool of this pair on the networks read.",
    loading: "Reading every network…",
  },
  tr: {
    link: "Bu parite tüm ağlarda",
    title: "Bir paritenin tüm ağlardaki bütün Uniswap havuzları",
    titleFor: (pair) => `${pair} paritesinin tüm ağlardaki bütün Uniswap havuzları`,
    description:
      "Bir token paritesinin Ethereum, Base, Arbitrum One, Unichain, OP Mainnet, Polygon, BNB Chain, Avalanche ve Celo üzerindeki Uniswap v3 ve v4 havuzları; her havuzun geçen haftaki işlem hacmi ve komisyonu, havuzdakiyle karşılaştırılarak.",
    heading: "Bir parite, bütün havuzlar",
    network: "Tüm ağlar",
    intro: (chains) =>
      `${chains} üzerinde bir pariteyi işleyen her Uniswap v3 ve v4 havuzunu görmek için USDC/WETH gibi bir parite yazın: komisyon kademesi, havuzda ne olduğu, geçen haftaki işlem hacmi ve komisyonu.`,
    label: "İki token sembolü",
    submit: "Bütün havuzları bul",
    notAPair:
      "USDC/WETH gibi iki farklı token sembolü yazın. Bir havuz adresinin ya da v4 havuz kimliğinin kendi sayfası var: onu havuz aramasına yapıştırın.",
    resultsFor: (pair) => `İki tokenı tam olarak ${pair} olan bütün havuzlar.`,
    method: (floor) =>
      `Komisyon verimi, bir havuzun son yedi günde — bugün dahil — aldığı komisyonun havuzda şu an olana oranı, yıllığa çevrilmiş hâli. Geçmiş komisyonun bugünkü likiditeye oranıdır: bir tahmin değildir ve bir pozisyonun kazanacağı da değildir — pozisyon yalnızca fiyat kendi aralığındayken kazanır, komisyonu oradaki bütün likiditeyle paylaşır ve iki tokenı elde tutmaya göre bir şey kaybeder. Yalnızca en az ${floor} değerindeki havuzlar sıralanır: bunun altında tek bir büyük takas verimi anlamsız kılabilir, bu yüzden küçük havuzlar sıralamanın ardından verimsiz listelenir. Buradaki hiçbir şey bir öneri değil.`,
    apart:
      "v3 ve v4 ayrı sıralanır. v3'te bir havuzun likiditesi, token sözleşmelerinin o havuz için tuttuğudur; v4'te havuzun güncel fiyattaki derinliğidir, çünkü her v4 havuzunun tokenları tek bir sözleşmede durur ve zincirde tek bir havuzun ne tuttuğunu söyleyen bir şey yoktur. Tutulana oranla komisyon ile derinliğe oranla komisyon aynı ölçek değildir.",
    symbols:
      "Yalnızca iki sembolü tam olarak yazılan iki sembol olan havuzlar listelenir. Bir havuz için ETH ile WETH farklı tokenlardır: ikisini ayrı ayrı arayın. Sembol, tokenın sözleşmesi ne diyorsa odur — sözleşmeleri her havuzun kendi sayfası gösterir.",
    window:
      "Haftalık rakamlar, en çok işlem görenler sayfasındaki gibi, her ağın son yedi gündeki en işlek bin havuz-gününden gelir. Bundan sakin bir havuz bu rakamlar olmadan listelenir; yediden az günden oluşan bir toplam bir alt sınırdır.",
    feeYield: "Geçmiş komisyon / likidite, yıllık",
    ranked: "Komisyon verimine göre sıralı",
    unranked: "Sıralanmayanlar",
    thin: (floor) => `Değeri ${floor} altında: sıralanmadı.`,
    hook: "Bu komisyonun bir kısmı likidite sağlayıcılarına değil hook'a gidebilir ve veride ikisini ayıran bir şey yok; bu yüzden verim hesaplanmadı.",
    quiet: "Bu hafta bu ağın en işlek havuzları arasında değil: haftalık rakam yok.",
    weekUnread: "Bu ağın haftalık rakamları şu an okunamadı.",
    liquidityUnread: "Bu havuzda ne olduğu şu an değerlenemedi.",
    chainsHeading: "Okunan ağlar",
    chainRead: (chain, pools) => `${chain}: ${pools} havuz`,
    chainUnread: (chain) => `${chain}: okunamadı`,
    none: "Okunan ağlarda bu paritenin havuzu yok.",
    loading: "Bütün ağlar okunuyor…",
  },
  de: {
    link: "Dieses Paar in jedem Netzwerk",
    title: "Jeder Uniswap-Pool eines Paars, in jedem Netzwerk",
    titleFor: (pair) => `Jeder Uniswap-Pool von ${pair}, in jedem Netzwerk`,
    description:
      "Wo ein Token-Paar auf Uniswap v3 und v4 gehandelt wird, über Ethereum, Base, Arbitrum One, Unichain, OP Mainnet, Polygon, BNB Chain, Avalanche und Celo, mit Volumen und Gebühren jedes Pools der letzten Woche im Verhältnis zu dem, was in ihm liegt.",
    heading: "Ein Paar, jeder Pool",
    network: "Alle Netzwerke",
    intro: (chains) =>
      `Geben Sie ein Paar ein, etwa USDC/WETH, um jeden Uniswap-v3- und -v4-Pool zu sehen, der es auf ${chains} handelt: seine Gebührenstufe, was in ihm liegt, und Handel und Gebühren der letzten Woche.`,
    label: "Zwei Token-Symbole",
    submit: "Jeden Pool finden",
    notAPair:
      "Geben Sie zwei verschiedene Token-Symbole ein, etwa USDC/WETH. Die Adresse eines Pools oder die ID eines v4-Pools hat eine eigene Seite: fügen Sie sie in die Pool-Suche ein.",
    resultsFor: (pair) => `Jeder Pool, dessen zwei Token genau ${pair} sind.`,
    method: (floor) =>
      `Die Gebührenrendite sind die Gebühren, die ein Pool in den letzten sieben Tagen erhoben hat, der heutige Tag bis jetzt eingeschlossen, im Verhältnis zu dem, was jetzt im Pool liegt, auf ein Jahr hochgerechnet. Es sind vergangene Gebühren über heutiger Liquidität: keine Prognose, und nicht, was eine Position verdienen würde — eine Position verdient nur, solange der Preis in ihrer Spanne liegt, teilt die Gebühren mit aller anderen Liquidität dort und gibt gegenüber dem bloßen Halten der beiden Token etwas auf. Nur Pools mit mindestens ${floor} werden gereiht: darunter kann ein einziger großer Tausch die Rendite bedeutungslos machen, deshalb stehen kleinere Pools ohne sie nach der Rangfolge. Nichts hier ist eine Empfehlung.`,
    apart:
      "v3 und v4 werden getrennt gereiht. Auf v3 ist die Liquidität eines Pools, was seine Token-Verträge für ihn halten; auf v4 ist es die Tiefe des Pools beim aktuellen Preis, weil die Token jedes v4-Pools in einem einzigen Vertrag liegen und nichts auf der Chain sagt, was ein einzelner Pool hält. Gebühren über Beständen und Gebühren über Tiefe sind nicht eine Skala.",
    symbols:
      "Gelistet werden nur Pools, deren zwei Symbole genau die zwei eingegebenen sind. ETH und WETH sind für einen Pool verschiedene Token: suchen Sie nach beiden. Ein Symbol ist, was der Vertrag eines Tokens sagt — die Seite jedes Pools zeigt die Verträge.",
    window:
      "Die Zahlen der Woche stammen aus den tausend geschäftigsten Pool-Tagen jedes Netzwerks in den letzten sieben Tagen, wie auf der Seite der meistgehandelten Pools. Ein ruhigerer Pool wird ohne sie gelistet, und eine Summe aus weniger als sieben Tagen ist eine Untergrenze.",
    feeYield: "Vergangene Gebühren über Liquidität, pro Jahr",
    ranked: "Nach Gebührenrendite gereiht",
    unranked: "Nicht gereiht",
    thin: (floor) => `Weniger als ${floor} wert: nicht gereiht.`,
    hook: "Ein Teil dieser Gebühren kann an den Hook gehen statt an die Liquiditätsanbieter, und nichts in den Daten trennt beides, deshalb wird keine Rendite berechnet.",
    quiet: "Nicht unter den geschäftigsten Pools dieses Netzwerks in dieser Woche: keine Wochenzahlen.",
    weekUnread: "Die Wochenzahlen dieses Netzwerks konnten gerade nicht gelesen werden.",
    liquidityUnread: "Was in diesem Pool liegt, konnte gerade nicht bewertet werden.",
    chainsHeading: "Gelesene Netzwerke",
    chainRead: (chain, pools) => `${chain}: ${pools} ${pools === "1" ? "Pool" : "Pools"}`,
    chainUnread: (chain) => `${chain}: nicht lesbar`,
    none: "Kein Pool dieses Paars in den gelesenen Netzwerken.",
    loading: "Jedes Netzwerk wird gelesen…",
  },
  es: {
    link: "Este par en todas las redes",
    title: "Todos los pools de Uniswap de un par, en todas las redes",
    titleFor: (pair) => `Todos los pools de Uniswap de ${pair}, en todas las redes`,
    description:
      "Dónde se negocia un par de tokens en Uniswap v3 y v4 en Ethereum, Base, Arbitrum One, Unichain, OP Mainnet, Polygon, BNB Chain, Avalanche y Celo, con el volumen y las comisiones de la última semana de cada pool frente a lo que contiene.",
    heading: "Un par, todos los pools",
    network: "Todas las redes",
    intro: (chains) =>
      `Escribe un par, como USDC/WETH, para ver cada pool de Uniswap v3 y v4 que lo negocia en ${chains}: su nivel de comisión, lo que contiene y su última semana de volumen y comisiones.`,
    label: "Dos símbolos de token",
    submit: "Buscar todos los pools",
    notAPair:
      "Escribe dos símbolos de token distintos, como USDC/WETH. La dirección de un pool o el id de un pool v4 tiene su propia página: pégalo en la búsqueda de pools.",
    resultsFor: (pair) => `Todos los pools cuyos dos tokens son exactamente ${pair}.`,
    method: (floor) =>
      `El rendimiento en comisiones son las comisiones que cobró un pool en los últimos siete días, incluido lo que va de hoy, frente a lo que contiene el pool ahora, llevado a un año. Son comisiones pasadas sobre la liquidez actual: no es una previsión, ni lo que ganaría una posición — una posición solo gana mientras el precio está dentro de su rango, reparte las comisiones con toda la otra liquidez que hay ahí y renuncia a algo frente a simplemente mantener los dos tokens. Solo se ordenan los pools que valen al menos ${floor}: por debajo, un único intercambio grande puede volver el rendimiento insignificante, así que los pools más pequeños aparecen después de la clasificación, sin él. Nada de esto es una recomendación.`,
    apart:
      "v3 y v4 se ordenan por separado. En v3 la liquidez de un pool es lo que sus contratos de token guardan para él; en v4 es la profundidad del pool al precio actual, porque los tokens de cada pool v4 están en un solo contrato y nada en la cadena dice lo que contiene un pool por sí solo. Comisiones sobre lo que se contiene y comisiones sobre la profundidad no son la misma escala.",
    symbols:
      "Solo aparecen los pools cuyos dos símbolos son exactamente los dos escritos. Para un pool, ETH y WETH son tokens distintos: busca cada uno. Un símbolo es lo que diga el contrato del token — la página de cada pool muestra los contratos.",
    window:
      "Las cifras de la semana salen de los mil pool-días más activos de cada red en los últimos siete días, como en la página de los más negociados. Un pool más tranquilo aparece sin ellas, y un total hecho de menos de siete días es un mínimo.",
    feeYield: "Comisiones pasadas sobre liquidez, al año",
    ranked: "Ordenados por rendimiento en comisiones",
    unranked: "Sin clasificar",
    thin: (floor) => `Vale menos de ${floor}: sin clasificar.`,
    hook: "Parte de estas comisiones puede ir al hook en lugar de a los proveedores de liquidez, y nada en los datos separa ambas cosas, así que no se calcula un rendimiento.",
    quiet: "No está entre los pools más activos de esta red esta semana: sin cifras semanales.",
    weekUnread: "Las cifras semanales de esta red no se pudieron leer ahora.",
    liquidityUnread: "Lo que contiene este pool no se pudo valorar ahora.",
    chainsHeading: "Redes leídas",
    chainRead: (chain, pools) => `${chain}: ${pools} ${pools === "1" ? "pool" : "pools"}`,
    chainUnread: (chain) => `${chain}: no se pudo leer`,
    none: "Ningún pool de este par en las redes leídas.",
    loading: "Leyendo todas las redes…",
  },
  ar: {
    link: "هذا الزوج على كل الشبكات",
    title: "كل تجمّعات Uniswap لزوج واحد، على كل الشبكات",
    titleFor: (pair) => `كل تجمّعات Uniswap للزوج ${pair}، على كل الشبكات`,
    description:
      "أين يُتداول زوج رموز على Uniswap v3 وv4 عبر Ethereum وBase وArbitrum One وUnichain وOP Mainnet وPolygon وBNB Chain وAvalanche وCelo، مع حجم تداول كل تجمّع ورسومه في الأسبوع الماضي مقابل ما فيه.",
    heading: "زوج واحد، كل التجمّعات",
    network: "كل الشبكات",
    intro: (chains) =>
      `اكتب زوجًا، مثل USDC/WETH، لترى كل تجمّع Uniswap v3 وv4 يتداوله على ${chains}: مستوى رسومه، وما فيه، وتداوله ورسومه في الأسبوع الماضي.`,
    label: "زوج من رمزين",
    submit: "ابحث عن كل التجمّعات",
    notAPair:
      "اكتب رمزين مختلفين، مثل USDC/WETH. لعنوان التجمّع أو معرّف تجمّع v4 صفحته الخاصة: ألصقه في بحث التجمّعات.",
    resultsFor: (pair) => `كل تجمّع رمزاه هما ${pair} تمامًا.`,
    method: (floor) =>
      `عائد الرسوم هو الرسوم التي تقاضاها التجمّع خلال الأيام السبعة الماضية، بما فيها ما مضى من اليوم، مقابل ما في التجمّع الآن، على أساس سنوي. إنه رسوم سابقة على السيولة الحالية: ليس تنبؤًا، وليس ما سيكسبه مركز — فالمركز يكسب فقط ما دام السعر داخل نطاقه، ويتقاسم الرسوم مع كل السيولة الأخرى هناك، ويتخلّى عن شيء مقابل مجرد الاحتفاظ بالرمزين. لا تُرتَّب إلا التجمّعات التي تساوي ${floor} على الأقل: فما دون ذلك قد تجعل عملية تبادل كبيرة واحدة العائد بلا معنى، لذا تُدرج التجمّعات الأصغر بعد الترتيب دون عائد. لا شيء هنا توصية.`,
    apart:
      "يُرتَّب v3 وv4 كلٌّ على حدة. في v3 سيولة التجمّع هي ما تحمله له عقود رموزه؛ وفي v4 هي عمق التجمّع عند السعر الحالي، لأن رموز كل تجمّعات v4 موجودة في عقد واحد ولا شيء على السلسلة يقول ما يحمله تجمّع بمفرده. الرسوم مقابل ما يُحمل والرسوم مقابل العمق ليسا مقياسًا واحدًا.",
    symbols:
      "لا تُدرج إلا التجمّعات التي يطابق رمزاها الرمزين المكتوبين تمامًا. ETH وWETH رمزان مختلفان بالنسبة إلى التجمّع: ابحث عن كل منهما. والرمز المكتوب ليس إلا ما يعلنه عقده عن نفسه — وصفحة كل تجمّع تعرض العقود.",
    window:
      "أرقام الأسبوع مأخوذة من أنشط ألف سجلّ يومي للتجمّعات في كل شبكة خلال الأيام السبعة الماضية، كما في صفحة الأكثر تداولًا. التجمّع الأهدأ من ذلك يُدرج من دونها، والمجموع المكوّن من أقل من سبعة أيام حدّ أدنى.",
    feeYield: "الرسوم السابقة مقابل السيولة، سنويًا",
    ranked: "مرتّبة حسب عائد الرسوم",
    unranked: "غير مرتّبة",
    thin: (floor) => `قيمته أقل من ${floor}: غير مرتّب.`,
    hook: "قد يذهب جزء من هذه الرسوم إلى الخطّاف بدلًا من مزوّدي السيولة، ولا شيء في البيانات يفصل بينهما، لذا لا يُحسب عائد.",
    quiet: "ليس بين أنشط تجمّعات هذه الشبكة هذا الأسبوع: لا أرقام أسبوعية.",
    weekUnread: "تعذّرت قراءة الأرقام الأسبوعية لهذه الشبكة الآن.",
    liquidityUnread: "تعذّر تقييم ما في هذا التجمّع الآن.",
    chainsHeading: "الشبكات المقروءة",
    chainRead: (chain, pools) => `${chain}: عدد التجمّعات ${pools}`,
    chainUnread: (chain) => `${chain}: تعذّرت القراءة`,
    none: "لا تجمّع لهذا الزوج على الشبكات المقروءة.",
    loading: "جارٍ قراءة كل الشبكات…",
  },
  hi: {
    link: "यह जोड़ी हर नेटवर्क पर",
    title: "एक जोड़ी के सभी Uniswap पूल, हर नेटवर्क पर",
    titleFor: (pair) => `${pair} के सभी Uniswap पूल, हर नेटवर्क पर`,
    description:
      "किसी टोकन जोड़ी का कारोबार Ethereum, Base, Arbitrum One, Unichain, OP Mainnet, Polygon, BNB Chain, Avalanche और Celo पर Uniswap v3 और v4 में कहाँ होता है, हर पूल के पिछले हफ़्ते के कारोबार और शुल्क के साथ, उसमें मौजूद रक़म के मुक़ाबले।",
    heading: "एक जोड़ी, सभी पूल",
    network: "सभी नेटवर्क",
    intro: (chains) =>
      `USDC/WETH जैसी कोई जोड़ी लिखें और ${chains} पर उसका कारोबार करने वाला हर Uniswap v3 और v4 पूल देखें: उसका शुल्क स्तर, उसमें क्या है, और पिछले हफ़्ते का कारोबार और शुल्क।`,
    label: "दो टोकन चिह्न",
    submit: "सभी पूल खोजें",
    notAPair:
      "USDC/WETH जैसे दो अलग टोकन चिह्न लिखें। किसी पूल के पते या v4 पूल की id का अपना पृष्ठ है: उसे पूल खोज में चिपकाएँ।",
    resultsFor: (pair) => `हर वह पूल जिसके दोनों टोकन ठीक ${pair} हैं।`,
    method: (floor) =>
      `शुल्क आय वह शुल्क है जो किसी पूल ने पिछले सात दिनों में लिया — आज का अब तक का शुल्क भी मिलाकर — पूल में अभी मौजूद रक़म के मुक़ाबले, सालाना आधार पर। यह पिछला शुल्क बनाम मौजूदा तरलता है: कोई पूर्वानुमान नहीं, और न ही वह जो कोई पोज़िशन कमाती — पोज़िशन तभी कमाती है जब कीमत उसके दायरे के भीतर हो, वहाँ की बाक़ी सारी तरलता के साथ शुल्क बाँटती है, और दोनों टोकन बस रखे रहने की तुलना में कुछ गँवाती है। केवल कम से कम ${floor} मूल्य वाले पूल क्रम में रखे जाते हैं: उससे नीचे एक बड़ा स्वैप आय को अर्थहीन बना सकता है, इसलिए छोटे पूल क्रम के बाद बिना आय के दिखाए जाते हैं। यहाँ कुछ भी सिफ़ारिश नहीं है।`,
    apart:
      "v3 और v4 अलग-अलग क्रम में रखे जाते हैं। v3 पर पूल की तरलता वह है जो उसके टोकन कॉन्ट्रैक्ट उसके लिए रखते हैं; v4 पर यह मौजूदा कीमत पर पूल की गहराई है, क्योंकि हर v4 पूल के टोकन एक ही कॉन्ट्रैक्ट में रहते हैं और चेन पर कुछ नहीं बताता कि अकेला पूल क्या रखता है। रखी रक़म पर शुल्क और गहराई पर शुल्क एक ही पैमाने पर नहीं हैं।",
    symbols:
      "केवल वे पूल दिखाए जाते हैं जिनके दोनों चिह्न ठीक वही हैं जो लिखे गए। पूल के लिए ETH और WETH अलग टोकन हैं: दोनों को अलग-अलग खोजें। चिह्न वही है जो टोकन का कॉन्ट्रैक्ट कहे — हर पूल का अपना पृष्ठ कॉन्ट्रैक्ट दिखाता है।",
    window:
      "हफ़्ते के आँकड़े हर नेटवर्क के पिछले सात दिनों के सबसे व्यस्त हज़ार पूल-दिनों से आते हैं, जैसे सबसे ज़्यादा कारोबार वाले पूलों के पृष्ठ पर। जो पूल इतना व्यस्त नहीं, वह उनके बिना दिखाया जाता है, और सात से कम दिनों से बना जोड़ एक न्यूनतम सीमा है।",
    feeYield: "पिछला शुल्क बनाम तरलता, सालाना",
    ranked: "शुल्क आय के क्रम में",
    unranked: "क्रम से बाहर",
    thin: (floor) => `मूल्य ${floor} से कम: क्रम में नहीं।`,
    hook: "इस शुल्क का एक हिस्सा तरलता देने वालों के बजाय hook को जा सकता है, और डेटा में दोनों को अलग करने वाला कुछ नहीं है, इसलिए कोई आय नहीं निकाली गई।",
    quiet: "इस हफ़्ते इस नेटवर्क के सबसे व्यस्त पूलों में नहीं: हफ़्ते के आँकड़े नहीं।",
    weekUnread: "इस नेटवर्क के हफ़्ते के आँकड़े अभी पढ़े नहीं जा सके।",
    liquidityUnread: "इस पूल में क्या है, उसका मूल्य अभी आँका नहीं जा सका।",
    chainsHeading: "पढ़े गए नेटवर्क",
    chainRead: (chain, pools) => `${chain}: ${pools} पूल`,
    chainUnread: (chain) => `${chain}: पढ़ा नहीं जा सका`,
    none: "पढ़े गए नेटवर्कों पर इस जोड़ी का कोई पूल नहीं।",
    loading: "हर नेटवर्क पढ़ा जा रहा है…",
  },
  zh: {
    link: "这个交易对在每个网络上",
    title: "一个交易对在每个网络上的所有 Uniswap 资金池",
    titleFor: (pair) => `${pair} 在每个网络上的所有 Uniswap 资金池`,
    description:
      "一个代币交易对在 Ethereum、Base、Arbitrum One、Unichain、OP Mainnet、Polygon、BNB Chain、Avalanche 和 Celo 上的 Uniswap v3 和 v4 资金池，以及每个资金池上周的交易量和手续费，与池中现有的价值相比。",
    heading: "一个交易对，所有资金池",
    network: "所有网络",
    intro: (chains) =>
      `输入一个交易对，例如 USDC/WETH，查看 ${chains} 上交易它的每个 Uniswap v3 和 v4 资金池：费率档、池中有什么，以及过去一周的交易量和手续费。`,
    label: "两个代币符号",
    submit: "查找所有资金池",
    notAPair:
      "请输入两个不同的代币符号，例如 USDC/WETH。资金池地址或 v4 资金池 ID 有自己的页面：把它粘贴到资金池搜索里。",
    resultsFor: (pair) => `两个代币正好是 ${pair} 的所有资金池。`,
    method: (floor) =>
      `手续费收益是一个资金池过去七天（包括今天到目前为止）收取的手续费，与池中现有的价值相比，再换算成一年。这是过去的手续费除以当前的流动性：不是预测，也不是一个仓位会赚到的——仓位只在价格处于其区间内时才赚取手续费，要与那里的其他流动性分享，并且相对于单纯持有两种代币还会有所损失。只有价值至少 ${floor} 的资金池才参与排名：低于这个数，一笔大额兑换就能让收益失去意义，所以较小的资金池列在排名之后，不给出收益。这里的任何内容都不是推荐。`,
    apart:
      "v3 和 v4 分开排名。在 v3 上，资金池的流动性是它的代币合约为它持有的数量；在 v4 上，是资金池在当前价格处的深度，因为每个 v4 资金池的代币都放在同一个合约里，链上没有任何东西说明单个资金池持有多少。手续费除以持有量和手续费除以深度不是同一个尺度。",
    symbols:
      "只列出两个符号正好是所输入的两个符号的资金池。对资金池来说，ETH 和 WETH 是不同的代币：请分别搜索。符号是代币合约自己说的任何东西——每个资金池自己的页面会显示合约。",
    window:
      "一周的数据来自每个网络过去七天里最繁忙的一千个资金池日，与交易最活跃页面相同。比这更冷清的资金池会列出但没有这些数据；由少于七天组成的合计是一个下限。",
    feeYield: "过去的手续费 ÷ 流动性，年化",
    ranked: "按手续费收益排名",
    unranked: "未排名",
    thin: (floor) => `价值低于 ${floor}：不参与排名。`,
    hook: "这些手续费中可能有一部分归 hook 而不是流动性提供者，数据中无法区分两者，所以不计算收益。",
    quiet: "不在这个网络本周最繁忙的资金池之列：没有每周数据。",
    weekUnread: "这个网络的每周数据现在无法读取。",
    liquidityUnread: "这个资金池中有多少现在无法估值。",
    chainsHeading: "读取的网络",
    chainRead: (chain, pools) => `${chain}：${pools} 个资金池`,
    chainUnread: (chain) => `${chain}：无法读取`,
    none: "在读取的网络上没有这个交易对的资金池。",
    loading: "正在读取每个网络…",
  },
  ru: {
    link: "Эта пара во всех сетях",
    title: "Все пулы Uniswap одной пары во всех сетях",
    titleFor: (pair) => `Все пулы Uniswap пары ${pair} во всех сетях`,
    description:
      "Где пара токенов торгуется в Uniswap v3 и v4 в Ethereum, Base, Arbitrum One, Unichain, OP Mainnet, Polygon, BNB Chain, Avalanche и Celo — с объёмом и комиссиями каждого пула за последнюю неделю против того, что в нём лежит.",
    heading: "Одна пара, все пулы",
    network: "Все сети",
    intro: (chains) =>
      `Введите пару, например USDC/WETH, чтобы увидеть каждый пул Uniswap v3 и v4, торгующий ею в сетях ${chains}: его уровень комиссии, что в нём лежит, его торги и комиссии за последнюю неделю.`,
    label: "Два символа токенов",
    submit: "Найти все пулы",
    notAPair:
      "Введите два разных символа токенов, например USDC/WETH. У адреса пула или id пула v4 есть своя страница: вставьте его в поиск пулов.",
    resultsFor: (pair) => `Все пулы, два токена которых — ровно ${pair}.`,
    method: (floor) =>
      `Доходность от комиссий — это комиссии, которые пул взял за последние семь дней, включая сегодняшний день до этого момента, против того, что лежит в пуле сейчас, в пересчёте на год. Это прошлые комиссии к текущей ликвидности: не прогноз и не то, что заработала бы позиция — позиция зарабатывает, только пока цена внутри её диапазона, делит комиссии со всей остальной ликвидностью там и кое-что теряет по сравнению с простым держанием двух токенов. Ранжируются только пулы стоимостью не меньше ${floor}: ниже этого один крупный своп может сделать доходность бессмысленной, поэтому меньшие пулы идут после рейтинга без неё. Ничто здесь не является рекомендацией.`,
    apart:
      "v3 и v4 ранжируются отдельно. В v3 ликвидность пула — это то, что его токен-контракты держат для него; в v4 — глубина пула на текущей цене, потому что токены всех пулов v4 лежат в одном контракте и ничто в сети не говорит, что держит отдельный пул. Комиссии к остаткам и комиссии к глубине — не одна шкала.",
    symbols:
      "Показаны только пулы, два символа которых в точности совпадают с введёнными. Для пула ETH и WETH — разные токены: ищите каждый. Символ — это то, что говорит контракт токена; страница каждого пула показывает контракты.",
    window:
      "Цифры за неделю берутся из тысячи самых активных пул-дней каждой сети за последние семь дней, как на странице самых торгуемых пулов. Более тихий пул показан без них, а сумма менее чем за семь дней — это нижняя граница.",
    feeYield: "Прошлые комиссии к ликвидности, в год",
    ranked: "По доходности от комиссий",
    unranked: "Вне рейтинга",
    thin: (floor) => `Стоит меньше ${floor}: вне рейтинга.`,
    hook: "Часть этих комиссий может уходить хуку, а не поставщикам ликвидности, и ничто в данных не разделяет одно и другое, поэтому доходность не считается.",
    quiet: "Не среди самых активных пулов этой сети на этой неделе: недельных цифр нет.",
    weekUnread: "Недельные цифры этой сети сейчас не удалось прочитать.",
    liquidityUnread: "Не удалось сейчас оценить, что лежит в этом пуле.",
    chainsHeading: "Прочитанные сети",
    chainRead: (chain, pools) => `${chain}: пулов — ${pools}`,
    chainUnread: (chain) => `${chain}: не удалось прочитать`,
    none: "В прочитанных сетях нет пула этой пары.",
    loading: "Читаем все сети…",
  },
  pt: {
    link: "Este par em todas as redes",
    title: "Todos os pools da Uniswap de um par, em todas as redes",
    titleFor: (pair) => `Todos os pools da Uniswap de ${pair}, em todas as redes`,
    description:
      "Onde um par de tokens é negociado na Uniswap v3 e v4 em Ethereum, Base, Arbitrum One, Unichain, OP Mainnet, Polygon, BNB Chain, Avalanche e Celo, com o volume e as taxas da última semana de cada pool diante do que há nele.",
    heading: "Um par, todos os pools",
    network: "Todas as redes",
    intro: (chains) =>
      `Digite um par, como USDC/WETH, para ver cada pool da Uniswap v3 e v4 que o negocia em ${chains}: seu nível de taxa, o que há nele e sua última semana de volume e taxas.`,
    label: "Dois símbolos de token",
    submit: "Encontrar todos os pools",
    notAPair:
      "Digite dois símbolos de token diferentes, como USDC/WETH. O endereço de um pool ou o id de um pool v4 tem sua própria página: cole-o na busca de pools.",
    resultsFor: (pair) => `Todos os pools cujos dois tokens são exatamente ${pair}.`,
    method: (floor) =>
      `O rendimento em taxas são as taxas que um pool cobrou nos últimos sete dias, incluindo o dia de hoje até agora, diante do que há no pool agora, levado a um ano. São taxas passadas sobre a liquidez atual: não é uma previsão, nem o que uma posição ganharia — uma posição só ganha enquanto o preço está dentro da sua faixa, divide as taxas com toda a outra liquidez ali e abre mão de algo em relação a simplesmente manter os dois tokens. Só os pools que valem pelo menos ${floor} são ordenados: abaixo disso, um único swap grande pode tornar o rendimento sem sentido, por isso os pools menores aparecem depois da classificação, sem ele. Nada aqui é uma recomendação.`,
    apart:
      "v3 e v4 são ordenados separadamente. Na v3 a liquidez de um pool é o que os contratos dos seus tokens guardam para ele; na v4 é a profundidade do pool ao preço atual, porque os tokens de cada pool v4 ficam num único contrato e nada na rede diz o que um pool sozinho guarda. Taxas sobre o que se guarda e taxas sobre profundidade não são a mesma escala.",
    symbols:
      "Só aparecem os pools cujos dois símbolos são exatamente os dois digitados. Para um pool, ETH e WETH são tokens diferentes: busque cada um. Um símbolo é o que o contrato do token disser — a página de cada pool mostra os contratos.",
    window:
      "Os números da semana vêm dos mil pool-dias mais movimentados de cada rede nos últimos sete dias, como na página dos mais negociados. Um pool mais calmo aparece sem eles, e um total feito de menos de sete dias é um mínimo.",
    feeYield: "Taxas passadas sobre liquidez, por ano",
    ranked: "Ordenados por rendimento em taxas",
    unranked: "Fora da classificação",
    thin: (floor) => `Vale menos de ${floor}: fora da classificação.`,
    hook: "Parte destas taxas pode ir para o hook em vez de para os provedores de liquidez, e nada nos dados separa as duas coisas, por isso nenhum rendimento é calculado.",
    quiet: "Não está entre os pools mais movimentados desta rede nesta semana: sem números semanais.",
    weekUnread: "Os números semanais desta rede não puderam ser lidos agora.",
    liquidityUnread: "O que há neste pool não pôde ser avaliado agora.",
    chainsHeading: "Redes lidas",
    chainRead: (chain, pools) => `${chain}: ${pools} ${pools === "1" ? "pool" : "pools"}`,
    chainUnread: (chain) => `${chain}: não foi possível ler`,
    none: "Nenhum pool deste par nas redes lidas.",
    loading: "Lendo todas as redes…",
  },
  "zh-Hant": {
    link: "這個交易對在每個網路上",
    title: "一個交易對在每個網路上的所有 Uniswap 資金池",
    titleFor: (pair) => `${pair} 在每個網路上的所有 Uniswap 資金池`,
    description:
      "一個代幣交易對在 Ethereum、Base、Arbitrum One、Unichain、OP Mainnet、Polygon、BNB Chain、Avalanche 和 Celo 上的 Uniswap v3 和 v4 資金池，以及每個資金池過去一週的交易量和手續費，並與池中現有的價值對照。",
    heading: "一個交易對，所有資金池",
    network: "所有網路",
    intro: (chains) =>
      `輸入一個交易對，例如 USDC/WETH，查看 ${chains} 上這個交易對的每個 Uniswap v3 和 v4 資金池：費率檔、池中有多少資金，以及過去一週的交易量和手續費。`,
    label: "兩個代幣符號",
    submit: "尋找所有資金池",
    notAPair:
      "請輸入兩個不同的代幣符號，例如 USDC/WETH。資金池地址或 v4 池 id 有自己的頁面：把它貼到資金池搜尋裡。",
    resultsFor: (pair) => `兩個代幣正好是 ${pair} 的所有資金池。`,
    method: (floor) =>
      `手續費收益是一個資金池過去七天（含今天截至目前）收取的手續費，除以池中現有的價值，再折算成年化。這是過去的手續費除以目前的流動性：不是預測，也不是一個倉位會賺到的——倉位只在價格處於其區間內時才賺取手續費，要與那裡的其他流動性分享，並且相對於單純持有兩種代幣還會有所損失。只有價值至少 ${floor} 的資金池才參與排名：低於這個數，一筆大額兌換就能讓收益失去意義，所以較小的資金池列在排名之後，不給出收益。這裡的任何內容都不是推薦。`,
    apart:
      "v3 和 v4 分開排名。在 v3 上，資金池的流動性是它的代幣合約為它持有的數量；在 v4 上，是資金池在當前價格處的深度，因為每個 v4 資金池的代幣都放在同一個合約裡，鏈上沒有任何東西說明單個資金池持有多少。手續費除以持有量和手續費除以深度不是同一個尺度。",
    symbols:
      "只列出兩個符號正好是所輸入的兩個符號的資金池。對資金池來說，ETH 和 WETH 是不同的代幣：請分別搜尋。代幣符號由合約自行設定，可以是任何內容——每個資金池自己的頁面會顯示合約。",
    window:
      "一週的資料取自每個網路過去七天裡最繁忙的一千筆資金池單日紀錄，與「交易最活躍的資金池」頁面相同。比這更冷清的資金池仍會列出，但沒有這些資料；不足七天的合計只是下限。",
    feeYield: "過去的手續費 ÷ 流動性，年化",
    ranked: "按手續費收益排名",
    unranked: "未排名",
    thin: (floor) => `價值低於 ${floor}：不參與排名。`,
    hook: "這些手續費中可能有一部分歸 hook 而不是流動性提供者，資料中無法區分兩者，所以不計算收益。",
    quiet: "不在這個網路本週最繁忙的資金池之列：沒有每週資料。",
    weekUnread: "這個網路的每週資料現在無法讀取。",
    liquidityUnread: "目前無法估算這個資金池中有多少資金。",
    chainsHeading: "讀取的網路",
    chainRead: (chain, pools) => `${chain}：${pools} 個資金池`,
    chainUnread: (chain) => `${chain}：無法讀取`,
    none: "在讀取的網路上沒有這個交易對的資金池。",
    loading: "正在讀取每個網路…",
  },
};

export const getPairPoolsCopy = (locale: Locale): PairPoolsCopy => COPY[locale];
