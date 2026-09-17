import { PoolFeeTiers } from "@/components/PoolFeeTiers";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { getEthereumV3PairFeeTiers } from "@/lib/uniswap/getEthereumV3PairFeeTiers";
import { getEthereumV4PairPools } from "@/lib/uniswap/getEthereumV4PairPools";
import type { PriceBandParameters, V3PoolMetadata } from "@/schemas";

/**
 * Reads the other fee tiers of one finished analysis's pair, and the same pair
 * on v4.
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
  depositUsd,
  locale,
  t,
}: {
  pool: V3PoolMetadata;
  parameters: PriceBandParameters;
  /** Carried into the links out, so a chosen size survives leaving this pool. */
  depositUsd: number;
  locale: Locale;
  t: Dictionary;
}) {
  /*
   * Both protocols at once. The v4 list is the same two token contracts on v4
   * — wrapped ether stays wrapped ether — and no entry there is the pool being
   * read, which the `null` says.
   */
  const [result, v4Result] = await Promise.all([
    getEthereumV3PairFeeTiers(pool),
    getEthereumV4PairPools({
      analysedPoolId: null,
      token0Address: pool.token0.address,
      token1Address: pool.token1.address,
    }),
  ]);

  return (
    <PoolFeeTiers
      result={result}
      v4Result={v4Result}
      pair={`${pool.token0.symbol} / ${pool.token1.symbol}`}
      parameters={parameters}
      depositUsd={depositUsd}
      t={t}
      locale={locale}
    />
  );
}
