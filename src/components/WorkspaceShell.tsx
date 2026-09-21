import Link from "next/link";
import type { Dictionary } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/locales";
import { getInterfaceCopy } from "../lib/i18n/interface";
import { EducationalDisclaimer } from "./EducationalDisclaimer";

export function WorkspaceShell({
  locale,
  t,
  section,
  children,
}: {
  locale: Locale;
  t: Dictionary;
  section: "pools" | "positions" | "hooks";
  children: React.ReactNode;
}) {
  const copy = getInterfaceCopy(locale);
  return (
    <main id="main" tabIndex={-1} className="workspace-main">
      <div className="workspace-heading">
        <div>
          <Link href="/" className="eyebrow workspace-back">
            {t.pool.back}
          </Link>
          <h1>{copy[section]}</h1>
        </div>
        <span className="network-chip">
          <i className="status-dot" />
          {copy.chain}
        </span>
      </div>
      <div className="workspace-content">{children}</div>
      <EducationalDisclaimer t={t} />
    </main>
  );
}
