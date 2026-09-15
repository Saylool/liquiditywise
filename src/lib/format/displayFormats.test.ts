import { describe, expect, it } from "vitest";

import {
  ABSENT,
  formatFeePpm,
  formatMeasuredFeePpm,
  formatMultiplier,
  formatPercent,
  formatPrice,
  formatTick,
  formatUsd,
  formatUtcDate,
  formatUtcMinute,
  formatWhole,
} from "./displayFormats";

describe("formatPrice", () => {
  it("keeps a small pool price readable instead of rounding it to zero", () => {
    // USDC priced in WETH. Two decimal places would show "0.00".
    expect(formatPrice(1 / 3000)).toBe("0.000333333");
  });

  it("groups an ordinary large number", () => {
    expect(formatPrice(12_500_000)).toBe("12,500,000");
  });

  it("switches to scientific notation past what ordinary notation can show", () => {
    expect(formatPrice(3.4e38)).toBe("3.4E38");
    expect(formatPrice(6e-39)).toBe("6E-39");
  });

  it("stays in ordinary notation across the readable range", () => {
    expect(formatPrice(1)).toBe("1");
    expect(formatPrice(1.0001)).toBe("1.0001");
    expect(formatPrice(0.000001)).toBe("0.000001");
  });

  it("shows a real zero rather than calling it absent", () => {
    expect(formatPrice(0)).toBe("0");
  });

  it("never invents digits", () => {
    // Six significant digits, not six decimal places padded with zeros.
    expect(formatPrice(2)).toBe("2");
    expect(formatPrice(0.5)).toBe("0.5");
  });

  it("reports a value it cannot represent as absent", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(formatPrice(value)).toBe(ABSENT);
    }
  });
});

describe("formatPercent", () => {
  it("turns a decimal ratio into a percentage", () => {
    expect(formatPercent(0.0545)).toBe("5.45%");
    expect(formatPercent(0.19)).toBe("19.00%");
    expect(formatPercent(1)).toBe("100.00%");
  });

  it("keeps the sign of a downside figure", () => {
    expect(formatPercent(-0.9999)).toBe("-99.99%");
  });

  it("switches notation rather than printing thirty digits", () => {
    expect(formatPercent(1e30)).toBe("1E32%");
  });

  it("reports a value it cannot represent as absent", () => {
    expect(formatPercent(Number.NaN)).toBe(ABSENT);
  });
});

describe("formatTick", () => {
  it("groups a six-digit tick", () => {
    expect(formatTick(196_256)).toBe("196,256");
    expect(formatTick(-276_325)).toBe("-276,325");
  });

  it("shows tick zero", () => {
    expect(formatTick(0)).toBe("0");
  });

  it("reports a value it cannot represent as absent", () => {
    expect(formatTick(Number.NaN)).toBe(ABSENT);
  });
});

describe("formatWhole", () => {
  it("groups a count", () => {
    expect(formatWhole(30)).toBe("30");
    expect(formatWhole(1_234_567)).toBe("1,234,567");
  });

  it("reports a value it cannot represent as absent", () => {
    expect(formatWhole(Number.POSITIVE_INFINITY)).toBe(ABSENT);
  });
});

describe("formatFeePpm", () => {
  it("labels each real v3 fee tier the way Uniswap does", () => {
    expect(formatFeePpm(100)).toBe("0.01%");
    expect(formatFeePpm(500)).toBe("0.05%");
    expect(formatFeePpm(3000)).toBe("0.30%");
    expect(formatFeePpm(10_000)).toBe("1.00%");
  });

  it("does not round a nonstandard tier away", () => {
    expect(formatFeePpm(1)).toBe("0.0001%");
  });
});

describe("formatUsd", () => {
  it("drops the cents on a figure where they say nothing", () => {
    expect(formatUsd(12_500_000)).toBe("$12,500,000");
  });

  it("keeps the cents on a small figure", () => {
    expect(formatUsd(12.5)).toBe("$12.50");
  });

  it("shows an unreported figure as absent rather than as zero", () => {
    // A pool with no reported TVL is not a pool holding nothing.
    expect(formatUsd(null)).toBe(ABSENT);
  });

  it("shows a genuine zero", () => {
    expect(formatUsd(0)).toBe("$0.00");
  });
});

describe("the reader's own language", () => {
  /*
   * Translating the words and leaving the numbers in English would be half a
   * translation: a Turkish reader writes the decimal separator as a comma, the
   * thousands separator as a dot, and the percent sign before the number.
   */
  it("writes a price with a comma for the decimal separator", () => {
    expect(formatPrice(1 / 3000, "tr")).toBe("0,000333333");
    expect(formatPrice(1 / 3000, "en")).toBe("0.000333333");
  });

  it("groups thousands with a dot", () => {
    expect(formatWhole(1_234_567, "tr")).toBe("1.234.567");
    expect(formatTick(-276_325, "tr")).toBe("-276.325");
  });

  it("puts the percent sign where Turkish puts it", () => {
    expect(formatPercent(0.0545, "tr")).toBe("%5,45");
    expect(formatFeePpm(3000, "tr")).toBe("%0,30");
  });

  it("formats a USD figure in the reader's conventions", () => {
    expect(formatUsd(12_500_000, "tr")).toBe("$12.500.000");
    expect(formatUsd(12.5, "tr")).toBe("$12,50");
  });

  it("defaults to English, so a bare call never follows the host's locale", () => {
    expect(formatPercent(0.0545)).toBe(formatPercent(0.0545, "en"));
    expect(formatWhole(1_234_567)).toBe("1,234,567");
  });

  it("still reports an absent figure the same way in both", () => {
    expect(formatUsd(null, "tr")).toBe(ABSENT);
    expect(formatPrice(Number.NaN, "tr")).toBe(ABSENT);
  });
});

describe("formatUtcMinute / formatUtcDate", () => {
  it("states the zone rather than leaving the reader to assume theirs", () => {
    expect(formatUtcMinute("2026-08-21T09:15:00.000Z")).toBe("2026-08-21 09:15 UTC");
  });

  it("does not shift the instant into a local timezone", () => {
    // Sliced, never parsed: a renderer set to UTC+13 must show the same string.
    expect(formatUtcMinute("2026-08-21T23:59:00.000Z")).toBe("2026-08-21 23:59 UTC");
  });

  it("returns the date alone for a window boundary", () => {
    expect(formatUtcDate("2026-07-21T00:00:00.000Z")).toBe("2026-07-21");
  });

  it("refuses anything that is not the exact timestamp format", () => {
    for (const value of ["2026-08-21T09:15:00Z", "2026-08-21", "", "not a timestamp"]) {
      expect(formatUtcMinute(value)).toBe(ABSENT);
      expect(formatUtcDate(value)).toBe(ABSENT);
    }
  });
});

/*
 * Its own formatter because `formatWhole` rounds to nothing after the point: a
 * band asked for at 1.5σ would have been labelled "2σ" while the arithmetic
 * behind it used 1.5 the whole time.
 */
describe("formatMultiplier", () => {
  it("keeps a fraction that formatWhole would round away", () => {
    expect(formatMultiplier(1.5)).toBe("1.5");
    expect(formatWhole(1.5)).toBe("2");
  });

  it("writes a whole multiplier without a decimal tail", () => {
    expect(formatMultiplier(1)).toBe("1");
    expect(formatMultiplier(2)).toBe("2");
  });

  it("writes it the way the reader's language writes a decimal", () => {
    expect(formatMultiplier(1.5, "tr")).toBe("1,5");
  });

  it("reports a figure it cannot format as absent rather than as a number", () => {
    expect(formatMultiplier(Number.NaN)).toBe(formatWhole(Number.NaN));
  });
});

/*
 * A measured rate is a quotient rather than an on-chain integer, so it lands
 * anywhere — and it is printed beside the rate the pool declares, for a panel
 * whose whole question is whether the two are the same number.
 */
describe("formatMeasuredFeePpm", () => {
  /*
   * The reason this formatter exists at all. `formatFeePpm` stops at four
   * decimal places, which is every fee tier and not every measured rate.
   */
  it("does not render a real sub-ppm rate as zero", () => {
    expect(formatMeasuredFeePpm(0.4)).toBe("0.00004%");
    expect(formatFeePpm(0.4)).toBe("0.00%");
  });

  /*
   * The other reason. "0.30%" printed beside "0.3%" reads as two different
   * answers to "do these agree", so a measured rate matching a declared one has
   * to print identically to it.
   */
  it.each([3000, 500, 625, 250, 12, 1, 1_000_000])(
    "prints %i ppm exactly as the declared formatter does",
    (ppm) => {
      expect(formatMeasuredFeePpm(ppm)).toBe(formatFeePpm(ppm));
      expect(formatMeasuredFeePpm(ppm, "tr")).toBe(formatFeePpm(ppm, "tr"));
    },
  );

  /** Three significant figures, so an ordinary rate is not a wall of digits. */
  it("stops at three significant figures", () => {
    expect(formatMeasuredFeePpm(17.37332)).toBe("0.00174%");
    expect(formatMeasuredFeePpm(230.4)).toBe("0.023%");
  });

  it("writes the number the way the reader's language writes it", () => {
    expect(formatMeasuredFeePpm(174, "tr")).toBe("%0,0174");
    expect(formatMeasuredFeePpm(174, "en")).toBe("0.0174%");
  });

  /* A day with volume and no fees charged is a real, measured zero. */
  it("shows a measured zero as zero", () => {
    expect(formatMeasuredFeePpm(0)).toBe("0.00%");
  });

  it("falls back to scientific below a hundredth of a part-per-million", () => {
    expect(formatMeasuredFeePpm(0.004)).toBe("4E-7%");
  });

  it("reports a figure that is not a number as absent", () => {
    expect(formatMeasuredFeePpm(Number.NaN)).toBe(ABSENT);
    expect(formatMeasuredFeePpm(Number.POSITIVE_INFINITY)).toBe(ABSENT);
  });
});
