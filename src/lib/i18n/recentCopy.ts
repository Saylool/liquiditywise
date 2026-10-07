import type { Locale } from "./locales";

/*
 * The words around the list of what a reader last looked at: its heading on
 * the front page, its shorter one beside the pool box, the control that
 * empties it, and the sentence that says where the list is.
 *
 * That sentence is the privacy copy for the feature, and it says what the
 * site's other such sentences say, in the same order: what is kept, where,
 * that nothing leaves the browser, and that clearing the site's data removes
 * it. The counts in it are the code's own constants, handed in formatted, so
 * a cap moved in `recentlyViewed.ts` moves in this sentence too.
 *
 * Each language uses the word its interface already uses for a pool and a
 * position — havuz, تجمّع, पूल, 资金池 — so the block reads as part of the page
 * and not as a label pasted onto it.
 */

export type RecentCopy = {
  /** Over the block on the front page. */
  readonly heading: string;
  /** Over the same list beside the pool box, where there is no room for a sentence. */
  readonly recently: string;
  /** The one control: empties both lists. */
  readonly forget: string;
  /** Where the list is kept and what removes it, given the two caps as figures. */
  readonly note: (pools: string, addresses: string) => string;
};

const COPY: Record<Locale, RecentCopy> = {
  en: {
    heading: "Continue where you left off",
    recently: "Recently",
    forget: "Forget",
    note: (pools, addresses) =>
      `Kept in this browser only: the last ${pools} pools and ${addresses} addresses opened here, and when. Nothing is sent to the server or anywhere else; clearing this site's data removes the list.`,
  },
  tr: {
    heading: "Kaldığın yerden devam et",
    recently: "Son bakılanlar",
    forget: "Unut",
    note: (pools, addresses) =>
      `Yalnızca bu tarayıcıda tutulur: burada en son açılan ${pools} havuz ve ${addresses} adres, ne zaman açıldıklarıyla birlikte. Sunucuya ya da başka bir yere hiçbir şey gönderilmez; bu sitenin verilerini temizlemek listeyi siler.`,
  },
  de: {
    heading: "Weitermachen, wo du aufgehört hast",
    recently: "Zuletzt",
    forget: "Vergessen",
    note: (pools, addresses) =>
      `Nur in diesem Browser gespeichert: die letzten ${pools} Pools und ${addresses} Adressen, die hier geöffnet wurden, mit dem Zeitpunkt. Nichts wird an den Server oder sonstwohin gesendet; das Löschen der Website-Daten entfernt die Liste.`,
  },
  es: {
    heading: "Continúa donde lo dejaste",
    recently: "Recientes",
    forget: "Olvidar",
    note: (pools, addresses) =>
      `Se guarda solo en este navegador: los últimos ${pools} pools y ${addresses} direcciones abiertos aquí, con la fecha. No se envía nada al servidor ni a ningún otro sitio; borrar los datos de este sitio elimina la lista.`,
  },
  ar: {
    heading: "تابع من حيث توقفت",
    recently: "مؤخرًا",
    forget: "انسَ القائمة",
    note: (pools, addresses) =>
      `يُحفظ في هذا المتصفح فقط: آخر ${pools} تجمّعات و${addresses} عناوين فُتحت هنا، مع وقت فتحها. لا يُرسل شيء إلى الخادم أو إلى أي مكان آخر؛ ومسح بيانات هذا الموقع يزيل القائمة.`,
  },
  hi: {
    heading: "जहाँ छोड़ा था, वहाँ से आगे बढ़ें",
    recently: "हाल ही में",
    forget: "भूल जाएँ",
    note: (pools, addresses) =>
      `केवल इस ब्राउज़र में रखा जाता है: यहाँ खोले गए पिछले ${pools} पूल और ${addresses} पते, उनके समय के साथ। सर्वर या किसी और जगह कुछ नहीं भेजा जाता; इस साइट का डेटा साफ़ करने से सूची हट जाती है।`,
  },
  zh: {
    heading: "从上次离开的地方继续",
    recently: "最近",
    forget: "忘记",
    note: (pools, addresses) =>
      `只保存在这个浏览器里：在这里最近打开的 ${pools} 个资金池和 ${addresses} 个地址，以及打开的时间。不会发送到服务器或任何地方；清除本站数据即会删除这份列表。`,
  },
  ru: {
    heading: "Продолжить с того места, где остановились",
    recently: "Недавние",
    forget: "Забыть",
    note: (pools, addresses) =>
      `Хранится только в этом браузере: последние ${pools} пулов и ${addresses} адреса, открытые здесь, с временем открытия. Ничего не отправляется на сервер или куда-либо ещё; очистка данных сайта удаляет список.`,
  },
  pt: {
    heading: "Continue de onde parou",
    recently: "Recentes",
    forget: "Esquecer",
    note: (pools, addresses) =>
      `Guardado só neste navegador: os últimos ${pools} pools e ${addresses} endereços abertos aqui, com a data. Nada é enviado ao servidor nem a qualquer outro lugar; limpar os dados deste site apaga a lista.`,
  },
  "zh-Hant": {
    heading: "從上次離開的地方繼續",
    recently: "最近",
    forget: "忘記",
    note: (pools, addresses) =>
      `只儲存在這個瀏覽器裡：在這裡最近開啟的 ${pools} 個資金池和 ${addresses} 個地址，以及開啟的時間。不會傳送到伺服器或任何地方；清除本站資料即會刪除這份清單。`,
  },
};

export const getRecentCopy = (locale: Locale): RecentCopy => COPY[locale];
