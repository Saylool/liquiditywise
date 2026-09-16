import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * A link to a page the proxy counts against a visitor's allowance: a pool, a
 * v4 pool or an address, with the parameter that makes it one.
 *
 * Never prefetched. The router prefetches every link that scrolls into view,
 * and a prefetch of one of these pages is counted as a request: the proxy
 * cannot tell a prefetch from a navigation, because the framework strips the
 * router's own headers before the proxy runs — and there is nothing in the
 * prefetch worth paying for, since a page rendered per request is prefetched
 * only down to its loading skeleton. Measured on the deployed application: a
 * prefetch of the holdings page is 379 bytes with no lookup in it. A list of
 * twelve pools cost a visitor twelve of their ten requests before they had
 * clicked on one, and the click was refused.
 *
 * So these links are followed, not prefetched, and the click costs the one
 * request it should. The loading skeleton still appears the moment the page
 * starts to stream.
 */
export const GuardedLink = (props: Omit<ComponentProps<typeof Link>, "prefetch">) => (
  <Link {...props} prefetch={false} />
);
