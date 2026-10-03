import type { NextConfig } from "next";

import { localeRewrites } from "./src/lib/i18n/localePath";
import { HEADER_RULES } from "./src/lib/security/responseHeaders";

const nextConfig: NextConfig = {
  // The framework's name on every response tells a scanner which advisories to try.
  poweredByHeader: false,

  async headers() {
    /* Every path, and every path but the embeddable card (see responseHeaders.ts). */
    return HEADER_RULES.map(({ source, headers }) => ({ source, headers: [...headers] }));
  },

  /*
   * /tr/hooks served as /hooks. Before the file system, and after the proxy,
   * which has by then handed the page its language (src/lib/i18n/localePath.ts).
   */
  async rewrites() {
    return { beforeFiles: localeRewrites(), afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
