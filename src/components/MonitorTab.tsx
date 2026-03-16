import { LiveMonitor } from "@/hooks/usePortfolioData";
import { COST_CURVES, STRUCTURAL_TRIGGERS } from "@/data/portfolio";
import { useIntelligence } from "@/data/intelligenceState";

interface Props {
  monitorData: LiveMonitor[];
}

const rag = (status: string): React.CSSProperties => {
  const upper = (status ?? "").toUpperCase();
  const solidMap: Record<string, { bg: string; color: string; pulse?: boolean }> = {
    GREEN: { bg: '#00aa66', color: '#fff' },
    NORMAL: { bg: '#00aa66', color: '#fff' },
    CLEAR: { bg: '#00aa66', color: '#fff' },
    PASS: { bg: '#00aa66', color: '#fff' },
    WATCH: { bg: 'transparent', color: '#c9a84c' },
    MONITOR: { bg: 'transparent', color: '#c9a84c' },
    AMBER: { bg: '#e67e22', color: '#fff' },
    RED: { bg: '#e74c3c', color: '#fff', pulse: true },
    TRIGGERED: { bg: '#e74c3c', color: '#fff', pulse: true },
    FIRED: { bg: '#e74c3c', color: '#fff', pulse: true },
  };
  const c = solidMap[upper] ?? solidMap.MONITOR;
  return {
    background: c.bg,
    color: c.color,
    border: c.bg === 'transparent' ? '1px solid #c9a84c' : '1px solid transparent',
    fontFamily: "var(--font-ui)",
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "2px 10px",
    borderRadius: 2,
    whiteSpace: "nowrap",
    ...(c.pulse ? { animation: 'pulse-alert 2s ease-in-out infinite' } : {}),
  };
};

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 };
const cardHeader: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "14px 20px", borderBottom: "1px solid var(--rim)",
};
const cardTitle: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
  letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-mid)",
};
const row: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", justifyContent: "space-between",
  gap: 20, padding: "14px 0", borderBottom: "1px solid rgba(28,28,48,0.5)",
};

const WEEKLY_FALLBACK = [
  { name: "S&P 500 intraday drop >5%", note: "Pause all wave execution", status: "CLEAR" },
  { name: "S&P 500 rolling 5-day >10%", note: "Full review, consider hedge adds", status: "CLEAR" },
  { name: "Uranium spot <$50/lb", note: "CCJ/SPUT thesis review", status: "CLEAR" },
  { name: "Copper spot <$3.50/lb", note: "FCX position review", status: "CLEAR" },
  { name: "Any holding >10% weekly move", note: "Review thesis immediately", status: "CLEAR" },
];

export default function MonitorTab({ monitorData }: Props) {
  const { state } = useIntelligence();
  const hasLive = monitorData.length > 0;

  const liveCostCurves = hasLive ? monitorData.filter((m) => m.type === "cost_curve") : [];
  const liveStructural = hasLive ? monitorData.filter((m) => m.type === "structural") : [];
  const liveDisruption = hasLive ? monitorData.filter((m) => m.type === "disruption") : [];

  // Intelligence state data
  const hasCostCurves = Object.keys(state.costCurves).length > 0;
  const hasStructural = Object.keys(state.structuralTriggers).length > 0;
  const hasDisruption = Object.keys(state.disruptionWatch).length > 0;
  const hasWeekly = Object.keys(state.weeklyMarketTriggers).length > 0;

  // Weekly triggers
  const weeklyData = hasWeekly
    ? Object.entries(state.weeklyMarketTriggers).map(([key, v]) => ({
        name: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        ...v,
      }))
    : WEEKLY_FALLBACK;

  const firedCount = weeklyData.filter(w => w.status === 'FIRED').length;
  const weeklyHeaderStatus = firedCount > 0 ? `${firedCount} FIRED` : 'ALL CLEAR';
  const weeklyHeaderRag = firedCount > 0 ? 'FIRED' : 'CLEAR';

  // Disruption data from intelligence state or live
  const disruptionEntries = hasDisruption
    ? Object.entries(state.disruptionWatch).map(([key, v]) => ({
        name: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        ...v,
      }))
    : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {/* Cost Curves */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Cost Curve Metrics</span>
          <span style={rag("MONITOR")}>
            {hasCostCurves ? `${Object.keys(state.costCurves).length} METRICS` :
             hasLive ? `${liveCostCurves.length} METRICS` : `${COST_CURVES.length} METRICS`}
          </span>
        </div>
        <div style={{ padding: "0 20px 16px" }}>
          {hasCostCurves
            ? Object.entries(state.costCurves).map(([key, m]) => (
                <div key={key} style={row}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>
                      {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                      Current: {m.value} {m.unit} · AMBER: {m.amber} · RED: {m.red}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>
                      Source: {m.source}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginTop: 2, opacity: 0.6 }}>
                      Updated: {m.updated}
                    </div>
                  </div>
                  <span style={rag(m.status)}>{m.status}</span>
                </div>
              ))
            : hasLive
            ? liveCostCurves.map((m) => (
                <div key={m.name} style={row}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{m.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                      Current: {m.current}{m.unit ? ` ${m.unit}` : ""} · AMBER: {m.amberThreshold} · RED: {m.redThreshold}
                    </div>
                    {m.notes && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>→ {m.notes}</div>}
                    {m.lastUpdated && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginTop: 2, opacity: 0.6 }}>Updated: {m.lastUpdated}</div>}
                  </div>
                  <span style={rag(m.status)}>{m.status}</span>
                </div>
              ))
            : COST_CURVES.map((m) => (
                <div key={m.name} style={row}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{m.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                      Current: {m.current} · AMBER: {m.amber} · RED: {m.red}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>→ {m.impact}</div>
                  </div>
                  <span style={rag(m.status)}>{m.status}</span>
                </div>
              ))}
        </div>
      </div>

      {/* Structural Triggers */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Structural Triggers</span>
          <span style={rag("MONITOR")}>
            {hasStructural ? `${Object.keys(state.structuralTriggers).length} TRIGGERS` :
             hasLive ? `${liveStructural.length} TRIGGERS` : `${STRUCTURAL_TRIGGERS.length} TRIGGERS`}
          </span>
        </div>
        <div style={{ padding: "0 20px 16px" }}>
          {hasStructural
            ? Object.entries(state.structuralTriggers).map(([key, t]) => (
                <div key={key} style={row}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>
                      {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                      Current: {t.current} · AMBER: {t.amber} · RED: {t.red}
                    </div>
                    {t.note && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>→ {t.note}</div>}
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginTop: 2, opacity: 0.6 }}>Updated: {t.updated}</div>
                  </div>
                  <span style={rag(t.status)}>{t.status}</span>
                </div>
              ))
            : hasLive
            ? liveStructural.map((t, i) => (
                <div key={t.name + i} style={row}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{t.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                      Current: {t.current}{t.unit ? ` ${t.unit}` : ""} · AMBER: {t.amberThreshold} · RED: {t.redThreshold}
                    </div>
                    {t.notes && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>→ {t.notes}</div>}
                    {t.lastUpdated && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginTop: 2, opacity: 0.6 }}>Updated: {t.lastUpdated}</div>}
                  </div>
                  <span style={rag(t.status)}>{t.status}</span>
                </div>
              ))
            : STRUCTURAL_TRIGGERS.map((t) => (
                <div key={t.id} style={row}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{t.id} — {t.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>→ {t.impact}</div>
                  </div>
                  <span style={rag(t.status)}>{t.status}</span>
                </div>
              ))}
        </div>
      </div>

      {/* Disruption Watch */}
      {(disruptionEntries || liveDisruption.length > 0) && (
        <div style={{ ...card, gridColumn: "1 / -1" }}>
          <div style={cardHeader}>
            <span style={{ ...cardTitle, color: "#e67e22" }}>Disruption Watch</span>
            <span style={rag("AMBER")}>
              {disruptionEntries
                ? `${disruptionEntries.length} RISK${disruptionEntries.length !== 1 ? 'S' : ''}`
                : `${liveDisruption.length} RISK${liveDisruption.length !== 1 ? 'S' : ''}`}
            </span>
          </div>
          <div style={{ padding: "0 20px 16px" }}>
            {disruptionEntries
              ? disruptionEntries.map((d) => (
                  <div key={d.name} style={row}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{d.name}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                        Current: {d.value} {d.unit} · AMBER: {d.amber} · RED: {d.red}
                      </div>
                      {d.note && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>→ {d.note}</div>}
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginTop: 2, opacity: 0.6 }}>Updated: {d.updated}</div>
                    </div>
                    <span style={rag(d.status)}>{d.status}</span>
                  </div>
                ))
              : liveDisruption.map((d, i) => (
                  <div key={d.name + i} style={row}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{d.name}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                        Current: {d.current}{d.unit ? ` ${d.unit}` : ""} · AMBER: {d.amberThreshold} · RED: {d.redThreshold}
                      </div>
                      {d.notes && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>→ {d.notes}</div>}
                      {d.lastUpdated && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginTop: 2, opacity: 0.6 }}>Updated: {d.lastUpdated}</div>}
                    </div>
                    <span style={rag(d.status)}>{d.status}</span>
                  </div>
                ))}
          </div>
        </div>
      )}

      {/* Weekly Market Triggers */}
      <div style={{ ...card, gridColumn: "1 / -1" }}>
        <div style={cardHeader}>
          <span style={cardTitle}>Weekly Market Triggers</span>
          <span style={rag(weeklyHeaderRag)}>{weeklyHeaderStatus}</span>
        </div>
        <div style={{ padding: "0 20px 16px" }}>
          {weeklyData.map((w) => (
            <div key={w.name} style={row}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{w.name}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>→ {w.note}</div>
              </div>
              <span style={rag(w.status)}>{w.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
