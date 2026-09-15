import { V4PoolIdentity } from "@/components/V4PoolIdentity";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { getEthereumV4Pool } from "@/lib/uniswap/getEthereumV4Pool";

/**
 * Reads one v4 pool.
 *
 * Lives in the route rather than in `src/components`, because it reads data and
 * components there do not.
 */
export async function V4PoolSection({
  poolId,
  locale,
  t,
}: {
  poolId: string;
  locale: Locale;
  t: Dictionary;
}) {
  const result = await getEthereumV4Pool(poolId);

  return <V4PoolIdentity result={result} t={t} locale={locale} />;
}

/** The page's shape while the read is still in flight. */
export function V4PoolPending({ t }: { t: Dictionary }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {t.v4.heading}
      </h2>
      <div className="h-24 animate-pulse rounded-md border border-border" aria-hidden="true" />
    </section>
  );
}
