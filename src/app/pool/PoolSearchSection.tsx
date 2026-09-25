import { PoolSearchResults } from "@/components/PoolSearchResults";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { getEthereumV3PoolSearch } from "@/lib/uniswap/getEthereumV3PoolSearch";
import type { ChainId } from "@/lib/chains/chains";

/**
 * Runs one search.
 *
 * Lives in the route rather than in `src/components`, because it reads data and
 * components there do not. Rendered inside a `<Suspense>` boundary so the search
 * box comes back the moment it is submitted: a search now asks the chain what
 * each candidate pool holds, which is the figure the order rests on and several
 * batched calls to obtain.
 */
export async function PoolSearchSection({
  terms,
  chainId = 1,
  locale,
  t,
}: {
  terms: readonly string[];
  /** The chain to search; mainnet when not said. */
  chainId?: ChainId;
  locale: Locale;
  t: Dictionary;
}) {
  const result = await getEthereumV3PoolSearch(terms, chainId);

  return <PoolSearchResults result={result} terms={terms} chainId={chainId} t={t} locale={locale} />;
}
