import type { Chain } from "../lib/chains/chains";
import { embedDataUrl, embedSnippet } from "../lib/embed/embedLinks";
import { getEmbedCopy } from "../lib/i18n/embedCopy";
import type { Locale } from "../lib/i18n/locales";

/**
 * The offer, at the end of a pool's page, to show this pool's card on
 * somebody else's site: the frame to paste, and the same figures as JSON.
 *
 * A `<details>` with the snippet in a read-only box, so it works with no
 * script at all — opening it is the browser's, and copying is selecting what
 * is in the box. Folded away, because it is for the few readers who run a
 * site, and the page above it is for everyone.
 *
 * The frame is offered in the reader's language, which is the language they
 * are reading this in; the card says which horizon and width it was drawn for,
 * whatever this page was set to.
 */
export function EmbedPoolSnippet({
  protocol,
  poolId,
  chain,
  pair,
  hookMayAlterSwaps,
  locale,
}: {
  protocol: "v3" | "v4";
  /** The pool's address or v4 id, as the page validated it. */
  poolId: string;
  chain: Chain;
  /** "WETH / USDC", for the frame's title. */
  pair: string;
  /** Whether the card will carry the hook note, which makes it taller. */
  hookMayAlterSwaps: boolean;
  locale: Locale;
}) {
  const copy = getEmbedCopy(locale);
  const request = { protocol, chain, poolId };

  return (
    <details className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <summary className="cursor-pointer text-sm font-semibold uppercase tracking-widest text-muted">
        {copy.summary}
      </summary>
      <div className="mt-3 flex min-w-0 flex-col gap-3">
        <p className="text-sm leading-relaxed text-muted">{copy.intro}</p>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-muted">
          {copy.codeLabel}
          <textarea
            readOnly
            rows={4}
            spellCheck={false}
            defaultValue={embedSnippet(request, pair, hookMayAlterSwaps, locale)}
            className="w-full min-w-0 resize-none rounded-md border border-border bg-surface-sunken p-3 font-mono text-xs text-foreground"
          />
        </label>
        <p className="text-xs leading-relaxed text-muted">{copy.data}</p>
        <p className="break-all font-mono text-xs">{embedDataUrl(request)}</p>
      </div>
    </details>
  );
}
