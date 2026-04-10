import React from "react";
import type { DailyPricePoint } from "@/hooks/useDailyPrices";

interface SparklineProps {
  points: DailyPricePoint[];
  color: "green" | "red" | "neutral";
  width?: number;
  height?: number;
}

const COLOR_MAP = {
  green: "var(--green)",
  red: "var(--red)",
  neutral: "var(--text-dim)",
};

const FILL_MAP = {
  green: "rgba(90,191,160,0.12)",
  red: "rgba(200,90,90,0.12)",
  neutral: "rgba(140,140,170,0.08)",
};

export function Sparkline({ points, color, width = 80, height = 24 }: SparklineProps) {
  // Use last 30 points
  const data = points.slice(-30);
  if (data.length < 5) {
    return <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>—</span>;
  }

  const prices = data.map(p => p.priceGbp);
  const rawMin = Math.min(...prices);
  const rawMax = Math.max(...prices);
  const rawRange = rawMax - rawMin;
  // Floor range to 10% of mean so small moves don't look extreme
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const minRange = mean * 0.10;
  const range = Math.max(rawRange, minRange);
  const mid = (rawMin + rawMax) / 2;
  const min = mid - range / 2;
  const max = mid + range / 2;

  const pad = 1;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const pts = prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * innerW;
    const y = pad + innerH - ((p - min) / range) * innerH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const lineStr = pts.join(" ");
  // Fill area: close the polygon at the bottom
  const fillStr = `${pts[0].split(",")[0]},${(height - pad).toFixed(1)} ${lineStr} ${pts[pts.length - 1].split(",")[0]},${(height - pad).toFixed(1)}`;

  return (
    <svg width={width} height={height} style={{ display: "block", flexShrink: 0 }}>
      <polygon points={fillStr} fill={FILL_MAP[color]} />
      <polyline points={lineStr} fill="none" stroke={COLOR_MAP[color]} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
