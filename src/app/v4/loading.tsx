import { getRequestDictionary } from "@/lib/i18n/requestLocale";

/**
 * Shown while a v4 pool is being read.
 *
 * The route blocks on more than the v3 one does: the pool itself comes from the
 * indexer, its key from the log that created it and its fee from the
 * PoolManager's own storage, and the analysis behind it needs two more reads
 * again. Without this the browser sits on the previous screen with nothing to
 * show that a click did anything — which it now does more than it used to,
 * because links into this page are deliberately not prefetched.
 */
export default async function Loading() {
  const { t } = await getRequestDictionary();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12 sm:py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">{t.v4.loading}</p>
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
