import Link from "next/link";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GuardedLink } from "./GuardedLink";

const POOL = `/pool?address=0x${"a".repeat(40)}`;

/*
 * The proxy counts every request for a guarded page and cannot tell a prefetch
 * from a navigation, so the one thing a link to such a page must do is not
 * prefetch. That is a prop on the element, not a mark in the markup, so the
 * element is inspected as well as rendered.
 */
describe("GuardedLink", () => {
  it("is the framework's link with prefetching off, whatever else it was given", () => {
    const element = GuardedLink({ href: POOL, className: "row", children: "USDC / WETH" });

    expect(element.type).toBe(Link);
    expect(element.props).toMatchObject({ href: POOL, className: "row", prefetch: false });
  });

  it("renders as an ordinary anchor to the page", () => {
    const markup = renderToStaticMarkup(<GuardedLink href={POOL}>USDC / WETH</GuardedLink>);

    expect(markup).toContain(`href="${POOL.replace(/&/g, "&amp;")}"`);
    expect(markup).toContain("USDC / WETH");
  });
});
