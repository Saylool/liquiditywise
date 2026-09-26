import { AddressPositions } from "@/components/AddressPositions";
import { getAddressPositions } from "@/lib/advisor/getAddressPositions";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { EvmAddress, PriceBandParameters } from "@/schemas";
import type { ChainId } from "@/lib/chains/chains";

/**
 * Reads the positions one address already holds.
 *
 * Lives in the route because it reads data, and streams in its own boundary
 * beside the holdings sweep rather than behind it. The two answer different
 * questions from different places — this one asks a contract what an address
 * owns, the other asks a few hundred token contracts what it holds — and
 * neither should wait on the other. This is the shorter of the two, so it is
 * usually the one that arrives first.
 */
export async function PositionsSection({
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
  return (
    <AddressPositions
      result={await getAddressPositions(address, chainId)}
      parameters={parameters}
      t={t}
      locale={locale}
    />
  );
}

/** The panel's shape while the contract is being asked. */
export function PositionsPending({ t }: { t: Dictionary }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {t.positions.heading}
      </h2>
      <div className="h-20 animate-pulse rounded-md border border-border" aria-hidden="true" />
    </section>
  );
}
