import { describe, expect, it } from "vitest";

import { lineRuns } from "./visualOrder";

const texts = (line: string) => lineRuns(line).map(({ dir, text }) => `${dir}:${text}`);

describe("the runs of a right-to-left card line", () => {
  it("cuts an Arabic sentence into one run per word, in reading order", () => {
    expect(texts("مقيس على الموقع")).toEqual(["rtl:مقيس", "rtl:على", "rtl:الموقع"]);
  });

  it("keeps a Latin stretch — a name, figures, a URL — as one run, so it reads left to right inside the line", () => {
    expect(texts("مركز Uniswap v3 مفتوح، بسعر اليوم")).toEqual(["rtl:مركز", "ltr:Uniswap v3", "rtl:مفتوح،", "rtl:بسعر", "rtl:اليوم"]);
    expect(texts("النطاق 1,948.91 – 5,502.58 USDC لكل WETH")).toEqual([
      "rtl:النطاق",
      "ltr:1,948.91 – 5,502.58 USDC",
      "rtl:لكل",
      "ltr:WETH",
    ]);
  });

  it("lets a word with no direction of its own — a dot, a dash — travel with the run before it", () => {
    expect(texts("قياس من liquiditywise.com · ليس نصيحة")).toEqual(["rtl:قياس", "rtl:من", "ltr:liquiditywise.com ·", "rtl:ليس", "rtl:نصيحة"]);
  });

  it("drops the direction marks the formatters wrap figures in, which the renderer drew as boxes", () => {
    expect(texts("الرسوم +9,810.24\u200e%\u200e وأثر")).toEqual(["rtl:الرسوم", "ltr:+9,810.24%", "rtl:وأثر"]);
  });

  it("makes one Latin run of a Latin line, one run of one word, and none of nothing", () => {
    expect(texts("1,948.91 – 5,502.58 USDC")).toEqual(["ltr:1,948.91 – 5,502.58 USDC"]);
    expect(texts("النطاق")).toEqual(["rtl:النطاق"]);
    expect(lineRuns("")).toEqual([]);
  });
});
