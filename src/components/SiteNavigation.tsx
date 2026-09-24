"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { InterfaceCopy } from "../lib/i18n/interface";
import { splitLocalePath } from "../lib/i18n/localePath";

/**
 * The hook directory is an open page, so it is linked at the reader's
 * language's own address — handed down from the server, which knows the
 * language. Which item is current is read from the page, not the address, so
 * /hooks and /tr/hooks both mark the same one.
 */
export function SiteNavigation({
  hooksHref,
  copy,
}: {
  hooksHref: string;
  copy: Pick<InterfaceCopy, "pools" | "positions" | "hooks" | "menu">;
}) {
  const address = usePathname();
  const path = splitLocalePath(address)?.path ?? address;
  return (
    <nav className="site-nav" aria-label={copy.menu}>
      {[
        ["/pool", "/pool", copy.pools],
        ["/holdings", "/holdings", copy.positions],
        ["/hooks", hooksHref, copy.hooks],
      ].map(([page, href, label]) => (
        <Link
          key={page}
          href={href!}
          prefetch={false}
          aria-current={
            path === page || (page === "/pool" && path === "/v4")
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
