import { PoolFeeTiers } from "@/components/PoolFeeTiers";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { getEthereumV3PairFeeTiers } from "@/lib/uniswap/getEthereumV3PairFeeTiers";
import type { PriceBandParameters, V3PoolMetadata } from "@/schemas";

/**
 * Reads the other fee tiers of one finished analysis's pair.
 *
 * Lives in the route rather than in `src/components`, because it reads data and
 * components there do not. Rendered inside a `<Suspense>` boundary and never
 * awaited by the page, for a reason the explanation shares and this one adds to:
 * the figures above are the answer the reader asked for, and one more request —
 * to a source that can be slow or refuse — must never be what holds them back.
 *
 * It runs only for an analysis that succeeded. The pair comes from a pool this
 * application verified, which is also what guarantees the two token addresses
 * are in the order the source stores them in.
 */
export async function PoolFeeTiersSection({
  pool,
  parameters,
  locale,
  t,
}: {
  pool: V3PoolMetadata;
  parameters: PriceBandParameters;
  locale: Locale;
  t: Dictionary;
}) {
  const result = await getEthereumV3PairFeeTiers(pool);

  return (
    <PoolFeeTiers
      result={result}
      pair={`${pool.token0.symbol} / ${pool.token1.symbol}`}
      parameters={parameters}
      t={t}
      locale={locale}
    />
  );
}
