import { AddressPositions } from "@/components/AddressPositions";
import { getAddressPositions } from "@/lib/advisor/getAddressPositions";
import { getPositionOutlooks } from "@/lib/advisor/getPositionOutlooks";
import { peekSmartLiquidity } from "@/lib/advisor/getSmartLiquidity";
import { smartRangesByPool } from "@/lib/advisor/smartRanges";
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
  /* With the v3 histories, for the record under each position; the alert check reads without them. */
  const result = await getAddressPositions(address, chainId, { history: true });
  /* Each open position against its pool's last days, from the histories the pool pages already read. */
  const outlooks = result.status === "success" ? await getPositionOutlooks(result.data.positions, parameters) : new Map();

  /* Only what the six-hourly measurement has already kept: this page never waits for it. */
  const smartRanges = smartRangesByPool(peekSmartLiquidity(chainId));

  return (
    <AddressPositions
      result={result}
      outlooks={outlooks}
      smartRanges={smartRanges}
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
