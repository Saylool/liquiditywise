import { AddressHoldings } from "@/components/AddressHoldings";
import { getAddressHoldings } from "@/lib/advisor/getAddressHoldings";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { EvmAddress, PriceBandParameters } from "@/schemas";
import type { ChainId } from "@/lib/chains/chains";

/**
 * Reads one address's holdings.
 *
 * Lives in the route rather than in `src/components`, because it reads data and
 * components there do not. Rendered inside a `<Suspense>` boundary and never
 * awaited by the page, for the usual reason and one of its own: this is the
 * slowest read here, and the disclaimer above it should not wait on a sweep of
 * contract calls.
 */
export async function HoldingsSection({
  address,
  chainId = 1,
  parameters,
  locale,
  t,
}: {
  address: EvmAddress;
  /** The chain to read the address on; mainnet when not said. */
  chainId?: ChainId;
  parameters: PriceBandParameters;
  locale: Locale;
  t: Dictionary;
}) {
  const result = await getAddressHoldings(address, chainId);

  return (
    <AddressHoldings
      result={result}
      parameters={parameters}
      chainId={chainId}
      t={t}
      locale={locale}
    />
  );
}

/** The panel's shape while the sweep is still running. */
export function HoldingsPending({ t }: { t: Dictionary }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {t.holdings.heading}
      </h2>
      <div className="h-24 animate-pulse rounded-md border border-border" aria-hidden="true" />
    </section>
  );
}
