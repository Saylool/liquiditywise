import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config";
import { SECURITY_HEADERS } from "./responseHeaders";

const header = (key: string) => SECURITY_HEADERS.find((entry) => entry.key === key)?.value;

describe("the headers every response carries", () => {
  it("forbids framing in both spellings", () => {
    expect(header("Content-Security-Policy")).toBe("frame-ancestors 'none'");
    expect(header("X-Frame-Options")).toBe("DENY");
  });

  /*
   * A script policy without a nonce would break the page: the framework
   * writes inline scripts. Until one is threaded through rendering, the
   * policy says nothing about scripts rather than something wrong.
   */
  it("sets no script policy it cannot keep", () => {
    expect(header("Content-Security-Policy")).not.toMatch(/script-src|default-src/);
  });

  it("asks for HTTPS on this host only, and nothing that cannot be taken back", () => {
    expect(header("Strict-Transport-Security")).toBe("max-age=31536000");
  });

  it("turns off sniffing, and leaves only the origin behind on the way out", () => {
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(header("Permissions-Policy")).toContain("camera=()");
  });

  it("is applied to every path, and the framework's name is not announced", async () => {
    const rules = await nextConfig.headers?.();

    expect(rules).toEqual([{ source: "/:path*", headers: [...SECURITY_HEADERS] }]);
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
