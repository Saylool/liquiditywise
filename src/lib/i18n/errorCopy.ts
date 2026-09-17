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
};
