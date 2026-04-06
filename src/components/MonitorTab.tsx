import { LiveMonitor, LiveWeeklyTrigger } from "@/hooks/usePortfolioData";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  monitorData: LiveMonitor[];
  weeklyTriggers: LiveWeeklyTrigger[];
}

const proximityIndicator = (metric: { current: any; amberThreshold: any; unit?: string }) => {
  const cur = parseFloat(String(metric.current).replace(/[^0-9.\-]/g, ""));
  const amber = parseFloat(String(metric.amberThreshold).replace(/[^0-9.\-]/g, ""));
  if (isNaN(cur) || isNaN(amber) || amber === 0) return null;

  // For cost curves, lower current = more disruptive, amber is the "danger" floor
  // Check if amber threshold uses "<" logic (current should stay above amber)
  const amberStr = String(metric.amberThreshold).trim();
  const isFloor = amberStr.startsWith("<") || amberStr.startsWith("≤");
  // For ">" thresholds (e.g., humanoid cost > 50000), invert
  const isCeiling = amberStr.startsWith(">") || amberStr.startsWith("≥");

  let ratio: number;
  let pctToAmber: number;

  if (isCeiling) {
    // Current should stay below amber (e.g., humanoid cost)
    ratio = amber / cur;
    pctToAmber = Math.round(((amber - cur) / cur) * 100);
  } else {
    // Default: current above amber is safe (cost curves — lower is disruptive)
    ratio = cur / amber;
    pctToAmber = Math.round(((cur - amber) / amber) * 100);
  }

  let arrow: string;
  let label: string;
  let color: string;

  if (ratio > 2) {
    arrow = "→"; color = "#00aa66"; label = `${Math.abs(pctToAmber)}% to amber`;
  } else if (ratio > 1.3) {
    arrow = "→"; color = "#00aa66"; label = `${Math.abs(pctToAmber)}% to amber`;
  } else if (ratio > 1) {
    arrow = "↘"; color = "#c9a84c"; label = `${Math.abs(pctToAmber)}% to amber`;
  } else {
    arrow = "↘↘"; color = "#e67e22"; label = "breached";
  }

  return { arrow, color, label };
};

const statusSeverity = (s: string): number => {
  const upper = (s || "").toUpperCase();
  if (["RED", "TRIGGERED", "FIRED", "BREACH", "BREACHED"].includes(upper)) return 3;
  if (["AMBER", "WARNING"].includes(upper)) return 2;
  if (["WATCH", "MONITOR"].includes(upper)) return 1;
  return 0;
};

const worstStatus = (items: { status?: string }[]): string => {
  if (items.length === 0) return "CLEAR";
  let worst = 0;
  let worstLabel = "GREEN";
  for (const item of items) {
    const sev = statusSeverity(item.status || "GREEN");
    if (sev > worst) { worst = sev; worstLabel = (item.status || "GREEN").toUpperCase(); }
  }
  return worstLabel;
};

const headerLabel = (items: { status?: string }[]): string => {
  if (items.length === 0) return "NO LIVE DATA";
  const counts: Record<string, number> = {};
  for (const item of items) {
    const sev = statusSeverity(item.status || "GREEN");
    const label = sev === 3 ? "RED" : sev === 2 ? "AMBER" : sev === 1 ? "WATCH" : "GREEN";
    counts[label] = (counts[label] || 0) + 1;
  }
  if (Object.keys(counts).length === 1 && counts["GREEN"]) return "ALL GREEN";
  const parts: string[] = [];
  for (const level of ["RED", "AMBER", "WATCH"]) {
    if (counts[level]) parts.push(`${counts[level]} ${level}`);
  }
  return parts.length > 0 ? parts.join(", ") : "ALL GREEN";
};

const rag = (status: string): React.CSSProperties => {
  const upper = (status ?? "").toUpperCase();
  const solidMap: Record<string, { bg: string; color: string; pulse?: boolean }> = {
    GREEN: { bg: "#00aa66", color: "#fff" },
    NORMAL: { bg: "#00aa66", color: "#fff" },
    CLEAR: { bg: "#00aa66", color: "#fff" },
    PASS: { bg: "#00aa66", color: "#fff" },
    WATCH: { bg: "transparent", color: "#c9a84c" },
    MONITOR: { bg: "transparent", color: "#c9a84c" },
    AMBER: { bg: "#e67e22", color: "#fff" },
    RED: { bg: "#e74c3c", color: "#fff", pulse: true },
    TRIGGERED: { bg: "#e74c3c", color: "#fff", pulse: true },
    FIRED: { bg: "#e74c3c", color: "#fff", pulse: true },
  };
  const c = solidMap[upper] ?? solidMap.MONITOR;
  return {
    background: c.bg,
    color: c.color,
    border: c.bg === "transparent" ? "1px solid #c9a84c" : "1px solid transparent",
    fontFamily: "var(--font-ui)",
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "2px 10px",
    borderRadius: 2,
    whiteSpace: "nowrap",
    ...(c.pulse ? { animation: "pulse-alert 2s ease-in-out infinite" } : {}),
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
const emptyState: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-dim)",
  padding: "14px 0 4px",
};

export default function MonitorTab({ monitorData, weeklyTriggers }: Props) {
  const isMobile = useIsMobile();
  const liveCostCurves = monitorData.filter((item) => item.type.includes("cost"));
  const liveStructural = monitorData.filter((item) => item.type.includes("structural"));
  const liveDisruption = monitorData.filter((item) => item.type.includes("disruption"));

  const firedCount = weeklyTriggers.filter((trigger) => trigger.status.toUpperCase() === "FIRED" || trigger.status.toUpperCase() === "TRIGGERED").length;
  const weeklyHeaderStatus = weeklyTriggers.length === 0 ? "NO LIVE DATA" : firedCount > 0 ? `${firedCount} FIRED` : "ALL CLEAR";
  const weeklyHeaderRag = weeklyTriggers.length === 0 ? "MONITOR" : firedCount > 0 ? "FIRED" : "CLEAR";

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Cost Curve Metrics</span>
          <span style={rag(worstStatus(liveCostCurves))}>
            {headerLabel(liveCostCurves)}
          </span>
        </div>
        <div style={{ padding: isMobile ? "0 12px 16px" : "0 20px 16px" }}>
          {liveCostCurves.length === 0 && <div style={emptyState}>No live cost-curve rows found in MONITOR.</div>}
          {liveCostCurves.map((metric) => (
            <div key={metric.name} style={row}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{metric.name}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", display: "flex", flexDirection: isMobile ? "column" as const : "row" as const, alignItems: isMobile ? "flex-start" : "center", gap: isMobile ? 2 : 6, flexWrap: "wrap" }}>
                  <span>Current: {metric.current}{metric.unit ? ` ${metric.unit}` : ""}</span>
                  {(() => {
                    const p = proximityIndicator(metric);
                    if (!p) return null;
                    return <span style={{ color: p.color, fontWeight: 600 }}>{p.arrow} {p.label}</span>;
                  })()}
                  <span>{isMobile ? "" : "· "}AMBER: {metric.amberThreshold} · RED: {metric.redThreshold}</span>
                </div>
                {metric.notes && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>→ {metric.notes}</div>}
                {metric.lastUpdated && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginTop: 2, opacity: 0.6 }}>Updated: {metric.lastUpdated}</div>}
              </div>
              <span style={rag(metric.status)}>{metric.status || "MONITOR"}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Structural Triggers</span>
          <span style={rag(worstStatus(liveStructural))}>
            {headerLabel(liveStructural)}
          </span>
        </div>
        <div style={{ padding: isMobile ? "0 12px 16px" : "0 20px 16px" }}>
          {liveStructural.length === 0 && <div style={emptyState}>No live structural-trigger rows found in MONITOR.</div>}
          {liveStructural.map((trigger, index) => (
            <div key={`${trigger.name}-${index}`} style={row}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{trigger.name}</div>
                {isMobile ? (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                    <div>Current: {trigger.current}{trigger.unit ? ` ${trigger.unit}` : ""}</div>
                    <div>AMBER: {trigger.amberThreshold} · RED: {trigger.redThreshold}</div>
                  </div>
                ) : (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                    Current: {trigger.current}{trigger.unit ? ` ${trigger.unit}` : ""} · AMBER: {trigger.amberThreshold} · RED: {trigger.redThreshold}
                  </div>
                )}
                {trigger.notes && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>→ {trigger.notes}</div>}
                {trigger.lastUpdated && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginTop: 2, opacity: 0.6 }}>Updated: {trigger.lastUpdated}</div>}
              </div>
              <span style={rag(trigger.status)}>{trigger.status || "MONITOR"}</span>
            </div>
          ))}
        </div>
      </div>

      {liveDisruption.length > 0 && (
        <div style={{ ...card, gridColumn: "1 / -1" }}>
          <div style={cardHeader}>
            <span style={{ ...cardTitle, color: "var(--amber)" }}>Disruption Watch</span>
            <span style={rag("AMBER")}>
              {`${liveDisruption.length} RISK${liveDisruption.length !== 1 ? "S" : ""}`}
            </span>
          </div>
          <div style={{ padding: isMobile ? "0 12px 16px" : "0 20px 16px" }}>
            {liveDisruption.map((item, index) => (
              <div key={`${item.name}-${index}`} style={row}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{item.name}</div>
                  {isMobile ? (
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                      <div>Current: {item.current}{item.unit ? ` ${item.unit}` : ""}</div>
                      <div>AMBER: {item.amberThreshold} · RED: {item.redThreshold}</div>
                    </div>
                  ) : (
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                      Current: {item.current}{item.unit ? ` ${item.unit}` : ""} · AMBER: {item.amberThreshold} · RED: {item.redThreshold}
                    </div>
                  )}
                  {item.notes && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>→ {item.notes}</div>}
                  {item.lastUpdated && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginTop: 2, opacity: 0.6 }}>Updated: {item.lastUpdated}</div>}
                </div>
                <span style={rag(item.status)}>{item.status || "MONITOR"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...card, gridColumn: "1 / -1" }}>
        <div style={cardHeader}>
          <span style={cardTitle}>Weekly Market Triggers</span>
          <span style={rag(weeklyHeaderRag)}>{weeklyHeaderStatus}</span>
        </div>
        <div style={{ padding: isMobile ? "0 12px 16px" : "0 20px 16px" }}>
          {weeklyTriggers.length === 0 && <div style={emptyState}>No live weekly trigger rows found in MACRO_STATE.</div>}
          {weeklyTriggers.map((trigger) => (
            <div key={trigger.key} style={row}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{trigger.name}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>→ {trigger.note}</div>
              </div>
              <span style={rag(trigger.status)}>{trigger.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
