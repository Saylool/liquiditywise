import type { Locale } from "./locales";

/*
 * The front page's section on where the smart money sits and on the Telegram
 * bot. The smart-money card reuses that page's own title and description, so
 * the two say one thing in one way; what is here is the section's heading and
 * the bot's card.
 *
 * The bot's card says what the bot does and that /smart is the one thing that
 * has to be asked for — the same promise the bot's own help makes.
 */

export type HomeAlertsCopy = {
  readonly kicker: string;
  readonly heading: string;
  readonly telegramTitle: string;
  readonly telegramBody: string;
  readonly telegramCta: string;
  readonly telegramBot: (username: string) => string;
};

const COPY: Record<Locale, HomeAlertsCopy> = {
  en: {
    kicker: "Beyond a single pool",
    heading: "See where the money goes, and hear when it moves",
    telegramTitle: "Alerts on Telegram",
    telegramBody:
      "Follow an address's positions and be told when one nears the edge of its range, leaves it or comes back. Send /smart to the bot and it also says when the best-earning liquidity in your pools moves.",
    telegramCta: "Set up alerts",
    telegramBot: (username) => `Open the bot: @${username}`,
  },
  tr: {
    kicker: "Tek bir havuzun ötesi",
    heading: "Paranın nereye gittiğini gör, kaydığında haber al",
    telegramTitle: "Telegram'da uyarılar",
    telegramBody:
      "Bir adresin pozisyonlarını takip et; biri aralığının sınırına yaklaştığında, aralıktan çıktığında ya da geri girdiğinde haber al. Bota /smart yazarsan, havuzlarında en çok kazanan likidite kaydığında da söyler.",
    telegramCta: "Uyarıları kur",
    telegramBot: (username) => `Botu aç: @${username}`,
  },
  de: {
    kicker: "Mehr als ein einzelner Pool",
    heading: "Sieh, wohin das Geld geht, und erfahre, wenn es sich bewegt",
    telegramTitle: "Benachrichtigungen auf Telegram",
    telegramBody:
      "Folge den Positionen einer Adresse und erfahre, wenn eine sich dem Rand ihres Bereichs nähert, ihn verlässt oder zurückkehrt. Sendest du dem Bot /smart, meldet er auch, wenn sich die bestverdienende Liquidität in deinen Pools verschiebt.",
    telegramCta: "Benachrichtigungen einrichten",
    telegramBot: (username) => `Bot öffnen: @${username}`,
  },
  es: {
    kicker: "Más allá de un solo pool",
    heading: "Mira adónde va el dinero y entérate cuando se mueve",
    telegramTitle: "Alertas en Telegram",
    telegramBody:
      "Sigue las posiciones de una dirección y entérate cuando una se acerca al borde de su rango, sale de él o vuelve. Si envías /smart al bot, también avisa cuando se mueve la liquidez que más gana en tus pools.",
    telegramCta: "Configurar alertas",
    telegramBot: (username) => `Abrir el bot: @${username}`,
  },
  ar: {
    kicker: "أبعد من تجمّع واحد",
    heading: "انظر إلى أين يذهب المال، واعرف متى يتحرّك",
    telegramTitle: "تنبيهات على تيليغرام",
    telegramBody:
      "تابع مراكز عنوان واحد واعرف حين يقترب أحدها من حافة نطاقه أو يخرج منه أو يعود إليه. وإن أرسلت /smart إلى البوت فسيخبرك أيضًا حين تنتقل السيولة الأعلى ربحًا في تجمّعاتك.",
    telegramCta: "إعداد التنبيهات",
    telegramBot: (username) => `افتح البوت: @${username}`,
  },
  hi: {
    kicker: "एक पूल से आगे",
    heading: "देखिए पैसा कहाँ जा रहा है, और खिसकने पर सुनिए",
    telegramTitle: "टेलीग्राम पर सूचनाएँ",
    telegramBody:
      "किसी पते की पोज़िशनें फ़ॉलो कीजिए और जब कोई अपने दायरे के किनारे के पास पहुँचे, उससे बाहर जाए या लौट आए तो सूचना पाइए। बॉट को /smart भेजें तो वह यह भी बताएगा कि आपके पूलों में सबसे ज़्यादा कमाने वाली तरलता कब खिसकी।",
    telegramCta: "सूचनाएँ सेट करें",
    telegramBot: (username) => `बॉट खोलें: @${username}`,
  },
  zh: {
    kicker: "不止一个池子",
    heading: "看钱去了哪里，并在它移动时得到通知",
    telegramTitle: "Telegram 提醒",
    telegramBody:
      "关注一个地址的仓位，当其中一个接近区间边缘、离开区间或回到区间时收到通知。向机器人发送 /smart，当你的池子里收益最高的流动性移动时，它也会告诉你。",
    telegramCta: "设置提醒",
    telegramBot: (username) => `打开机器人：@${username}`,
  },
  ru: {
    kicker: "Больше, чем один пул",
    heading: "Смотрите, куда идут деньги, и узнавайте, когда они двигаются",
    telegramTitle: "Оповещения в Telegram",
    telegramBody:
      "Следите за позициями одного адреса и узнавайте, когда одна из них подходит к границе диапазона, выходит из него или возвращается. Отправьте боту /smart — и он сообщит также, когда сместится самая доходная ликвидность в ваших пулах.",
    telegramCta: "Настроить оповещения",
    telegramBot: (username) => `Открыть бота: @${username}`,
  },
  pt: {
    kicker: "Além de um único pool",
    heading: "Veja para onde vai o dinheiro e saiba quando ele se move",
    telegramTitle: "Alertas no Telegram",
    telegramBody:
      "Acompanhe as posições de um endereço e saiba quando uma se aproxima da borda da faixa, sai dela ou volta. Se você enviar /smart ao bot, ele também avisa quando a liquidez que mais ganha nos seus pools se mover.",
    telegramCta: "Configurar alertas",
    telegramBot: (username) => `Abrir o bot: @${username}`,
  },
  "zh-Hant": {
    kicker: "不止一個池子",
    heading: "看錢去了哪裡，並在它移動時得到通知",
    telegramTitle: "Telegram 提醒",
    telegramBody:
      "關注一個地址的倉位，當其中一個接近區間邊緣、離開區間或回到區間時收到通知。向機器人發送 /smart，當你的池子裡收益最高的流動性移動時，它也會告訴你。",
    telegramCta: "設定提醒",
    telegramBot: (username) => `開啟機器人：@${username}`,
  },
};

export const getHomeAlertsCopy = (locale: Locale): HomeAlertsCopy => COPY[locale];
