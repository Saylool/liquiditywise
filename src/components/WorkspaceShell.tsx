import Link from "next/link";
import type { Dictionary } from "../lib/i18n/dictionaries";
import { localePath } from "../lib/i18n/localePath";
import type { Locale } from "../lib/i18n/locales";
import { getInterfaceCopy } from "../lib/i18n/interface";
import { EducationalDisclaimer } from "./EducationalDisclaimer";

/**
 * A page's heading is its navigation item's name, or — for a page the
 * navigation does not list — a heading of its own.
 */
type Heading =
  | { readonly section: "pools" | "positions" | "hooks"; readonly heading?: never }
  | { readonly section?: never; readonly heading: string };

export function WorkspaceShell({
  locale,
  t,
  section,
  heading,
  children,
  network,
}: {
  locale: Locale;
  t: Dictionary;
  children: React.ReactNode;
  /** The network the page reads, for the chip beside the heading; mainnet when not said. */
  network?: string | undefined;
} & Heading) {
  const copy = getInterfaceCopy(locale);
  return (
    <main id="main" tabIndex={-1} className="workspace-main">
      <div className="workspace-heading">
        <div>
          <Link href={localePath(locale, "/")} prefetch={false} className="eyebrow workspace-back">
            {t.pool.back}
          </Link>
          <h1>{section === undefined ? heading : copy[section]}</h1>
        </div>
        <span className="network-chip">
          <i className="status-dot" />
          {network ?? copy.chain}
        </span>
      </div>
      <div className="workspace-content">{children}</div>
      <EducationalDisclaimer t={t} />
    </main>
  );
}
