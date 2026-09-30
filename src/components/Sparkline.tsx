/*
 * A small line for a series of numbers: its shape, and nothing else.
 *
 * No axes and no figures on it — the numbers that matter are written beside
 * it — so it draws from the series' own smallest to its own largest, and a
 * series that never moves is a flat line in the middle rather than a line
 * pretending to. Drawn only from two points on; one is not a line. A screen
 * reader is given `label`, which says what it shows.
 */

const WIDTH = 120;
const HEIGHT = 28;
const PAD = 2;

export const sparklinePoints = (values: readonly number[]): string | null => {
  if (values.length < 2 || values.some((value) => !Number.isFinite(value))) return null;

  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low;
  return values
    .map((value, index) => {
      const x = PAD + (index / (values.length - 1)) * (WIDTH - 2 * PAD);
      const y = span === 0 ? HEIGHT / 2 : HEIGHT - PAD - ((value - low) / span) * (HEIGHT - 2 * PAD);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
};

export function Sparkline({ values, label }: { values: readonly number[]; label: string }) {
  const points = sparklinePoints(values);
  if (points === null) return null;

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      className="text-accent"
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
