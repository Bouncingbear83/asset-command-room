import React from "react";
import type { DailyPricePoint } from "@/hooks/useDailyPrices";

interface PriceChartProps {
  points: DailyPricePoint[];
  loading?: boolean;
  height?: number;
}

function computeMA(prices: number[], period: number, index: number): number | null {
  if (index < period - 1) return null;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i++) sum += prices[i];
  return sum / period;
}

export function PriceChart({ points, loading, height = 120 }: PriceChartProps) {
  if (loading) {
    return (
      <div style={{ padding: "12px 36px", background: "rgba(20,20,40,0.4)", borderBottom: "1px solid rgba(28,28,48,0.3)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>Loading price history…</span>
      </div>
    );
  }

  if (points.length < 10) return null;

  const pad = { top: 16, right: 60, bottom: 24, left: 8 };
  const width = 800;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const prices = points.map(p => p.priceLocal);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;

  const toX = (i: number) => pad.left + (i / (points.length - 1)) * innerW;
  const toY = (v: number) => pad.top + innerH - ((v - minP) / range) * innerH;

  // Main price line
  const pricePath = points.map((_, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(prices[i]).toFixed(1)}`).join(" ");

  // MA lines
  const ma20Points: string[] = [];
  const ma50Points: string[] = [];
  for (let i = 0; i < prices.length; i++) {
    const m20 = computeMA(prices, 20, i);
    const m50 = computeMA(prices, 50, i);
    if (m20 != null) ma20Points.push(`${ma20Points.length === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(m20).toFixed(1)}`);
    if (m50 != null) ma50Points.push(`${ma50Points.length === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(m50).toFixed(1)}`);
  }

  // Overall trend color
  const trendColor = prices[prices.length - 1] >= prices[0] ? "var(--green)" : "var(--red)";

  // Fill area
  const fillPath = `${pricePath} L${toX(points.length - 1).toFixed(1)},${(pad.top + innerH).toFixed(1)} L${toX(0).toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`;
  const fillColor = prices[prices.length - 1] >= prices[0] ? "rgba(90,191,160,0.08)" : "rgba(200,90,90,0.08)";

  // Year labels on X axis
  const yearLabels: { x: number; label: string }[] = [];
  let lastYear = "";
  for (let i = 0; i < points.length; i++) {
    const y = points[i].date.slice(0, 4);
    if (y !== lastYear) {
      yearLabels.push({ x: toX(i), label: y });
      lastYear = y;
    }
  }

  // Y-axis labels
  const niceStep = range / 4;
  const yLabels = [minP, minP + niceStep, minP + 2 * niceStep, minP + 3 * niceStep, maxP];

  return (
    <div style={{ padding: "8px 12px 4px 36px", background: "rgba(20,20,40,0.4)", borderBottom: "1px solid rgba(28,28,48,0.3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-dim)" }}>PRICE HISTORY</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)" }}>{points[0].date} → {points[points.length - 1].date}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--accent)" }}>— MA20</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--gold)" }}>-- MA50</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", maxHeight: height, display: "block" }} preserveAspectRatio="none">
        {/* Fill */}
        <path d={fillPath} fill={fillColor} />
        {/* Grid lines */}
        {yLabels.map((v, i) => (
          <line key={i} x1={pad.left} x2={width - pad.right} y1={toY(v)} y2={toY(v)} stroke="rgba(140,140,170,0.1)" strokeWidth="0.5" />
        ))}
        {/* MA50 */}
        {ma50Points.length > 1 && <path d={ma50Points.join(" ")} fill="none" stroke="var(--gold)" strokeWidth="1" strokeDasharray="4,3" opacity="0.6" />}
        {/* MA20 */}
        {ma20Points.length > 1 && <path d={ma20Points.join(" ")} fill="none" stroke="var(--accent)" strokeWidth="1" opacity="0.7" />}
        {/* Price line */}
        <path d={pricePath} fill="none" stroke={trendColor} strokeWidth="1.5" strokeLinejoin="round" />
        {/* Year labels */}
        {yearLabels.map((yl, i) => (
          <text key={i} x={yl.x} y={height - 4} fill="var(--text-dim)" fontSize="8" fontFamily="var(--font-mono)">{yl.label}</text>
        ))}
        {/* Y labels */}
        {yLabels.map((v, i) => (
          <text key={i} x={width - pad.right + 4} y={toY(v) + 3} fill="var(--text-dim)" fontSize="7" fontFamily="var(--font-mono)">{v.toFixed(v >= 100 ? 0 : 2)}</text>
        ))}
      </svg>
    </div>
  );
}
