"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { InterfaceCopy } from "../lib/i18n/interface";

export function SiteNavigation({
  copy,
}: {
  copy: Pick<InterfaceCopy, "pools" | "positions" | "hooks" | "menu">;
}) {
  const path = usePathname();
  return (
    <nav className="site-nav" aria-label={copy.menu}>
      {[
        ["/pool", copy.pools],
        ["/holdings", copy.positions],
        ["/hooks", copy.hooks],
      ].map(([href, label]) => (
        <Link
          key={href}
          href={href!}
          prefetch={false}
          aria-current={
            path === href || (href === "/pool" && path === "/v4")
              ? "page"
              : undefined
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
