import type { SparkPoint } from "@/hooks/useWatchlistHistory";
import type { EntryZone } from "@/lib/parseEntryTarget";

interface Props {
  points: SparkPoint[];
  zone: EntryZone | null;
  width?: number;
  height?: number;
  /** colour mood: 'good' = price moving toward entry; 'bad' = away */
  mood?: "good" | "bad" | "neutral";
}

const STROKE = {
  good: "rgba(90, 191, 160, 0.85)",
  bad: "rgba(200, 90, 90, 0.85)",
  neutral: "rgba(238, 232, 216, 0.7)",
};

const DOT = {
  good: "rgb(90, 191, 160)",
  bad: "rgb(200, 90, 90)",
  neutral: "rgb(238, 232, 216)",
};

export function WatchlistSparkline({
  points,
  zone,
  width = 180,
  height = 50,
  mood = "neutral",
}: Props) {
  if (!points || points.length < 2) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--text-dim)",
          opacity: 0.5,
          border: "1px dashed var(--rim)",
          borderRadius: 2,
        }}
      >
        No price history yet
      </div>
    );
  }

  const closes = points.map((p) => p.close);
  let dataMin = Math.min(...closes);
  let dataMax = Math.max(...closes);

  // Include zone in y-domain so the band is always visible
  if (zone) {
    dataMin = Math.min(dataMin, zone.low);
    dataMax = Math.max(dataMax, zone.high);
  }

  // Floor the range so flat tickers don't look extreme
  const mid = (dataMin + dataMax) / 2;
  const rawRange = dataMax - dataMin;
  const minRange = Math.max(Math.abs(mid) * 0.1, 0.0001);
  const range = Math.max(rawRange, minRange);
  const min = mid - range / 2;
  const max = mid + range / 2;

  const pad = 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const x = (i: number) => pad + (i / (points.length - 1)) * innerW;
  const y = (price: number) => pad + innerH - ((price - min) / range) * innerH;

  const linePts = points.map((p, i) => `${x(i).toFixed(2)},${y(p.close).toFixed(2)}`).join(" ");

  const lastIdx = points.length - 1;
  const lastX = x(lastIdx);
  const lastY = y(points[lastIdx].close);

  // Entry zone band
  let bandY = 0;
  let bandH = 0;
  if (zone) {
    const yTop = y(zone.high);
    const yBot = y(zone.low);
    bandY = Math.min(yTop, yBot);
    bandH = Math.max(2, Math.abs(yBot - yTop));
  }

  return (
    <svg
      width={width}
      height={height}
      style={{ display: "block", flexShrink: 0 }}
      aria-label={`30-day price sparkline, ${points.length} points`}
    >
      {zone && (
        <rect
          x={0}
          y={bandY}
          width={width}
          height={bandH}
          fill="rgba(200, 169, 110, 0.16)"
          stroke="rgba(200, 169, 110, 0.35)"
          strokeWidth={0.5}
          strokeDasharray="2 2"
        />
      )}
      <polyline
        points={linePts}
        fill="none"
        stroke={STROKE[mood]}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={2.5} fill={DOT[mood]} />
    </svg>
  );
}
