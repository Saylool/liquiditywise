import { getSmartLiquidityCopy } from "@/lib/i18n/smartLiquidityCopy";
import { getRequestDictionary } from "@/lib/i18n/requestLocale";

/**
 * Shown while the positions are measured — rarely: the figures are kept for
 * hours and read anew by the warmer, so only a visit that finds none waits on
 * a dozen pools' reads.
 */
export default async function Loading() {
  const { locale } = await getRequestDictionary();

  return (
    <main id="main" tabIndex={-1} className="workspace-main flex flex-col gap-8" aria-busy="true">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">{getSmartLiquidityCopy(locale).loading}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="h-44 animate-pulse rounded-xl border border-border bg-surface" />
        ))}
      </div>
    </main>
  );
}
