import type { Dictionary } from "../lib/i18n/dictionaries";
import type { PoolSearchRejection } from "../lib/search/poolSearchInput";
import { MAX_SEARCH_TERM_LENGTH, MIN_SEARCH_TERM_LENGTH } from "../schemas";
import { ArrowIcon } from "./BrandMark";
import { CHAINS, type ChainSlug } from "../lib/chains/chains";

/**
 * The one box: a pair to search for, or a pool's own id to go straight to.
 *
 * One field rather than three because a visitor has one thing in mind, and
 * asking them to first classify it — "is what I have an address, a v4 id, or a
 * name?" — is asking them to do work this application can do by looking. What
 * they typed decides which happened, and `readPoolSearchInput` is where that is
 * decided.
 *
 * A plain GET form, so it works with no JavaScript at all. That is also why the
 * page takes its query in the URL rather than in a request body: a search is a
 * place, and a place can be linked to, reloaded and gone back to.
 */

/** A v4 pool id is 66 characters; an address and a two-term search are shorter. */
const MAX_LOOKUP_LENGTH = 66;

const rejectionMessage = (reason: PoolSearchRejection, t: Dictionary): string => {
  switch (reason) {
    case "empty":
      return t.search.rejected.empty;
    case "length":
      return t.search.rejected.length(MIN_SEARCH_TERM_LENGTH, MAX_SEARCH_TERM_LENGTH);
    case "unsupported-characters":
      return t.search.rejected.unsupportedCharacters;
  }
};

export function PoolLookupForm({
  t,
  value,
  rejection,
  network,
}: {
  t: Dictionary;
  /**
   * Which chain the box reads on, as a plain select riding in the same GET
   * form — so a pasted Base address goes to Base. Absent, the box reads
   * mainnet, as it always has.
   */
  network?: { readonly label: string; readonly current: ChainSlug } | undefined;
  /**
   * What to put back in the box. Only ever a value that has already passed
   * validation — what a visitor typed is never echoed as they typed it.
   */
  value?: string | undefined;
  rejection?: PoolSearchRejection | undefined;
}) {
  return (
    <form
      method="get"
      action="/pool"
      className="pool-lookup"
    >
      <label htmlFor="q">
        {t.search.label}
      </label>
      <div className="lookup-row">
        <div className="lookup-input">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="m16 16 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        <input
          id="q"
          name="q"
          type="text"
          required
          spellCheck={false}
          autoComplete="off"
          maxLength={MAX_LOOKUP_LENGTH}
          placeholder={t.search.placeholder}
          defaultValue={value ?? ""}
          aria-describedby={rejection === undefined ? "lookup-help" : "lookup-help lookup-error"}
          aria-invalid={rejection !== undefined || undefined}
        />
        </div>
        <button
          type="submit"
          className="button-primary"
        >
          {t.search.submit}<ArrowIcon />
        </button>
      </div>
      <p id="lookup-help" className="lookup-help">{t.search.help}</p>
      {network === undefined ? null : (
        <p className="lookup-network">
          <label htmlFor="chain">{network.label}</label>
          <select id="chain" name="chain" defaultValue={network.current}>
            {CHAINS.map(({ slug, name }) => (
              <option key={slug} value={slug}>
                {name}
              </option>
            ))}
          </select>
        </p>
      )}
      {rejection === undefined ? null : (
        <p id="lookup-error" role="alert" className="lookup-error">{rejectionMessage(rejection, t)}</p>
      )}
    </form>
  );
}
