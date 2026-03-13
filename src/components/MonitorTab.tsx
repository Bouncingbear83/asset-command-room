import { LiveMonitor } from "@/hooks/usePortfolioData";
import { COST_CURVES, STRUCTURAL_TRIGGERS } from "@/data/portfolio";

interface Props {
  monitorData: LiveMonitor[];
}

const rag = (status: string): React.CSSProperties => {
  const upper = (status ?? "").toUpperCase();
  const map: Record<string, [string, string, string]> = {
    NORMAL: ["var(--green-dim)", "var(--green)", "rgba(90,191,160,0.2)"],
    GREEN: ["var(--green-dim)", "var(--green)", "rgba(90,191,160,0.2)"],
    CLEAR: ["var(--green-dim)", "var(--green)", "rgba(90,191,160,0.2)"],
    WATCH: ["var(--amber-dim)", "var(--amber)", "rgba(200,146,90,0.2)"],
    AMBER: ["var(--amber-dim)", "var(--amber)", "rgba(200,146,90,0.2)"],
    MONITOR: ["var(--accent-dim)", "var(--accent)", "rgba(110,142,200,0.2)"],
    RED: ["var(--red-dim)", "var(--red)", "rgba(200,90,90,0.2)"],
    TRIGGERED: ["var(--red-dim)", "var(--red)", "rgba(200,90,90,0.2)"],
  };
  const [bg, color, border] = map[upper] ?? map.MONITOR;
  return {
    background: bg,
    color,
    border: `1px solid ${border}`,
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    padding: "3px 10px",
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
  textTransform: "uppercase",
  color: "var(--text-mid)",
};
const row: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 20,
  padding: "14px 0",
  borderBottom: "1px solid rgba(28,28,48,0.5)",
};

const WEEKLY = [
  { name: "S&P 500 intraday drop >5%", detail: "Pause all wave execution", status: "CLEAR" },
  { name: "S&P 500 rolling 5-day >10%", detail: "Full review, consider hedge adds", status: "CLEAR" },
  { name: "Uranium spot <$50/lb", detail: "CCJ/SPUT thesis review", status: "CLEAR" },
  { name: "Copper spot <$3.50/lb", detail: "FCX position review", status: "CLEAR" },
  { name: "Any holding >10% weekly move", detail: "Review thesis immediately", status: "CLEAR" },
];

export default function MonitorTab({ monitorData }: Props) {
  const hasLive = monitorData.length > 0;

  const liveCostCurves = hasLive ? monitorData.filter((m) => m.type === "cost_curve") : [];
  const liveStructural = hasLive ? monitorData.filter((m) => m.type === "structural") : [];
  const liveDisruption = hasLive ? monitorData.filter((m) => m.type === "disruption") : [];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Cost Curve Metrics</span>
          <span style={rag("MONITOR")}>
            {hasLive ? `${liveCostCurves.length} METRICS` : `${COST_CURVES.length} METRICS`}
          </span>
        </div>
        <div style={{ padding: "0 20px 16px" }}>
          {hasLive
            ? liveCostCurves.map((m) => (
                <div key={m.name} style={row}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{m.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                      Current: {m.current}{m.unit ? ` ${m.unit}` : ""} · AMBER: {m.amberThreshold} · RED: {m.redThreshold}
                    </div>
                    {m.notes && (
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>
                        → {m.notes}
                      </div>
                    )}
                    {m.lastUpdated && (
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginTop: 2, opacity: 0.6 }}>
                        Updated: {m.lastUpdated}
                      </div>
                    )}
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
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>
                      → {m.impact}
                    </div>
                  </div>
                  <span style={rag(m.status)}>{m.status}</span>
                </div>
              ))}
        </div>
      </div>

      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Structural Triggers</span>
          <span style={rag("MONITOR")}>
            {hasLive ? `${liveStructural.length} TRIGGERS` : `${STRUCTURAL_TRIGGERS.length} TRIGGERS`}
          </span>
        </div>
        <div style={{ padding: "0 20px 16px" }}>
          {hasLive
            ? liveStructural.map((t, i) => (
                <div key={t.name + i} style={row}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{t.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                      Current: {t.current}{t.unit ? ` ${t.unit}` : ""} · AMBER: {t.amberThreshold} · RED: {t.redThreshold}
                    </div>
                    {t.notes && (
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>
                        → {t.notes}
                      </div>
                    )}
                    {t.lastUpdated && (
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginTop: 2, opacity: 0.6 }}>
                        Updated: {t.lastUpdated}
                      </div>
                    )}
                  </div>
                  <span style={rag(t.status)}>{t.status}</span>
                </div>
              ))
            : STRUCTURAL_TRIGGERS.map((t) => (
                <div key={t.id} style={row}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>
                      {t.id} — {t.name}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                      → {t.impact}
                    </div>
                  </div>
                  <span style={rag(t.status)}>{t.status}</span>
                </div>
              ))}
        </div>
      </div>

      {liveDisruption.length > 0 && (
        <div style={{ ...card, gridColumn: "1 / -1" }}>
          <div style={cardHeader}>
            <span style={{ ...cardTitle, color: "var(--amber)" }}>Disruption Watch</span>
            <span style={rag("AMBER")}>{liveDisruption.length} RISK{liveDisruption.length !== 1 ? "S" : ""}</span>
          </div>
          <div style={{ padding: "0 20px 16px" }}>
            {liveDisruption.map((d, i) => (
              <div key={d.name + i} style={row}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{d.name}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                    Current: {d.current}{d.unit ? ` ${d.unit}` : ""} · AMBER: {d.amberThreshold} · RED: {d.redThreshold}
                  </div>
                  {d.notes && (
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>
                      → {d.notes}
                    </div>
                  )}
                  {d.lastUpdated && (
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginTop: 2, opacity: 0.6 }}>
                      Updated: {d.lastUpdated}
                    </div>
                  )}
                </div>
                <span style={rag(d.status)}>{d.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...card, gridColumn: "1 / -1" }}>
        <div style={cardHeader}>
          <span style={cardTitle}>Weekly Market Triggers</span>
          <span style={rag("CLEAR")}>ALL CLEAR</span>
        </div>
        <div style={{ padding: "0 20px 16px" }}>
          {WEEKLY.map((w) => (
            <div key={w.name} style={row}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{w.name}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                  → {w.detail}
                </div>
              </div>
              <span style={rag(w.status)}>{w.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
