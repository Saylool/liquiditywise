import type { Locale } from "./locales";

/*
 * The words around the Monday digest by e-mail: the form on the weekly page
 * and its card on the front page, what the form answers, the two pages a link
 * in a mail leads to, and the two mails themselves.
 *
 * Only the frame is here. The digest inside the mail is the bot's message
 * (telegram/messages.ts), word for word, and the mail's subject is the weekly
 * page's own title — so a reader who gets the mail, opens the page and has
 * the bot's chat open sees one digest in one set of words. What is here
 * follows the same terms: "smart money", "digest", "network", each as the
 * weekly page and the bot say it in that language.
 *
 * The privacy sentence is the one that matters. It names exactly what is
 * kept — the address, the network, the language, when it was confirmed and
 * when the last digest went out — and says that unsubscribing deletes it from
 * the server at once and from the encrypted backups within seven days: the
 * same promise the Telegram section makes, held to the same backup
 * (backup/retentionPromise.test.ts, email/subscriptions.ts).
 */

export type EmailDigestCopy = {
  /** Over the form, and the card's title on the front page. */
  readonly heading: string;
  /** What arrives, when, and for which network. Never names another channel: the card stands where no bot may be. */
  readonly body: string;
  readonly emailLabel: string;
  readonly submit: string;
  /** Exactly what is kept, and that unsubscribing deletes it. */
  readonly privacy: string;
  /** How to change the network: the record cannot be rewritten from the form. */
  readonly changeNetwork: string;
  readonly notConfigured: string;
  /** The front page card's link to the form. */
  readonly homeCta: string;
  /** What the form says after it was sent, by what happened. */
  readonly status: {
    readonly sent: string;
    readonly invalid: string;
    readonly busy: string;
    readonly unavailable: string;
  };
  /** The page the link in the confirmation mail opens. */
  readonly confirm: {
    readonly title: string;
    readonly confirmed: (chain: string) => string;
    readonly already: string;
    readonly unknown: string;
    readonly invalid: string;
    readonly unavailable: string;
  };
  /** The page the link at the foot of a digest opens: a button first, so a mail scanner that follows links stops nothing. */
  readonly unsubscribe: {
    readonly title: string;
    readonly ask: string;
    readonly button: string;
    readonly removed: string;
    readonly unknown: string;
    readonly invalid: string;
    readonly unavailable: string;
  };
  readonly mail: {
    readonly confirmSubject: (chain: string) => string;
    readonly confirmIntro: (chain: string) => string;
    readonly confirmLink: string;
    readonly confirmIgnore: string;
    /** Before the weekly page's address in a digest. */
    readonly digestPage: string;
    /** The unsubscribe link's text, at the foot of every digest. */
    readonly unsubscribeLink: string;
  };
};

const COPY: Record<Locale, EmailDigestCopy> = {
  en: {
    heading: "The digest by e-mail",
    body: "The same digest, in your inbox every Monday from 08:00 UTC, for the network you choose — where the smart money moved over the week. A confirmation comes first; nothing is sent until you open the link in it.",
    emailLabel: "E-mail address",
    submit: "Send me the digest",
    privacy:
      "What is kept is the address, the network, the language, when it was confirmed and when the last digest went out — nothing else. The link at the foot of every digest deletes it from this server at once, and it drops out of the encrypted backups within seven days.",
    changeNetwork: "To change the network, stop the digest with the link in any of them and ask again.",
    notConfigured: "The digest by e-mail is not set up on this server.",
    homeCta: "Get it by e-mail",
    status: {
      sent: "If that address is not already subscribed, a confirmation has been sent to it. Open the link in it within a day; nothing is sent until you do.",
      invalid: "That is not an e-mail address.",
      busy: "Too many requests from here just now. Try again in a few minutes.",
      unavailable: "The request could not be saved or the confirmation could not be sent just now. Try again in a minute.",
    },
    confirm: {
      title: "The digest by e-mail: confirmed",
      confirmed: (chain) => `Confirmed. From the next Monday on, the digest for ${chain} comes to that address.`,
      already: "That address was already confirmed. Nothing has changed.",
      unknown: "This link is not known or has expired. Ask for the digest again on the weekly page.",
      invalid: "This link is not valid.",
      unavailable: "The subscription could not be confirmed just now. Try the link again in a minute.",
    },
    unsubscribe: {
      title: "Stopping the digest by e-mail",
      ask: "Press the button to stop the digest to this address. Its record is deleted at once.",
      button: "Stop the digest",
      removed: "Stopped. The record is deleted from this server, and drops out of its encrypted backups within seven days.",
      unknown: "Nothing is kept for this link any more.",
      invalid: "This link is not valid.",
      unavailable: "The record could not be removed just now. Try again in a minute.",
    },
    mail: {
      confirmSubject: (chain) => `Confirm the Monday digest for ${chain}`,
      confirmIntro: (chain) =>
        `Somebody — we hope you — asked on liquiditywise.com for the Monday digest of where the smart money on ${chain} moved, at this address. Open the link below to confirm; it is good for a day.`,
      confirmLink: "Confirm the digest",
      confirmIgnore: "If you did not ask, do nothing: the request expires on its own within a day and nothing is kept.",
      digestPage: "The same digest as a page:",
      unsubscribeLink: "Stop these e-mails",
    },
  },
  tr: {
    heading: "Özet e-postayla",
    body: "Aynı özet, her pazartesi 08:00 UTC'den itibaren, seçtiğin ağ için gelen kutunda — akıllı para hafta boyunca nereye kaydı. Önce bir onay gelir; içindeki bağlantıyı açmadan hiçbir şey gönderilmez.",
    emailLabel: "E-posta adresi",
    submit: "Özeti bana gönder",
    privacy:
      "Saklanan: adres, ağ, dil, ne zaman onaylandığı ve son özetin ne zaman gittiği — başka hiçbir şey. Her özetin altındaki bağlantı kaydı bu sunucudan anında siler; şifreli yedeklerden de yedi gün içinde düşer.",
    changeNetwork: "Ağı değiştirmek için özeti herhangi birinin altındaki bağlantıyla durdur ve yeniden iste.",
    notConfigured: "Bu sunucuda e-postayla özet kurulu değil.",
    homeCta: "E-postayla al",
    status: {
      sent: "Bu adres zaten abone değilse ona bir onay gönderildi. İçindeki bağlantıyı bir gün içinde aç; açmadan hiçbir şey gönderilmez.",
      invalid: "Bu bir e-posta adresi değil.",
      busy: "Buradan şu an çok fazla istek geldi. Birkaç dakika sonra yeniden dene.",
      unavailable: "İstek şu an kaydedilemedi ya da onay gönderilemedi. Bir dakika sonra yeniden dene.",
    },
    confirm: {
      title: "E-postayla özet: onaylandı",
      confirmed: (chain) => `Onaylandı. Gelecek pazartesiden itibaren ${chain} özeti bu adrese gelir.`,
      already: "Bu adres zaten onaylanmıştı. Hiçbir şey değişmedi.",
      unknown: "Bu bağlantı tanınmıyor ya da süresi dolmuş. Haftalık sayfadan özeti yeniden iste.",
      invalid: "Bu bağlantı geçerli değil.",
      unavailable: "Abonelik şu an onaylanamadı. Bağlantıyı bir dakika sonra yeniden dene.",
    },
    unsubscribe: {
      title: "E-postayla özeti durdurma",
      ask: "Bu adrese giden özeti durdurmak için düğmeye bas. Kaydı anında silinir.",
      button: "Özeti durdur",
      removed: "Durduruldu. Kayıt bu sunucudan silindi; şifreli yedeklerden de yedi gün içinde düşecek.",
      unknown: "Bu bağlantı için artık hiçbir şey saklanmıyor.",
      invalid: "Bu bağlantı geçerli değil.",
      unavailable: "Kayıt şu an silinemedi. Bir dakika sonra yeniden dene.",
    },
    mail: {
      confirmSubject: (chain) => `${chain} için pazartesi özetini onayla`,
      confirmIntro: (chain) =>
        `Birisi — umarız sen — liquiditywise.com'da ${chain} üzerinde akıllı paranın nereye kaydığına dair pazartesi özetini bu adrese istedi. Onaylamak için aşağıdaki bağlantıyı aç; bir gün geçerli.`,
      confirmLink: "Özeti onayla",
      confirmIgnore: "Sen istemediysen hiçbir şey yapma: istek bir gün içinde kendiliğinden düşer ve hiçbir şey saklanmaz.",
      digestPage: "Aynı özet sayfa olarak:",
      unsubscribeLink: "Bu e-postaları durdur",
    },
  },
  de: {
    heading: "Der Überblick per E-Mail",
    body: "Derselbe Überblick, jeden Montag ab 08:00 UTC in deinem Postfach, für das Netzwerk deiner Wahl — wohin sich das kluge Geld in der Woche bewegt hat. Zuerst kommt eine Bestätigung; bis du den Link darin öffnest, wird nichts geschickt.",
    emailLabel: "E-Mail-Adresse",
    submit: "Überblick schicken",
    privacy:
      "Gespeichert werden die Adresse, das Netzwerk, die Sprache, wann sie bestätigt wurde und wann der letzte Überblick verschickt wurde — sonst nichts. Der Link am Ende jedes Überblicks löscht den Eintrag sofort von diesem Server; aus den verschlüsselten Sicherungen verschwindet er binnen sieben Tagen.",
    changeNetwork: "Um das Netzwerk zu wechseln, beende den Überblick über den Link in einem von ihnen und bestelle ihn neu.",
    notConfigured: "Der Überblick per E-Mail ist auf diesem Server nicht eingerichtet.",
    homeCta: "Per E-Mail erhalten",
    status: {
      sent: "Falls diese Adresse nicht schon eingetragen ist, wurde ihr eine Bestätigung geschickt. Öffne den Link darin innerhalb eines Tages; bis dahin wird nichts geschickt.",
      invalid: "Das ist keine E-Mail-Adresse.",
      busy: "Gerade kommen von hier zu viele Anfragen. Versuch es in ein paar Minuten noch einmal.",
      unavailable: "Die Anfrage konnte gerade nicht gespeichert oder die Bestätigung nicht geschickt werden. Versuch es in einer Minute noch einmal.",
    },
    confirm: {
      title: "Der Überblick per E-Mail: bestätigt",
      confirmed: (chain) => `Bestätigt. Ab dem nächsten Montag kommt der Überblick für ${chain} an diese Adresse.`,
      already: "Diese Adresse war schon bestätigt. Nichts hat sich geändert.",
      unknown: "Dieser Link ist unbekannt oder abgelaufen. Bestelle den Überblick auf der Wochenseite neu.",
      invalid: "Dieser Link ist nicht gültig.",
      unavailable: "Die Bestellung konnte gerade nicht bestätigt werden. Versuch den Link in einer Minute noch einmal.",
    },
    unsubscribe: {
      title: "Den Überblick per E-Mail beenden",
      ask: "Drück den Knopf, um den Überblick an diese Adresse zu beenden. Der Eintrag wird sofort gelöscht.",
      button: "Überblick beenden",
      removed: "Beendet. Der Eintrag ist von diesem Server gelöscht und verschwindet binnen sieben Tagen auch aus den verschlüsselten Sicherungen.",
      unknown: "Für diesen Link ist nichts mehr gespeichert.",
      invalid: "Dieser Link ist nicht gültig.",
      unavailable: "Der Eintrag konnte gerade nicht gelöscht werden. Versuch es in einer Minute noch einmal.",
    },
    mail: {
      confirmSubject: (chain) => `Den Montagsüberblick für ${chain} bestätigen`,
      confirmIntro: (chain) =>
        `Jemand — hoffentlich du — hat auf liquiditywise.com den Montagsüberblick darüber, wohin sich das kluge Geld auf ${chain} bewegt hat, an diese Adresse bestellt. Öffne den Link unten, um das zu bestätigen; er gilt einen Tag.`,
      confirmLink: "Überblick bestätigen",
      confirmIgnore: "Wenn du das nicht warst, tu nichts: die Anfrage verfällt binnen eines Tages von selbst, und nichts wird gespeichert.",
      digestPage: "Derselbe Überblick als Seite:",
      unsubscribeLink: "Diese E-Mails beenden",
    },
  },
  es: {
    heading: "El resumen por correo",
    body: "El mismo resumen, en tu bandeja cada lunes desde las 08:00 UTC, para la red que elijas — adónde se movió el dinero inteligente durante la semana. Primero llega una confirmación; no se envía nada hasta que abras su enlace.",
    emailLabel: "Dirección de correo",
    submit: "Enviarme el resumen",
    privacy:
      "Lo que se guarda es la dirección, la red, el idioma, cuándo se confirmó y cuándo salió el último resumen — nada más. El enlace al pie de cada resumen lo borra de este servidor al instante, y desaparece de las copias cifradas en siete días.",
    changeNetwork: "Para cambiar la red, detén el resumen con el enlace de cualquiera de ellos y pídelo de nuevo.",
    notConfigured: "El resumen por correo no está configurado en este servidor.",
    homeCta: "Recibirlo por correo",
    status: {
      sent: "Si esa dirección no está ya suscrita, se le ha enviado una confirmación. Abre su enlace en el plazo de un día; hasta entonces no se envía nada.",
      invalid: "Eso no es una dirección de correo.",
      busy: "Demasiadas solicitudes desde aquí ahora mismo. Inténtalo en unos minutos.",
      unavailable: "No se pudo guardar la solicitud o enviar la confirmación en este momento. Inténtalo en un minuto.",
    },
    confirm: {
      title: "El resumen por correo: confirmado",
      confirmed: (chain) => `Confirmado. Desde el próximo lunes, el resumen de ${chain} llega a esa dirección.`,
      already: "Esa dirección ya estaba confirmada. Nada ha cambiado.",
      unknown: "Este enlace no se reconoce o ha caducado. Pide el resumen de nuevo en la página semanal.",
      invalid: "Este enlace no es válido.",
      unavailable: "No se pudo confirmar la suscripción en este momento. Vuelve a abrir el enlace en un minuto.",
    },
    unsubscribe: {
      title: "Detener el resumen por correo",
      ask: "Pulsa el botón para detener el resumen a esta dirección. Su registro se borra al instante.",
      button: "Detener el resumen",
      removed: "Detenido. El registro se ha borrado de este servidor y desaparece de sus copias cifradas en siete días.",
      unknown: "Ya no se guarda nada para este enlace.",
      invalid: "Este enlace no es válido.",
      unavailable: "No se pudo borrar el registro en este momento. Inténtalo en un minuto.",
    },
    mail: {
      confirmSubject: (chain) => `Confirma el resumen de los lunes para ${chain}`,
      confirmIntro: (chain) =>
        `Alguien — esperamos que tú — pidió en liquiditywise.com el resumen de los lunes sobre adónde se movió el dinero inteligente en ${chain}, para esta dirección. Abre el enlace de abajo para confirmarlo; vale un día.`,
      confirmLink: "Confirmar el resumen",
      confirmIgnore: "Si no lo pediste, no hagas nada: la solicitud caduca sola en un día y no se guarda nada.",
      digestPage: "El mismo resumen como página:",
      unsubscribeLink: "Detener estos correos",
    },
  },
  ar: {
    heading: "الملخص بالبريد الإلكتروني",
    body: "الملخص نفسه في بريدك كل يوم اثنين من الساعة 08:00 بالتوقيت العالمي، للشبكة التي تختارها — إلى أين انتقل المال الذكي خلال الأسبوع. يصلك تأكيد أولًا، ولا يُرسل شيء حتى تفتح الرابط الذي فيه.",
    emailLabel: "عنوان البريد الإلكتروني",
    submit: "أرسل لي الملخص",
    privacy:
      "ما يُحفظ هو العنوان والشبكة واللغة ووقت التأكيد ووقت إرسال آخر ملخص — ولا شيء غير ذلك. الرابط في أسفل كل ملخص يحذفه من هذا الخادم فورًا، ويخرج من النسخ الاحتياطية المشفّرة في غضون سبعة أيام.",
    changeNetwork: "لتغيير الشبكة، أوقف الملخص بالرابط الموجود في أي منها ثم اطلبه من جديد.",
    notConfigured: "الملخص بالبريد الإلكتروني غير مُعدّ على هذا الخادم.",
    homeCta: "استلمه بالبريد الإلكتروني",
    status: {
      sent: "إن لم يكن هذا العنوان مشتركًا بالفعل، فقد أُرسل إليه تأكيد. افتح الرابط الذي فيه خلال يوم واحد؛ لا يُرسل شيء قبل ذلك.",
      invalid: "هذا ليس عنوان بريد إلكتروني.",
      busy: "طلبات كثيرة من هنا الآن. حاول مرة أخرى بعد بضع دقائق.",
      unavailable: "تعذّر حفظ الطلب أو إرسال التأكيد الآن. حاول مرة أخرى بعد دقيقة.",
    },
    confirm: {
      title: "الملخص بالبريد الإلكتروني: تم التأكيد",
      confirmed: (chain) => `تم التأكيد. من يوم الاثنين القادم يصل ملخص ${chain} إلى هذا العنوان.`,
      already: "هذا العنوان مؤكَّد بالفعل. لم يتغيّر شيء.",
      unknown: "هذا الرابط غير معروف أو انتهت صلاحيته. اطلب الملخص من جديد من صفحة الأسبوع.",
      invalid: "هذا الرابط غير صالح.",
      unavailable: "تعذّر تأكيد الاشتراك الآن. افتح الرابط مرة أخرى بعد دقيقة.",
    },
    unsubscribe: {
      title: "إيقاف الملخص بالبريد الإلكتروني",
      ask: "اضغط الزر لإيقاف الملخص إلى هذا العنوان. يُحذف سجله فورًا.",
      button: "أوقف الملخص",
      removed: "تم الإيقاف. حُذف السجل من هذا الخادم، ويخرج من نسخه الاحتياطية المشفّرة في غضون سبعة أيام.",
      unknown: "لم يبقَ شيء محفوظ لهذا الرابط.",
      invalid: "هذا الرابط غير صالح.",
      unavailable: "تعذّر حذف السجل الآن. حاول مرة أخرى بعد دقيقة.",
    },
    mail: {
      confirmSubject: (chain) => `أكّد ملخص يوم الاثنين لشبكة ${chain}`,
      confirmIntro: (chain) =>
        `طلب أحد — نرجو أن يكون أنت — على liquiditywise.com ملخص يوم الاثنين عن المكان الذي انتقل إليه المال الذكي على ${chain}، إلى هذا العنوان. افتح الرابط أدناه للتأكيد؛ يصلح ليوم واحد.`,
      confirmLink: "أكّد الملخص",
      confirmIgnore: "إن لم تكن أنت من طلب، فلا تفعل شيئًا: ينتهي الطلب من تلقاء نفسه خلال يوم ولا يُحفظ شيء.",
      digestPage: "الملخص نفسه كصفحة:",
      unsubscribeLink: "أوقف هذه الرسائل",
    },
  },
  hi: {
    heading: "सारांश ई-मेल से",
    body: "वही सारांश, हर सोमवार 08:00 UTC से आपके इनबॉक्स में, आपके चुने नेटवर्क के लिए — हफ़्ते भर में स्मार्ट पैसा कहाँ खिसका। पहले एक पुष्टि आती है; उसमें दिया लिंक खोले बिना कुछ नहीं भेजा जाता।",
    emailLabel: "ई-मेल पता",
    submit: "मुझे सारांश भेजें",
    privacy:
      "जो रखा जाता है: पता, नेटवर्क, भाषा, पुष्टि कब हुई और आख़िरी सारांश कब गया — और कुछ नहीं। हर सारांश के नीचे दिया लिंक इसे इस सर्वर से तुरंत हटा देता है, और सात दिनों के भीतर यह एन्क्रिप्टेड बैकअप से भी निकल जाता है।",
    changeNetwork: "नेटवर्क बदलने के लिए किसी भी सारांश के लिंक से इसे रोकिए और फिर से माँगिए।",
    notConfigured: "इस सर्वर पर ई-मेल से सारांश सेट नहीं है।",
    homeCta: "ई-मेल से पाइए",
    status: {
      sent: "अगर यह पता पहले से सदस्य नहीं है, तो इस पर एक पुष्टि भेजी गई है। उसमें दिया लिंक एक दिन के भीतर खोलिए; तब तक कुछ नहीं भेजा जाता।",
      invalid: "यह ई-मेल पता नहीं है।",
      busy: "यहाँ से अभी बहुत ज़्यादा अनुरोध आए हैं। कुछ मिनट बाद फिर कोशिश करें।",
      unavailable: "अनुरोध अभी सहेजा नहीं जा सका या पुष्टि भेजी नहीं जा सकी। एक मिनट बाद फिर कोशिश करें।",
    },
    confirm: {
      title: "ई-मेल से सारांश: पुष्टि हो गई",
      confirmed: (chain) => `पुष्टि हो गई। अगले सोमवार से ${chain} का सारांश इस पते पर आएगा।`,
      already: "इस पते की पुष्टि पहले ही हो चुकी थी। कुछ नहीं बदला।",
      unknown: "यह लिंक पहचाना नहीं गया या इसकी अवधि बीत गई। साप्ताहिक पृष्ठ पर सारांश फिर से माँगिए।",
      invalid: "यह लिंक मान्य नहीं है।",
      unavailable: "सदस्यता की पुष्टि अभी नहीं हो सकी। एक मिनट बाद लिंक फिर खोलिए।",
    },
    unsubscribe: {
      title: "ई-मेल से सारांश रोकना",
      ask: "इस पते पर सारांश रोकने के लिए बटन दबाइए। इसका रिकॉर्ड तुरंत हट जाता है।",
      button: "सारांश रोकें",
      removed: "रोक दिया गया। रिकॉर्ड इस सर्वर से हट गया है और सात दिनों के भीतर एन्क्रिप्टेड बैकअप से भी निकल जाएगा।",
      unknown: "इस लिंक के लिए अब कुछ नहीं रखा गया है।",
      invalid: "यह लिंक मान्य नहीं है।",
      unavailable: "रिकॉर्ड अभी हटाया नहीं जा सका। एक मिनट बाद फिर कोशिश करें।",
    },
    mail: {
      confirmSubject: (chain) => `${chain} के सोमवार सारांश की पुष्टि करें`,
      confirmIntro: (chain) =>
        `किसी ने — उम्मीद है आपने — liquiditywise.com पर इस पते के लिए ${chain} पर स्मार्ट पैसा कहाँ खिसका, इसका सोमवार सारांश माँगा। पुष्टि के लिए नीचे का लिंक खोलिए; यह एक दिन तक मान्य है।`,
      confirmLink: "सारांश की पुष्टि करें",
      confirmIgnore: "अगर आपने नहीं माँगा, तो कुछ न करें: अनुरोध एक दिन में अपने आप ख़त्म हो जाता है और कुछ नहीं रखा जाता।",
      digestPage: "वही सारांश पृष्ठ के रूप में:",
      unsubscribeLink: "ये ई-मेल रोकें",
    },
  },
  zh: {
    heading: "通过电子邮件收取摘要",
    body: "同一份摘要，每周一 08:00 UTC 起发到你的收件箱，针对你选择的网络——这一周聪明资金流向了哪里。先会收到一封确认邮件；打开其中的链接之前不会发送任何内容。",
    emailLabel: "电子邮件地址",
    submit: "把摘要发给我",
    privacy:
      "保存的只有：地址、网络、语言、确认时间和上一份摘要的发送时间——别无其他。每份摘要底部的链接会立即把它从本服务器删除，七天内也会从加密备份中消失。",
    changeNetwork: "要更换网络，请用任一摘要中的链接停止订阅，然后重新申请。",
    notConfigured: "本服务器未设置电子邮件摘要。",
    homeCta: "通过电子邮件收取",
    status: {
      sent: "如果该地址尚未订阅，已向它发送了一封确认邮件。请在一天内打开其中的链接；此前不会发送任何内容。",
      invalid: "这不是一个电子邮件地址。",
      busy: "此处的请求暂时过多。请几分钟后再试。",
      unavailable: "暂时无法保存请求或发送确认邮件。请一分钟后再试。",
    },
    confirm: {
      title: "电子邮件摘要：已确认",
      confirmed: (chain) => `已确认。从下周一起，${chain} 的摘要会发到该地址。`,
      already: "该地址早已确认。没有任何改变。",
      unknown: "此链接无法识别或已过期。请在每周页面重新申请摘要。",
      invalid: "此链接无效。",
      unavailable: "暂时无法确认订阅。请一分钟后再打开链接。",
    },
    unsubscribe: {
      title: "停止电子邮件摘要",
      ask: "按下按钮即停止向该地址发送摘要。其记录会立即删除。",
      button: "停止摘要",
      removed: "已停止。记录已从本服务器删除，七天内也会从加密备份中消失。",
      unknown: "此链接已不再保存任何内容。",
      invalid: "此链接无效。",
      unavailable: "暂时无法删除记录。请一分钟后再试。",
    },
    mail: {
      confirmSubject: (chain) => `确认 ${chain} 的周一摘要`,
      confirmIntro: (chain) =>
        `有人——希望是你——在 liquiditywise.com 为此地址申请了关于 ${chain} 上聪明资金流向的周一摘要。请打开下面的链接确认；链接一天内有效。`,
      confirmLink: "确认摘要",
      confirmIgnore: "如果不是你申请的，无需任何操作：请求会在一天内自动失效，不会保存任何内容。",
      digestPage: "同一份摘要的网页版：",
      unsubscribeLink: "停止这些邮件",
    },
  },
  ru: {
    heading: "Сводка по электронной почте",
    body: "Та же сводка, каждый понедельник с 08:00 UTC в вашем почтовом ящике, для выбранной сети — куда за неделю переместились умные деньги. Сначала приходит подтверждение; пока вы не откроете ссылку в нём, ничего не отправляется.",
    emailLabel: "Адрес электронной почты",
    submit: "Присылать мне сводку",
    privacy:
      "Хранятся адрес, сеть, язык, время подтверждения и время отправки последней сводки — и больше ничего. Ссылка внизу каждой сводки сразу удаляет запись с этого сервера, а из зашифрованных резервных копий она исчезает в течение семи дней.",
    changeNetwork: "Чтобы сменить сеть, остановите сводку по ссылке из любой из них и запросите её снова.",
    notConfigured: "Сводка по электронной почте на этом сервере не настроена.",
    homeCta: "Получать по почте",
    status: {
      sent: "Если этот адрес ещё не подписан, на него отправлено подтверждение. Откройте ссылку в нём в течение дня; до этого ничего не отправляется.",
      invalid: "Это не адрес электронной почты.",
      busy: "Отсюда сейчас слишком много запросов. Попробуйте через несколько минут.",
      unavailable: "Сейчас не удалось сохранить запрос или отправить подтверждение. Попробуйте через минуту.",
    },
    confirm: {
      title: "Сводка по электронной почте: подтверждено",
      confirmed: (chain) => `Подтверждено. Со следующего понедельника сводка по сети ${chain} приходит на этот адрес.`,
      already: "Этот адрес уже был подтверждён. Ничего не изменилось.",
      unknown: "Эта ссылка неизвестна или устарела. Запросите сводку снова на недельной странице.",
      invalid: "Эта ссылка недействительна.",
      unavailable: "Сейчас не удалось подтвердить подписку. Откройте ссылку снова через минуту.",
    },
    unsubscribe: {
      title: "Остановить сводку по электронной почте",
      ask: "Нажмите кнопку, чтобы остановить сводку на этот адрес. Запись удаляется сразу.",
      button: "Остановить сводку",
      removed: "Остановлено. Запись удалена с этого сервера и в течение семи дней исчезнет из его зашифрованных резервных копий.",
      unknown: "По этой ссылке больше ничего не хранится.",
      invalid: "Эта ссылка недействительна.",
      unavailable: "Сейчас не удалось удалить запись. Попробуйте через минуту.",
    },
    mail: {
      confirmSubject: (chain) => `Подтвердите понедельничную сводку по сети ${chain}`,
      confirmIntro: (chain) =>
        `Кто-то — надеемся, вы — запросил на liquiditywise.com понедельничную сводку о том, куда переместились умные деньги в сети ${chain}, на этот адрес. Откройте ссылку ниже, чтобы подтвердить; она действует один день.`,
      confirmLink: "Подтвердить сводку",
      confirmIgnore: "Если это были не вы, ничего не делайте: запрос сам истекает в течение дня, и ничего не сохраняется.",
      digestPage: "Та же сводка на сайте:",
      unsubscribeLink: "Остановить эти письма",
    },
  },
  pt: {
    heading: "O resumo por e-mail",
    body: "O mesmo resumo, na sua caixa de entrada toda segunda-feira a partir das 08:00 UTC, para a rede que você escolher — para onde o dinheiro inteligente se moveu na semana. Primeiro chega uma confirmação; nada é enviado até você abrir o link dela.",
    emailLabel: "Endereço de e-mail",
    submit: "Enviar o resumo para mim",
    privacy:
      "O que fica guardado é o endereço, a rede, o idioma, quando foi confirmado e quando saiu o último resumo — nada mais. O link no fim de cada resumo o apaga deste servidor na hora, e ele sai das cópias cifradas em sete dias.",
    changeNetwork: "Para mudar a rede, interrompa o resumo pelo link em qualquer um deles e peça de novo.",
    notConfigured: "O resumo por e-mail não está configurado neste servidor.",
    homeCta: "Receber por e-mail",
    status: {
      sent: "Se esse endereço ainda não estiver inscrito, uma confirmação foi enviada a ele. Abra o link dela em até um dia; até então nada é enviado.",
      invalid: "Isso não é um endereço de e-mail.",
      busy: "Pedidos demais daqui agora. Tente de novo em alguns minutos.",
      unavailable: "Não foi possível guardar o pedido ou enviar a confirmação agora. Tente de novo em um minuto.",
    },
    confirm: {
      title: "O resumo por e-mail: confirmado",
      confirmed: (chain) => `Confirmado. A partir da próxima segunda-feira, o resumo de ${chain} chega a esse endereço.`,
      already: "Esse endereço já estava confirmado. Nada mudou.",
      unknown: "Este link não é conhecido ou expirou. Peça o resumo de novo na página semanal.",
      invalid: "Este link não é válido.",
      unavailable: "Não foi possível confirmar a inscrição agora. Abra o link de novo em um minuto.",
    },
    unsubscribe: {
      title: "Interromper o resumo por e-mail",
      ask: "Aperte o botão para interromper o resumo a este endereço. O registro é apagado na hora.",
      button: "Interromper o resumo",
      removed: "Interrompido. O registro foi apagado deste servidor e sai das suas cópias cifradas em sete dias.",
      unknown: "Nada mais fica guardado para este link.",
      invalid: "Este link não é válido.",
      unavailable: "Não foi possível apagar o registro agora. Tente de novo em um minuto.",
    },
    mail: {
      confirmSubject: (chain) => `Confirme o resumo de segunda-feira para ${chain}`,
      confirmIntro: (chain) =>
        `Alguém — esperamos que você — pediu em liquiditywise.com o resumo de segunda-feira sobre para onde o dinheiro inteligente em ${chain} se moveu, para este endereço. Abra o link abaixo para confirmar; ele vale por um dia.`,
      confirmLink: "Confirmar o resumo",
      confirmIgnore: "Se não foi você, não faça nada: o pedido expira sozinho em um dia e nada fica guardado.",
      digestPage: "O mesmo resumo como página:",
      unsubscribeLink: "Interromper estes e-mails",
    },
  },
  "zh-Hant": {
    heading: "透過電子郵件收取摘要",
    body: "同一份摘要，每週一 08:00 UTC 起寄到你的收件匣，針對你選擇的網路——這一週聰明資金流向了哪裡。會先收到一封確認信；打開其中的連結之前不會寄出任何內容。",
    emailLabel: "電子郵件地址",
    submit: "把摘要寄給我",
    privacy:
      "儲存的只有：地址、網路、語言、確認時間和上一份摘要的寄出時間——別無其他。每份摘要底部的連結會立即把它從本伺服器刪除，七天內也會從加密備份中消失。",
    changeNetwork: "要更換網路，請用任一摘要中的連結停止訂閱，然後重新申請。",
    notConfigured: "本伺服器未設定電子郵件摘要。",
    homeCta: "透過電子郵件收取",
    status: {
      sent: "如果該地址尚未訂閱，已向它寄出一封確認信。請在一天內打開其中的連結；此前不會寄出任何內容。",
      invalid: "這不是一個電子郵件地址。",
      busy: "此處的請求暫時過多。請幾分鐘後再試。",
      unavailable: "暫時無法儲存請求或寄出確認信。請一分鐘後再試。",
    },
    confirm: {
      title: "電子郵件摘要：已確認",
      confirmed: (chain) => `已確認。從下週一起，${chain} 的摘要會寄到該地址。`,
      already: "該地址早已確認。沒有任何改變。",
      unknown: "此連結無法識別或已過期。請在每週頁面重新申請摘要。",
      invalid: "此連結無效。",
      unavailable: "暫時無法確認訂閱。請一分鐘後再打開連結。",
    },
    unsubscribe: {
      title: "停止電子郵件摘要",
      ask: "按下按鈕即停止向該地址寄送摘要。其記錄會立即刪除。",
      button: "停止摘要",
      removed: "已停止。記錄已從本伺服器刪除，七天內也會從加密備份中消失。",
      unknown: "此連結已不再儲存任何內容。",
      invalid: "此連結無效。",
      unavailable: "暫時無法刪除記錄。請一分鐘後再試。",
    },
    mail: {
      confirmSubject: (chain) => `確認 ${chain} 的週一摘要`,
      confirmIntro: (chain) =>
        `有人——希望是你——在 liquiditywise.com 為此地址申請了關於 ${chain} 上聰明資金流向的週一摘要。請打開下面的連結確認；連結一天內有效。`,
      confirmLink: "確認摘要",
      confirmIgnore: "如果不是你申請的，無需任何操作：請求會在一天內自動失效，不會儲存任何內容。",
      digestPage: "同一份摘要的網頁版：",
      unsubscribeLink: "停止這些郵件",
    },
  },
};

export const getEmailDigestCopy = (locale: Locale): EmailDigestCopy => COPY[locale];
