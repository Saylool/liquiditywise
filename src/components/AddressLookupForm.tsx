import type { InterfaceCopy } from "../lib/i18n/interface";
import { ArrowIcon } from "./BrandMark";

export function AddressLookupForm({ copy }: { copy: InterfaceCopy }) {
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
    </form>
  );
}
