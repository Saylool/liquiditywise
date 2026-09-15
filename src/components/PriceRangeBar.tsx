import type { RangeBarLayout } from "../lib/format/rangeBarLayout";

/**
 * The range and the current price on one line, to scale.
 *
 * Presentational only: the positions arrive computed, in log space, from
 * `layoutRangeBar`. It exists because the same three numbers read differently
 * as a picture — a reader sees at once whether the price sits in the middle of
 * the range or against an edge, which is the first thing anyone opening a
 * position wants to know and the last thing three figures in a grid tell them.
 *
 * Every figure drawn here is printed as text beside the bar, so the drawing is
 * decorative to assistive technology and carries only a label.
 */
export function PriceRangeBar({
  layout,
  lowerLabel,
  upperLabel,
  currentLabel,
  label,
}: {
  layout: RangeBarLayout;
  lowerLabel: string;
  upperLabel: string;
  currentLabel: string;
  label: string;
}) {
  const at = (position: number) => ({ left: `${position}%` });

  return (
    <div role="img" aria-label={label} className="relative my-1 h-16 select-none">
      <div aria-hidden="true">
        <div className="absolute inset-x-0 top-7 h-2 rounded-full bg-border" />
        <div
          className="absolute top-7 h-2 rounded-full bg-accent/50"
          style={{ left: `${layout.lower}%`, width: `${layout.upper - layout.lower}%` }}
        />
        <div
          className="absolute top-5 h-6 w-0.5 -translate-x-1/2 bg-foreground"
          style={at(layout.current)}
        />
        <span
          className="absolute top-0 -translate-x-1/2 whitespace-nowrap font-mono text-[11px]"
          style={at(layout.current)}
        >
          {currentLabel}
        </span>
        <span
          className="absolute top-10 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] text-muted"
          style={at(layout.lower)}
        >
          {lowerLabel}
        </span>
        <span
          className="absolute top-10 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] text-muted"
          style={at(layout.upper)}
        >
          {upperLabel}
        </span>
      </div>
    </div>
  );
}
