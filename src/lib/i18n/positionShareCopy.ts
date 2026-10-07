import type { Locale } from "./locales";

/*
 * The words of sharing a position's record: the row of links under a verified
 * record on the holdings page, the prewritten post those links offer, and the
 * card drawn at /api/share/position in the reader's language.
 *
 * What the card shares with the record it is drawn from — the labels for the
 * fees and the result, the two parts of the result — comes from the record's
 * own copy (positionRecordCopy.ts), so the card and the page say those things
 * the same way. What is here is what sharing adds: the links themselves, the
 * post, the card's title and its range label, and the one line every card
 * carries, that it is a measurement made here and not advice. Every term is
 * the one the rest of the site uses in that language — the position, its
 * range, the fees — and the figures arrive written, each with its token.
 *
 * The post is short on purpose: a post has room for little, and the figures
 * carry their symbols. It is written in the third person — the pair, the date,
 * the result — so the reader can post it as it stands or in their own voice.
 */

export type PositionShareCopy = {
  /** Over the row of links under a verified record. */
  readonly heading: string;
  /** The card as an image, which opens in a new tab. */
  readonly image: string;
  /** The post, prewritten, on X. */
  readonly post: string;
  /** The page's own address, as a plain link to copy. */
  readonly link: string;
  /** Under the links: what the card names, and that nothing about the reader is in it or kept. */
  readonly note: string;
  /** The post itself: the pair, the result against holding and the fees, both already signed and written with their token, and the date opened. */
  readonly text: (pair: string, result: string, fees: string, openedOn: string) => string;
  readonly card: {
    /** Over the figures: what the card is. */
    readonly title: string;
    readonly range: string;
    /** The result's label on the card: against simply holding the deposits. */
    readonly against: string;
    readonly since: (openedOn: string) => string;
    /** The one line every card carries. */
    readonly footer: string;
    /** A position whose record could not be verified: the card says so and shows no figure. */
    readonly unverified: string;
  };
};

const COPY: Record<Locale, PositionShareCopy> = {
  en: {
    heading: "Share this record",
    image: "Open the card as an image",
    post: "Post on X",
    link: "Copy link",
    note: "The card and the post name the position's public token id and its figures, nothing about you; nothing is kept when they are made.",
    text: (pair, result, fees, openedOn) =>
      `${pair} on Uniswap v3, since ${openedOn}: ${result} against simply holding, of which fees ${fees}. Measured on LiquidityWise, not advice.`,
    card: {
      title: "An open Uniswap v3 position, at today's price",
      range: "Range",
      against: "Against simply holding the deposits",
      since: (openedOn) => `since ${openedOn}`,
      footer: "measured on liquiditywise.com · not advice",
      unverified: "This position's record could not be verified against the chain, so this card shows no figure.",
    },
  },
  tr: {
    heading: "Bu hesabı paylaş",
    image: "Kartı görsel olarak aç",
    post: "X'te paylaş",
    link: "Bağlantıyı kopyala",
    note: "Kart ve paylaşım, pozisyonun herkese açık token kimliğini ve rakamlarını söyler, senin hakkında hiçbir şey söylemez; yapılırken hiçbir şey saklanmaz.",
    text: (pair, result, fees, openedOn) =>
      `Uniswap v3'te ${pair}, ${openedOn} tarihinden beri: sadece tutmaya kıyasla ${result}, bunun komisyon kısmı ${fees}. LiquidityWise'ta ölçüldü, yatırım tavsiyesi değildir.`,
    card: {
      title: "Açık bir Uniswap v3 pozisyonu, bugünkü fiyatla",
      range: "Aralık",
      against: "Yatırılanları sadece tutmaya kıyasla",
      since: (openedOn) => `${openedOn} tarihinden beri`,
      footer: "liquiditywise.com'da ölçüldü · yatırım tavsiyesi değildir",
      unverified: "Bu pozisyonun geçmişi zincirle doğrulanamadı; bu yüzden bu kart hiçbir rakam göstermiyor.",
    },
  },
  de: {
    heading: "Diese Rechnung teilen",
    image: "Die Karte als Bild öffnen",
    post: "Auf X posten",
    link: "Link kopieren",
    note: "Karte und Post nennen die öffentliche Token-ID der Position und ihre Zahlen, nichts über dich; beim Erstellen wird nichts gespeichert.",
    text: (pair, result, fees, openedOn) =>
      `${pair} auf Uniswap v3, seit ${openedOn}: ${result} gegenüber dem bloßen Halten, davon Gebühren ${fees}. Gemessen auf LiquidityWise, keine Finanzberatung.`,
    card: {
      title: "Eine offene Uniswap-v3-Position, zum heutigen Preis",
      range: "Bereich",
      against: "Gegenüber dem bloßen Halten der Einlagen",
      since: (openedOn) => `seit ${openedOn}`,
      footer: "gemessen auf liquiditywise.com · keine Finanzberatung",
      unverified: "Der Verlauf dieser Position ließ sich nicht gegen die Chain prüfen, deshalb zeigt diese Karte keine Zahl.",
    },
  },
  es: {
    heading: "Compartir este cálculo",
    image: "Abrir la tarjeta como imagen",
    post: "Publicar en X",
    link: "Copiar el enlace",
    note: "La tarjeta y la publicación nombran el id público del token de la posición y sus cifras, nada sobre ti; al hacerlas no se guarda nada.",
    text: (pair, result, fees, openedOn) =>
      `${pair} en Uniswap v3, desde el ${openedOn}: ${result} frente a simplemente mantener, de lo cual comisiones ${fees}. Medido en LiquidityWise, no asesoramiento.`,
    card: {
      title: "Una posición abierta en Uniswap v3, al precio de hoy",
      range: "Rango",
      against: "Frente a simplemente mantener lo depositado",
      since: (openedOn) => `desde el ${openedOn}`,
      footer: "medido en liquiditywise.com · no asesoramiento",
      unverified: "El historial de esta posición no pudo comprobarse contra la cadena, así que esta tarjeta no muestra ninguna cifra.",
    },
  },
  ar: {
    heading: "شارك هذا الحساب",
    image: "افتح البطاقة كصورة",
    post: "انشر على X",
    link: "انسخ الرابط",
    note: "تذكر البطاقة والمنشور معرّف رمز المركز العام وأرقامه، ولا شيء عنك؛ ولا يُحفظ شيء عند إنشائهما.",
    text: (pair, result, fees, openedOn) =>
      `${pair} على Uniswap v3، منذ ${openedOn}: ${result} مقابل الاحتفاظ ببساطة، منها رسوم ${fees}. قياس من LiquidityWise، وليس نصيحة.`,
    card: {
      title: "مركز مفتوح في Uniswap v3، بسعر اليوم",
      range: "النطاق",
      against: "مقابل الاحتفاظ بالمودَع ببساطة",
      since: (openedOn) => `منذ ${openedOn}`,
      footer: "قياس من liquiditywise.com · ليس نصيحة",
      unverified: "تعذّر التحقق من سجل هذا المركز مقابل السلسلة، فلا تعرض هذه البطاقة أي رقم.",
    },
  },
  hi: {
    heading: "यह हिसाब साझा करें",
    image: "कार्ड को तस्वीर के रूप में खोलें",
    post: "X पर पोस्ट करें",
    link: "लिंक कॉपी करें",
    note: "कार्ड और पोस्ट में पोज़िशन की सार्वजनिक टोकन आईडी और उसके आँकड़े हैं, आपके बारे में कुछ नहीं; इन्हें बनाते समय कुछ भी सहेजा नहीं जाता।",
    text: (pair, result, fees, openedOn) =>
      `Uniswap v3 पर ${pair}, ${openedOn} से: बस रखे रहने की तुलना में ${result}, जिसमें शुल्क ${fees}। LiquidityWise पर मापा गया, सलाह नहीं।`,
    card: {
      title: "एक खुली Uniswap v3 पोज़िशन, आज की कीमत पर",
      range: "दायरा",
      against: "जमा की गई राशि को बस रखे रहने की तुलना में",
      since: (openedOn) => `${openedOn} से`,
      footer: "liquiditywise.com पर मापा गया · सलाह नहीं",
      unverified: "इस पोज़िशन का इतिहास चेन से जाँचा नहीं जा सका, इसलिए यह कार्ड कोई आँकड़ा नहीं दिखाता।",
    },
  },
  zh: {
    heading: "分享这份记录",
    image: "以图片形式打开卡片",
    post: "发布到 X",
    link: "复制链接",
    note: "卡片和帖子只写出这个仓位公开的代币 id 和它的数字，不涉及你的任何信息；生成时不会保存任何东西。",
    text: (pair, result, fees, openedOn) =>
      `Uniswap v3 上的 ${pair}，自 ${openedOn} 起：相对单纯持有 ${result}，其中手续费 ${fees}。由 LiquidityWise 测量所得，不构成财务建议。`,
    card: {
      title: "一个未平仓的 Uniswap v3 仓位，按今天的价格",
      range: "区间",
      against: "相对单纯持有存入的代币",
      since: (openedOn) => `自 ${openedOn} 起`,
      footer: "由 liquiditywise.com 测量所得 · 不构成财务建议",
      unverified: "这个仓位的历史无法与链上核对，因此这张卡片不显示任何数字。",
    },
  },
  ru: {
    heading: "Поделиться этим расчётом",
    image: "Открыть карточку как изображение",
    post: "Опубликовать в X",
    link: "Скопировать ссылку",
    note: "Карточка и пост называют публичный id токена позиции и её цифры, ничего о вас; при их создании ничего не сохраняется.",
    text: (pair, result, fees, openedOn) =>
      `${pair} в Uniswap v3, с ${openedOn}: ${result} против простого хранения, из них комиссии ${fees}. Измерено на LiquidityWise, а не финансовый совет.`,
    card: {
      title: "Открытая позиция Uniswap v3, по сегодняшней цене",
      range: "Диапазон",
      against: "Против простого хранения внесённого",
      since: (openedOn) => `с ${openedOn}`,
      footer: "измерено на liquiditywise.com · не финансовый совет",
      unverified: "Историю этой позиции не удалось сверить с сетью, поэтому на этой карточке нет цифр.",
    },
  },
  pt: {
    heading: "Compartilhar este cálculo",
    image: "Abrir o cartão como imagem",
    post: "Publicar no X",
    link: "Copiar o link",
    note: "O cartão e a publicação nomeiam o id público do token da posição e os números dela, nada sobre você; nada é guardado ao fazê-los.",
    text: (pair, result, fees, openedOn) =>
      `${pair} no Uniswap v3, desde ${openedOn}: ${result} contra simplesmente segurar, dos quais taxas ${fees}. Medido no LiquidityWise, não é recomendação.`,
    card: {
      title: "Uma posição aberta no Uniswap v3, ao preço de hoje",
      range: "Faixa",
      against: "Contra simplesmente segurar o que foi depositado",
      since: (openedOn) => `desde ${openedOn}`,
      footer: "medido no liquiditywise.com · não é recomendação",
      unverified: "O histórico desta posição não pôde ser conferido com a rede, então este cartão não mostra nenhum número.",
    },
  },
  "zh-Hant": {
    heading: "分享這份記錄",
    image: "以圖片形式開啟卡片",
    post: "發布到 X",
    link: "複製連結",
    note: "卡片和貼文只寫出這個倉位公開的代幣 id 和它的數字，不涉及你的任何資訊；產生時不會保存任何東西。",
    text: (pair, result, fees, openedOn) =>
      `Uniswap v3 上的 ${pair}，自 ${openedOn} 起：相對單純持有 ${result}，其中手續費 ${fees}。由 LiquidityWise 測量所得，不構成財務建議。`,
    card: {
      title: "一個未平倉的 Uniswap v3 倉位，按今天的價格",
      range: "區間",
      against: "相對單純持有存入的代幣",
      since: (openedOn) => `自 ${openedOn} 起`,
      footer: "由 liquiditywise.com 測量所得 · 不構成財務建議",
      unverified: "這個倉位的歷史無法與鏈上核對，因此這張卡片不顯示任何數字。",
    },
  },
};

export const getPositionShareCopy = (locale: Locale): PositionShareCopy => COPY[locale];
