import { getRequestDictionary } from "@/lib/i18n/requestLocale";

/**
 * Shown while an address is being looked up.
 *
 * The slowest first read on the site: two pool lists, and then one call that
 * asks a few hundred token contracts what this address holds. A reader who has
 * just pasted an address is the most likely of all to think nothing happened.
 */
export default async function Loading() {
  const { t } = await getRequestDictionary();

  return (
    <main id="main" tabIndex={-1} className="workspace-main flex flex-col gap-8" aria-busy="true">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">{t.holdings.loading}</p>
      <div className="flex flex-col gap-4" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-lg border border-border bg-surface"
          />
        ))}
      </div>
    </main>
  );
}
