import { getRequestDictionary } from "@/lib/i18n/requestLocale";

/**
 * Shown while every tier of the pair is being read — up to four full analyses
 * at once, so the page is blocked for a moment longer than a single pool.
 */
export default async function Loading() {
  const { t } = await getRequestDictionary();

  return (
    <main id="main" tabIndex={-1} className="workspace-main flex flex-col gap-8" aria-busy="true">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">{t.pool.loading}</p>
      <div className="flex flex-col gap-4" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-lg border border-border bg-surface"
          />
        ))}
      </div>
    </main>
  );
}
