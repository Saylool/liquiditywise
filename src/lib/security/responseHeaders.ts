/*
 * The headers every response carries, set in next.config.ts.
 *
 * Each one closes something a browser would otherwise allow, and none of them
 * changes what the page does:
 *
 *  - HSTS, for a year, on this host only. No `includeSubDomains` or `preload`:
 *    those bind names this application does not serve, and preload cannot be
 *    taken back quickly.
 *  - No framing, by anyone, in both spellings: `frame-ancestors` for browsers
 *    that read CSP, `X-Frame-Options` for those that do not. A page that asks
 *    a reader to connect a wallet is exactly the page a clickjacker would put
 *    under an invisible frame. One page is the exception, below.
 *  - No content sniffing, a referrer that stops at the origin when leaving,
 *    and the device features this site never asks for turned off.
 *
 * Deliberately not a full Content-Security-Policy. The framework writes inline
 * scripts and the wallet connection loads its own; a script policy needs a
 * nonce threaded through rendering, and one written without that would break
 * the page it was meant to protect. `frame-ancestors` is the part that stands
 * on its own.
 */
export const SECURITY_HEADERS: readonly { readonly key: string; readonly value: string }[] = [
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

/*
 * The one page any site may frame: the pool card at /embed/pool, which exists
 * to be put in somebody else's page. It is written by hand, holds no script,
 * no form and nothing a click on it can change, and it links out of the frame
 * rather than navigating inside it — there is nothing under it for a
 * clickjacker to aim at.
 *
 * Opened in two halves, so that no other address can be opened by mistake:
 *
 *  - `X-Frame-Options: DENY` is sent on every path except that one. Next
 *    matches a header's source without regard to case, so `/EMBED/POOL` is
 *    spared it too — but that address is not the card (the app's routes are
 *    matched exactly), it is the not-found page, and it still carries the
 *    `frame-ancestors 'none'` above, which every browser that reads CSP obeys
 *    over `X-Frame-Options`.
 *  - That `frame-ancestors 'none'` is replaced by the card's own policy in the
 *    proxy (src/proxy.ts), which runs after these headers are set, matches its
 *    paths exactly, and whose response headers win over them. A proxy that
 *    stopped running there would leave the card unframable rather than
 *    anything else framable: the exception fails closed.
 *
 * And since the card is the one page this site writes without the framework,
 * it can carry the full policy the comment above says the others cannot:
 * nothing may load but its own inline style.
 */
export const EMBED_CARD_PATH = "/embed/pool";

export const NO_FRAMING_HEADERS: readonly { readonly key: string; readonly value: string }[] = [
  { key: "X-Frame-Options", value: "DENY" },
];

/** Every path but the card, in the pattern syntax next.config reads. */
export const NO_FRAMING_SOURCE = "/:path((?!embed/pool$).*)";

export const EMBED_CARD_HEADERS: readonly { readonly key: string; readonly value: string }[] = [
  {
    key: "Content-Security-Policy",
    value: "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors *",
  },
];

/** What next.config.ts answers every response with. */
export const HEADER_RULES: readonly {
  readonly source: string;
  readonly headers: readonly { readonly key: string; readonly value: string }[];
}[] = [
  { source: "/:path*", headers: SECURITY_HEADERS },
  { source: NO_FRAMING_SOURCE, headers: NO_FRAMING_HEADERS },
];
