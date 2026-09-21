"use client";

import { useId, useState } from "react";
import type { InterfaceCopy } from "../lib/i18n/interface";

// Whole-pixel coordinates render identically in the server and browser engines.
const BARS = Array.from({ length: 49 }, (_, i) => ({
  x: 32 + i * 11,
  height: Math.round(
    20 + 144 * Math.exp(-Math.pow((i - 24) / 11, 2)) + 8 * Math.sin(i * 1.8),
  ),
}));

/** A deliberately synthetic diagram; no market prices or return estimates. */
export function RangeExplorer({
  copy,
}: {
  copy: Pick<
    InterfaceCopy,
    "rangeLabel" | "narrow" | "wide" | "illustration" | "current" | "range"
  >;
}) {
  const [width, setWidth] = useState(24);
  const id = useId();
  const left = 300 - width * 5;
  const right = 300 + width * 5;
  return (
    <div className="range-explorer">
      <div className="range-toolbar">
        <span>
          <i className="status-dot" />
          {copy.range}
        </span>
        <output htmlFor={id}>±{width}%</output>
      </div>
      <svg
        className="range-plot"
        viewBox="0 0 600 255"
        role="img"
        aria-label={`${copy.rangeLabel}: ±${width}%`}
      >
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
          <clipPath id={`${id}-clip`}>
            <rect x={left} y="25" width={right - left} height="185" />
          </clipPath>
        </defs>
        {[55, 105, 155, 205].map((y) => (
          <line key={y} x1="22" x2="578" y1={y} y2={y} className="plot-grid" />
        ))}
        <rect
          x={left}
          y="25"
          width={right - left}
          height="185"
          fill={`url(#${id}-fill)`}
        />
        <g className="plot-bars">
          {BARS.map(({ x, height }) => (
            <rect
              key={x}
              x={x}
              y={205 - height}
              width="7"
              height={height}
              rx="2"
            />
          ))}
        </g>
        <g clipPath={`url(#${id}-clip)`} fill="currentColor">
          {BARS.map(({ x, height }) => (
            <rect
              key={x}
              x={x}
              y={205 - height}
              width="7"
              height={height}
              rx="2"
            />
          ))}
        </g>
        {[left, right].map((x) => (
          <g key={x}>
            <line
              x1={x}
              x2={x}
              y1="25"
              y2="214"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <rect
              x={x - 3}
              y="105"
              width="6"
              height="24"
              rx="3"
              fill="currentColor"
            />
          </g>
        ))}
        <line
          x1="300"
          x2="300"
          y1="15"
          y2="219"
          className="plot-current"
          strokeDasharray="3 5"
        />
        <circle cx="300" cy="205" r="4" className="plot-current-dot" />
        <text x="300" y="246" textAnchor="middle" className="plot-label">
          {copy.current}
        </text>
      </svg>
      <div className="range-control">
        <label htmlFor={id}>{copy.rangeLabel}</label>
        <input
          id={id}
          type="range"
          min="8"
          max="42"
          value={width}
          aria-valuetext={`±${width}%`}
          onChange={(event) => setWidth(Number(event.target.value))}
        />
        <div>
          <span>{copy.narrow}</span>
          <span>{copy.wide}</span>
        </div>
      </div>
      <p className="illustration-note">{copy.illustration}</p>
    </div>
  );
}
