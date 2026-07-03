import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ScoreRationale, DisruptionRationale } from "@/hooks/useRationales";

// ── Dimension config ──

const DIMENSIONS: { key: string; label: string; max: number; scoreKey: keyof ScoreRationale; rationaleKey: keyof ScoreRationale }[] = [
  { key: "substrate", label: "Substrate", max: 27, scoreKey: "substrate_score", rationaleKey: "substrate_rationale" },
  { key: "demand", label: "Demand", max: 22, scoreKey: "demand_score", rationaleKey: "demand_rationale" },
  { key: "moat", label: "Moat", max: 18, scoreKey: "moat_score", rationaleKey: "moat_rationale" },
  { key: "valuation", label: "Margin of Safety", max: 10, scoreKey: "mos_score", rationaleKey: "mos_rationale" },
  { key: "mgmt", label: "Management", max: 7, scoreKey: "mgmt_score", rationaleKey: "mgmt_rationale" },
  { key: "disruption", label: "Disruption", max: 16, scoreKey: "disruption_score", rationaleKey: "disruption_rationale" },
];

const DISRUPTION_COMPONENTS: { key: string; label: string; max: number; scoreKey: keyof DisruptionRationale; rationaleKey: keyof DisruptionRationale }[] = [
  { key: "sub_avail", label: "Substitute Availability", max: 20, scoreKey: "sub_avail_score", rationaleKey: "sub_avail_rationale" },
  { key: "economics", label: "Economics", max: 20, scoreKey: "economics_score", rationaleKey: "economics_rationale" },
  { key: "govt", label: "Government Support", max: 20, scoreKey: "govt_support_score", rationaleKey: "govt_support_rationale" },
  { key: "demand", label: "Demand Vulnerability", max: 20, scoreKey: "demand_vuln_score", rationaleKey: "demand_vuln_rationale" },
  { key: "time", label: "Time to Viable Alternative", max: 20, scoreKey: "time_viability_score", rationaleKey: "time_viability_rationale" },
];

function scoreColor(score: number, max: number): string {
  const pct = score / max;
  if (pct >= 0.8) return "var(--green)";
  if (pct >= 0.6) return "var(--amber)";
  return "var(--red)";
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return dateStr; }
}

const ACTION_BADGE_STYLE: Record<string, React.CSSProperties> = {
  NEW_SCORE: { background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(90,191,160,0.2)" },
  UPDATE_SCORE: { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(110,142,200,0.2)" },
  EXITED: { background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(200,90,90,0.2)" },
};

// ── Truncatable text ──

function TruncatedText({ text, lines = 3 }: { text: string; lines?: number }) {
  const [showAll, setShowAll] = useState(false);
  if (!text) return <span style={{ color: "var(--text-dim)", fontStyle: "italic" }}>—</span>;

  return (
    <div>
      <div style={{
        fontFamily: "var(--font-ui), var(--font-mono)",
        fontSize: 10,
        color: "var(--text-mid)",
        lineHeight: 1.6,
        ...(showAll ? {} : {
          display: "-webkit-box",
          WebkitLineClamp: lines,
          WebkitBoxOrient: "vertical" as const,
          overflow: "hidden",
        }),
      }}>
        {text}
      </div>
      {text.length > 180 && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowAll(!showAll); }}
          style={{
            background: "none", border: "none", color: "var(--accent)", cursor: "pointer",
            fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.1em", marginTop: 2, padding: 0,
          }}
        >
          {showAll ? "show less" : "show more"}
        </button>
      )}
    </div>
  );
}

// ── Score Rationale Panel ──

export function ScoreRationalePanel({ rationale, showHistory, history }: {
  rationale: ScoreRationale;
  showHistory?: boolean;
  history?: ScoreRationale[];
}) {
  const [expandedHistory, setExpandedHistory] = useState<Set<number>>(new Set());
  const [showAllHistory, setShowAllHistory] = useState(false);

  const toggleHistory = (idx: number) => {
    setExpandedHistory(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  return (
    <div style={{ padding: "12px 16px 16px 36px", background: "rgba(20,20,40,0.4)", borderBottom: "1px solid rgba(28,28,48,0.3)" }}>
      {/* Thesis summary */}
      {rationale.thesis_summary && (
        <div style={{ marginBottom: 12, padding: "10px 14px", background: "rgba(28,28,48,0.5)", border: "1px solid var(--rim)", borderLeft: "3px solid var(--gold)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 6 }}>THESIS</div>
          <div style={{ fontFamily: "var(--font-ui), var(--font-mono)", fontSize: 11, color: "var(--text)", lineHeight: 1.7 }}>
            {rationale.thesis_summary}
          </div>
        </div>
      )}

      {/* Change note */}
      {rationale.change_note && (
        <div style={{ marginBottom: 12, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", fontStyle: "italic" }}>
          <span style={{ color: "var(--accent)", fontStyle: "normal", letterSpacing: "0.08em", fontSize: 8 }}>LAST CHANGE:</span>{" "}
          {rationale.change_note} — {formatDate(rationale.scored_at)}
        </div>
      )}

      {/* 6 dimension cards in 3×2 grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
        {DIMENSIONS.map(dim => {
          const score = rationale[dim.scoreKey] as number;
          const text = rationale[dim.rationaleKey] as string;
          const color = scoreColor(score, dim.max);
          return (
            <div key={dim.key} style={{ padding: "8px 10px", background: "rgba(28,28,48,0.5)", border: "1px solid var(--rim)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-dim)" }}>{dim.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color }}>{score} / {dim.max}</span>
                </div>
              </div>
              <TruncatedText text={text} />
            </div>
          );
        })}
      </div>

      {/* Scored metadata */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginBottom: showHistory ? 16 : 0 }}>
        Scored {formatDate(rationale.scored_at)} by {rationale.scored_by}
        {rationale.price_at_scoring != null && ` · Price at scoring: ${rationale.price_at_scoring.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`}
      </div>

      {/* Score history timeline */}
      {showHistory && history && history.length > 1 && (
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 8 }}>SCORE HISTORY</div>
          <div style={{ borderLeft: "2px solid var(--rim)", paddingLeft: 12, marginLeft: 4 }}>
            {(showAllHistory ? history.slice(1) : history.slice(1, 6)).map((entry, idx) => {
              const isOpen = expandedHistory.has(idx);
              const actionStyle = ACTION_BADGE_STYLE[entry.action] ?? ACTION_BADGE_STYLE.UPDATE_SCORE;
              return (
                <div key={idx} style={{ position: "relative", marginBottom: 8 }}>
                  {/* Timeline dot */}
                  <div style={{ position: "absolute", left: -17, top: 4, width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", border: "2px solid var(--panel)" }} />
                  <div
                    onClick={(e) => { e.stopPropagation(); toggleHistory(idx); }}
                    style={{ cursor: "pointer", padding: "6px 10px", background: "rgba(28,28,48,0.3)", border: "1px solid rgba(28,28,48,0.4)" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>{formatDate(entry.scored_at)}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: entry.total_score >= 80 ? "var(--green)" : entry.total_score >= 60 ? "var(--accent)" : "var(--amber)" }}>{entry.total_score}</span>
                      <span style={{ ...actionStyle, fontFamily: "var(--font-mono)", fontSize: 7, letterSpacing: "0.1em", padding: "1px 6px", borderRadius: 2 }}>{entry.action}</span>
                      {entry.change_note && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", fontStyle: "italic", flex: 1 }}>{entry.change_note}</span>}
                      <span style={{ color: "var(--text-dim)" }}>{isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}</span>
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{ padding: "8px 10px", background: "rgba(20,20,40,0.3)", borderTop: "none" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                        {DIMENSIONS.map(dim => {
                          const s = entry[dim.scoreKey] as number;
                          const t = entry[dim.rationaleKey] as string;
                          return (
                            <div key={dim.key} style={{ padding: "4px 6px", background: "rgba(28,28,48,0.4)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-dim)", letterSpacing: "0.1em" }}>{dim.label.toUpperCase()}</span>
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: scoreColor(s, dim.max) }}>{s}/{dim.max}</span>
                              </div>
                              <TruncatedText text={t} lines={2} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {!showAllHistory && history.length > 6 && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowAllHistory(true); }}
                style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.1em", padding: "4px 0" }}
              >
                Show all ({history.length - 1} entries)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Disruption Rationale Panel ──

export function DisruptionRationalePanel({ rationale, showHistory, history }: {
  rationale: DisruptionRationale;
  showHistory?: boolean;
  history?: DisruptionRationale[];
}) {
  return (
    <div style={{ padding: "12px 16px 16px 36px", background: "rgba(20,20,40,0.4)", borderBottom: "1px solid rgba(28,28,48,0.3)" }}>
      {/* 5 component cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, marginBottom: 12 }}>
        {DISRUPTION_COMPONENTS.map(comp => {
          const score = rationale[comp.scoreKey] as number | null;
          const text = rationale[comp.rationaleKey] as string | null;
          const color = score != null ? scoreColor(score, comp.max) : "var(--text-dim)";
          return (
            <div key={comp.key} style={{ padding: "8px 10px", background: "rgba(28,28,48,0.5)", border: "1px solid var(--rim)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dim)" }}>{comp.label}</span>
                {score != null && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color }}>{score} / {comp.max}</span>
                  </div>
                )}
              </div>
              <TruncatedText text={text || ""} />
            </div>
          );
        })}
      </div>

      {/* Amber/Red triggers */}
      <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
        {rationale.amber_trigger && (
          <div style={{ flex: 1, padding: "6px 10px", background: "rgba(200,146,90,0.08)", border: "1px solid rgba(200,146,90,0.2)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--amber)", fontWeight: 700, letterSpacing: "0.1em" }}>⚠ AMBER TRIGGER</span>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-mid)", marginTop: 4, lineHeight: 1.5 }}>{rationale.amber_trigger}</div>
          </div>
        )}
        {rationale.red_trigger && (
          <div style={{ flex: 1, padding: "6px 10px", background: "rgba(200,90,90,0.08)", border: "1px solid rgba(200,90,90,0.2)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--red)", fontWeight: 700, letterSpacing: "0.1em" }}>🔴 RED TRIGGER</span>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-mid)", marginTop: 4, lineHeight: 1.5 }}>{rationale.red_trigger}</div>
          </div>
        )}
      </div>

      {/* Evidence */}
      {rationale.evidence && (
        <div style={{ padding: "6px 10px", background: "rgba(28,28,48,0.5)", border: "1px solid var(--rim)", marginBottom: 10 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--accent)", letterSpacing: "0.1em", fontWeight: 700 }}>EVIDENCE</span>
          <div style={{ fontFamily: "var(--font-ui), var(--font-mono)", fontSize: 10, color: "var(--text-mid)", lineHeight: 1.6, marginTop: 4 }}>{rationale.evidence}</div>
        </div>
      )}

      {/* Change note + metadata */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
        Last assessed: {formatDate(rationale.scored_at)}
        {rationale.change_note && <span style={{ fontStyle: "italic" }}> — {rationale.change_note}</span>}
      </div>

      {/* Disruption history timeline */}
      {showHistory && history && history.length > 1 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 8 }}>DISRUPTION HISTORY</div>
          <div style={{ borderLeft: "2px solid var(--rim)", paddingLeft: 12, marginLeft: 4 }}>
            {history.slice(1, 6).map((entry, idx) => {
              const st = entry.status?.toUpperCase() || "MONITOR";
              const stColor = st === "GREEN" ? "var(--green)" : st === "RED" ? "var(--red)" : "var(--amber)";
              return (
                <div key={idx} style={{ position: "relative", marginBottom: 6 }}>
                  <div style={{ position: "absolute", left: -17, top: 4, width: 8, height: 8, borderRadius: "50%", background: stColor, border: "2px solid var(--panel)" }} />
                  <div style={{ padding: "4px 8px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>{formatDate(entry.scored_at)}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: entry.disruption_score >= 70 ? "var(--green)" : entry.disruption_score >= 50 ? "var(--amber)" : "var(--red)" }}>{entry.disruption_score}/100</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, padding: "1px 6px", borderRadius: 2, color: stColor, background: st === "GREEN" ? "var(--green-dim)" : st === "RED" ? "var(--red-dim)" : "var(--amber-dim)", border: `1px solid ${stColor}22` }}>{st}</span>
                    {entry.change_note && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", fontStyle: "italic" }}>{entry.change_note}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Compact Thesis Card (for Holdings tab) ──

const TIER_COLOR: Record<string, string> = {
  CORE: "var(--gold)",
  ANCHOR: "var(--accent)",
  SATELLITE: "var(--amber)",
  SPEC: "var(--red)",
};

export function ThesisCard({ rationale }: { rationale: ScoreRationale }) {
  const tierUpper = (rationale.tier || "").toUpperCase();
  const tierColor = TIER_COLOR[tierUpper] || "var(--text-dim)";

  return (
    <div style={{ padding: "8px 12px 8px 36px", background: "rgba(20,20,40,0.4)", borderBottom: "1px solid rgba(28,28,48,0.25)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700,
          color: rationale.total_score >= 80 ? "var(--green)" : rationale.total_score >= 60 ? "var(--accent)" : "var(--amber)",
        }}>
          {rationale.total_score}
        </span>
        {rationale.tier && (
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em",
            padding: "2px 8px", borderRadius: 2, color: tierColor,
            background: `color-mix(in srgb, ${tierColor} 15%, transparent)`,
            border: `1px solid color-mix(in srgb, ${tierColor} 30%, transparent)`,
          }}>
            {tierUpper}
          </span>
        )}
      </div>
      {rationale.thesis_summary && (
        <div style={{ fontFamily: "var(--font-ui), var(--font-mono)", fontSize: 10, color: "var(--text-mid)", lineHeight: 1.6, marginBottom: 4 }}>
          {rationale.thesis_summary}
        </div>
      )}
      {rationale.change_note && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", fontStyle: "italic" }}>
          {rationale.change_note} — {formatDate(rationale.scored_at)}
        </div>
      )}
    </div>
  );
}

// ── Loading indicator ──

export function RationaleLoading() {
  return (
    <div style={{ padding: "12px 16px 12px 36px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.08em" }}>
      Loading rationale data…
    </div>
  );
}
