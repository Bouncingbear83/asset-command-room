import React, { useMemo, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { LiveLayer } from "@/hooks/usePortfolioData";
import { triggerWebhook } from "@/lib/webhooks";

const LAYER_COLORS = [
  "#c9a84c", "#5b8def", "#e67e22", "#00aa66", "#e74c3c",
  "#9b59b6", "#1abc9c", "#f39c12", "#3498db", "#e91e63",
];

interface Props {
  layers: LiveLayer[];
}

/* ── Custom tooltip ── */
function AllocationTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  const isCash = d.name?.toUpperCase() === "CASH";
  const gap = d.current - d.target;
  return (
    <div style={{
      background: "var(--panel)", border: "1px solid var(--rim)", padding: "8px 12px",
      fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.6,
    }}>
      <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{d.name}</div>
      <div style={{ color: "var(--text-mid)" }}>Actual: {d.current.toFixed(1)}%</div>
      {!isCash && <div style={{ color: "var(--text-mid)" }}>Target: {d.target.toFixed(1)}%</div>}
      {!isCash && (
        <div style={{ color: gap > 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
          Gap: {gap >= 0 ? "+" : ""}{gap.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

/* ── Target marker rendered as custom shape ── */
function TargetMarker(props: any) {
  const { y, height, background } = props;
  const target = props.payload?.target ?? 0;
  if (target <= 0) return null;
  const chartWidth = background?.width ?? 0;
  const chartX = background?.x ?? 0;
  const xPos = chartX + (target / 25) * chartWidth;
  return (
    <line
      x1={xPos} x2={xPos}
      y1={y} y2={y + height}
      stroke="var(--text-mid)"
      strokeWidth={1.5}
      strokeDasharray="4 3"
    />
  );
}

export default function LayersAllocation({ layers }: Props) {
  const totalRow = layers.find(l => l.name.toUpperCase() === "TOTAL");
  const cashRow = layers.find(l => l.name.toUpperCase() === "CASH");
  const investedLayers = layers.filter(l => {
    const n = l.name.toUpperCase();
    return n !== "TOTAL" && n !== "CASH" && n.trim() !== "";
  });

  /* Sort by gap ascending (most underweight first), then append cash */
  const chartData = useMemo(() => {
    const sorted = [...investedLayers]
      .map((l, i) => ({
        name: l.name,
        current: l.current,
        target: l.target,
        color: l.hexColor || LAYER_COLORS[i % LAYER_COLORS.length],
        isCash: false,
      }))
      .sort((a, b) => (a.current - a.target) - (b.current - b.target));

    if (cashRow && cashRow.current > 0) {
      sorted.push({
        name: "Cash",
        current: cashRow.current,
        target: 0,
        color: "var(--muted)",
        isCash: true,
      });
    }

    return sorted;
  }, [investedLayers, cashRow]);

  /* Gap label as closure so it can access chartData */
  const GapLabel = useCallback((props: any) => {
    const { x, y, width, height, index } = props;
    const d = chartData[index];
    if (!d) return null;

    if (d.isCash) {
      return (
        <text
          x={(x ?? 0) + (width ?? 0) + 8}
          y={(y ?? 0) + (height ?? 0) / 2 + 4}
          fill="var(--text-dim)"
          style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600 }}
        >
          {d.current.toFixed(1)}%
        </text>
      );
    }

    const gap = d.current - d.target;
    const color = gap < 0 ? "var(--red)" : gap > 0 ? "var(--green)" : "var(--text-mid)";
    const suffix = gap < 0 ? " under" : gap > 0 ? " over" : "";
    return (
      <text
        x={(x ?? 0) + (width ?? 0) + 8}
        y={(y ?? 0) + (height ?? 0) / 2 + 4}
        fill={color}
        style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600 }}
      >
        {gap >= 0 ? "+" : ""}{gap.toFixed(1)}{suffix}
      </text>
    );
  }, [chartData]);

  /* Metrics */
  const totalMv = useMemo(() => {
    const layerSum = investedLayers.reduce((s, l) => s + l.mv, 0);
    return layerSum + (cashRow?.mv ?? 0);
  }, [investedLayers, cashRow]);

  const investedPct = useMemo(() => {
    return 100 - (cashRow?.current ?? 0);
  }, [cashRow]);

  const dryPowder = cashRow?.mv ?? 0;

  const formatMv = (v: number) => {
    if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(2)}m`;
    if (v >= 1000) return `£${(v / 1000).toFixed(0)}k`;
    return `£${v.toFixed(0)}`;
  };

  const metricCard: React.CSSProperties = {
    background: "var(--panel)",
    border: "1px solid var(--rim)",
    padding: "14px 20px",
    flex: 1,
    minWidth: 140,
  };
  const metricLabel: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)",
    letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4,
  };
  const metricValue: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--gold)", lineHeight: 1,
  };

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 20px", borderBottom: "1px solid var(--rim)",
      }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
          letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-mid)",
        }}>Portfolio Allocation</span>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 9,
          color: layers.length > 0 ? "var(--green)" : "var(--text-dim)",
        }}>{layers.length > 0 ? "● LIVE" : "● NO DATA"}</span>
      </div>

      {/* Metric cards */}
      <div style={{ display: "flex", gap: 12, padding: "20px 20px 0", flexWrap: "wrap" }}>
        <div style={metricCard}>
          <div style={metricLabel}>Total AUM</div>
          <div style={metricValue}>{formatMv(totalMv)}</div>
        </div>
        <div style={metricCard}>
          <div style={metricLabel}>Invested</div>
          <div style={metricValue}>{investedPct.toFixed(1)}%</div>
        </div>
        <div style={metricCard}>
          <div style={metricLabel}>Dry Powder</div>
          <div style={metricValue}>{formatMv(dryPowder)}</div>
        </div>
      </div>

      {/* Horizontal bar chart */}
      <div style={{ padding: "20px 20px 8px", height: 380 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 60, bottom: 4, left: 10 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              type="number"
              domain={[0, 25]}
              ticks={[0, 5, 10, 15, 20, 25]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontFamily: "var(--font-mono)", fontSize: 9, fill: "var(--text-dim)" }}
              axisLine={{ stroke: "var(--rim)" }}
              tickLine={{ stroke: "var(--rim)" }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={90}
              tick={({ x, y, payload }: any) => (
                <g>
                  <text x={x} y={y} dy={4} textAnchor="end" style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, fill: "var(--text)" }}>{payload.value}</text>
                  {payload.value?.toUpperCase() !== "CASH" && (
                    <text
                      x={x + 4}
                      y={y}
                      dy={4}
                      textAnchor="start"
                      style={{ fontFamily: "var(--font-mono)", fontSize: 9, fill: "var(--text-dim)", cursor: "pointer" }}
                      onClick={() => triggerWebhook("stellar-layer-scan", { layer: payload.value }, `Layer scan triggered for ${payload.value}. Check email.`)}
                    >🔍</text>
                  )}
                </g>
              )}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<AllocationTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar
              dataKey="current"
              radius={[0, 3, 3, 0]}
              barSize={20}
              label={<GapLabel />}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
            {chartData.map((entry, i) => (
              entry.target > 0 ? (
                <ReferenceLine
                  key={`target-${i}`}
                  x={entry.target}
                  stroke="var(--text-mid)"
                  strokeDasharray="4 3"
                  strokeWidth={1}
                  ifOverflow="extendDomain"
                  label={false}
                />
              ) : null
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Custom legend */}
      <div style={{
        display: "flex", gap: 20, padding: "0 20px 16px", flexWrap: "wrap",
        fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)",
        letterSpacing: "0.08em",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: "var(--gold)" }} />
          <span>ACTUAL %</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 12, height: 0, borderTop: "2px dashed var(--text-mid)" }} />
          <span>TARGET %</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "var(--red)", fontWeight: 600 }}>-X.X</span>
          <span>UNDER TARGET</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "var(--green)", fontWeight: 600 }}>+X.X</span>
          <span>OVER TARGET</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: "var(--muted)" }} />
          <span>CASH / DRY POWDER</span>
        </div>
      </div>
    </div>
  );
}