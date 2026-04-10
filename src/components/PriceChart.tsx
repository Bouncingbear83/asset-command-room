import React, { useState, useRef, useCallback } from "react";
import type { DailyPricePoint } from "@/hooks/useDailyPrices";

interface PriceChartProps {
  points: DailyPricePoint[];
  loading?: boolean;
  height?: number;
}

type RangeKey = "1W" | "1M" | "1Y" | "5Y" | "MAX";
const RANGE_DAYS: Record<RangeKey, number> = { "1W": 5, "1M": 22, "1Y": 252, "5Y": 1260, MAX: Infinity };
const RANGE_KEYS: RangeKey[] = ["1W", "1M", "1Y", "5Y", "MAX"];

function computeMA(prices: number[], period: number, index: number): number | null {
  if (index < period - 1) return null;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i++) sum += prices[i];
  return sum / period;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatPrice(v: number): string {
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (v >= 100) return v.toFixed(1);
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(3);
}

function buildXLabels(data: DailyPricePoint[], range: RangeKey, toX: (i: number) => number, maxX: number): { x: number; label: string }[] {
  if (data.length < 2) return [];
  const labels: { x: number; label: string }[] = [];

  if (range === "1W" || range === "1M") {
    // Show ~5-6 evenly spaced date labels
    const step = Math.max(1, Math.floor(data.length / 5));
    for (let i = 0; i < data.length; i += step) {
      const d = data[i].date;
      const month = MONTHS[parseInt(d.slice(5, 7)) - 1];
      const day = parseInt(d.slice(8, 10));
      labels.push({ x: toX(i), label: `${month} ${day}` });
    }
    // Always include last point
    if (labels.length === 0 || labels[labels.length - 1].x < toX(data.length - 1) - 30) {
      const d = data[data.length - 1].date;
      const month = MONTHS[parseInt(d.slice(5, 7)) - 1];
      const day = parseInt(d.slice(8, 10));
      labels.push({ x: toX(data.length - 1), label: `${month} ${day}` });
    }
  } else if (range === "1Y") {
    // Show month labels where month changes
    let lastMonth = "";
    for (let i = 0; i < data.length; i++) {
      const m = data[i].date.slice(0, 7);
      if (m !== lastMonth) {
        const month = MONTHS[parseInt(m.slice(5, 7)) - 1];
        // Only show every other month if too dense
        const monthNum = parseInt(m.slice(5, 7));
        if (monthNum % 2 === 1 || data.length < 150) {
          labels.push({ x: toX(i), label: month });
        }
        lastMonth = m;
      }
    }
  } else {
    // 5Y / MAX — year boundaries + final date
    let lastYear = "";
    for (let i = 0; i < data.length; i++) {
      const y = data[i].date.slice(0, 4);
      if (y !== lastYear) {
        labels.push({ x: toX(i), label: y });
        lastYear = y;
      }
    }
    // Add final date label if it doesn't collide
    const lastLabel = labels[labels.length - 1];
    const finalX = toX(data.length - 1);
    if (!lastLabel || finalX - lastLabel.x > 40) {
      const d = data[data.length - 1].date;
      const month = MONTHS[parseInt(d.slice(5, 7)) - 1];
      const yr = d.slice(2, 4);
      labels.push({ x: finalX, label: `${month}'${yr}` });
    }
  }

  // Shift any label that would overlap the right y-axis
  return labels.map(l => ({
    ...l,
    x: Math.min(l.x, maxX - 20),
  }));
}

export function PriceChart({ points, loading, height = 120 }: PriceChartProps) {
  const [range, setRange] = useState<RangeKey>("1Y");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (loading) {
    return (
      <div style={{ padding: "12px 36px", background: "rgba(20,20,40,0.4)", borderBottom: "1px solid rgba(28,28,48,0.3)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>Loading price history…</span>
      </div>
    );
  }

  const btnStyle = (active: boolean): React.CSSProperties => ({
    fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", fontWeight: active ? 700 : 500,
    padding: "4px 12px", border: active ? "1px solid rgba(90,160,255,0.5)" : "1px solid rgba(140,140,170,0.25)", cursor: "pointer",
    background: active ? "rgba(90,160,255,0.2)" : "rgba(140,140,170,0.08)",
    color: active ? "#7bb8ff" : "rgba(180,180,200,0.7)",
    borderRadius: 3, transition: "all 0.15s ease",
  });

  const sliceCount = RANGE_DAYS[range];
  const data = sliceCount === Infinity ? points : points.slice(-sliceCount);

  const rangeRow = (
    <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
      {RANGE_KEYS.map(k => (
        <button key={k} onClick={(e) => { e.stopPropagation(); setRange(k); }} style={btnStyle(range === k)}>{k}</button>
      ))}
    </div>
  );

  if (data.length < 10) {
    return (
      <div style={{ padding: "8px 12px 4px 36px", background: "rgba(20,20,40,0.4)", borderBottom: "1px solid rgba(28,28,48,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-dim)" }}>PRICE HISTORY</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)" }}>Not enough data for {range}</span>
        </div>
        {rangeRow}
      </div>
    );
  }

  const pad = { top: 16, right: 60, bottom: 24, left: 8 };
  const width = 800;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const prices = data.map(p => p.priceLocal);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range_ = maxP - minP || 1;

  const toX = (i: number) => pad.left + (i / (data.length - 1)) * innerW;
  const toY = (v: number) => pad.top + innerH - ((v - minP) / range_) * innerH;

  const pricePath = data.map((_, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(prices[i]).toFixed(1)}`).join(" ");

  const ma20Points: string[] = [];
  const ma50Points: string[] = [];
  for (let i = 0; i < prices.length; i++) {
    const m20 = computeMA(prices, 20, i);
    const m50 = computeMA(prices, 50, i);
    if (m20 != null) ma20Points.push(`${ma20Points.length === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(m20).toFixed(1)}`);
    if (m50 != null) ma50Points.push(`${ma50Points.length === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(m50).toFixed(1)}`);
  }

  const trendColor = prices[prices.length - 1] >= prices[0] ? "var(--green)" : "var(--red)";
  const fillPath = `${pricePath} L${toX(data.length - 1).toFixed(1)},${(pad.top + innerH).toFixed(1)} L${toX(0).toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`;
  const fillColor = prices[prices.length - 1] >= prices[0] ? "rgba(90,191,160,0.08)" : "rgba(200,90,90,0.08)";

  // Year boundaries for vertical lines
  const yearBoundaries: { x: number; label: string }[] = [];
  let lastYear = "";
  for (let i = 0; i < data.length; i++) {
    const y = data[i].date.slice(0, 4);
    if (y !== lastYear) { yearBoundaries.push({ x: toX(i), label: y }); lastYear = y; }
  }

  // Smart x-axis labels
  const xLabels = buildXLabels(data, range, toX, width - pad.right);

  const niceStep = range_ / 4;
  const yLabels = [minP, minP + niceStep, minP + 2 * niceStep, minP + 3 * niceStep, maxP];

  // Hover handler
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    const dataX = svgX - pad.left;
    if (dataX < 0 || dataX > innerW) { setHoverIdx(null); return; }
    const idx = Math.round((dataX / innerW) * (data.length - 1));
    setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)));
  }, [data.length, innerW, width]);

  const handleMouseLeave = useCallback(() => setHoverIdx(null), []);

  // Hover tooltip data
  const hoverPoint = hoverIdx != null ? data[hoverIdx] : null;
  const hoverX = hoverIdx != null ? toX(hoverIdx) : 0;
  const hoverY = hoverIdx != null ? toY(prices[hoverIdx]) : 0;

  return (
    <div style={{ padding: "8px 12px 4px 36px", background: "rgba(20,20,40,0.4)", borderBottom: "1px solid rgba(28,28,48,0.3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-dim)" }}>PRICE HISTORY</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)" }}>{data[0].date} → {data[data.length - 1].date}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#7bb8ff" }}>— MA20</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--gold)" }}>-- MA50</span>
      </div>
      {rangeRow}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", maxHeight: height, display: "block", cursor: "crosshair" }}
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <path d={fillPath} fill={fillColor} />
        {yLabels.map((v, i) => (
          <line key={`h${i}`} x1={pad.left} x2={width - pad.right} y1={toY(v)} y2={toY(v)} stroke="rgba(140,140,170,0.1)" strokeWidth="0.5" />
        ))}
        {/* Vertical year-end lines */}
        {yearBoundaries.slice(1).map((yb, i) => (
          <line key={`yv${i}`} x1={yb.x} x2={yb.x} y1={pad.top} y2={pad.top + innerH} stroke="rgba(140,140,170,0.18)" strokeWidth="0.7" strokeDasharray="3,3" />
        ))}
        {ma50Points.length > 1 && <path d={ma50Points.join(" ")} fill="none" stroke="var(--gold)" strokeWidth="1" strokeDasharray="4,3" opacity="0.6" />}
        {ma20Points.length > 1 && <path d={ma20Points.join(" ")} fill="none" stroke="#7bb8ff" strokeWidth="1" opacity="0.7" />}
        <path d={pricePath} fill="none" stroke={trendColor} strokeWidth="1.5" strokeLinejoin="round" />

        {/* X-axis labels */}
        {xLabels.map((xl, i) => (
          <text key={`xl${i}`} x={xl.x} y={height - 4} fill="var(--text-dim)" fontSize="8" fontFamily="var(--font-mono)">{xl.label}</text>
        ))}

        {/* Y-axis labels — larger */}
        {yLabels.map((v, i) => (
          <text key={`yp${i}`} x={width - pad.right + 4} y={toY(v) + 3} fill="rgba(180,180,200,0.8)" fontSize="9" fontFamily="var(--font-mono)">{formatPrice(v)}</text>
        ))}

        {/* Hover crosshair */}
        {hoverIdx != null && hoverPoint && (
          <>
            <line x1={hoverX} x2={hoverX} y1={pad.top} y2={pad.top + innerH} stroke="rgba(200,200,220,0.4)" strokeWidth="0.7" />
            <circle cx={hoverX} cy={hoverY} r="3" fill={trendColor} stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
            {/* Tooltip background */}
            <rect
              x={hoverX + (hoverX > width / 2 ? -130 : 8)}
              y={Math.max(pad.top, hoverY - 20)}
              width="122" height="18" rx="3"
              fill="rgba(10,10,30,0.85)" stroke="rgba(140,140,170,0.3)" strokeWidth="0.5"
            />
            <text
              x={hoverX + (hoverX > width / 2 ? -124 : 14)}
              y={Math.max(pad.top + 12, hoverY - 7)}
              fill="rgba(220,220,240,0.95)" fontSize="9" fontFamily="var(--font-mono)"
            >
              {hoverPoint.date} · {formatPrice(hoverPoint.priceLocal)}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
