import type { InterfaceCopy } from "../lib/i18n/interface";
import { ArrowIcon } from "./BrandMark";
import { CHAINS, type ChainSlug } from "../lib/chains/chains";

/**
 * The address box, with the network it is read on as a select in the same
 * GET form — one address holds different things on every chain. Absent, it
 * reads mainnet.
 */
export function AddressLookupForm({
  copy,
  network,
}: {
  copy: InterfaceCopy;
  network?: { readonly label: string; readonly current: ChainSlug } | undefined;
}) {
  return (
    <form action="/holdings" method="get" className="address-lookup">
      <label htmlFor="wallet-address">{copy.addressLabel}</label>
      <div>
        <input
          id="wallet-address"
          name="address"
          type="text"
          required
          pattern="0x[0-9a-fA-F]{40}"
          maxLength={42}
          placeholder="0x…"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="button-primary">
          {copy.addressAction}
          <ArrowIcon />
        </button>
      </div>
      {network === undefined ? null : (
        <p className="lookup-network">
          <label htmlFor="address-chain">{network.label}</label>
          <select id="address-chain" name="chain" defaultValue={network.current}>
            {CHAINS.map(({ slug, name }) => (
              <option key={slug} value={slug}>
                {name}
              </option>
            ))}
          </select>
        </p>
      )}
    </form>
  );
}
