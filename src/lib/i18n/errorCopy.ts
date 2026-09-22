import type { Locale } from "./locales";

/*
 * The only part of the interface's copy that a Client Component needs.
 *
 * It lives here rather than inside `dictionaries.ts` because of who imports it.
 * An error boundary has to be a Client Component — the framework requires it —
 * and a Client Component that imported the dictionary would put both languages
 * of every string in this application into the browser's bundle, on every page,
 * to render a screen almost nobody ever sees.
 *
 * It is not a second copy of anything. `dictionaries.ts` imports this module and
 * serves it as `t.error`, so there is one source for these sentences, the
 * translation check walks them with all the others, and the layout can hand the
 * reader's own language to the boundary as an ordinary prop.
 */

export type ErrorCopy = {
  /** When a page below the layout threw: the layout, and its language, survive. */
  readonly title: string;
  readonly body: string;
  readonly nothingKept: string;
  readonly retry: string;
  readonly home: string;
  readonly referenceLabel: string;
  readonly referenceNote: string;
  /**
   * When the layout itself threw, and the document is being written from
   * scratch: no styles, no fonts, no theme, and no way to know which language
   * the reader came for. Both are shown, so these two carry their own wording.
   */
  readonly globalTitle: string;
  readonly globalBody: string;
};

export const ERROR_COPY: Record<Locale, ErrorCopy> = {
  en: {
    title: "This page could not be read",
    body: "Something failed in a way this application has no message for. That is a fault here or in one of the sources it reads — not something you did — and the same page may well work on a second attempt.",
    nothingKept:
      "Nothing was saved. There is no account here and no record of what anyone looks up, so there is nothing of yours to have been lost.",
    retry: "Try again",
    home: "Back to the start",
    referenceLabel: "Identifier",
    referenceNote: "Names this failure in the server's log. It says nothing about you.",
    globalTitle: "Something went wrong",
    globalBody:
      "The page could not be built at all, so this screen does not know which language you read it in.",
  },
  tr: {
    title: "Bu sayfa okunamadı",
    body: "Bir şey, bu uygulamanın karşılığında söyleyecek sözü olmayan bir biçimde başarısız oldu. Bu ya buradaki ya da okuduğu kaynaklardan birindeki bir arıza — senin yaptığın bir şey değil — ve aynı sayfa ikinci denemede pekâlâ açılabilir.",
    nothingKept:
      "Hiçbir şey kaydedilmedi. Burada hesap yok ve kimin neye baktığının kaydı tutulmuyor; yani kaybolmuş bir şeyin de yok.",
    retry: "Yeniden dene",
    home: "Başa dön",
    referenceLabel: "Tanımlayıcı",
    referenceNote:
      "Bu arızayı sunucunun kaydında adlandırır. Senin hakkında hiçbir şey söylemez.",
    globalTitle: "Bir şeyler ters gitti",
    globalBody:
      "Sayfa hiç kurulamadı; bu yüzden bu ekran hangi dilde okuduğunu bilmiyor.",
  },
  de: {
    title: "Diese Seite konnte nicht gelesen werden",
    body: "Etwas ist auf eine Weise fehlgeschlagen, für die diese Anwendung keine Meldung hat. Das ist ein Fehler hier oder in einer der Quellen, die sie liest — nichts, was Sie getan haben — und dieselbe Seite funktioniert beim zweiten Versuch womöglich.",
    nothingKept:
      "Es wurde nichts gespeichert. Es gibt hier kein Konto und keine Aufzeichnung darüber, was jemand nachschlägt; es kann Ihnen also nichts verloren gegangen sein.",
    retry: "Erneut versuchen",
    home: "Zurück zum Anfang",
    referenceLabel: "Kennung",
    referenceNote: "Benennt diesen Fehler im Protokoll des Servers. Über Sie sagt sie nichts aus.",
    globalTitle: "Etwas ist schiefgelaufen",
    globalBody:
      "Die Seite konnte überhaupt nicht aufgebaut werden, daher weiß dieser Bildschirm nicht, in welcher Sprache Sie sie gelesen haben.",
  },
  es: {
    title: "No se pudo leer esta página",
    body: "Algo falló de una forma para la que esta aplicación no tiene mensaje. Es un fallo de aquí o de alguna de las fuentes que consulta —no algo que usted haya hecho— y es muy posible que la misma página funcione en un segundo intento.",
    nothingKept:
      "No se guardó nada. Aquí no hay cuentas ni registro de lo que nadie consulta, así que no hay nada suyo que se haya podido perder.",
    retry: "Intentar de nuevo",
    home: "Volver al inicio",
    referenceLabel: "Identificador",
    referenceNote: "Nombra este fallo en el registro del servidor. No dice nada sobre usted.",
    globalTitle: "Algo salió mal",
    globalBody:
      "La página no pudo construirse en absoluto, así que esta pantalla no sabe en qué idioma la estaba leyendo.",
  },
  ar: {
    title: "تعذّرت قراءة هذه الصفحة",
    body: "أخفق شيء بطريقة لا يملك هذا التطبيق رسالة لها. هذا خلل هنا أو في أحد المصادر التي يقرأها — وليس شيئًا فعلته أنت — وقد تعمل الصفحة نفسها في محاولة ثانية.",
    nothingKept:
      "لم يُحفظ شيء. لا توجد هنا حسابات ولا سجل لما يبحث عنه أحد، فليس هناك شيء يخصّك ليضيع.",
    retry: "حاول مرة أخرى",
    home: "العودة إلى البداية",
    referenceLabel: "المعرّف",
    referenceNote: "يسمّي هذا الخلل في سجل الخادم، ولا يقول عنك شيئًا.",
    globalTitle: "حدث خطأ ما",
    globalBody:
      "تعذّر بناء الصفحة أصلًا، لذا لا تعرف هذه الشاشة بأي لغة كنت تقرأها.",
  },
  hi: {
    title: "यह पृष्ठ पढ़ा नहीं जा सका",
    body: "कुछ इस तरह विफल हुआ कि इस ऐप्लिकेशन के पास उसके लिए कोई संदेश नहीं है। यह यहाँ की, या इसके पढ़े जाने वाले स्रोतों में से किसी एक की खराबी है — आपकी कोई गलती नहीं — और वही पृष्ठ दूसरी बार में चल भी सकता है।",
    nothingKept:
      "कुछ भी सहेजा नहीं गया। यहाँ कोई खाता नहीं है और कौन क्या देखता है इसका कोई रिकॉर्ड नहीं रखा जाता, इसलिए आपका खोने के लिए कुछ था ही नहीं।",
    retry: "फिर से कोशिश करें",
    home: "शुरुआत पर लौटें",
    referenceLabel: "पहचानकर्ता",
    referenceNote: "यह इस खराबी को सर्वर के लॉग में नाम देता है। आपके बारे में यह कुछ नहीं बताता।",
    globalTitle: "कुछ गड़बड़ हो गई",
    globalBody:
      "पृष्ठ बन ही नहीं सका, इसलिए यह स्क्रीन नहीं जानती कि आप उसे किस भाषा में पढ़ रहे थे।",
  },
  zh: {
    title: "无法读取此页面",
    body: "有些东西以本应用无从说明的方式失败了。这是这里、或它所读取的某个来源的故障——不是你做错了什么——同一个页面再试一次很可能就能打开。",
    nothingKept:
      "没有保存任何东西。这里没有账户，也不记录任何人查询了什么，所以没有属于你的东西会丢失。",
    retry: "重试",
    home: "返回起点",
    referenceLabel: "标识符",
    referenceNote: "它在服务器日志中标识这次故障，不会透露关于你的任何信息。",
    globalTitle: "出了点问题",
    globalBody: "页面完全没能构建出来，因此这个界面不知道你是用哪种语言阅读的。",
  },
  ru: {
    title: "Эту страницу не удалось прочитать",
    body: "Что-то сломалось так, что у этого приложения нет для этого сообщения. Это сбой здесь или в одном из источников, которые оно читает, — не то, что сделали вы, — и та же страница вполне может открыться со второй попытки.",
    nothingKept:
      "Ничего не сохранено. Здесь нет учётных записей и нет записи о том, кто что смотрел, так что ничего вашего пропасть не могло.",
    retry: "Попробовать снова",
    home: "Вернуться к началу",
    referenceLabel: "Идентификатор",
    referenceNote: "Называет этот сбой в журнале сервера. О вас он не говорит ничего.",
    globalTitle: "Что-то пошло не так",
    globalBody:
      "Страницу не удалось собрать вообще, поэтому этот экран не знает, на каком языке вы её читали.",
  },
};
