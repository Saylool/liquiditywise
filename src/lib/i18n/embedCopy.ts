import type { Locale } from "./locales";

/*
 * The embeddable pool card's own words, and the pool page's offer of it.
 *
 * What the card shares with the pool page — "Suggested price range", "Current
 * price", the range itself, the horizon in days and the width in σ, the hook
 * note, the pool's protocol, fee and network — comes from the dictionary, so
 * the card and the page it links to say those things the same way.
 *
 * What is its own is what a card on somebody else's page has to say for
 * itself: that it is not advice, whose figures these are, that its link leaves
 * the page it sits on, and, when it has no figures, why. The words keep the
 * range to what it is in every language: worked out from how far the price has
 * moved, not a forecast and not a recommendation.
 */

export type EmbedCopy = {
  /** The horizon and the width the range was drawn for, both already written: "30 days, 1σ". */
  readonly drawnFor: (horizon: string, width: string) => string;
  readonly notAdvice: string;
  /** The link back, under the card. */
  readonly analysedBy: string;
  /** Read out after it: the link leaves the page the card sits on. */
  readonly newTab: string;
  /** A pool that was named well and could not be read just now. */
  readonly unreadable: string;
  /** An address that names no pool this site reads. */
  readonly notAPool: string;
  /** For the JSON: what the figures are and are not, with the days the movement was measured over. */
  readonly disclaimer: (days: string) => string;

  /** The pool page's disclosure. */
  readonly summary: string;
  readonly intro: string;
  readonly codeLabel: string;
  readonly data: string;
  /** The frame's title, for a screen reader on the page it is pasted into. */
  readonly frameTitle: (pair: string) => string;
};

const COPY: Record<Locale, EmbedCopy> = {
  en: {
    drawnFor: (horizon, width) => `${horizon}, ${width}`,
    notAdvice: "Not financial advice.",
    analysedBy: "Analysed by LiquidityWise",
    newTab: "opens in a new tab",
    unreadable: "This pool could not be read just now. The card will try again in a few minutes.",
    notAPool: "This card does not name a pool LiquidityWise reads.",
    disclaimer: (days) =>
      `For information only, not financial advice. The range is worked out from how far this pool's price moved over the last ${days} days: it is not a forecast and not a recommendation.`,
    summary: "Embed this pool",
    intro:
      "Show this pool's suggested range on your own site. The card reads the pool live, draws the range for the default horizon and width, says so on the card, and links back here. It carries no script.",
    codeLabel: "Paste this into your page",
    data: "The same figures as JSON, for your own code:",
    frameTitle: (pair) => `${pair} on LiquidityWise`,
  },
  tr: {
    drawnFor: (horizon, width) => `${horizon}, ${width}`,
    notAdvice: "Yatırım tavsiyesi değildir.",
    analysedBy: "LiquidityWise analizi",
    newTab: "yeni sekmede açılır",
    unreadable: "Bu havuz şu an okunamadı. Kart birkaç dakika içinde yeniden deneyecek.",
    notAPool: "Bu kart, LiquidityWise'ın okuduğu bir havuzu belirtmiyor.",
    disclaimer: (days) =>
      `Yalnızca bilgi amaçlıdır, yatırım tavsiyesi değildir. Aralık, bu havuzun fiyatının son ${days} günde ne kadar hareket ettiğinden hesaplanır: bir tahmin değildir, bir öneri de değildir.`,
    summary: "Bu havuzu sitene ekle",
    intro:
      "Bu havuzun önerilen aralığını kendi sitende göster. Kart havuzu canlı okur, aralığı varsayılan süre ve genişlikle çizer, bunu kartın üzerinde söyler ve buraya geri bağlantı verir. İçinde hiçbir betik yoktur.",
    codeLabel: "Bunu sayfana yapıştır",
    data: "Aynı rakamlar, kendi kodun için JSON olarak:",
    frameTitle: (pair) => `LiquidityWise'ta ${pair}`,
  },
  de: {
    drawnFor: (horizon, width) => `${horizon}, ${width}`,
    notAdvice: "Keine Finanzberatung.",
    analysedBy: "Analysiert von LiquidityWise",
    newTab: "öffnet in einem neuen Tab",
    unreadable: "Dieser Pool konnte gerade nicht gelesen werden. Die Karte versucht es in ein paar Minuten erneut.",
    notAPool: "Diese Karte nennt keinen Pool, den LiquidityWise liest.",
    disclaimer: (days) =>
      `Nur zur Information, keine Finanzberatung. Der Bereich wird daraus berechnet, wie weit sich der Preis dieses Pools in den letzten ${days} Tagen bewegt hat: Er ist keine Prognose und keine Empfehlung.`,
    summary: "Diesen Pool einbetten",
    intro:
      "Zeigen Sie den vorgeschlagenen Bereich dieses Pools auf Ihrer eigenen Website. Die Karte liest den Pool live, zeichnet den Bereich für den voreingestellten Horizont und die voreingestellte Breite, sagt das auf der Karte und verlinkt hierher zurück. Sie enthält kein Skript.",
    codeLabel: "Fügen Sie dies in Ihre Seite ein",
    data: "Dieselben Zahlen als JSON, für Ihren eigenen Code:",
    frameTitle: (pair) => `${pair} auf LiquidityWise`,
  },
  es: {
    drawnFor: (horizon, width) => `${horizon}, ${width}`,
    notAdvice: "No es asesoramiento financiero.",
    analysedBy: "Analizado por LiquidityWise",
    newTab: "se abre en una pestaña nueva",
    unreadable: "Este pool no se pudo leer ahora mismo. La tarjeta lo volverá a intentar en unos minutos.",
    notAPool: "Esta tarjeta no nombra ningún pool que LiquidityWise lea.",
    disclaimer: (days) =>
      `Solo a título informativo, no es asesoramiento financiero. El rango se calcula a partir de cuánto se movió el precio de este pool en los últimos ${days} días: no es una previsión ni una recomendación.`,
    summary: "Insertar este pool",
    intro:
      "Muestre el rango sugerido de este pool en su propio sitio. La tarjeta lee el pool en vivo, traza el rango con el horizonte y la anchura predeterminados, lo indica en la tarjeta y enlaza de vuelta aquí. No lleva ningún script.",
    codeLabel: "Pegue esto en su página",
    data: "Las mismas cifras en JSON, para su propio código:",
    frameTitle: (pair) => `${pair} en LiquidityWise`,
  },
  ar: {
    drawnFor: (horizon, width) => `${horizon}، ${width}`,
    notAdvice: "ليست نصيحة مالية.",
    analysedBy: "تحليل LiquidityWise",
    newTab: "يفتح في علامة تبويب جديدة",
    unreadable: "تعذّرت قراءة هذا التجمّع الآن. ستحاول البطاقة مجددًا بعد بضع دقائق.",
    notAPool: "لا تشير هذه البطاقة إلى تجمّع يقرؤه LiquidityWise.",
    disclaimer: (days) =>
      `للاطلاع فقط، وليست نصيحة مالية. يُحسب النطاق من مقدار تحرّك سعر هذا التجمّع خلال آخر ${days} يومًا: ليس تنبؤًا وليس توصية.`,
    summary: "تضمين هذا التجمّع",
    intro:
      "اعرض النطاق المقترح لهذا التجمّع على موقعك. تقرأ البطاقة التجمّع مباشرةً، وترسم النطاق بالأفق والاتساع الافتراضيين، وتذكر ذلك على البطاقة، وتضع رابطًا يعود إلى هنا. لا تحتوي على أي برنامج نصي.",
    codeLabel: "الصق هذا في صفحتك",
    data: "الأرقام نفسها بصيغة JSON، لاستخدامها في شيفرتك:",
    frameTitle: (pair) => `${pair} على LiquidityWise`,
  },
  hi: {
    drawnFor: (horizon, width) => `${horizon}, ${width}`,
    notAdvice: "वित्तीय सलाह नहीं।",
    analysedBy: "LiquidityWise द्वारा विश्लेषित",
    newTab: "नए टैब में खुलता है",
    unreadable: "यह पूल अभी पढ़ा नहीं जा सका। कार्ड कुछ मिनट में फिर कोशिश करेगा।",
    notAPool: "यह कार्ड ऐसे किसी पूल का नाम नहीं लेता जिसे LiquidityWise पढ़ता है।",
    disclaimer: (days) =>
      `केवल जानकारी के लिए, वित्तीय सलाह नहीं। दायरा इस बात से निकाला गया है कि पिछले ${days} दिनों में इस पूल की कीमत कितनी हिली: यह कोई पूर्वानुमान नहीं है और कोई सिफ़ारिश भी नहीं।`,
    summary: "इस पूल को अपनी साइट पर लगाएँ",
    intro:
      "इस पूल का सुझाया गया दायरा अपनी साइट पर दिखाएँ। कार्ड पूल को लाइव पढ़ता है, दायरे को डिफ़ॉल्ट अवधि और चौड़ाई से बनाता है, कार्ड पर यह लिखता है, और यहाँ वापस लिंक देता है। इसमें कोई स्क्रिप्ट नहीं है।",
    codeLabel: "इसे अपने पृष्ठ में चिपकाएँ",
    data: "यही आँकड़े JSON में, आपके अपने कोड के लिए:",
    frameTitle: (pair) => `LiquidityWise पर ${pair}`,
  },
  zh: {
    drawnFor: (horizon, width) => `${horizon}，${width}`,
    notAdvice: "不构成财务建议。",
    analysedBy: "由 LiquidityWise 分析",
    newTab: "在新标签页中打开",
    unreadable: "暂时无法读取这个池子。卡片会在几分钟后重试。",
    notAPool: "这张卡片没有指向 LiquidityWise 读取的池子。",
    disclaimer: (days) =>
      `仅供参考，不构成财务建议。这个区间是根据该池子的价格在过去 ${days} 天里的波动幅度算出的：它不是预测，也不是推荐。`,
    summary: "把这个池子嵌入你的网站",
    intro:
      "在你自己的网站上展示这个池子的建议区间。卡片实时读取池子，按默认的期限和宽度绘制区间，并在卡片上注明，同时链接回这里。卡片里没有任何脚本。",
    codeLabel: "把这段代码粘贴到你的页面里",
    data: "同样的数字也有 JSON 版本，供你自己的代码使用：",
    frameTitle: (pair) => `LiquidityWise 上的 ${pair}`,
  },
  ru: {
    drawnFor: (horizon, width) => `${horizon}, ${width}`,
    notAdvice: "Не финансовый совет.",
    analysedBy: "Анализ LiquidityWise",
    newTab: "открывается в новой вкладке",
    unreadable: "Этот пул сейчас не удалось прочитать. Карточка попробует снова через несколько минут.",
    notAPool: "Эта карточка не указывает на пул, который читает LiquidityWise.",
    disclaimer: (days) =>
      `Только для информации, не финансовый совет. Диапазон рассчитан по тому, насколько цена этого пула двигалась за последние ${days} дн.: это не прогноз и не рекомендация.`,
    summary: "Встроить этот пул",
    intro:
      "Покажите предлагаемый диапазон этого пула на своём сайте. Карточка читает пул в реальном времени, строит диапазон для горизонта и ширины по умолчанию, указывает их на карточке и ссылается сюда. В ней нет никаких скриптов.",
    codeLabel: "Вставьте это на свою страницу",
    data: "Те же цифры в формате JSON, для вашего кода:",
    frameTitle: (pair) => `${pair} на LiquidityWise`,
  },
  pt: {
    drawnFor: (horizon, width) => `${horizon}, ${width}`,
    notAdvice: "Não é recomendação financeira.",
    analysedBy: "Analisado por LiquidityWise",
    newTab: "abre em uma nova aba",
    unreadable: "Não foi possível ler este pool agora. O cartão vai tentar de novo em alguns minutos.",
    notAPool: "Este cartão não indica nenhum pool que o LiquidityWise lê.",
    disclaimer: (days) =>
      `Apenas para informação, não é recomendação financeira. A faixa é calculada a partir de quanto o preço deste pool se moveu nos últimos ${days} dias: não é uma previsão nem uma recomendação de investimento.`,
    summary: "Incorporar este pool",
    intro:
      "Mostre a faixa sugerida deste pool no seu próprio site. O cartão lê o pool ao vivo, desenha a faixa com o horizonte e a largura padrão, diz isso no cartão e leva de volta para cá. Ele não carrega nenhum script.",
    codeLabel: "Cole isto na sua página",
    data: "Os mesmos números em JSON, para o seu próprio código:",
    frameTitle: (pair) => `${pair} no LiquidityWise`,
  },
  "zh-Hant": {
    drawnFor: (horizon, width) => `${horizon}，${width}`,
    notAdvice: "不構成財務建議。",
    analysedBy: "由 LiquidityWise 分析",
    newTab: "在新分頁中開啟",
    unreadable: "暫時無法讀取這個池子。卡片會在幾分鐘後重試。",
    notAPool: "這張卡片沒有指向 LiquidityWise 讀取的池子。",
    disclaimer: (days) =>
      `僅供參考，不構成財務建議。這個區間是根據該池子的價格在過去 ${days} 天裡的波動幅度算出的：它不是預測，也不是推薦。`,
    summary: "把這個池子嵌入你的網站",
    intro:
      "在你自己的網站上展示這個池子的建議區間。卡片即時讀取池子，按預設的時間跨度和寬度繪製區間，並在卡片上註明，同時連結回這裡。卡片裡沒有任何腳本。",
    codeLabel: "把這段程式碼貼到你的頁面裡",
    data: "同樣的數字也有 JSON 版本，供你自己的程式碼使用：",
    frameTitle: (pair) => `LiquidityWise 上的 ${pair}`,
  },
};

export const getEmbedCopy = (locale: Locale): EmbedCopy => COPY[locale];
