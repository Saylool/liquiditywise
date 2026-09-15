import { V4PoolSearchResults } from "@/components/V4PoolSearchResults";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { getEthereumV4PoolSearch } from "@/lib/uniswap/getEthereumV4PoolSearch";

/**
 * Runs the v4 half of one search.
 *
 * Its own boundary rather than a second await inside the v3 section, so each
 * list is sent the moment it exists. The two searches go to different subgraphs
 * and then to different contracts, and neither should wait for the other.
 */
export async function V4PoolSearchSection({
  terms,
  locale,
  t,
}: {
  terms: readonly string[];
  locale: Locale;
  t: Dictionary;
}) {
  const result = await getEthereumV4PoolSearch(terms);

  return <V4PoolSearchResults result={result} terms={terms} t={t} locale={locale} />;
}
