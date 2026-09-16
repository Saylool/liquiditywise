import { PRICE_CHART, type PriceChartLayout } from "../lib/format/priceChartLayout";

/**
 * A month of prices drawn through the suggested range.
 *
 * Presentational only: every position arrives computed, in log space, from
 * `layoutPriceChart`. The band is the range, the dashed lines its edges, the
 * solid line today's price; each day is its close with a whisker from its low
 * to its high, filled where the day stayed entirely inside the range and
 * hollow where it did not.
 *
 * No viewBox, on purpose. The width is whatever the page gives, the height is
 * fixed, horizontal positions are percentages and vertical ones pixels — so
 * the chart narrows on a phone without shrinking its text to nothing, which
 * a scaled viewBox would do. Every figure drawn here is printed as text on
 * the page, so the drawing carries a label and nothing else for assistive
 * technology.
 */

/** Keeps a label legible where it crosses a line: a stroke under the glyphs in the panel's own colour. */
const HALO = { paintOrder: "stroke", stroke: "var(--color-surface)", strokeWidth: 3 } as const;

export function PriceHistoryChart({
  layout,
  labels,
  label,
}: {
  layout: PriceChartLayout;
  /** The figures beside their lines, already formatted. An open edge has no line, so its figure is not drawn. */
  labels: {
    readonly current: string;
    readonly upper: string;
    readonly lower: string;
    readonly first: string;
    readonly last: string;
  };
  label: string;
}) {
  const { points } = layout;

  return (
    <svg
      role="img"
      aria-label={label}
      width="100%"
      height={PRICE_CHART.height}
      className="block select-none overflow-visible font-mono text-[11px]"
    >
      {/* The range. */}
      <rect
        x="0"
        y={layout.bandTop}
        width="100%"
        height={Math.max(0, layout.bandBottom - layout.bandTop)}
        className="fill-accent/15"
      />
      {layout.upperY === null ? null : (
        <line x1="0" x2="100%" y1={layout.upperY} y2={layout.upperY} className="stroke-accent" strokeDasharray="4 4" />
      )}
      {layout.lowerY === null ? null : (
        <line x1="0" x2="100%" y1={layout.lowerY} y2={layout.lowerY} className="stroke-accent" strokeDasharray="4 4" />
      )}

      {/* Each day's low to high, behind the closes. */}
      {points.map((point) =>
        point.yLow === null || point.yHigh === null ? null : (
          <line
            key={`whisker-${point.date}`}
            x1={`${point.x}%`}
            x2={`${point.x}%`}
            y1={point.yHigh}
            y2={point.yLow}
            className="stroke-muted"
            strokeOpacity={0.6}
          />
        ),
      )}

      {/* The closes, joined. */}
      {points.slice(1).map((point, index) => {
        const previous = points[index];
        return previous === undefined ? null : (
          <line
            key={`close-${point.date}`}
            x1={`${previous.x}%`}
            y1={previous.y}
            x2={`${point.x}%`}
            y2={point.y}
            className="stroke-foreground"
            strokeWidth={1.25}
          />
        );
      })}

      {/* Today's price. */}
      <line x1="0" x2="100%" y1={layout.currentY} y2={layout.currentY} className="stroke-foreground" strokeWidth={1.5} />

      {/* One dot per day: filled inside the range, hollow otherwise. */}
      {points.map((point) => (
        <circle
          key={`day-${point.date}`}
          cx={`${point.x}%`}
          cy={point.y}
          r={3}
          strokeWidth={1.5}
          className={point.placement === "inside" ? "fill-accent stroke-accent" : "fill-surface stroke-muted"}
          data-placement={point.placement}
        />
      ))}

      {/*
       * The figures beside their lines. The edges' at the right, where the
       * latest days sit near today's price and away from them; today's at the
       * left, where the month's first day is a month away from it.
       */}
      {layout.upperY === null ? null : (
        <text x="100%" y={layout.upperY - 5} textAnchor="end" className="fill-accent" style={HALO}>
          {labels.upper}
        </text>
      )}
      {layout.lowerY === null ? null : (
        <text x="100%" y={layout.lowerY + 14} textAnchor="end" className="fill-accent" style={HALO}>
          {labels.lower}
        </text>
      )}
      <text x="0" y={layout.currentY - 5} className="fill-foreground font-medium" style={HALO}>
        {labels.current}
      </text>

      {/* The month's ends. */}
      <text x="0" y={PRICE_CHART.height - 8} className="fill-muted">
        {labels.first}
      </text>
      <text x="100%" y={PRICE_CHART.height - 8} textAnchor="end" className="fill-muted">
        {labels.last}
      </text>
    </svg>
  );
}
