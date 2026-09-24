import { getMostTradedCopy } from "@/lib/i18n/mostTradedCopy";
import { getRequestDictionary } from "@/lib/i18n/requestLocale";

/**
 * Shown while the week's pools are read — rarely: the read is shared for ten
 * minutes, and only the visit that pays for it waits on two day tables and a
 * chain read, a few seconds that would otherwise be a blank screen.
 */
export default async function Loading() {
  const { locale } = await getRequestDictionary();

  return (
    <main id="main" tabIndex={-1} className="workspace-main flex flex-col gap-8" aria-busy="true">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">{getMostTradedCopy(locale).loading}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="h-44 animate-pulse rounded-xl border border-border bg-surface" />
        ))}
      </div>
    </main>
  );
}
