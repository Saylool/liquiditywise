import { describe, expect, it } from "vitest";

import { visualOrder } from "./visualOrder";

describe("the visual order of a right-to-left card line", () => {
  it("reverses the words of an Arabic sentence, so a left-to-right renderer draws it reading right to left", () => {
    expect(visualOrder("مقيس على الموقع")).toBe("الموقع على مقيس");
  });

  it("keeps a Latin run — a name, figures, a URL — in its own order inside the reversed line", () => {
    expect(visualOrder("مركز Uniswap v3 مفتوح، بسعر اليوم")).toBe("اليوم بسعر مفتوح، Uniswap v3 مركز");
    expect(visualOrder("النطاق 1,948.91 – 5,502.58 USDC لكل WETH")).toBe("WETH لكل 1,948.91 – 5,502.58 USDC النطاق");
  });

  it("lets a word with no direction of its own — a dot, a dash — travel with the run before it", () => {
    expect(visualOrder("مقيس على liquiditywise.com · ليس نصيحة")).toBe("نصيحة ليس liquiditywise.com · على مقيس");
  });

  it("leaves a line that is Latin alone as it is, and a single word as it is", () => {
    expect(visualOrder("1,948.91 – 5,502.58 USDC")).toBe("1,948.91 – 5,502.58 USDC");
    expect(visualOrder("النطاق")).toBe("النطاق");
    expect(visualOrder("")).toBe("");
  });

  it("is its own inverse on a line of two runs, as a reordering should be", () => {
    const line = "منذ 2025-05-28";
    expect(visualOrder(visualOrder(line))).toBe(line);
  });
});
