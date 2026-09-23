import type { NextConfig } from "next";

import { SECURITY_HEADERS } from "./src/lib/security/responseHeaders";

const nextConfig: NextConfig = {
  // The framework's name on every response tells a scanner which advisories to try.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: [...SECURITY_HEADERS] }];
  },
};

export default nextConfig;
