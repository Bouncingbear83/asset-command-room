import React, { useState, useRef, useCallback } from "react";
import type { DailyPricePoint } from "@/hooks/useDailyPrices";

export type PriceMilestone = {
  date: string; // YYYY-MM-DD
  kind: "added" | "scored" | "alert" | "earnings";
  label: string;
  tooltip?: string;
};

interface PriceChartProps {
  points: DailyPricePoint[];
  loading?: boolean;
  height?: number;
  milestones?: PriceMilestone[];
}

const MILESTONE_STYLE: Record<PriceMilestone["kind"], { color: string; glyph: string; dash: string }> = {
  added:    { color: "var(--gold)",    glyph: "A", dash: "1.2,0.8" },
  scored:   { color: "#7bb8ff",         glyph: "S", dash: "0.8,0.8" },
  alert:    { color: "var(--amber)",   glyph: "!", dash: "0.6,0.6" },
  earnings: { color: "var(--silver)",  glyph: "E", dash: "0.3,0.6" },
};

type RangeKey = "1W" | "1M" | "1Y" | "5Y" | "MAX";
const RANGE_DAYS: Record<RangeKey, number> = { "1W": 5, "1M": 22, "1Y": 252, "5Y": 1260, MAX: Infinity };
const RANGE_KEYS: RangeKey[] = ["1W", "1M", "1Y", "5Y", "MAX"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function computeMA(prices: number[], period: number, index: number): number | null {
  if (index < period - 1) return null;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i++) sum += prices[i];
  return sum / period;
}

function formatPrice(v: number): string {
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (v >= 100) return v.toFixed(1);
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(3);
}

function buildXLabels(data: DailyPricePoint[], range: RangeKey, toPct: (i: number) => number): { pct: number; label: string }[] {
  if (data.length < 2) return [];
  const labels: { pct: number; label: string }[] = [];

  if (range === "1W" || range === "1M") {
    const step = Math.max(1, Math.floor(data.length / 5));
    for (let i = 0; i < data.length; i += step) {
      const d = data[i].date;
      labels.push({ pct: toPct(i), label: `${MONTHS[parseInt(d.slice(5, 7)) - 1]} ${parseInt(d.slice(8, 10))}` });
    }
    const lastPct = toPct(data.length - 1);
    if (!labels.length || lastPct - labels[labels.length - 1].pct > 5) {
      const d = data[data.length - 1].date;
      labels.push({ pct: lastPct, label: `${MONTHS[parseInt(d.slice(5, 7)) - 1]} ${parseInt(d.slice(8, 10))}` });
    }
  } else if (range === "1Y") {
    let lastMonth = "";
    for (let i = 0; i < data.length; i++) {
      const m = data[i].date.slice(0, 7);
      if (m !== lastMonth) {
        const monthNum = parseInt(m.slice(5, 7));
        if (monthNum % 2 === 1 || data.length < 150) {
          labels.push({ pct: toPct(i), label: MONTHS[monthNum - 1] });
        }
        lastMonth = m;
      }
    }
  } else {
    let lastYear = "";
    for (let i = 0; i < data.length; i++) {
      const y = data[i].date.slice(0, 4);
      if (y !== lastYear) { labels.push({ pct: toPct(i), label: y }); lastYear = y; }
    }
    const finalPct = toPct(data.length - 1);
    const last = labels[labels.length - 1];
    if (!last || finalPct - last.pct > 5) {
      const d = data[data.length - 1].date;
      labels.push({ pct: finalPct, label: `${MONTHS[parseInt(d.slice(5, 7)) - 1]}'${d.slice(2, 4)}` });
    }
  }

  return labels.map(l => ({ ...l, pct: Math.min(l.pct, 95) }));
}

export function PriceChart({ points, loading, height = 140 }: PriceChartProps) {
  const [range, setRange] = useState<RangeKey>("1Y");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const sliceCount = RANGE_DAYS[range];
  const data = sliceCount === Infinity ? points : points.slice(-sliceCount);

  // Percentages for padding within the chart area
  const padLeft = 1; // % 
  const padRight = 8; // % for y-axis labels
  const padTop = 10; // % 
  const padBottom = 18; // %
  const chartW = 100 - padLeft - padRight; // % of container
  const chartH = 100 - padTop - padBottom; // %

  const toPctX = useCallback((i: number) => padLeft + (i / Math.max(1, data.length - 1)) * chartW, [data.length, chartW]);
  const toPctY = useCallback((v: number, minP: number, range_: number) => padTop + chartH - ((v - minP) / range_) * chartH, [chartH]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el || data.length < 2) return;
    const rect = el.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const dataXPct = xPct - padLeft;
    if (dataXPct < 0 || dataXPct > chartW) { setHoverIdx(null); return; }
    const idx = Math.round((dataXPct / chartW) * (data.length - 1));
    setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)));
  }, [data.length, chartW]);

  const handleMouseLeave = useCallback(() => setHoverIdx(null), []);

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

  const prices = data.map(p => p.priceLocal);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range_ = maxP - minP || 1;

  // Build SVG path using percentage-based viewBox (0-100 x 0-100)
  const pricePath = data.map((_, i) => {
    const x = toPctX(i);
    const y = toPctY(prices[i], minP, range_);
    return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");

  const ma20Points: string[] = [];
  const ma50Points: string[] = [];
  for (let i = 0; i < prices.length; i++) {
    const m20 = computeMA(prices, 20, i);
    const m50 = computeMA(prices, 50, i);
    const x = toPctX(i);
    if (m20 != null) ma20Points.push(`${ma20Points.length === 0 ? "M" : "L"}${x.toFixed(2)},${toPctY(m20, minP, range_).toFixed(2)}`);
    if (m50 != null) ma50Points.push(`${ma50Points.length === 0 ? "M" : "L"}${x.toFixed(2)},${toPctY(m50, minP, range_).toFixed(2)}`);
  }

  const trendColor = prices[prices.length - 1] >= prices[0] ? "var(--green)" : "var(--red)";
  const bottomY = padTop + chartH;
  const fillPath = `${pricePath} L${toPctX(data.length - 1).toFixed(2)},${bottomY.toFixed(2)} L${toPctX(0).toFixed(2)},${bottomY.toFixed(2)} Z`;
  const fillColor = prices[prices.length - 1] >= prices[0] ? "rgba(90,191,160,0.08)" : "rgba(200,90,90,0.08)";

  // Year boundaries
  const yearBoundaries: number[] = [];
  let lastYr = "";
  for (let i = 0; i < data.length; i++) {
    const y = data[i].date.slice(0, 4);
    if (y !== lastYr) { yearBoundaries.push(toPctX(i)); lastYr = y; }
  }

  const xLabels = buildXLabels(data, range, toPctX);

  const niceStep = range_ / 4;
  const yLabels = [minP, minP + niceStep, minP + 2 * niceStep, minP + 3 * niceStep, maxP];

  const hoverPoint = hoverIdx != null ? data[hoverIdx] : null;
  const hoverXPct = hoverIdx != null ? toPctX(hoverIdx) : 0;
  const hoverYPct = hoverIdx != null ? toPctY(prices[hoverIdx], minP, range_) : 0;

  return (
    <div style={{ padding: "8px 12px 4px 36px", background: "rgba(20,20,40,0.4)", borderBottom: "1px solid rgba(28,28,48,0.3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-dim)" }}>PRICE HISTORY</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)" }}>{data[0].date} → {data[data.length - 1].date}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#7bb8ff" }}>— MA20</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--gold)" }}>-- MA50</span>
      </div>
      {rangeRow}

      {/* Chart container: SVG for paths, HTML for labels */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ position: "relative", width: "100%", height, cursor: "crosshair", userSelect: "none" }}
      >
        {/* SVG for lines/paths only */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          <path d={fillPath} fill={fillColor} />
          {/* Horizontal grid lines */}
          {yLabels.map((v, i) => {
            const y = toPctY(v, minP, range_);
            return <line key={`h${i}`} x1={padLeft} x2={padLeft + chartW} y1={y} y2={y} stroke="rgba(140,140,170,0.1)" strokeWidth="0.15" vectorEffect="non-scaling-stroke" />;
          })}
          {/* Year boundary lines */}
          {yearBoundaries.slice(1).map((xPct, i) => (
            <line key={`yv${i}`} x1={xPct} x2={xPct} y1={padTop} y2={bottomY} stroke="rgba(140,140,170,0.18)" strokeWidth="0.5" strokeDasharray="0.5,0.5" vectorEffect="non-scaling-stroke" />
          ))}
          {ma50Points.length > 1 && <path d={ma50Points.join(" ")} fill="none" stroke="var(--gold)" strokeWidth="0.5" strokeDasharray="1,0.8" opacity="0.6" vectorEffect="non-scaling-stroke" />}
          {ma20Points.length > 1 && <path d={ma20Points.join(" ")} fill="none" stroke="#7bb8ff" strokeWidth="0.5" opacity="0.7" vectorEffect="non-scaling-stroke" />}
          <path d={pricePath} fill="none" stroke={trendColor} strokeWidth="0.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {/* Hover crosshair line */}
          {hoverIdx != null && (
            <line x1={hoverXPct} x2={hoverXPct} y1={padTop} y2={bottomY} stroke="rgba(200,200,220,0.4)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          )}
        </svg>

        {/* Hover dot */}
        {hoverIdx != null && hoverPoint && (
          <div style={{
            position: "absolute",
            left: `${hoverXPct}%`,
            top: `${hoverYPct}%`,
            transform: "translate(-50%, -50%)",
            width: 7, height: 7,
            borderRadius: "50%",
            background: trendColor,
            border: "1.5px solid rgba(255,255,255,0.7)",
            pointerEvents: "none",
          }} />
        )}

        {/* Hover tooltip */}
        {hoverIdx != null && hoverPoint && (
          <div style={{
            position: "absolute",
            left: hoverXPct > 60 ? `${hoverXPct - 1}%` : `${hoverXPct + 1}%`,
            top: `${Math.max(padTop, hoverYPct - 8)}%`,
            transform: hoverXPct > 60 ? "translateX(-100%)" : "none",
            background: "rgba(10,10,30,0.9)",
            border: "1px solid rgba(140,140,170,0.35)",
            borderRadius: 4,
            padding: "3px 8px",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "rgba(220,220,240,0.95)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 10,
          }}>
            {hoverPoint.date} · {formatPrice(hoverPoint.priceLocal)}
          </div>
        )}

        {/* X-axis labels (HTML) */}
        {xLabels.map((xl, i) => (
          <span key={`xl${i}`} style={{
            position: "absolute",
            left: `${xl.pct}%`,
            bottom: 2,
            transform: "translateX(-50%)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-dim)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}>
            {xl.label}
          </span>
        ))}

        {/* Y-axis labels (HTML) */}
        {yLabels.map((v, i) => (
          <span key={`yp${i}`} style={{
            position: "absolute",
            right: 2,
            top: `${toPctY(v, minP, range_)}%`,
            transform: "translateY(-50%)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "rgba(180,180,200,0.8)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}>
            {formatPrice(v)}
          </span>
        ))}
      </div>
    </div>
  );
}
