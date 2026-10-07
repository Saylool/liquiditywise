import { getRequestDictionary } from "@/lib/i18n/requestLocale";
import { getWeeklyCopy } from "@/lib/i18n/weeklyCopy";

/**
 * Shown while the kept series is read — one key from the store, so briefly.
 */
export default async function Loading() {
  const { locale } = await getRequestDictionary();

  return (
    <main id="main" tabIndex={-1} className="workspace-main flex flex-col gap-8" aria-busy="true">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">{getWeeklyCopy(locale).loading}</p>
      <div className="flex flex-col gap-3" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-6 max-w-2xl animate-pulse rounded border border-border bg-surface" />
        ))}
      </div>
    </main>
  );
}
