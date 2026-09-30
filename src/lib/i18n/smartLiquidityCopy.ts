import type { Locale } from "./locales";

/*
 * The smart-money page's own words.
 *
 * The page makes one claim — these positions earned the most fees for their
 * size — and the words keep it to that. "Smart" is defined where it is used,
 * in every language, and so is everything the figure leaves out: what a
 * position gave up against holding the two tokens, and anything about the
 * future. A list sorted by yield reads as a tip unless it says otherwise.
 */

export type SmartLiquidityCopy = {
  /** Where the page is linked from. */
  readonly link: string;
  readonly title: string;
  readonly titleOn: (chain: string) => string;
  readonly description: string;
  readonly heading: string;
  readonly intro: (chain: string, pools: string) => string;
  /** How "smart" is decided, and what the figure leaves out. */
  readonly method: (minimum: string, days: string, share: string) => string;
  readonly summary: (measured: string, smart: string, from: string, median: string) => string;
  readonly poolsRead: (read: string, asked: string) => string;
  readonly pairsHeading: string;
  readonly positions: (count: string) => string;
  readonly value: string;
  readonly range: string;
  /** One position's own range. */
  readonly ownRange: string;
  /** A typical range, as how far below and above the price its edges sit. */
  readonly rangeValue: (below: string, above: string) => string;
  readonly medianYield: string;
  readonly topHeading: string;
  readonly owner: string;
  readonly earned: (fees: string, days: string) => string;
  readonly yearly: string;
  readonly ownerPositions: string;
  readonly measuredAt: (time: string) => string;
  /** On a chain whose source keeps no positions. */
  /** Under an open position: where the pool's best-earning liquidity sits, beside where this position does. */
  readonly alongside: (smart: string, yours: string, count: string) => string;
  readonly notRead: (chain: string, chains: string) => string;
  /** How the smart liquidity moved over the last days, from the measurements kept. */
  readonly trend: {
    readonly heading: (days: string) => string;
    readonly intro: string;
    readonly notYet: string;
    readonly range: (then: string, now: string) => string;
    readonly rangeNew: (now: string) => string;
    readonly share: (then: string, now: string) => string;
    readonly shareNew: (now: string) => string;
    /** For a screen reader: what the little chart of a range's width shows. */
    readonly widthLabel: (from: string, to: string) => string;
    readonly gaining: string;
    readonly losing: string;
    readonly mover: (pair: string, from: string, to: string) => string;
  };
  /** The holders that keep turning up in the smart fifth. */
  readonly holders: {
    readonly heading: string;
    readonly intro: (of: string) => string;
    readonly notYet: string;
    readonly seen: (appeared: string, of: string) => string;
    readonly wallet: string;
    readonly contract: string;
    readonly contractNote: string;
    readonly now: (positions: string, value: string) => string;
    readonly gone: string;
    /** What is kept about them, and what is not. */
    readonly kept: string;
  };
  readonly unavailable: string;
  readonly empty: string;
  readonly loading: string;
};

const COPY: Record<Locale, SmartLiquidityCopy> = {
  en: {
    link: "Where smart liquidity sits",
    title: "Where the best-earning Uniswap liquidity providers put their money",
    titleOn: (chain) => `Where the best-earning Uniswap v3 liquidity providers on ${chain} put their money`,
    description:
      "The pairs and price ranges of the Uniswap v3 positions that have earned the most fees for their size, measured from the chain. Updated every six hours.",
    heading: "Smart liquidity",
    intro: (chain, pools) =>
      `Which pairs and which ranges the best-earning liquidity on ${chain} sits in right now, among the positions in range in the ${pools} most traded Uniswap v3 pools of the week.`,
    method: (minimum, days, share) =>
      `"Smart" is measured, not assumed: each position's fees since it was last changed, read from the chain, against what it is worth now, per year. Positions under ${minimum}, or changed less than ${days} days ago, are left out as too small or too new to say anything. The ${share} with the highest yield are the smart ones. This is fees only: what a position gave up against simply holding the two tokens is not in it, and none of it says what any position will earn next. Nothing here is a recommendation.`,
    summary: (measured, smart, from, median) =>
      `${measured} positions measured. The smart ones — ${smart} of them — earned at least ${from} a year in fees, against a median of ${median} for all of them.`,
    poolsRead: (read, asked) => `${read} of ${asked} pools could be read this time.`,
    pairsHeading: "Where they are",
    positions: (count) => `Smart positions: ${count}`,
    value: "Worth now",
    range: "Typical range",
    ownRange: "Range",
    rangeValue: (below, above) => `${below} to ${above} around the price`,
    medianYield: "Median fee yield, a year",
    topHeading: "The smart positions",
    owner: "Held by",
    earned: (fees, days) => `${fees} in fees over ${days} days`,
    yearly: "a year",
    ownerPositions: "This address's positions",
    measuredAt: (time) => `Measured ${time}.`,
    alongside: (smart, yours, count) => `Where the best-earning liquidity in this pool sits (median of ${count}): ${smart} · this position: ${yours}`,
    notRead: (chain, chains) =>
      `Positions cannot be listed on ${chain}: its data source keeps none. This page reads ${chains}.`,
    trend: {
      heading: (days) => `How it moved over the last ${days} days`,
      intro:
        "The smart positions' median range and their share of the smart money at the first measurement of the period and at the latest. Ranges are compared as prices, so the price moving alone does not show as a shift.",
      notYet: "Trends appear once a day of measurements has been kept.",
      range: (then, now) => `Range: ${then} → ${now}`,
      rangeNew: (now) => `Range: ${now} · not among the top pairs at the start`,
      share: (then, now) => `Share of the smart money: ${then} → ${now}`,
      shareNew: (now) => `Share of the smart money: ${now}`,
      widthLabel: (from, to) => `Range width, from ${from} to ${to}`,
      gaining: "Gaining smart money",
      losing: "Losing smart money",
      mover: (pair, from, to) => `${pair}: ${from} → ${to}`,
    },
    holders: {
      heading: "Holders that keep showing up",
      intro: (of) => `Addresses in the smart fifth in at least half of the last ${of} measurements. One measurement's fifth is partly luck; being in it again and again is less so.`,
      notYet: "Needs about two days of measurements before it can say who keeps showing up.",
      seen: (n, of) => `In ${n} of ${of} measurements`,
      wallet: "Wallet",
      contract: "Contract",
      contractNote:
        "A contract: a vault, a bot or another program holds these positions, not one person's own wallet. The yield is that program's.",
      now: (positions, value) => `${positions} smart positions now, worth ${value}`,
      gone: "None among the smart positions in the latest measurement",
      kept:
        "These addresses are read from the chain and kept for a week to see which stay on the list. Nothing about who reads this page is kept.",
    },
    unavailable: "The positions could not be measured just now.",
    empty: "No position met the floors this time.",
    loading: "Measuring what each position has earned…",
  },
  tr: {
    link: "Akıllı likidite nerede",
    title: "En çok kazanan Uniswap likidite sağlayıcıları paralarını nereye koyuyor",
    titleOn: (chain) => `${chain} üzerinde en çok kazanan Uniswap v3 likidite sağlayıcıları paralarını nereye koyuyor`,
    description:
      "Büyüklüğüne göre en çok komisyon kazanmış Uniswap v3 pozisyonlarının çiftleri ve fiyat aralıkları, zincirden ölçülerek. Altı saatte bir güncellenir.",
    heading: "Akıllı likidite",
    intro: (chain, pools) =>
      `${chain} üzerinde en çok kazanan likiditenin şu an hangi çiftlerde ve hangi aralıklarda durduğu; haftanın en çok işlem gören ${pools} Uniswap v3 havuzunda aralık içindeki pozisyonlar arasından.`,
    method: (minimum, days, share) =>
      `"Akıllı" varsayılmıyor, ölçülüyor: her pozisyonun son değiştirildiğinden beri kazandığı komisyon zincirden okunuyor ve pozisyonun bugünkü değerine göre yıllığa çevriliyor. ${minimum} altındaki ya da ${days} günden kısa süre önce değiştirilmiş pozisyonlar, bir şey söylemek için fazla küçük ya da fazla yeni oldukları için dışarıda. Verimi en yüksek ${share} akıllı sayılıyor. Bu yalnızca komisyon: pozisyonun iki tokenı elde tutmaya göre kaybettiği bunun içinde değil ve hiçbiri bir pozisyonun bundan sonra ne kazanacağını söylemiyor. Buradaki hiçbir şey bir öneri değil.`,
    summary: (measured, smart, from, median) =>
      `${measured} pozisyon ölçüldü. Akıllı olanlar — ${smart} tanesi — yılda en az ${from} komisyon kazanmış; tümünün medyanı ${median}.`,
    poolsRead: (read, asked) => `Bu sefer ${asked} havuzdan ${read} tanesi okunabildi.`,
    pairsHeading: "Nerede duruyorlar",
    positions: (count) => `${count} akıllı pozisyon`,
    value: "Bugünkü değer",
    range: "Tipik aralık",
    ownRange: "Aralık",
    rangeValue: (below, above) => `fiyatın ${below} ile ${above} çevresi`,
    medianYield: "Medyan komisyon verimi, yıllık",
    topHeading: "Akıllı pozisyonlar",
    owner: "Sahibi",
    earned: (fees, days) => `${days} günde ${fees} komisyon`,
    yearly: "yıllık",
    ownerPositions: "Bu adresin pozisyonları",
    measuredAt: (time) => `Ölçüm: ${time}.`,
    alongside: (smart, yours, count) => `Bu havuzda en çok kazanan likiditenin durduğu yer (${count} pozisyonun medyanı): ${smart} · bu pozisyon: ${yours}`,
    notRead: (chain, chains) =>
      `${chain} üzerinde pozisyonlar listelenemiyor: veri kaynağı hiç pozisyon tutmuyor. Bu sayfa ${chains} ağlarını okuyor.`,
    trend: {
      heading: (days) => `Son ${days} günde nasıl kaydı`,
      intro:
        "Akıllı pozisyonların medyan aralığı ve akıllı paradaki payları: dönemin ilk ölçümünde ve en son ölçümde. Aralıklar fiyat olarak karşılaştırılır; yani yalnızca fiyatın hareket etmesi bir kayma olarak görünmez.",
      notYet: "Bir günlük ölçüm saklanınca eğilimler görünür.",
      range: (then, now) => `Aralık: ${then} → ${now}`,
      rangeNew: (now) => `Aralık: ${now} · başlangıçta en çok para tutan paritelerde yoktu`,
      share: (then, now) => `Akıllı paradaki payı: ${then} → ${now}`,
      shareNew: (now) => `Akıllı paradaki payı: ${now}`,
      widthLabel: (from, to) => `Aralık genişliği, ${from} değerinden ${to} değerine`,
      gaining: "Akıllı para kazananlar",
      losing: "Akıllı para kaybedenler",
      mover: (pair, from, to) => `${pair}: ${from} → ${to}`,
    },
    holders: {
      heading: "Listede sürekli görünen sahipler",
      intro: (of) => `Son ${of} ölçümün en az yarısında akıllı beşte birde olan adresler. Tek bir ölçümün beşte biri kısmen şanstır; tekrar tekrar orada olmak o kadar değil.`,
      notYet: "Kimin sürekli göründüğünü söyleyebilmesi için yaklaşık iki günlük ölçüm gerekir.",
      seen: (n, of) => `${of} ölçümün ${n} tanesinde`,
      wallet: "Cüzdan",
      contract: "Sözleşme",
      contractNote:
        "Bir sözleşme: bu pozisyonları tek bir kişinin kendi cüzdanı değil, bir kasa, bir bot ya da başka bir program tutuyor. Verim o programın verimidir.",
      now: (positions, value) => `Şu an ${positions} akıllı pozisyon, değeri ${value}`,
      gone: "En son ölçümde akıllı pozisyonlar arasında yok",
      kept:
        "Bu adresler zincirden okunur ve hangilerinin listede kaldığını görmek için bir hafta saklanır. Bu sayfayı kimin okuduğuna dair hiçbir şey saklanmaz.",
    },
    unavailable: "Pozisyonlar şu an ölçülemedi.",
    empty: "Bu sefer hiçbir pozisyon eşikleri geçmedi.",
    loading: "Her pozisyonun kazancı ölçülüyor…",
  },
  de: {
    link: "Wo die klügste Liquidität liegt",
    title: "Wo die bestverdienenden Uniswap-Liquiditätsanbieter ihr Geld anlegen",
    titleOn: (chain) => `Wo die bestverdienenden Uniswap-v3-Liquiditätsanbieter auf ${chain} ihr Geld anlegen`,
    description:
      "Die Paare und Preisbereiche der Uniswap-v3-Positionen, die für ihre Größe die meisten Gebühren verdient haben, von der Chain gemessen. Alle sechs Stunden aktualisiert.",
    heading: "Kluge Liquidität",
    intro: (chain, pools) =>
      `In welchen Paaren und Bereichen die bestverdienende Liquidität auf ${chain} gerade liegt, unter den Positionen, deren Bereich den Preis einschließt, in den ${pools} meistgehandelten Uniswap-v3-Pools der Woche.`,
    method: (minimum, days, share) =>
      `„Klug" wird gemessen, nicht angenommen: die Gebühren jeder Position seit ihrer letzten Änderung, von der Chain gelesen, gegen ihren heutigen Wert, aufs Jahr gerechnet. Positionen unter ${minimum} oder vor weniger als ${days} Tagen geändert bleiben außen vor, weil sie zu klein oder zu neu sind, um etwas zu sagen. Die ${share} mit der höchsten Rendite sind die klugen. Es sind nur Gebühren: was eine Position gegenüber dem bloßen Halten der beiden Token aufgegeben hat, steckt nicht darin, und nichts davon sagt, was eine Position künftig verdient. Nichts hier ist eine Empfehlung.`,
    summary: (measured, smart, from, median) =>
      `${measured} Positionen gemessen. Die klugen — ${smart} davon — verdienten mindestens ${from} im Jahr an Gebühren, gegenüber einem Median von ${median} für alle.`,
    poolsRead: (read, asked) => `${read} von ${asked} Pools ließen sich diesmal lesen.`,
    pairsHeading: "Wo sie liegen",
    positions: (count) => `${count} kluge Positionen`,
    value: "Heutiger Wert",
    range: "Typischer Bereich",
    ownRange: "Bereich",
    rangeValue: (below, above) => `${below} bis ${above} um den Preis`,
    medianYield: "Median-Gebührenrendite, pro Jahr",
    topHeading: "Die klugen Positionen",
    owner: "Gehalten von",
    earned: (fees, days) => `${fees} an Gebühren in ${days} Tagen`,
    yearly: "pro Jahr",
    ownerPositions: "Positionen dieser Adresse",
    measuredAt: (time) => `Gemessen ${time}.`,
    alongside: (smart, yours, count) => `Wo die bestverdienende Liquidität in diesem Pool liegt (Median aus ${count}): ${smart} · diese Position: ${yours}`,
    notRead: (chain, chains) =>
      `Auf ${chain} lassen sich keine Positionen auflisten: ihre Datenquelle führt keine. Diese Seite liest ${chains}.`,
    trend: {
      heading: (days) => `Wie sie sich in den letzten ${days} Tagen bewegt hat`,
      intro:
        "Der mediane Bereich der klugen Positionen und ihr Anteil am klugen Geld bei der ersten Messung des Zeitraums und bei der letzten. Bereiche werden als Preise verglichen; eine bloße Preisbewegung erscheint also nicht als Verschiebung.",
      notYet: "Trends erscheinen, sobald ein Tag an Messungen gespeichert ist.",
      range: (then, now) => `Bereich: ${then} → ${now}`,
      rangeNew: (now) => `Bereich: ${now} · anfangs nicht unter den größten Paaren`,
      share: (then, now) => `Anteil am klugen Geld: ${then} → ${now}`,
      shareNew: (now) => `Anteil am klugen Geld: ${now}`,
      widthLabel: (from, to) => `Breite des Bereichs, von ${from} auf ${to}`,
      gaining: "Gewinnt kluges Geld",
      losing: "Verliert kluges Geld",
      mover: (pair, from, to) => `${pair}: ${from} → ${to}`,
    },
    holders: {
      heading: "Halter, die immer wieder auftauchen",
      intro: (of) => `Adressen, die in mindestens der Hälfte der letzten ${of} Messungen im klugen Fünftel waren. Das Fünftel einer Messung ist zum Teil Glück; immer wieder darin zu sein, weniger.`,
      notYet: "Es braucht etwa zwei Tage an Messungen, bevor sich sagen lässt, wer immer wieder auftaucht.",
      seen: (n, of) => `In ${n} von ${of} Messungen`,
      wallet: "Wallet",
      contract: "Vertrag",
      contractNote:
        "Ein Vertrag: Ein Tresor, ein Bot oder ein anderes Programm hält diese Positionen, nicht die eigene Wallet einer Person. Die Rendite ist die dieses Programms.",
      now: (positions, value) => `Jetzt ${positions} kluge Positionen, wert ${value}`,
      gone: "Keine unter den klugen Positionen der letzten Messung",
      kept:
        "Diese Adressen werden von der Chain gelesen und eine Woche lang gespeichert, um zu sehen, welche auf der Liste bleiben. Nichts darüber, wer diese Seite liest, wird gespeichert.",
    },
    unavailable: "Die Positionen ließen sich gerade nicht messen.",
    empty: "Diesmal hat keine Position die Schwellen erreicht.",
    loading: "Was jede Position verdient hat, wird gemessen…",
  },
  es: {
    link: "Dónde está la liquidez inteligente",
    title: "Dónde ponen su dinero los proveedores de liquidez de Uniswap que más ganan",
    titleOn: (chain) => `Dónde ponen su dinero los proveedores de liquidez de Uniswap v3 que más ganan en ${chain}`,
    description:
      "Los pares y rangos de precio de las posiciones de Uniswap v3 que más comisiones han ganado para su tamaño, medidos desde la cadena. Se actualiza cada seis horas.",
    heading: "Liquidez inteligente",
    intro: (chain, pools) =>
      `En qué pares y en qué rangos está ahora la liquidez que más gana en ${chain}, entre las posiciones dentro de rango en los ${pools} pools de Uniswap v3 más negociados de la semana.`,
    method: (minimum, days, share) =>
      `"Inteligente" se mide, no se supone: las comisiones de cada posición desde su último cambio, leídas de la cadena, frente a lo que vale ahora, por año. Las posiciones de menos de ${minimum}, o cambiadas hace menos de ${days} días, quedan fuera por ser demasiado pequeñas o demasiado nuevas para decir algo. El ${share} con mayor rendimiento son las inteligentes. Son solo comisiones: lo que una posición cedió frente a simplemente mantener los dos tokens no está incluido, y nada de esto dice lo que una posición ganará después. Nada aquí es una recomendación.`,
    summary: (measured, smart, from, median) =>
      `${measured} posiciones medidas. Las inteligentes — ${smart} de ellas — ganaron al menos ${from} al año en comisiones, frente a una mediana de ${median} para todas.`,
    poolsRead: (read, asked) => `Esta vez se pudieron leer ${read} de ${asked} pools.`,
    pairsHeading: "Dónde están",
    positions: (count) => `${count} posiciones inteligentes`,
    value: "Valor actual",
    range: "Rango típico",
    ownRange: "Rango",
    rangeValue: (below, above) => `de ${below} a ${above} en torno al precio`,
    medianYield: "Rendimiento mediano en comisiones, al año",
    topHeading: "Las posiciones inteligentes",
    owner: "En manos de",
    earned: (fees, days) => `${fees} en comisiones en ${days} días`,
    yearly: "al año",
    ownerPositions: "Posiciones de esta dirección",
    measuredAt: (time) => `Medido ${time}.`,
    alongside: (smart, yours, count) => `Dónde está la liquidez que más gana en este pool (mediana de ${count}): ${smart} · esta posición: ${yours}`,
    notRead: (chain, chains) =>
      `No se pueden listar posiciones en ${chain}: su fuente de datos no guarda ninguna. Esta página lee ${chains}.`,
    trend: {
      heading: (days) => `Cómo se movió en los últimos ${days} días`,
      intro:
        "El rango mediano de las posiciones inteligentes y su parte del dinero inteligente en la primera medición del periodo y en la última. Los rangos se comparan como precios, así que el mero movimiento del precio no aparece como un desplazamiento.",
      notYet: "Las tendencias aparecen cuando se ha guardado un día de mediciones.",
      range: (then, now) => `Rango: ${then} → ${now}`,
      rangeNew: (now) => `Rango: ${now} · no estaba entre los pares principales al principio`,
      share: (then, now) => `Parte del dinero inteligente: ${then} → ${now}`,
      shareNew: (now) => `Parte del dinero inteligente: ${now}`,
      widthLabel: (from, to) => `Ancho del rango, de ${from} a ${to}`,
      gaining: "Gana dinero inteligente",
      losing: "Pierde dinero inteligente",
      mover: (pair, from, to) => `${pair}: ${from} → ${to}`,
    },
    holders: {
      heading: "Titulares que siguen apareciendo",
      intro: (of) => `Direcciones que estuvieron en el quinto inteligente en al menos la mitad de las últimas ${of} mediciones. El quinto de una medición es en parte suerte; estar en él una y otra vez lo es menos.`,
      notYet: "Hacen falta unos dos días de mediciones para poder decir quién sigue apareciendo.",
      seen: (n, of) => `En ${n} de ${of} mediciones`,
      wallet: "Billetera",
      contract: "Contrato",
      contractNote:
        "Un contrato: una bóveda, un bot u otro programa tiene estas posiciones, no la billetera propia de una persona. El rendimiento es el de ese programa.",
      now: (positions, value) => `Ahora ${positions} posiciones inteligentes, valen ${value}`,
      gone: "Ninguna entre las posiciones inteligentes de la última medición",
      kept:
        "Estas direcciones se leen de la cadena y se guardan una semana para ver cuáles siguen en la lista. No se guarda nada sobre quién lee esta página.",
    },
    unavailable: "No se pudieron medir las posiciones en este momento.",
    empty: "Esta vez ninguna posición superó los umbrales.",
    loading: "Midiendo lo que ha ganado cada posición…",
  },
  ar: {
    link: "أين تقع السيولة الذكية",
    title: "أين يضع مزوّدو السيولة الأعلى ربحًا في Uniswap أموالهم",
    titleOn: (chain) => `أين يضع مزوّدو السيولة الأعلى ربحًا في Uniswap v3 على ${chain} أموالهم`,
    description:
      "أزواج ونطاقات أسعار مراكز Uniswap v3 التي حقّقت أكبر رسوم نسبةً إلى حجمها، مقيسةً من السلسلة. تُحدَّث كل ست ساعات.",
    heading: "السيولة الذكية",
    intro: (chain, pools) =>
      `في أي الأزواج وأي النطاقات تقع السيولة الأعلى ربحًا على ${chain} الآن، من بين المراكز الواقعة داخل النطاق في أكثر ${pools} تجمّعًا تداولًا في Uniswap v3 هذا الأسبوع.`,
    method: (minimum, days, share) =>
      `"الذكاء" هنا يُقاس ولا يُفترض: رسوم كل مركز منذ آخر تغيير له، مقروءة من السلسلة، مقابل قيمته الآن، على أساس سنوي. تُستبعد المراكز التي تقل عن ${minimum} أو التي تغيّرت قبل أقل من ${days} أيام لأنها أصغر أو أحدث من أن تدل على شيء. و${share} الأعلى عائدًا هي المراكز الذكية. هذه رسوم فقط: ما تخلّى عنه المركز مقارنةً بمجرد الاحتفاظ بالرمزين ليس فيها، ولا شيء منها يقول ما سيربحه أي مركز لاحقًا. لا شيء هنا توصية.`,
    summary: (measured, smart, from, median) =>
      `قيس ${measured} مركزًا. المراكز الذكية — ${smart} منها — ربحت ${from} على الأقل سنويًا من الرسوم، مقابل وسيط قدره ${median} لجميعها.`,
    poolsRead: (read, asked) => `أمكن قراءة ${read} من أصل ${asked} تجمّعًا هذه المرة.`,
    pairsHeading: "أين هي",
    positions: (count) => `${count} مراكز ذكية`,
    value: "القيمة الآن",
    range: "النطاق المعتاد",
    ownRange: "النطاق",
    rangeValue: (below, above) => `من ${below} إلى ${above} حول السعر`,
    medianYield: "العائد الوسيط من الرسوم، سنويًا",
    topHeading: "المراكز الذكية",
    owner: "يملكه",
    earned: (fees, days) => `${fees} رسومًا خلال ${days} أيام`,
    yearly: "سنويًا",
    ownerPositions: "مراكز هذا العنوان",
    measuredAt: (time) => `قيس في ${time}.`,
    alongside: (smart, yours, count) => `أين تقع السيولة الأعلى ربحًا في هذا التجمّع (وسيط ${count}): ${smart} · هذا المركز: ${yours}`,
    notRead: (chain, chains) =>
      `لا يمكن سرد المراكز على ${chain}: مصدر بياناتها لا يحتفظ بأي منها. تقرأ هذه الصفحة ${chains}.`,
    trend: {
      heading: (days) => `كيف تحرّكت خلال آخر ${days} أيام`,
      intro:
        "النطاق الوسيط للمراكز الذكية وحصتها من المال الذكي عند أول قياس في الفترة وعند آخر قياس. تُقارَن النطاقات أسعارًا، فلا يظهر تحرّك السعر وحده على أنه انزياح.",
      notYet: "تظهر الاتجاهات متى حُفظ يوم من القياسات.",
      range: (then, now) => `النطاق: ${then} ← ${now}`,
      rangeNew: (now) => `النطاق: ${now} · لم يكن بين أبرز الأزواج في البداية`,
      share: (then, now) => `حصته من المال الذكي: ${then} ← ${now}`,
      shareNew: (now) => `حصته من المال الذكي: ${now}`,
      widthLabel: (from, to) => `اتساع النطاق، من ${from} إلى ${to}`,
      gaining: "يكسب مالًا ذكيًا",
      losing: "يفقد مالًا ذكيًا",
      mover: (pair, from, to) => `${pair}: ${from} ← ${to}`,
    },
    holders: {
      heading: "حائزون يظهرون باستمرار",
      intro: (of) => `عناوين كانت في الخمس الذكي في نصف آخر ${of} قياسات على الأقل. الخمس في قياس واحد فيه شيء من الحظ؛ أما البقاء فيه مرة بعد مرة فأقل.`,
      notYet: "يلزم نحو يومين من القياسات قبل أن يمكن القول من الذي يظهر باستمرار.",
      seen: (n, of) => `في ${n} من ${of} قياسات`,
      wallet: "محفظة",
      contract: "عقد",
      contractNote:
        "عقد: خزنة أو بوت أو برنامج آخر يحمل هذه المراكز، لا محفظة شخص بعينه. والعائد عائد ذلك البرنامج.",
      now: (positions, value) => `${positions} مراكز ذكية الآن، قيمتها ${value}`,
      gone: "لا شيء بين المراكز الذكية في آخر قياس",
      kept:
        "تُقرأ هذه العناوين من السلسلة وتُحفظ أسبوعًا لمعرفة أيها يبقى في القائمة. ولا يُحفظ شيء عمّن يقرأ هذه الصفحة.",
    },
    unavailable: "تعذّر قياس المراكز الآن.",
    empty: "لم يتجاوز أي مركز الحدود هذه المرة.",
    loading: "جارٍ قياس ما ربحه كل مركز…",
  },
  hi: {
    link: "स्मार्ट लिक्विडिटी कहाँ है",
    title: "सबसे ज़्यादा कमाने वाले Uniswap लिक्विडिटी प्रदाता अपना पैसा कहाँ लगाते हैं",
    titleOn: (chain) => `${chain} पर सबसे ज़्यादा कमाने वाले Uniswap v3 लिक्विडिटी प्रदाता अपना पैसा कहाँ लगाते हैं`,
    description:
      "उन Uniswap v3 पोज़िशनों की जोड़ियाँ और मूल्य-सीमाएँ जिन्होंने अपने आकार के हिसाब से सबसे ज़्यादा शुल्क कमाया, चेन से मापी गईं। हर छह घंटे में अपडेट।",
    heading: "स्मार्ट लिक्विडिटी",
    intro: (chain, pools) =>
      `${chain} पर सबसे ज़्यादा कमाने वाली लिक्विडिटी इस समय किन जोड़ियों और किन सीमाओं में है — इस सप्ताह के ${pools} सबसे अधिक कारोबार वाले Uniswap v3 पूलों में सीमा के भीतर की पोज़िशनों में से।`,
    method: (minimum, days, share) =>
      `"स्मार्ट" माना नहीं जाता, मापा जाता है: हर पोज़िशन का पिछले बदलाव के बाद से कमाया शुल्क, चेन से पढ़ा गया, उसके अभी के मूल्य के मुक़ाबले, सालाना। ${minimum} से छोटी या ${days} दिन से कम पहले बदली गई पोज़िशनें कुछ कहने के लिए बहुत छोटी या बहुत नई होने के कारण बाहर हैं। सबसे ऊँची आय वाली ${share} स्मार्ट मानी जाती हैं। यह केवल शुल्क है: दोनों टोकन यूँ ही रखने की तुलना में पोज़िशन ने जो गँवाया वह इसमें नहीं है, और इसमें से कुछ भी नहीं बताता कि कोई पोज़िशन आगे क्या कमाएगी। यहाँ कुछ भी सिफ़ारिश नहीं है।`,
    summary: (measured, smart, from, median) =>
      `${measured} पोज़िशनें मापी गईं। स्मार्ट पोज़िशनों — ${smart} — ने सालाना कम से कम ${from} शुल्क कमाया, जबकि सबकी माध्यिका ${median} है।`,
    poolsRead: (read, asked) => `इस बार ${asked} में से ${read} पूल पढ़े जा सके।`,
    pairsHeading: "वे कहाँ हैं",
    positions: (count) => `${count} स्मार्ट पोज़िशनें`,
    value: "अभी का मूल्य",
    range: "आम सीमा",
    ownRange: "सीमा",
    rangeValue: (below, above) => `मूल्य के आसपास ${below} से ${above}`,
    medianYield: "माध्यिका शुल्क आय, सालाना",
    topHeading: "स्मार्ट पोज़िशनें",
    owner: "धारक",
    earned: (fees, days) => `${days} दिनों में ${fees} शुल्क`,
    yearly: "सालाना",
    ownerPositions: "इस पते की पोज़िशनें",
    measuredAt: (time) => `मापा गया ${time}.`,
    alongside: (smart, yours, count) => `इस पूल में सबसे ज़्यादा कमाने वाली लिक्विडिटी कहाँ है (${count} की माध्यिका): ${smart} · यह पोज़िशन: ${yours}`,
    notRead: (chain, chains) =>
      `${chain} पर पोज़िशनें सूचीबद्ध नहीं की जा सकतीं: उसका डेटा स्रोत कोई पोज़िशन नहीं रखता। यह पृष्ठ ${chains} पढ़ता है।`,
    trend: {
      heading: (days) => `पिछले ${days} दिनों में यह कैसे खिसकी`,
      intro:
        "स्मार्ट पोज़िशनों की माध्यिका सीमा और स्मार्ट पैसे में उनका हिस्सा: अवधि के पहले माप पर और सबसे ताज़ा पर। सीमाओं की तुलना कीमतों के रूप में होती है, इसलिए केवल कीमत के हिलने से कोई खिसकाव नहीं दिखता।",
      notYet: "एक दिन के माप जमा होने पर रुझान दिखने लगते हैं।",
      range: (then, now) => `दायरा: ${then} → ${now}`,
      rangeNew: (now) => `दायरा: ${now} · शुरुआत में शीर्ष जोड़ियों में नहीं थी`,
      share: (then, now) => `स्मार्ट पैसे में हिस्सा: ${then} → ${now}`,
      shareNew: (now) => `स्मार्ट पैसे में हिस्सा: ${now}`,
      widthLabel: (from, to) => `दायरे की चौड़ाई, ${from} से ${to}`,
      gaining: "स्मार्ट पैसा पा रही हैं",
      losing: "स्मार्ट पैसा खो रही हैं",
      mover: (pair, from, to) => `${pair}: ${from} → ${to}`,
    },
    holders: {
      heading: "जो धारक बार-बार दिखते हैं",
      intro: (of) => `वे पते जो पिछले ${of} मापों में से कम से कम आधे में स्मार्ट पाँचवें हिस्से में रहे। एक माप का पाँचवाँ हिस्सा कुछ हद तक क़िस्मत है; बार-बार उसमें होना उतना नहीं।`,
      notYet: "कौन बार-बार दिख रहा है यह कहने के लिए लगभग दो दिन के माप चाहिए।",
      seen: (n, of) => `${of} में से ${n} मापों में`,
      wallet: "वॉलेट",
      contract: "कॉन्ट्रैक्ट",
      contractNote:
        "एक कॉन्ट्रैक्ट: ये पोज़िशनें किसी एक व्यक्ति के अपने वॉलेट की नहीं, बल्कि किसी वॉल्ट, बॉट या अन्य प्रोग्राम की हैं। आय उसी प्रोग्राम की है।",
      now: (positions, value) => `अभी ${positions} स्मार्ट पोज़िशनें, मूल्य ${value}`,
      gone: "ताज़ा माप की स्मार्ट पोज़िशनों में कोई नहीं",
      kept:
        "ये पते चेन से पढ़े जाते हैं और यह देखने के लिए एक हफ़्ते रखे जाते हैं कि कौन-से सूची में बने रहते हैं। इस पृष्ठ को कौन पढ़ता है, इसकी कोई बात नहीं रखी जाती।",
    },
    unavailable: "इस समय पोज़िशनें मापी नहीं जा सकीं।",
    empty: "इस बार कोई पोज़िशन सीमाएँ पार नहीं कर सकी।",
    loading: "हर पोज़िशन की कमाई मापी जा रही है…",
  },
  zh: {
    link: "聪明的流动性在哪里",
    title: "收益最高的 Uniswap 流动性提供者把钱放在哪里",
    titleOn: (chain) => `${chain} 上收益最高的 Uniswap v3 流动性提供者把钱放在哪里`,
    description: "按规模计赚取手续费最多的 Uniswap v3 仓位所在的交易对和价格区间，直接从链上测量。每六小时更新一次。",
    heading: "聪明的流动性",
    intro: (chain, pools) =>
      `${chain} 上收益最高的流动性此刻位于哪些交易对、哪些区间——范围是本周成交最活跃的 ${pools} 个 Uniswap v3 资金池中处于区间内的仓位。`,
    method: (minimum, days, share) =>
      `“聪明”是测出来的，不是假定的：每个仓位自上次变动以来赚取的手续费，从链上读取，除以它现在的价值，再折算成年化。低于 ${minimum} 或不到 ${days} 天前变动过的仓位被排除在外，因为它们太小或太新，说明不了什么。收益最高的 ${share} 被视为聪明的仓位。这里只有手续费：仓位相对于单纯持有两种代币所放弃的部分不在其中，也没有任何一项说明某个仓位今后会赚多少。这里的一切都不是推荐。`,
    summary: (measured, smart, from, median) =>
      `共测量了 ${measured} 个仓位。聪明的仓位——共 ${smart} 个——每年至少赚取 ${from} 的手续费，而全部仓位的中位数是 ${median}。`,
    poolsRead: (read, asked) => `这次 ${asked} 个资金池中有 ${read} 个可以读取。`,
    pairsHeading: "它们在哪里",
    positions: (count) => `${count} 个聪明仓位`,
    value: "当前价值",
    range: "典型区间",
    ownRange: "区间",
    rangeValue: (below, above) => `价格附近 ${below} 至 ${above}`,
    medianYield: "手续费收益中位数，年化",
    topHeading: "聪明的仓位",
    owner: "持有者",
    earned: (fees, days) => `${days} 天内赚取 ${fees} 手续费`,
    yearly: "年化",
    ownerPositions: "该地址的仓位",
    measuredAt: (time) => `测量时间 ${time}。`,
    alongside: (smart, yours, count) => `这个资金池中收益最高的流动性所在的区间（${count} 个仓位的中位数）：${smart} · 这个仓位：${yours}`,
    notRead: (chain, chains) => `${chain} 上无法列出仓位：它的数据源不保存任何仓位。本页读取 ${chains}。`,
    trend: {
      heading: (days) => `过去 ${days} 天里它是怎么移动的`,
      intro:
        "聪明仓位的中位区间及其在聪明资金中的占比：本期第一次测量时和最近一次。区间按价格来比较，所以仅仅价格在变，不会显示成区间移动。",
      notYet: "保存满一天的测量后，趋势才会出现。",
      range: (then, now) => `区间：${then} → ${now}`,
      rangeNew: (now) => `区间：${now} · 一开始不在最大的交易对之列`,
      share: (then, now) => `占聪明资金的比例：${then} → ${now}`,
      shareNew: (now) => `占聪明资金的比例：${now}`,
      widthLabel: (from, to) => `区间宽度，从 ${from} 到 ${to}`,
      gaining: "聪明资金在流入",
      losing: "聪明资金在流出",
      mover: (pair, from, to) => `${pair}：${from} → ${to}`,
    },
    holders: {
      heading: "一再出现的持有者",
      intro: (of) => `在最近 ${of} 次测量中至少一半的次数里都处于聪明的前五分之一的地址。一次测量的前五分之一多少有运气成分；一再出现在其中，运气的成分就小得多。`,
      notYet: "要有大约两天的测量，才能说出谁一再出现。",
      seen: (n, of) => `${of} 次测量中出现 ${n} 次`,
      wallet: "钱包",
      contract: "合约",
      contractNote:
        "合约：持有这些仓位的是金库、机器人或别的程序，而不是某个人自己的钱包。收益是那个程序的收益。",
      now: (positions, value) => `现有 ${positions} 个聪明仓位，价值 ${value}`,
      gone: "最近一次测量的聪明仓位中没有它",
      kept:
        "这些地址是从链上读取的，保存一周，用来看哪些会一直留在名单上。没有保存任何关于谁在阅读本页的信息。",
    },
    unavailable: "现在无法测量这些仓位。",
    empty: "这次没有仓位达到门槛。",
    loading: "正在测量每个仓位赚了多少…",
  },
  ru: {
    link: "Где стоит умная ликвидность",
    title: "Куда вкладывают деньги самые доходные поставщики ликвидности Uniswap",
    titleOn: (chain) => `Куда вкладывают деньги самые доходные поставщики ликвидности Uniswap v3 в ${chain}`,
    description:
      "Пары и ценовые диапазоны позиций Uniswap v3, заработавших больше всего комиссий для своего размера, измеренные по данным сети. Обновляется каждые шесть часов.",
    heading: "Умная ликвидность",
    intro: (chain, pools) =>
      `В каких парах и в каких диапазонах сейчас стоит самая доходная ликвидность в ${chain} — среди позиций в диапазоне в ${pools} самых торгуемых пулах Uniswap v3 за неделю.`,
    method: (minimum, days, share) =>
      `«Умность» измеряется, а не предполагается: комиссии каждой позиции с её последнего изменения, прочитанные из сети, против её нынешней стоимости, в пересчёте на год. Позиции меньше ${minimum} или изменённые менее ${days} дней назад не учитываются: они слишком малы или слишком новы, чтобы что-то говорить. ${share} с наибольшей доходностью считаются умными. Это только комиссии: то, что позиция потеряла по сравнению с простым хранением двух токенов, сюда не входит, и ничто здесь не говорит, сколько позиция заработает дальше. Ничто здесь не является рекомендацией.`,
    summary: (measured, smart, from, median) =>
      `Измерено позиций: ${measured}. Умные — ${smart} из них — заработали не менее ${from} в год комиссиями, при медиане ${median} по всем.`,
    poolsRead: (read, asked) => `На этот раз удалось прочитать ${read} из ${asked} пулов.`,
    pairsHeading: "Где они стоят",
    positions: (count) => `Умных позиций: ${count}`,
    value: "Стоимость сейчас",
    range: "Типичный диапазон",
    ownRange: "Диапазон",
    rangeValue: (below, above) => `от ${below} до ${above} вокруг цены`,
    medianYield: "Медианная доходность от комиссий, в год",
    topHeading: "Умные позиции",
    owner: "Владелец",
    earned: (fees, days) => `${fees} комиссий за ${days} дн.`,
    yearly: "в год",
    ownerPositions: "Позиции этого адреса",
    measuredAt: (time) => `Измерено ${time}.`,
    alongside: (smart, yours, count) => `Где стоит самая доходная ликвидность этого пула (медиана по ${count}): ${smart} · эта позиция: ${yours}`,
    notRead: (chain, chains) =>
      `В ${chain} позиции нельзя перечислить: её источник данных их не хранит. Эта страница читает ${chains}.`,
    trend: {
      heading: (days) => `Как она двигалась за последние ${days} дн.`,
      intro:
        "Медианный диапазон умных позиций и их доля в умных деньгах при первом измерении периода и при последнем. Диапазоны сравниваются как цены, так что одно лишь движение цены не выглядит сдвигом.",
      notYet: "Тенденции появятся, когда накопится день измерений.",
      range: (then, now) => `Диапазон: ${then} → ${now}`,
      rangeNew: (now) => `Диапазон: ${now} · вначале не входила в число главных пар`,
      share: (then, now) => `Доля умных денег: ${then} → ${now}`,
      shareNew: (now) => `Доля умных денег: ${now}`,
      widthLabel: (from, to) => `Ширина диапазона, от ${from} до ${to}`,
      gaining: "Умных денег прибывает",
      losing: "Умных денег убывает",
      mover: (pair, from, to) => `${pair}: ${from} → ${to}`,
    },
    holders: {
      heading: "Держатели, которые появляются снова и снова",
      intro: (of) => `Адреса, которые были в умной пятой части не менее чем в половине последних ${of} измерений. Пятая часть одного измерения — отчасти удача; попадать в неё снова и снова — уже меньше.`,
      notYet: "Нужно около двух дней измерений, чтобы можно было сказать, кто появляется снова и снова.",
      seen: (n, of) => `В ${n} из ${of} измерений`,
      wallet: "Кошелёк",
      contract: "Контракт",
      contractNote:
        "Контракт: этими позициями владеет хранилище, бот или другая программа, а не собственный кошелёк одного человека. Доходность — этой программы.",
      now: (positions, value) => `Сейчас умных позиций: ${positions}, стоимость ${value}`,
      gone: "Среди умных позиций последнего измерения нет",
      kept:
        "Эти адреса читаются из сети и хранятся неделю, чтобы видеть, какие остаются в списке. Ничего о том, кто читает эту страницу, не хранится.",
    },
    unavailable: "Сейчас позиции измерить не удалось.",
    empty: "На этот раз ни одна позиция не прошла пороги.",
    loading: "Измеряем, сколько заработала каждая позиция…",
  },
  pt: {
    link: "Onde está a liquidez inteligente",
    title: "Onde os provedores de liquidez da Uniswap que mais ganham colocam seu dinheiro",
    titleOn: (chain) => `Onde os provedores de liquidez da Uniswap v3 que mais ganham na ${chain} colocam seu dinheiro`,
    description:
      "Os pares e faixas de preço das posições da Uniswap v3 que mais ganharam taxas para o seu tamanho, medidos a partir da rede. Atualizado a cada seis horas.",
    heading: "Liquidez inteligente",
    intro: (chain, pools) =>
      `Em quais pares e em quais faixas a liquidez que mais ganha na ${chain} está agora, entre as posições dentro da faixa nos ${pools} pools da Uniswap v3 mais negociados da semana.`,
    method: (minimum, days, share) =>
      `"Inteligente" é medido, não suposto: as taxas de cada posição desde a última alteração, lidas da rede, contra o que ela vale agora, por ano. Posições abaixo de ${minimum}, ou alteradas há menos de ${days} dias, ficam de fora por serem pequenas ou novas demais para dizer algo. Os ${share} com maior rendimento são as inteligentes. São só taxas: o que uma posição abriu mão em relação a simplesmente manter os dois tokens não está incluído, e nada disso diz o que uma posição vai ganhar daqui em diante. Nada aqui é uma recomendação.`,
    summary: (measured, smart, from, median) =>
      `${measured} posições medidas. As inteligentes — ${smart} delas — ganharam pelo menos ${from} por ano em taxas, contra uma mediana de ${median} para todas.`,
    poolsRead: (read, asked) => `Desta vez foi possível ler ${read} de ${asked} pools.`,
    pairsHeading: "Onde elas estão",
    positions: (count) => `${count} posições inteligentes`,
    value: "Valor agora",
    range: "Faixa típica",
    ownRange: "Faixa",
    rangeValue: (below, above) => `de ${below} a ${above} em torno do preço`,
    medianYield: "Rendimento mediano em taxas, por ano",
    topHeading: "As posições inteligentes",
    owner: "Em posse de",
    earned: (fees, days) => `${fees} em taxas em ${days} dias`,
    yearly: "por ano",
    ownerPositions: "Posições deste endereço",
    measuredAt: (time) => `Medido ${time}.`,
    alongside: (smart, yours, count) => `Onde está a liquidez que mais ganha neste pool (mediana de ${count}): ${smart} · esta posição: ${yours}`,
    notRead: (chain, chains) =>
      `Não é possível listar posições na ${chain}: a fonte de dados dela não guarda nenhuma. Esta página lê ${chains}.`,
    trend: {
      heading: (days) => `Como ela se moveu nos últimos ${days} dias`,
      intro:
        "A faixa mediana das posições inteligentes e a parte delas no dinheiro inteligente na primeira medição do período e na última. As faixas são comparadas como preços, então só o preço se mover não aparece como um deslocamento.",
      notYet: "As tendências aparecem quando um dia de medições foi guardado.",
      range: (then, now) => `Faixa: ${then} → ${now}`,
      rangeNew: (now) => `Faixa: ${now} · não estava entre os pares principais no começo`,
      share: (then, now) => `Parte do dinheiro inteligente: ${then} → ${now}`,
      shareNew: (now) => `Parte do dinheiro inteligente: ${now}`,
      widthLabel: (from, to) => `Largura da faixa, de ${from} a ${to}`,
      gaining: "Ganhando dinheiro inteligente",
      losing: "Perdendo dinheiro inteligente",
      mover: (pair, from, to) => `${pair}: ${from} → ${to}`,
    },
    holders: {
      heading: "Titulares que continuam aparecendo",
      intro: (of) => `Endereços que estiveram no quinto inteligente em pelo menos metade das últimas ${of} medições. O quinto de uma medição é em parte sorte; estar nele várias vezes é menos.`,
      notYet: "São necessários uns dois dias de medições para dizer quem continua aparecendo.",
      seen: (n, of) => `Em ${n} de ${of} medições`,
      wallet: "Carteira",
      contract: "Contrato",
      contractNote:
        "Um contrato: um cofre, um bot ou outro programa detém essas posições, não a carteira própria de uma pessoa. O rendimento é o desse programa.",
      now: (positions, value) => `Agora ${positions} posições inteligentes, valendo ${value}`,
      gone: "Nenhuma entre as posições inteligentes da última medição",
      kept:
        "Esses endereços são lidos da rede e guardados por uma semana para ver quais continuam na lista. Nada sobre quem lê esta página é guardado.",
    },
    unavailable: "Não foi possível medir as posições agora.",
    empty: "Desta vez nenhuma posição passou dos limites.",
    loading: "Medindo o que cada posição ganhou…",
  },
  "zh-Hant": {
    link: "聰明的流動性在哪裡",
    title: "收益最高的 Uniswap 流動性提供者把錢放在哪裡",
    titleOn: (chain) => `${chain} 上收益最高的 Uniswap v3 流動性提供者把錢放在哪裡`,
    description: "按規模計賺取手續費最多的 Uniswap v3 倉位所在的交易對和價格區間，直接從鏈上測量。每六小時更新一次。",
    heading: "聰明的流動性",
    intro: (chain, pools) =>
      `${chain} 上收益最高的流動性此刻位於哪些交易對、哪些區間——範圍是本週成交最活躍的 ${pools} 個 Uniswap v3 資金池中處於區間內的倉位。`,
    method: (minimum, days, share) =>
      `「聰明」是測出來的，不是假定的：每個倉位自上次變動以來賺取的手續費，從鏈上讀取，除以它現在的價值，再折算成年化。低於 ${minimum} 或不到 ${days} 天前變動過的倉位被排除在外，因為它們太小或太新，說明不了什麼。收益最高的 ${share} 被視為聰明的倉位。這裡只有手續費：倉位相對於單純持有兩種代幣所放棄的部分不在其中，也沒有任何一項說明某個倉位今後會賺多少。這裡的一切都不是推薦。`,
    summary: (measured, smart, from, median) =>
      `共測量了 ${measured} 個倉位。聰明的倉位——共 ${smart} 個——每年至少賺取 ${from} 的手續費，而全部倉位的中位數是 ${median}。`,
    poolsRead: (read, asked) => `這次 ${asked} 個資金池中有 ${read} 個可以讀取。`,
    pairsHeading: "它們在哪裡",
    positions: (count) => `${count} 個聰明倉位`,
    value: "目前價值",
    range: "典型區間",
    ownRange: "區間",
    rangeValue: (below, above) => `價格附近 ${below} 至 ${above}`,
    medianYield: "手續費收益中位數，年化",
    topHeading: "聰明的倉位",
    owner: "持有者",
    earned: (fees, days) => `${days} 天內賺取 ${fees} 手續費`,
    yearly: "年化",
    ownerPositions: "該地址的倉位",
    measuredAt: (time) => `測量時間 ${time}。`,
    alongside: (smart, yours, count) => `這個資金池中收益最高的流動性所在的區間（${count} 個倉位的中位數）：${smart} · 這個倉位：${yours}`,
    notRead: (chain, chains) => `${chain} 上無法列出倉位：它的資料來源不保存任何倉位。本頁讀取 ${chains}。`,
    trend: {
      heading: (days) => `過去 ${days} 天裡它是怎麼移動的`,
      intro:
        "聰明倉位的中位區間及其在聰明資金中的占比：本期第一次測量時和最近一次。區間按價格來比較，所以僅僅價格在變，不會顯示成區間移動。",
      notYet: "儲存滿一天的測量後，趨勢才會出現。",
      range: (then, now) => `區間：${then} → ${now}`,
      rangeNew: (now) => `區間：${now} · 一開始不在最大的交易對之列`,
      share: (then, now) => `占聰明資金的比例：${then} → ${now}`,
      shareNew: (now) => `占聰明資金的比例：${now}`,
      widthLabel: (from, to) => `區間寬度，從 ${from} 到 ${to}`,
      gaining: "聰明資金在流入",
      losing: "聰明資金在流出",
      mover: (pair, from, to) => `${pair}：${from} → ${to}`,
    },
    holders: {
      heading: "一再出現的持有者",
      intro: (of) => `在最近 ${of} 次測量中至少一半的次數裡都處於聰明的前五分之一的地址。一次測量的前五分之一多少有運氣成分；一再出現在其中，運氣的成分就小得多。`,
      notYet: "要有大約兩天的測量，才能說出誰一再出現。",
      seen: (n, of) => `${of} 次測量中出現 ${n} 次`,
      wallet: "錢包",
      contract: "合約",
      contractNote:
        "合約：持有這些倉位的是金庫、機器人或別的程式，而不是某個人自己的錢包。收益是那個程式的收益。",
      now: (positions, value) => `現有 ${positions} 個聰明倉位，價值 ${value}`,
      gone: "最近一次測量的聰明倉位中沒有它",
      kept:
        "這些地址是從鏈上讀取的，儲存一週，用來看哪些會一直留在名單上。沒有儲存任何關於誰在閱讀本頁的資訊。",
    },
    unavailable: "現在無法測量這些倉位。",
    empty: "這次沒有倉位達到門檻。",
    loading: "正在測量每個倉位賺了多少…",
  },
};

export const getSmartLiquidityCopy = (locale: Locale): SmartLiquidityCopy => COPY[locale];
