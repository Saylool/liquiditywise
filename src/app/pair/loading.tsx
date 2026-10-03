import { getPairPoolsCopy } from "@/lib/i18n/pairPoolsCopy";
import { getRequestDictionary } from "@/lib/i18n/requestLocale";

/**
 * Shown while every network is read — two searches, two day tables and a
 * price on each of six, at once. Most of it is usually kept from a minute
 * ago; a pair nobody has asked about waits on the slowest network's search.
 */
export default async function Loading() {
  const { locale } = await getRequestDictionary();

  return (
    <main id="main" tabIndex={-1} className="workspace-main flex flex-col gap-8" aria-busy="true">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">{getPairPoolsCopy(locale).loading}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="h-44 animate-pulse rounded-xl border border-border bg-surface" />
        ))}
      </div>
    </main>
  );
}
