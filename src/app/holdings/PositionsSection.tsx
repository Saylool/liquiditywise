import { AddressPositions } from "@/components/AddressPositions";
import { getAddressPositions } from "@/lib/advisor/getAddressPositions";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { EvmAddress, PriceBandParameters } from "@/schemas";

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
  parameters,
  locale,
  t,
}: {
  address: EvmAddress;
  parameters: PriceBandParameters;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <AddressPositions
      result={await getAddressPositions(address)}
      parameters={parameters}
      t={t}
      locale={locale}
    />
  );
}

/** The panel's shape while the contract is being asked. */
export function PositionsPending({ t }: { t: Dictionary }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
        {t.positions.heading}
      </h2>
      <div className="h-20 animate-pulse rounded-md border border-border" aria-hidden="true" />
    </section>
  );
}
