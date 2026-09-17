import { getRequestDictionary } from "@/lib/i18n/requestLocale";

/**
 * Shown while the week's v4 pools are being read.
 *
 * The read is cached for ten minutes and shared with the v4 search, so most
 * visits are instant and this is never seen. The one that pays for it waits on
 * a subgraph query measured at three to four seconds cold, which is long enough
 * that a blank screen reads as a broken link.
 */
export default async function Loading() {
  const { t } = await getRequestDictionary();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12 sm:py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">{t.hooks.loading}</p>
      <div className="flex flex-col gap-4" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-40 animate-pulse rounded-lg border border-border bg-surface"
          />
        ))}
      </div>
    </main>
  );
}
