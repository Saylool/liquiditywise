import type { NextConfig } from "next";

import { localeRewrites } from "./src/lib/i18n/localePath";
import { SECURITY_HEADERS } from "./src/lib/security/responseHeaders";

const nextConfig: NextConfig = {
  // The framework's name on every response tells a scanner which advisories to try.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: [...SECURITY_HEADERS] }];
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
