import React from "react";
import { LiveMacroStateRow, usePortfolioData } from "@/hooks/usePortfolioData";
import { useIsMobile } from "@/hooks/use-mobile";
import CommandHeader from "@/components/command/CommandHeader";
import MoversCard from "@/components/command/MoversCard";
import ActionInbox from "@/components/ActionInbox";
import CapitalQueue from "@/components/command/CapitalQueue";
import OpportunityRank from "@/components/OpportunityRank";
import NarrativeSignalsCard from "@/components/NarrativeSignalsCard";
import LayerReviewCalendar from "@/components/LayerReviewCalendar";
import ToolsCard from "@/components/command/ToolsCard";
import ScheduledReviewsCard from "@/components/ScheduledReviewsCard";

const SIGNAL_KEYS = ["VIX", "SP500_YTD_PCT", "GOLD_USD", "PAUSE_ACTIVE", "EARNINGS_BLACKOUT"] as const;
const SIGNAL_LABELS: Record<(typeof SIGNAL_KEYS)[number], string> = {
  VIX: "VIX",
  SP500_YTD_PCT: "S&P 500 YTD",
  GOLD_USD: "Gold USD",
  PAUSE_ACTIVE: "Pause Active",
  EARNINGS_BLACKOUT: "Earnings Blackout",
};

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 };
const cardHeaderBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
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

const statusChip = (status: string): React.CSSProperties => {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    PASS: { bg: "var(--green-dim)", color: "var(--green)", border: "rgba(90,191,160,0.2)" },
    CLEAR: { bg: "var(--green-dim)", color: "var(--green)", border: "rgba(90,191,160,0.2)" },
    WATCH: { bg: "transparent", color: "var(--amber)", border: "var(--amber)" },
    MONITOR: { bg: "transparent", color: "var(--amber)", border: "var(--amber)" },
    TRIGGERED: { bg: "var(--red-dim)", color: "var(--red)", border: "rgba(200,90,90,0.2)" },
    FIRED: { bg: "var(--red-dim)", color: "var(--red)", border: "rgba(200,90,90,0.2)" },
    AMBER: { bg: "var(--amber-dim)", color: "var(--amber)", border: "rgba(200,146,90,0.2)" },
    GREEN: { bg: "var(--green-dim)", color: "var(--green)", border: "rgba(90,191,160,0.2)" },
  };
  const c = colors[status.toUpperCase()] ?? colors.WATCH;
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

function deriveSignalStatus(row?: LiveMacroStateRow) {
  if (!row) return "MONITOR";
  const current = row.currentValue.toUpperCase();
  if (current === "YES" || current === "TRUE" || current === "ACTIVE") return "TRIGGERED";
  if (current === "NO" || current === "FALSE" || current === "INACTIVE" || current === "CLEAR") return "CLEAR";
  return row.status || "MONITOR";
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const ragChipStyle = (color: string): React.CSSProperties => ({
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  letterSpacing: "0.1em",
  padding: "2px 6px",
  borderRadius: 2,
  color,
  background: `color-mix(in srgb, ${color} 10%, transparent)`,
  whiteSpace: "nowrap",
});

export default function CommandTab() {
  const { holdings, watchlist, layers, scores, riskControls, macroState, narrativeData, earningsCalendar, cashTotal } =
    usePortfolioData();
  const isMobile = useIsMobile();

  const cardHeader: React.CSSProperties = { ...cardHeaderBase, padding: isMobile ? "10px 12px" : "12px 14px" };

  const cashGbp = cashTotal || 0;

  // Narrative derived data
  const priorityNarratives = [
    narrativeData.week_priority_1,
    narrativeData.week_priority_2,
    narrativeData.week_priority_3,
  ]
    .map((item) => item?.trim() ?? "")
    .filter(Boolean);
  const weeklyWatch = [narrativeData.week_watch_1, narrativeData.week_watch_2, narrativeData.week_watch_3]
    .map((item) => item?.trim() ?? "")
    .filter(Boolean);
  const hasNarrative = Boolean(
    narrativeData.macro_regime ||
    narrativeData.posture_rationale ||
    priorityNarratives.length ||
    narrativeData.key_risk_this_week ||
    narrativeData.layer_narrative,
  );

  // Macro signals
  const macroSignals = SIGNAL_KEYS.map((key) => ({ key, row: macroState[key] }))
    .filter((entry) => Boolean(entry.row))
    .map(({ key, row }) => ({
      name: SIGNAL_LABELS[key],
      status: deriveSignalStatus(row),
      detail: [
        row?.currentValue ? `Current ${row.currentValue}` : "",
        row?.thresholdAmber ? `Amber ${row.thresholdAmber}` : "",
        row?.thresholdRed ? `Red ${row.thresholdRed}` : "",
        row?.note || "",
      ]
        .filter(Boolean)
        .join(" · "),
    }));
  const macroStatusCounts = macroSignals.reduce(
    (acc, s) => {
      const upper = s.status.toUpperCase();
      if (upper === "TRIGGERED" || upper === "FIRED" || upper === "RED") acc.RED++;
      else if (upper === "AMBER" || upper === "WATCH" || upper === "MONITOR") acc.AMBER++;
      else acc.GREEN++;
      return acc;
    },
    { GREEN: 0, AMBER: 0, RED: 0 },
  );

  // Risk controls
  const riskStatusCounts = riskControls.reduce(
    (acc, r) => {
      const s = (r.status || "").toUpperCase();
      if (s === "BREACH" || s === "RED") acc.BREACH++;
      else if (s === "WATCH" || s === "AMBER" || s === "WARNING") acc.WATCH++;
      else acc.SAFE++;
      return acc;
    },
    { SAFE: 0, WATCH: 0, BREACH: 0 },
  );

  const divRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 0",
    borderBottom: "1px solid rgba(28,28,48,0.4)",
    gap: 16,
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 0, alignItems: "start" }}>
      {/* ── HEADER BAR ── */}
      <CommandHeader
        layers={layers}
        riskControls={riskControls}
        macroState={macroState}
        cashGbp={cashGbp}
        isMobile={isMobile}
      />

      {/* ── CARD 1: MOVERS ── */}
      <MoversCard holdings={holdings} watchlist={watchlist} earnings={earningsCalendar} />

      {/* ── CARD 2: ACTION INBOX ── */}
      <ActionInbox holdings={holdings} watchlist={watchlist} earnings={earningsCalendar} />

      {/* ── CARD 3: CAPITAL QUEUE ── */}
      <CapitalQueue holdings={holdings} watchlist={watchlist} layers={layers} macroState={macroState} />

      {/* ── CARD 4: OPPORTUNITY RANK ── */}
      <OpportunityRank scores={scores} holdings={holdings} watchlist={watchlist} />

      {/* ── CARD 5: NARRATIVE SIGNALS ── */}
      <NarrativeSignalsCard />

      {/* ── LAYER REVIEW CALENDAR ── */}
      <LayerReviewCalendar />

      {/* ── SCHEDULED REVIEWS ── */}
      <ScheduledReviewsCard />

      {/* ── CARD 6: RISK CONTROLS (collapsible) ── */}
      <details style={card}>
        <summary style={{ ...cardHeader, cursor: "pointer", userSelect: "none", listStyle: "none" }}>
          <span style={cardTitle}>Risk Controls</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {riskStatusCounts.SAFE > 0 && (
              <span style={ragChipStyle("var(--green)")}>{riskStatusCounts.SAFE} SAFE</span>
            )}
            {riskStatusCounts.WATCH > 0 && (
              <span style={ragChipStyle("var(--amber)")}>{riskStatusCounts.WATCH} WATCH</span>
            )}
            {riskStatusCounts.BREACH > 0 && (
              <span style={ragChipStyle("var(--red)")}>{riskStatusCounts.BREACH} BREACH</span>
            )}
            {riskControls.length === 0 && <span style={ragChipStyle("var(--text-dim)")}>—</span>}
          </div>
        </summary>
        <div style={{ padding: isMobile ? "0 12px 12px" : "0 20px 12px" }}>
          {riskControls.length === 0 ? (
            <div style={{ padding: "16px 0", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
              Risk controls unavailable
            </div>
          ) : (
            riskControls.map((r) => {
              let currentNum = parseFloat(String(r.current).replace(/[^0-9.\-]/g, ""));
              if (!isNaN(currentNum) && Math.abs(currentNum) <= 1) currentNum = currentNum * 100;
              const isFloor = r.key.toLowerCase().includes("floor");
              const thresholdRaw = r.threshold;
              const redMatch = thresholdRaw.match(/RED\s+([\d.]+)/i);
              const amberMatch = thresholdRaw.match(/AMBER\s+([\d.]+)/i);
              let limit = redMatch ? parseFloat(redMatch[1]) : amberMatch ? parseFloat(amberMatch[1]) : 100;
              let amberLimit = amberMatch ? parseFloat(amberMatch[1]) : null;
              if (limit <= 1) limit = limit * 100;
              if (amberLimit != null && amberLimit <= 1) amberLimit = amberLimit * 100;
              const maxBar = Math.max(limit * 1.3, currentNum * 1.2, 20);
              const fillPct = Math.min((currentNum / maxBar) * 100, 100);
              const thresholdPct = Math.min((limit / maxBar) * 100, 100);
              let barColor = "var(--green)";
              if (isFloor) {
                if (currentNum < limit) barColor = "var(--red)";
                else if (amberLimit != null && currentNum < amberLimit * 1.1) barColor = "var(--amber)";
              } else {
                if (currentNum > limit) barColor = "var(--red)";
                else if (currentNum > limit - 1) barColor = "var(--amber)";
              }
              const label =
                r.key === "SGLD_AUM_PCT"
                  ? "SGLD"
                  : r.key === "TOP5_CONCENTRATION"
                    ? "Top-5"
                    : r.key === "HEDGE_FLOOR_PCT"
                      ? "Hedge"
                      : r.key === "BIO_TWIN_RISK_PCT"
                        ? "BioTwin"
                        : r.label;
              return (
                <div key={r.key} style={{ padding: "10px 0", borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text)",
                        minWidth: 60,
                      }}
                    >
                      {label}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: barColor }}>
                      {isNaN(currentNum) ? r.current : `${currentNum.toFixed(1)}%`} / {limit.toFixed(1)}%{" "}
                      {isFloor ? "floor" : "cap"}
                    </span>
                  </div>
                  <div
                    style={{
                      position: "relative",
                      height: 8,
                      background: "rgba(255,255,255,0.06)",
                      borderRadius: 2,
                      overflow: "visible",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        height: "100%",
                        width: `${fillPct}%`,
                        background: barColor,
                        borderRadius: 2,
                        transition: "width 0.4s ease",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: -2,
                        left: `${thresholdPct}%`,
                        width: 1,
                        height: 12,
                        background: "var(--text-dim)",
                        opacity: 0.6,
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </details>

      {/* ── CARD 7: NARRATIVE + WEEKLY WATCH (merged, collapsible) ── */}
      <details
        style={{ ...card, borderLeft: "3px solid transparent" }}
        open={!isMobile}
        onToggle={(e) => {
          const el = e.currentTarget;
          el.style.borderLeftColor = el.open ? "var(--gold)" : "transparent";
        }}
      >
        <summary style={{ ...cardHeader, cursor: "pointer", userSelect: "none", listStyle: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <span style={cardTitle}>Narrative</span>
            {narrativeData.macro_regime && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  color: "var(--text-dim)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {narrativeData.macro_regime}
              </span>
            )}
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: "var(--text-dim)",
              letterSpacing: "0.12em",
              flexShrink: 0,
            }}
          >
            ▸ {formatDate(narrativeData.last_updated)}
          </span>
        </summary>
        <div style={{ padding: isMobile ? 16 : 32 }}>
          {hasNarrative ? (
            <div style={{ display: "grid", gap: 18 }}>
              {priorityNarratives.length > 0 && (
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "var(--text-dim)",
                      marginBottom: 8,
                    }}
                  >
                    Weekly Priorities
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {priorityNarratives.map((item, index) => (
                      <div key={`${item}-${index}`} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span
                          style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--gold)", marginTop: 2 }}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text-mid)", lineHeight: 1.6 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: isMobile ? 15 : 18,
                    fontWeight: 300,
                    color: "var(--text)",
                    lineHeight: 1.3,
                    marginBottom: 4,
                  }}
                >
                  {narrativeData.macro_regime || "Macro regime pending"}
                </div>
                {narrativeData.posture_rationale && (
                  <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>
                    {narrativeData.posture_rationale}
                  </div>
                )}
              </div>
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "var(--text-dim)",
                      marginBottom: 8,
                    }}
                  >
                    Key Risk
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-mid)", lineHeight: 1.6 }}>
                    {narrativeData.key_risk_this_week || "No key risk supplied."}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "var(--text-dim)",
                      marginBottom: 8,
                    }}
                  >
                    Layer Narrative
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-mid)", lineHeight: 1.6 }}>
                    {narrativeData.layer_narrative || "No layer commentary supplied."}
                  </div>
                </div>
              </div>
              {/* Weekly Watch (merged in) */}
              {weeklyWatch.length > 0 && (
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "var(--text-dim)",
                      marginBottom: 8,
                    }}
                  >
                    Weekly Watch
                  </div>
                  {weeklyWatch.map((item, index) => {
                    const tickerMatch = item.match(/^([A-Z]{2,6})\b/);
                    return (
                      <div
                        key={`watch-${index}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "6px 0",
                          borderBottom: index < weeklyWatch.length - 1 ? "1px solid rgba(28,28,48,0.3)" : "none",
                        }}
                      >
                        {tickerMatch && (
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 11,
                              fontWeight: 700,
                              color: "var(--text)",
                              minWidth: 44,
                            }}
                          >
                            {tickerMatch[1]}
                          </span>
                        )}
                        <span style={statusChip("MONITOR")}>MONITOR</span>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 10,
                            color: "var(--text-dim)",
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: isMobile ? "normal" : "nowrap",
                          }}
                        >
                          {tickerMatch ? item.slice(tickerMatch[0].length).replace(/^[\s:–—-]+/, "") : item}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>
              Awaiting first n8n run
            </div>
          )}
        </div>
      </details>

      {/* ── CARD 8: MACRO SIGNALS (collapsible) ── */}
      <details style={card}>
        <summary style={{ ...cardHeader, cursor: "pointer", userSelect: "none", listStyle: "none" }}>
          <span style={cardTitle}>Macro Signals</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {macroStatusCounts.GREEN > 0 && (
              <span style={ragChipStyle("var(--green)")}>{macroStatusCounts.GREEN} GREEN</span>
            )}
            {macroStatusCounts.AMBER > 0 && (
              <span style={ragChipStyle("var(--amber)")}>{macroStatusCounts.AMBER} AMBER</span>
            )}
            {macroStatusCounts.RED > 0 && <span style={ragChipStyle("var(--red)")}>{macroStatusCounts.RED} RED</span>}
            {macroSignals.length === 0 && <span style={ragChipStyle("var(--text-dim)")}>—</span>}
          </div>
        </summary>
        <div style={{ padding: isMobile ? "0 12px 8px" : "0 20px 8px" }}>
          {macroSignals.map((signal) => (
            <div key={signal.name} style={divRow}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                  {signal.name}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                  {signal.detail || "No note"}
                </div>
              </div>
              <span style={statusChip(signal.status)}>{signal.status}</span>
            </div>
          ))}
          {macroSignals.length === 0 && (
            <div style={{ padding: "16px 0", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
              Macro signals unavailable
            </div>
          )}
        </div>
      </details>

      {/* ── CARD 9: TOOLS (collapsible) ── */}
      <ToolsCard holdings={holdings} watchlist={watchlist} layers={layers} />
    </div>
  );
}
