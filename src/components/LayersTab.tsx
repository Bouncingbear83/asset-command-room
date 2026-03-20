import { LiveLayer, LiveNarrativeData, LiveWatchItem } from "@/hooks/usePortfolioData";
import React, { useMemo } from "react";

interface Props {
  liveData: LiveLayer[];
  watchlist: LiveWatchItem[];
  narrative: LiveNarrativeData;
}

/* ── colour palette for layers without explicit hex ── */
const LAYER_COLORS = [
  "#c9a84c", "#5b8def", "#e67e22", "#00aa66", "#e74c3c",
  "#9b59b6", "#1abc9c", "#f39c12", "#3498db", "#e91e63",
];

/* ── SVG donut helpers ── */
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const clampedEnd = Math.min(endAngle, startAngle + 359.999);
  const start = polarToCartesian(cx, cy, r, clampedEnd);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = clampedEnd - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

/* ── badge helpers ── */
const priorityBadge = (priority: string): React.CSSProperties => {
  const map: Record<string, { bg: string; color: string }> = {
    URGENT: { bg: "#e74c3c", color: "#fff" },
    HIGH: { bg: "#e67e22", color: "#fff" },
    MEDIUM: { bg: "rgba(201,168,76,0.15)", color: "#c9a84c" },
    LOW: { bg: "rgba(85,85,85,0.2)", color: "#555" },
  };
  const c = map[priority?.toUpperCase()] ?? map.LOW;
  return { background: c.bg, color: c.color, fontFamily: "var(--font-ui)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 10px", borderRadius: 2, whiteSpace: "nowrap" };
};

const ipoStatusBadge = (status: string): React.CSSProperties => {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    "PRE-IPO": { bg: "transparent", color: "#c9a84c", border: "#c9a84c" },
    "IPO-WATCH": { bg: "rgba(201,168,76,0.2)", color: "#c9a84c", border: "transparent" },
    FILED: { bg: "#e67e22", color: "#fff", border: "transparent" },
    LISTED: { bg: "#00aa66", color: "#fff", border: "transparent" },
  };
  const c = map[status] ?? map["PRE-IPO"];
  return { background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontFamily: "var(--font-ui)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 10px", borderRadius: 2, whiteSpace: "nowrap" };
};

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 };
const cardHeader: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--rim)" };
const cardTitle: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "var(--text-mid)" };
const emptyState: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", padding: "14px 0 4px" };

/* ── Donut Ring Component ── */
function DonutRing({ segments, radius, strokeWidth, cx, cy, opacity = 1 }: {
  segments: { value: number; color: string; label: string }[];
  radius: number;
  strokeWidth: number;
  cx: number;
  cy: number;
  opacity?: number;
}) {
  const total = segments.reduce((s, seg) => s + Math.max(seg.value, 0), 0);
  if (total <= 0) return null;
  let angle = 0;
  return (
    <g opacity={opacity}>
      {segments.map((seg, i) => {
        if (seg.value <= 0) return null;
        const sweep = (seg.value / total) * 360;
        const startAngle = angle;
        angle += sweep;
        return (
          <path
            key={i}
            d={describeArc(cx, cy, radius, startAngle, startAngle + sweep - 1)}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ transition: "all 0.8s ease" }}
          >
            <title>{seg.label}: {seg.value.toFixed(1)}%</title>
          </path>
        );
      })}
    </g>
  );
}

export default function LayersTab({ liveData, watchlist, narrative }: Props) {
  const allLayers = liveData;
  const totalRow = allLayers.find((l) => l.name.toUpperCase() === "TOTAL");
  const cashRow = allLayers.find((l) => l.name.toUpperCase() === "CASH");
  const investedLayers = allLayers.filter((l) => {
    const n = l.name.toUpperCase();
    return n !== "TOTAL" && n !== "CASH";
  });
  const chartLayers = allLayers.filter((l) => l.name.toUpperCase() !== "TOTAL");

  const liveGapLayers = allLayers.filter((l) => l.gapNotes && l.gapNotes.trim() !== "" && l.name.toUpperCase() !== "TOTAL" && l.name.toUpperCase() !== "CASH");
  const preIpoEntries = watchlist.filter((item) => {
    const s = item.status.toUpperCase();
    return s === "PRE-IPO" || s === "IPO-WATCH" || s === "FILED";
  });
  const layerNarrative = narrative.layer_narrative || "";

  /* Assign colors to layers */
  const coloredLayers = useMemo(() => {
    return investedLayers.map((l, i) => ({
      ...l,
      color: l.hexColor || LAYER_COLORS[i % LAYER_COLORS.length],
    }));
  }, [investedLayers]);

  const currentSegments = useMemo(() =>
    coloredLayers.filter(l => l.current > 0).map(l => ({ value: l.current, color: l.color, label: l.name })),
    [coloredLayers]
  );

  const targetSegments = useMemo(() =>
    coloredLayers.filter(l => l.target > 0).map(l => ({ value: l.target, color: l.color, label: l.name })),
    [coloredLayers]
  );

  const totalInvested = totalRow?.current ?? investedLayers.reduce((s, l) => s + l.current, 0);

  const CX = 140, CY = 140, SIZE = 280;

  return (
    <div>
      {/* ── Donut + Legend ── */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Portfolio Allocation</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: liveData.length > 0 ? "var(--green)" : "var(--text-dim)" }}>{liveData.length > 0 ? "● LIVE" : "● NO DATA"}</span>
        </div>
        <div style={{ padding: "24px", display: "flex", gap: 48, alignItems: "center", flexWrap: "wrap" }}>
          {/* SVG Donut */}
          <div style={{ position: "relative", width: SIZE, height: SIZE, flexShrink: 0 }}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              {/* Target ring (inner, faint) */}
              <DonutRing segments={targetSegments} radius={80} strokeWidth={18} cx={CX} cy={CY} opacity={0.25} />
              {/* Current ring (outer, bold) */}
              <DonutRing segments={currentSegments} radius={110} strokeWidth={22} cx={CX} cy={CY} />
            </svg>
            {/* Center label */}
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700, color: "var(--gold)", lineHeight: 1 }}>
                {totalInvested.toFixed(0)}%
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em", marginTop: 4 }}>INVESTED</div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 200 }}>
            <div style={{ display: "grid", gridTemplateColumns: "12px 1fr 50px 50px 50px", gap: 8, alignItems: "center", marginBottom: 4 }}>
              <div />
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Layer</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "right" }}>Actual</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "right" }}>Target</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "right" }}>Gap</div>
            </div>
            {coloredLayers.map((layer, i) => {
              const diff = layer.current - layer.target;
              const diffColor = Math.abs(diff) < 1 ? "var(--green)" : Math.abs(diff) < 3 ? "var(--amber)" : "var(--red)";
              return (
                <div key={`legend-${i}`} style={{ display: "grid", gridTemplateColumns: "12px 1fr 50px 50px 50px", gap: 8, alignItems: "center", padding: "4px 0" }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: layer.color }} />
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{layer.name}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", textAlign: "right" }}>{layer.current.toFixed(1)}%</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textAlign: "right" }}>{layer.target > 0 ? `${layer.target.toFixed(0)}%` : "—"}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: diffColor, textAlign: "right", fontWeight: 600 }}>{layer.target > 0 ? `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}` : "—"}</div>
                </div>
              );
            })}
            {/* Cash row */}
            {cashRow && (
              <div style={{ display: "grid", gridTemplateColumns: "12px 1fr 50px 50px 50px", gap: 8, alignItems: "center", padding: "4px 0", borderTop: "1px solid var(--rim)", marginTop: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: "var(--text-dim)", opacity: 0.4 }} />
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cash</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)", textAlign: "right" }}>{cashRow.current.toFixed(1)}%</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textAlign: "right" }}>—</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textAlign: "right" }}>—</div>
              </div>
            )}
            {/* Total */}
            {totalRow && (
              <div style={{ display: "grid", gridTemplateColumns: "12px 1fr 50px 50px 50px", gap: 8, alignItems: "center", padding: "6px 0", borderTop: "2px solid var(--rim)", marginTop: 2 }}>
                <div />
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Total</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--gold)", textAlign: "right", fontWeight: 700 }}>{totalRow.current.toFixed(1)}%</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textAlign: "right" }}>{totalRow.target > 0 ? `${totalRow.target.toFixed(0)}%` : "100%"}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--gold)", textAlign: "right", fontWeight: 700 }}>{totalRow.mv > 0 ? `£${(totalRow.mv / 1000).toFixed(0)}k` : "—"}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Detail table: Key Holdings + MV ── */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Layer Detail</span>
        </div>
        <div style={{ padding: "0 20px 12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px", gap: 8, padding: "10px 0", borderBottom: "1px solid var(--rim)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Layer</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Key Holdings</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "right" }}>MV</div>
          </div>
          {chartLayers.map((layer, i) => {
            const color = coloredLayers.find(c => c.name === layer.name)?.color || layer.hexColor || "var(--text-mid)";
            return (
              <div key={`detail-${i}`} style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px", gap: 8, padding: "10px 0", borderBottom: "1px solid rgba(28,28,48,0.3)", alignItems: "center" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{layer.name}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>{layer.keyHoldings || "—"}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)", textAlign: "right" }}>{layer.mv > 0 ? `£${(layer.mv / 1000).toFixed(1)}k` : "—"}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Gap Actions + Pre-IPO ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={card}>
          <div style={cardHeader}><span style={cardTitle}>Layer Gap Actions</span>{liveGapLayers.length > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--green)" }}>● LIVE</span>}</div>
          <div style={{ padding: "0 20px 12px" }}>
            {layerNarrative && <div style={{ ...emptyState, paddingBottom: 12, borderBottom: "1px solid rgba(28,28,48,0.4)" }}>{layerNarrative}</div>}
            {liveGapLayers.length === 0 && <div style={emptyState}>No live gap actions found in LAYERS.</div>}
            {liveGapLayers.map((layer) => (
              <div key={layer.name} style={{ padding: "12px 0", borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: layer.hexColor || "var(--text)" }}>{layer.name}</span>
                  {layer.priority && <span style={priorityBadge(layer.priority)}>{layer.priority}</span>}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginBottom: 4 }}>{layer.gapNotes}</div>
                {layer.keyHoldings && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", opacity: 0.7 }}>Holdings: {layer.keyHoldings}</div>}
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={cardHeader}><span style={cardTitle}>Pre-IPO Watch</span></div>
          <div style={{ padding: "0 20px 12px" }}>
            {preIpoEntries.length === 0 && <div style={emptyState}>No live PRE-IPO or IPO-WATCH rows found in WATCHLIST.</div>}
            {preIpoEntries.map((item) => (
              <div key={`${item.ticker}-${item.name}`} style={{ padding: "12px 0", borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "var(--text)" }}>{item.name || item.ticker}</span>
                  <span style={ipoStatusBadge(item.status.toUpperCase())}>{item.status}</span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>{item.layer} · {item.rationale || item.trigger || item.entry}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
