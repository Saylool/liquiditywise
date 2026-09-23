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
 *    under an invisible frame.
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
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];
