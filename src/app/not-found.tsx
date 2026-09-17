import Link from "next/link";

import { PreferenceBar } from "@/components/PreferenceBar";
import { getRequestDictionary } from "@/lib/i18n/requestLocale";

/**
 * The page a reader reaches by following something that is not here.
 *
 * The framework answers a missing route with an unstyled English line, which on
 * a site published in two languages is the one screen that forgets which it is
 * in. This one is the site: the reader's language, the reader's theme, and a
 * way back that is a link rather than a suggestion to press the back button.
 *
 * It says where a pool address actually goes, because the likeliest way to
 * arrive here is putting one in the path.
 */
export default async function NotFound() {
  const { locale, t } = await getRequestDictionary();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12 sm:py-16">
      <PreferenceBar locale={locale} t={t} />

      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{t.notFound.title}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">{t.notFound.body}</p>
        <Link
          href="/pool"
          className="w-fit rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium"
        >
          {t.notFound.search}
        </Link>
      </section>
    </main>
  );
}
