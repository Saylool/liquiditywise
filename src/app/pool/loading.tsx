import { getRequestDictionary } from "@/lib/i18n/requestLocale";

/**
 * Shown while the page's reads are in flight.
 *
 * The route serves both of the things this page does — a search and an analysis
 * — and cannot tell which is running, so it says what is true of both: live
 * Uniswap data is being read. It said "pool data" until a search sat under it
 * for three seconds saying something that was not quite the case.
 *
 * An analysis needs three concurrent subgraph reads and one `eth_call`, and a
 * search one query, so the page is genuinely blocked for a moment either way.
 * Without this the browser shows the previous screen with no sign that anything
 * is happening.
 */
export default async function Loading() {
  const { t } = await getRequestDictionary();

  return (
    <main id="main" tabIndex={-1} className="workspace-main flex flex-col gap-8" aria-busy="true">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">{t.pool.loading}</p>
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
