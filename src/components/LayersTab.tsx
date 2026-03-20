import { LiveLayer, LiveNarrativeData, LiveWatchItem } from "@/hooks/usePortfolioData";

interface Props {
  liveData: LiveLayer[];
  watchlist: LiveWatchItem[];
  narrative: LiveNarrativeData;
}

const priorityBadge = (priority: string): React.CSSProperties => {
  const map: Record<string, { bg: string; color: string }> = {
    URGENT: { bg: "#e74c3c", color: "#fff" },
    HIGH: { bg: "#e67e22", color: "#fff" },
    MEDIUM: { bg: "rgba(201,168,76,0.15)", color: "#c9a84c" },
    LOW: { bg: "rgba(85,85,85,0.2)", color: "#555" },
  };
  const c = map[priority?.toUpperCase()] ?? map.LOW;
  return {
    background: c.bg,
    color: c.color,
    fontFamily: "var(--font-ui)",
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "2px 10px",
    borderRadius: 2,
    whiteSpace: "nowrap",
  };
};

const ipoStatusBadge = (status: string): React.CSSProperties => {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    "PRE-IPO": { bg: "transparent", color: "#c9a84c", border: "#c9a84c" },
    "IPO-WATCH": { bg: "rgba(201,168,76,0.2)", color: "#c9a84c", border: "transparent" },
    FILED: { bg: "#e67e22", color: "#fff", border: "transparent" },
    LISTED: { bg: "#00aa66", color: "#fff", border: "transparent" },
  };
  const c = map[status] ?? map["PRE-IPO"];
  return {
    background: c.bg,
    color: c.color,
    border: `1px solid ${c.border}`,
    fontFamily: "var(--font-ui)",
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "2px 10px",
    borderRadius: 2,
    whiteSpace: "nowrap",
  };
};

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 };
const cardHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 20px",
  borderBottom: "1px solid var(--rim)",
};
const cardTitle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase" as const,
  color: "var(--text-mid)",
};
const emptyState: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-dim)",
  padding: "14px 0 4px",
};

export default function LayersTab({ liveData, watchlist, narrative }: Props) {
  const allLayers = liveData;
  const totalRow = allLayers.find((layer) => layer.name.toUpperCase() === "TOTAL");
  const cashRow = allLayers.find((layer) => layer.name.toUpperCase() === "CASH");
  const chartLayers = allLayers.filter((layer) => {
    const n = layer.name.toUpperCase();
    return n !== "TOTAL";
  });
  const liveGapLayers = allLayers.filter((layer) => layer.gapNotes && layer.gapNotes.trim() !== "" && layer.name.toUpperCase() !== "TOTAL" && layer.name.toUpperCase() !== "CASH");
  const preIpoEntries = watchlist.filter((item) => {
    const status = item.status.toUpperCase();
    return status === "PRE-IPO" || status === "IPO-WATCH" || status === "FILED";
  });
  const layerNarrative = narrative.layer_narrative || "";

  return (
    <div>
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Layer Weights vs Target</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: liveData.length > 0 ? "var(--green)" : "var(--text-dim)" }}>{liveData.length > 0 ? "● LIVE" : "● NO DATA"}</span>
        </div>
        <div style={{ padding: "16px 24px" }}>
          {chartLayers.length === 0 && <div style={emptyState}>No live layer rows found in LAYERS.</div>}
          {chartLayers.map((layer) => {
            const isCash = layer.name.toUpperCase() === "CASH";
            const diff = layer.current - layer.target;
            const pct = layer.target > 0 ? Math.min((layer.current / layer.target) * 100, 130) : isCash ? 100 : 0;
            const diffColor = isCash ? "var(--text-dim)" : Math.abs(diff) < 1 ? "var(--green)" : Math.abs(diff) < 3 ? "var(--amber)" : "var(--red)";
            const fillColor = isCash ? "var(--text-dim)" : layer.current === 0 ? "var(--muted)" : layer.current >= layer.target ? "var(--gold)" : "var(--accent)";
            const barColor = layer.hexColor || fillColor;
            return (
              <div key={layer.name} style={{ display: "grid", gridTemplateColumns: "120px 1fr 48px 44px 52px", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: layer.hexColor || "var(--text-mid)" }}>{layer.name}</div>
                  {layer.keyHoldings && <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", marginTop: 2, letterSpacing: "0.05em" }}>{layer.keyHoldings}</div>}
                </div>
                <div style={{ height: 2, background: "var(--muted)", position: "relative" }}>
                  {!isCash && layer.target > 0 && <div style={{ position: "absolute", top: 0, left: 0, height: 2, background: barColor, width: `${pct}%`, maxWidth: "100%", transition: "width 0.8s ease" }} />}
                  {isCash && <div style={{ position: "absolute", top: 0, left: 0, height: 2, background: "var(--text-dim)", width: `${Math.min(layer.current * 5, 100)}%`, maxWidth: "100%", opacity: 0.4, transition: "width 0.8s ease" }} />}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", textAlign: "right" }}>{layer.current.toFixed(1)}%</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>{isCash ? "" : layer.target > 0 ? `/${layer.target}%` : ""}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: diffColor, textAlign: "right", fontWeight: 600 }}>{isCash ? "—" : `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`}</div>
              </div>
            );
          })}
          {/* TOTAL summary row — no bar */}
          {totalRow && (
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 48px 44px 52px", alignItems: "center", gap: 12, padding: "12px 0", marginTop: 4, borderTop: "2px solid var(--rim)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text)" }}>TOTAL</div>
              <div />
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--gold)", textAlign: "right", fontWeight: 700 }}>{totalRow.current.toFixed(1)}%</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>/{totalRow.target > 0 ? `${totalRow.target}%` : "100%"}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)", textAlign: "right", fontWeight: 700 }}>{totalRow.mv > 0 ? `£${(totalRow.mv / 1000).toFixed(0)}k` : "—"}</div>
            </div>
          )}
        </div>
      </div>

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
