import { type Chain, CHAINS, ETHEREUM } from "../lib/chains/chains";

/**
 * One page per chain, reached by a tab for each: the same address with
 * `?chain=`, so the chain is in the link a reader shares. Mainnet's tab is the
 * page's own address, as every link published before other chains was.
 *
 * Plain links rather than the router's, so none prefetches (see
 * linksNeverPrefetch.test.ts).
 */
export function ChainTabs({
  current,
  pageHref,
  label,
  chains = CHAINS,
}: {
  current: Chain;
  /** The page's own address in the reader's language. */
  pageHref: string;
  /** What the tabs are called for a screen reader. */
  label: string;
  /** The chains the page is read on; every chain unless said. */
  chains?: readonly Chain[];
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {chains.map((chain) => (
        <a
          key={chain.slug}
          href={chain.id === ETHEREUM.id ? pageHref : `${pageHref}?chain=${chain.slug}`}
          aria-current={chain.id === current.id ? "page" : undefined}
          className={`rounded-full border px-3 py-1 text-xs ${
            chain.id === current.id ? "border-accent text-accent" : "border-border text-muted hover:text-foreground"
          }`}
        >
          {chain.name}
        </a>
      ))}
    </nav>
  );
}
