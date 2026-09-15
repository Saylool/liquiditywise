import { V4PairPanel } from "@/components/V4PairPanel";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { getEthereumV3PoolsOfPair } from "@/lib/uniswap/getEthereumV3PairFeeTiers";
import { getEthereumV4PairPools } from "@/lib/uniswap/getEthereumV4PairPools";
import { type PriceBandParameters, type V4Pool, ZERO_ADDRESS } from "@/schemas";

/**
 * Reads where one v4 pool's pair trades: its v4 siblings, and the same two
 * token contracts on v3.
 *
 * Lives in the route because it reads data. Rendered inside a `<Suspense>`
 * boundary and never awaited by the page: the figures above are the answer,
 * and two more requests must never hold them back.
 *
 * The v3 question is not asked for a pair holding native ether. v3 has no
 * native currency, so the zero address is not a token it could be asked about
 * — the reader is told why, rather than shown an empty list that would read as
 * "the pair does not trade on v3".
 */
export async function V4PairSection({
  pool,
  parameters,
  locale,
  t,
}: {
  pool: V4Pool;
  parameters: PriceBandParameters;
  locale: Locale;
  t: Dictionary;
}) {
  const pair = {
    token0Address: pool.token0.address,
    token1Address: pool.token1.address,
  };
  const [v4Result, v3Result] = await Promise.all([
    getEthereumV4PairPools({ analysedPoolId: pool.id, ...pair }),
    pool.token0.address === ZERO_ADDRESS
      ? Promise.resolve(null)
      : getEthereumV3PoolsOfPair({ analysedPoolId: null, ...pair }),
  ]);

  return (
    <V4PairPanel
      v4Result={v4Result}
      v3Result={v3Result}
      pair={`${pool.token0.symbol} / ${pool.token1.symbol}`}
      token0Address={pool.token0.address}
      parameters={parameters}
      t={t}
      locale={locale}
    />
  );
}
