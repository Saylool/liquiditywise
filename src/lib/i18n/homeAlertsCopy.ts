import type { Locale } from "./locales";

/*
 * The front page's section on where the smart money sits, on a pair across
 * every network, and on the Telegram bot. The smart-money and pair cards reuse
 * their pages' own titles and descriptions, so each says one thing in one way;
 * what is here is the section's heading, the pair card's link and the bot's
 * card.
 *
 * The bot's card says what the bot does — and what an alert that a position has
 * left its range adds — and that /smart and /weekly are the things that have to
 * be asked for: the same promise the bot's own help makes.
 */

export type HomeAlertsCopy = {
  readonly kicker: string;
  readonly heading: string;
  readonly telegramTitle: string;
  readonly telegramBody: string;
  /** The link on the pair card; its title and text are the pair page's own. */
  readonly pairCta: string;
  readonly telegramCta: string;
  readonly telegramBot: (username: string) => string;
};

const COPY: Record<Locale, HomeAlertsCopy> = {
  en: {
    kicker: "Beyond a single pool",
    heading: "See where the money goes, and hear when it moves",
    telegramTitle: "Alerts on Telegram",
    telegramBody:
      "Follow an address's positions and be told when one nears the edge of its range, leaves it or comes back. When one leaves, the alert adds what the pool paid its liquidity in range over the last seven days and what re-centring would cost in swap fees. Send /smart to the bot and it also says when the best-earning liquidity in your pools moves; send /weekly for a Monday digest of where the smart money moved.",
    pairCta: "Look up a pair",
    telegramCta: "Set up alerts",
    telegramBot: (username) => `Open the bot: @${username}`,
  },
  tr: {
    kicker: "Tek bir havuzun ötesi",
    heading: "Paranın nereye gittiğini gör, kaydığında haber al",
    telegramTitle: "Telegram'da uyarılar",
    telegramBody:
      "Bir adresin pozisyonlarını takip et; biri aralığının sınırına yaklaştığında, aralıktan çıktığında ya da geri girdiğinde haber al. Biri çıktığında bildirim, havuzun son yedi günde aralık içindeki likiditeye ne ödediğini ve yeniden ortalamanın takas komisyonu olarak neye mal olacağını da ekler. Bota /smart yazarsan, havuzlarında en çok kazanan likidite kaydığında da söyler; /weekly yazarsan her pazartesi akıllı paranın nereye kaydığını özetler.",
    pairCta: "Bir parite ara",
    telegramCta: "Uyarıları kur",
    telegramBot: (username) => `Botu aç: @${username}`,
  },
  de: {
    kicker: "Mehr als ein einzelner Pool",
    heading: "Sieh, wohin das Geld geht, und erfahre, wenn es sich bewegt",
    telegramTitle: "Benachrichtigungen auf Telegram",
    telegramBody:
      "Folge den Positionen einer Adresse und erfahre, wenn eine sich dem Rand ihres Bereichs nähert, ihn verlässt oder zurückkehrt. Verlässt eine ihn, nennt der Hinweis auch, was der Pool der Liquidität im Bereich in den letzten sieben Tagen gezahlt hat und was eine Neuzentrierung an Tauschgebühren kosten würde. Sendest du dem Bot /smart, meldet er auch, wenn sich die bestverdienende Liquidität in deinen Pools verschiebt; mit /weekly schickt er jeden Montag einen Überblick, wohin sich das kluge Geld bewegt hat.",
    pairCta: "Ein Paar nachschlagen",
    telegramCta: "Benachrichtigungen einrichten",
    telegramBot: (username) => `Bot öffnen: @${username}`,
  },
  es: {
    kicker: "Más allá de un solo pool",
    heading: "Mira adónde va el dinero y entérate cuando se mueve",
    telegramTitle: "Alertas en Telegram",
    telegramBody:
      "Sigue las posiciones de una dirección y entérate cuando una se acerca al borde de su rango, sale de él o vuelve. Cuando una sale, el aviso añade cuánto pagó el pool a su liquidez dentro de rango en los últimos siete días y cuánto costaría recentrarla en comisiones de intercambio. Si envías /smart al bot, también avisa cuando se mueve la liquidez que más gana en tus pools; con /weekly recibes cada lunes un resumen de adónde se movió el dinero inteligente.",
    pairCta: "Buscar un par",
    telegramCta: "Configurar alertas",
    telegramBot: (username) => `Abrir el bot: @${username}`,
  },
  ar: {
    kicker: "أبعد من تجمّع واحد",
    heading: "انظر إلى أين يذهب المال، واعرف متى يتحرّك",
    telegramTitle: "تنبيهات عبر تيليغرام",
    telegramBody:
      "تابع مراكز عنوان واحد واعرف حين يقترب أحدها من حافة نطاقه أو يخرج منه أو يعود إليه. وحين يخرج أحدها، يضيف التنبيه ما دفعه التجمّع للسيولة داخل النطاق خلال الأيام السبعة الماضية وما ستكلّفه إعادة التوسيط من رسوم التبادل. وإن أرسلت /smart إلى البوت فسيخبرك أيضًا حين تنتقل السيولة الأعلى ربحًا في تجمّعاتك، ومع /weekly يصلك كل يوم اثنين ملخص عن المكان الذي انتقل إليه المال الذكي.",
    pairCta: "ابحث عن زوج",
    telegramCta: "إعداد التنبيهات",
    telegramBot: (username) => `افتح البوت: @${username}`,
  },
  hi: {
    kicker: "एक पूल से आगे",
    heading: "देखिए पैसा कहाँ जा रहा है, और खिसकने पर सुनिए",
    telegramTitle: "Telegram पर सूचनाएँ",
    telegramBody:
      "किसी पते की पोज़िशनों पर नज़र रखिए और जब कोई अपने दायरे के किनारे के पास पहुँचे, उससे बाहर जाए या लौट आए तो सूचना पाइए। जब कोई बाहर जाती है, तो सूचना यह भी जोड़ती है कि पिछले सात दिनों में पूल ने दायरे के भीतर की तरलता को कितना शुल्क दिया और फिर से केंद्रित करने में स्वैप शुल्क कितना लगेगा। बॉट को /smart भेजें तो वह यह भी बताएगा कि आपके पूलों में सबसे ज़्यादा कमाने वाली तरलता कब खिसकी, और /weekly भेजें तो हर सोमवार यह सारांश मिलेगा कि स्मार्ट पैसा कहाँ खिसका।",
    pairCta: "कोई जोड़ी खोजें",
    telegramCta: "सूचनाएँ सेट करें",
    telegramBot: (username) => `बॉट खोलें: @${username}`,
  },
  zh: {
    kicker: "不止一个池子",
    heading: "看钱去了哪里，并在它移动时得到通知",
    telegramTitle: "Telegram 提醒",
    telegramBody:
      "关注一个地址的仓位，当其中一个接近区间边缘、离开区间或回到区间时收到通知。某个仓位离开区间时，提醒还会附上过去七天里资金池付给区间内流动性的手续费，以及重新居中需要付多少兑换手续费。向机器人发送 /smart，当你的池子里收益最高的流动性移动时，它也会告诉你；发送 /weekly，每周一收到聪明资金流向的摘要。",
    pairCta: "查找一个交易对",
    telegramCta: "设置提醒",
    telegramBot: (username) => `打开机器人：@${username}`,
  },
  ru: {
    kicker: "Больше, чем один пул",
    heading: "Смотрите, куда идут деньги, и узнавайте, когда они двигаются",
    telegramTitle: "Оповещения в Telegram",
    telegramBody:
      "Следите за позициями одного адреса и узнавайте, когда одна из них подходит к границе диапазона, выходит из него или возвращается. Когда позиция выходит за диапазон, уведомление добавляет, сколько пул заплатил ликвидности внутри диапазона за последние семь дней и во что обошлось бы перецентрирование в комиссиях за своп. Отправьте боту /smart — и он сообщит также, когда сместится самая доходная ликвидность в ваших пулах, а с /weekly будет каждый понедельник присылать сводку о том, куда переместились умные деньги.",
    pairCta: "Найти пару",
    telegramCta: "Настроить оповещения",
    telegramBot: (username) => `Открыть бота: @${username}`,
  },
  pt: {
    kicker: "Além de um único pool",
    heading: "Veja para onde vai o dinheiro e saiba quando ele se move",
    telegramTitle: "Alertas no Telegram",
    telegramBody:
      "Acompanhe as posições de um endereço e saiba quando uma se aproxima da borda da faixa, sai dela ou volta. Quando uma sai, o aviso acrescenta quanto o pool pagou à liquidez dentro da faixa nos últimos sete dias e quanto custaria recentralizar em taxas de swap. Se você enviar /smart ao bot, ele também avisa quando a liquidez que mais ganha nos seus pools se mover; com /weekly, você recebe toda segunda-feira um resumo de para onde o dinheiro inteligente se moveu.",
    pairCta: "Buscar um par",
    telegramCta: "Configurar alertas",
    telegramBot: (username) => `Abrir o bot: @${username}`,
  },
  "zh-Hant": {
    kicker: "不止一個池子",
    heading: "看錢去了哪裡，並在它移動時得到通知",
    telegramTitle: "Telegram 提醒",
    telegramBody:
      "追蹤一個地址的倉位，當其中一個接近區間邊緣、離開區間或回到區間時收到通知。某個倉位離開區間時，提醒還會附上過去七天裡資金池付給區間內流動性的手續費，以及重新置中需要付多少兌換手續費。向機器人傳送 /smart，當你的池子裡收益最高的流動性移動時，它也會告訴你；傳送 /weekly，每週一收到聰明資金流向的摘要。",
    pairCta: "查詢一個交易對",
    telegramCta: "設定提醒",
    telegramBot: (username) => `開啟機器人：@${username}`,
  },
};

export const getHomeAlertsCopy = (locale: Locale): HomeAlertsCopy => COPY[locale];
