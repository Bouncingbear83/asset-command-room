import { LiveLayer, LiveNarrativeData, LiveWatchItem, LiveHolding, LiveScore } from "@/hooks/usePortfolioData";
import React, { useMemo } from "react";
import { triggerWebhook } from "@/lib/webhooks";
import LayersAllocation from "./LayersAllocation";
import {
  buildProfileMixIndex,
  LayerProfileBreakdown,
  ProfileLegend,
  ProfileMatrix,
  type ProfileBreakdownKey,
} from "./LayerProfileBreakdown";

interface Props {
  liveData: LiveLayer[];
  watchlist: LiveWatchItem[];
  narrative: LiveNarrativeData;
  /** Held positions (sipp + isa + jisa, mapped to LiveHolding shape) — needed for profile-by-layer AUM. */
  holdings?: LiveHolding[];
  /** SCORES sheet rows — provides RETURN_PROFILE / COMPOUNDER_SUBTYPE per ticker. */
  scores?: LiveScore[];
  /** Deep-link from a matrix cell into Holdings tab filtered to those tickers. */
  onNavigateToHoldings?: (tickers: string[]) => void;
}

/* ── colour palette for layers without explicit hex ── */
const LAYER_COLORS = [
  "#c9a84c", "#5b8def", "#e67e22", "#00aa66", "#e74c3c",
  "#9b59b6", "#1abc9c", "#f39c12", "#3498db", "#e91e63",
];


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


export default function LayersTab({
  liveData,
  watchlist,
  narrative,
  holdings = [],
  scores = [],
  onNavigateToHoldings,
}: Props) {
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

  // Build profile-by-layer index from holdings × scores (HOLDINGS rows are
  // already held positions, so no extra Held_Status filter is needed).
  const profileMix = useMemo(() => buildProfileMixIndex(holdings, scores), [holdings, scores]);
  const matrixLayerOrder = useMemo(
    () => investedLayers.map((l) => l.name).filter(Boolean),
    [investedLayers],
  );

  /* Assign colors to layers */
  return (
    <div>
      {/* ── Profile legend (colour key for breakdown bars + matrix) ── */}
      <ProfileLegend />

      {/* ── Horizontal Bar Chart ── */}
      <LayersAllocation layers={liveData} />

      {/* ── Detail table: Key Holdings + MV + per-layer profile breakdown ── */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Layer Detail</span>
        </div>
        <div style={{ padding: "0 20px 12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px 60px", gap: 8, padding: "10px 0", borderBottom: "1px solid var(--rim)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Layer</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Key Holdings</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "right" }}>MV</div>
            <div />
          </div>
          {chartLayers.map((layer, i) => {
            const color = layer.hexColor || LAYER_COLORS[i % LAYER_COLORS.length] || "var(--text-mid)";
            const isCashRow = layer.name.toUpperCase() === "CASH";
            return (
              <div key={`detail-${i}`} style={{ padding: "10px 0", borderBottom: "1px solid rgba(28,28,48,0.3)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px 60px", gap: 8, alignItems: "center" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{layer.name}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>{layer.keyHoldings || "—"}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)", textAlign: "right" }}>{layer.mv > 0 ? `£${(layer.mv / 1000).toFixed(1)}k` : "—"}</div>
                  {!isCashRow && (
                    <button
                      title={`Scan ${layer.name}`}
                      onClick={() => triggerWebhook("stellar-layer-scan", { layer: layer.name }, `Layer scan triggered for ${layer.name}. Check email.`)}
                      style={{ background: "none", border: "1px solid var(--rim)", color: "var(--text-dim)", cursor: "pointer", padding: "3px 8px", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", transition: "color 0.2s", justifySelf: "center" }}
                    >
                      🔍
                    </button>
                  )}
                </div>
                {!isCashRow && (
                  <LayerProfileBreakdown layerName={layer.name} index={profileMix} layerCurrentPct={layer.current} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Substrate × Return Profile matrix ── */}
      <ProfileMatrix
        index={profileMix}
        layerOrder={matrixLayerOrder}
        onCellClick={
          onNavigateToHoldings
            ? (_layer: string, _profile: ProfileBreakdownKey, tickers: string[]) => onNavigateToHoldings(tickers)
            : undefined
        }
      />

      {/* ── Gap Actions + Pre-IPO ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={card}>
          <div style={cardHeader}><span style={cardTitle}>Layer Gap Actions</span>{liveGapLayers.length > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--green)" }}>● LIVE</span>}</div>
          <div style={{ padding: "0 20px 12px" }}>
            {layerNarrative && <div style={{ ...emptyState, paddingBottom: 12, borderBottom: "1px solid rgba(28,28,48,0.4)" }}>{layerNarrative}</div>}
            {liveGapLayers.length === 0 && <div style={emptyState}>No live gap actions found in LAYERS.</div>}
            {liveGapLayers.map((layer, i) => (
              <div key={`gap-${i}`} style={{ padding: "12px 0", borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
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
