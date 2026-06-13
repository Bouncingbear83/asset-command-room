import { LiveMonitor, LiveWeeklyTrigger, LiveEarningsCalendarItem } from "@/hooks/usePortfolioData";
import { useIsMobile } from "@/hooks/use-mobile";
import TickerButton from "@/components/factsheet/TickerButton";
import { triggerWebhook } from "@/lib/webhooks";
import ClaudePromptButton from "@/components/ClaudePromptButton";

interface Props {
  monitorData: LiveMonitor[];
  weeklyTriggers: LiveWeeklyTrigger[];
  earningsCalendar?: LiveEarningsCalendarItem[];
}

const parseThreshold = (val: any): { num: number; isFloor: boolean; isCeiling: boolean } | null => {
  const str = String(val).trim();
  const isFloor = str.startsWith("<") || str.startsWith("≤");
  const isCeiling = str.startsWith(">") || str.startsWith("≥");
  const num = parseFloat(str.replace(/[^0-9.\-]/g, ""));
  if (isNaN(num)) return null;
  return { num, isFloor, isCeiling };
};

const proximityIndicator = (metric: { current: any; amberThreshold: any; unit?: string }) => {
  const cur = parseFloat(String(metric.current).replace(/[^0-9.\-]/g, ""));
  const parsed = parseThreshold(metric.amberThreshold);
  if (isNaN(cur) || !parsed || parsed.num === 0) return null;

  const { num: amber, isCeiling } = parsed;

  let ratio: number;
  let pctToAmber: number;

  if (isCeiling) {
    ratio = amber / cur;
    pctToAmber = Math.round(((amber - cur) / cur) * 100);
  } else {
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

const deriveStatus = (metric: { current: any; amberThreshold: any; redThreshold?: any; status?: string }): string => {
  const cur = parseFloat(String(metric.current).replace(/[^0-9.\-]/g, ""));
  if (isNaN(cur)) return (metric.status || "MONITOR").toUpperCase();

  // Check red threshold first
  const red = parseThreshold(metric.redThreshold);
  if (red) {
    const breached = red.isCeiling ? cur >= red.num : cur <= red.num;
    if (breached) return "RED";
  }

  // Check amber threshold
  const amber = parseThreshold(metric.amberThreshold);
  if (amber) {
    const breached = amber.isCeiling ? cur >= amber.num : cur <= amber.num;
    if (breached) return "AMBER";

    // Within 30% of amber → WATCH
    const ratio = amber.isCeiling ? amber.num / cur : cur / amber.num;
    if (ratio <= 1.3) return "WATCH";
  }

  return "GREEN";
};

const statusSeverity = (s: string): number => {
  const upper = (s || "").toUpperCase();
  if (["RED", "TRIGGERED", "FIRED", "BREACH", "BREACHED"].includes(upper)) return 3;
  if (["AMBER", "WARNING"].includes(upper)) return 2;
  if (["WATCH", "MONITOR"].includes(upper)) return 1;
  return 0;
};

const worstStatus = (items: { current: any; amberThreshold: any; redThreshold?: any; status?: string }[]): string => {
  if (items.length === 0) return "CLEAR";
  let worst = 0;
  let worstLabel = "GREEN";
  for (const item of items) {
    const derived = deriveStatus(item);
    const sev = statusSeverity(derived);
    if (sev > worst) { worst = sev; worstLabel = derived; }
  }
  return worstLabel;
};

const headerLabel = (items: { current: any; amberThreshold: any; redThreshold?: any; status?: string }[]): string => {
  if (items.length === 0) return "NO LIVE DATA";
  const counts: Record<string, number> = {};
  for (const item of items) {
    const derived = deriveStatus(item);
    const sev = statusSeverity(derived);
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

export default function MonitorTab({ monitorData, weeklyTriggers, earningsCalendar = [] }: Props) {
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
              <span style={rag(deriveStatus(metric))}>{deriveStatus(metric)}</span>
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
              <span style={rag(deriveStatus(trigger))}>{deriveStatus(trigger)}</span>
            </div>
          ))}
        </div>
      </div>

      {liveDisruption.length > 0 && (
        <div style={{ ...card, gridColumn: "1 / -1" }}>
          <div style={cardHeader}>
            <span style={{ ...cardTitle, color: "var(--amber)" }}>Disruption Watch</span>
            <span style={rag(worstStatus(liveDisruption))}>
              {headerLabel(liveDisruption)}
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
                <span style={rag(deriveStatus(item))}>{deriveStatus(item)}</span>
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

      {/* Earnings Calendar */}
      {earningsCalendar.length > 0 && (
        <div style={{ ...card, gridColumn: "1 / -1" }}>
          <div style={cardHeader}>
            <span style={cardTitle}>Earnings Calendar</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.08em" }}>
              {earningsCalendar.length} holdings
            </span>
          </div>
          <div style={{ padding: isMobile ? "0 12px 16px" : "0 20px 16px", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
              <thead>
                <tr>
                  {["Ticker", "Next Earnings", "Window", "Fiscal", "Status", ""].map((h) => (
                    <th key={h} style={{ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-dim)", padding: "8px 12px", borderBottom: "1px solid var(--rim)", textAlign: "left", fontWeight: 400, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...earningsCalendar]
                  .sort((a, b) => {
                    const at = new Date(a.nextEarningsDate).getTime();
                    const bt = new Date(b.nextEarningsDate).getTime();
                    return (isNaN(at) ? Infinity : at) - (isNaN(bt) ? Infinity : bt);
                  })
                  .map((item) => {
                    const d = new Date(item.nextEarningsDate);
                    const now = new Date(); now.setHours(0,0,0,0);
                    const target = new Date(d); target.setHours(0,0,0,0);
                    const days = isNaN(d.getTime()) ? Infinity : Math.round((target.getTime() - now.getTime()) / 86400000);
                    const urgColor = days <= 2 ? "var(--red)" : days <= 7 ? "var(--amber)" : "var(--text-dim)";
                    const urgBg = days <= 2 ? "var(--red-dim)" : days <= 7 ? "var(--amber-dim)" : "rgba(28,28,48,0.5)";
                    const dateStr = isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                    return (
                      <tr key={`${item.ticker}-${item.nextEarningsDate}`} style={{ borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                        <td style={{ padding: "10px 12px" }}><TickerButton ticker={item.ticker} style={{ color: "var(--gold)", fontWeight: 700 }}>{item.ticker}</TickerButton></td>
                        <td style={{ padding: "10px 12px", color: "var(--text)" }}>{dateStr}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ color: urgColor, background: urgBg, padding: "2px 8px", borderRadius: 2, fontSize: 9, letterSpacing: "0.1em", border: `1px solid color-mix(in srgb, ${urgColor} 30%, transparent)` }}>
                            {days === Infinity ? "TBD" : days < 0 ? "PAST" : `${days}D`}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", color: "var(--text-dim)" }}>{item.fiscalPeriod || "—"}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 2, fontSize: 9, letterSpacing: "0.1em", background: item.confirmed ? "var(--green-dim)" : "rgba(28,28,48,0.5)", color: item.confirmed ? "var(--green)" : "var(--text-dim)", border: `1px solid ${item.confirmed ? "rgba(90,191,160,0.3)" : "var(--rim)"}` }}>
                            {item.confirmed ? "CONFIRMED" : "TENTATIVE"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 8px" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => triggerWebhook("stellar-earnings-prep", { ticker: item.ticker }, `Earnings prep triggered for ${item.ticker}`)} style={{ background: "none", border: "1px solid var(--rim)", color: "var(--text-dim)", cursor: "pointer", padding: "3px 8px", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em" }}>📋 Prep</button>
                            <ClaudePromptButton templateKey="earnings_post" context={{ ticker: item.ticker, fiscal_period: item.fiscalPeriod || "—", earnings_date: item.nextEarningsDate || "—" }} style={{ border: "1px solid var(--accent)", color: "var(--accent)", padding: "3px 8px", fontSize: 9 }}>🔬 Post</ClaudePromptButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
