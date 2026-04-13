import { useState } from "react";
import { ChevronRight, ChevronDown, AlertTriangle } from "lucide-react";
import { LiveHolding } from "@/hooks/usePortfolioData";
import { useIsMobile } from "@/hooks/use-mobile";

const CLAUDE_PROJECT_URL = "https://claude.ai/project/019ca3a9-aefe-77ea-af76-db62fd96f4e1";

export interface ReviewFlag {
  ticker: string;
  date: string;
  prefix: "W_EXIT" | "Q_REVIEW" | "M_REVIEW" | "RESEARCH" | "UNKNOWN";
  priority: "HIGH" | "MEDIUM" | "LOW";
  flagType: string;
  reason: string;
  isStale: boolean;
}

const FLAG_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  EXIT_SIZE_HARD: { label: "SIZE ⚠️", color: "var(--red)" },
  EXIT_SIZE_SOFT: { label: "SIZE", color: "var(--amber)" },
  EXIT_RECLASS: { label: "RECLASS", color: "var(--amber)" },
  EXIT_DECAY: { label: "STALE", color: "var(--amber)" },
  EARNINGS: { label: "EARNINGS", color: "var(--accent)" },
  COMPETITOR: { label: "COMPETITOR", color: "var(--accent)" },
  THESIS_WEAK: { label: "THESIS", color: "var(--red)" },
  KILL_CONDITION: { label: "KILL", color: "var(--red)" },
  REGULATORY: { label: "REGULATORY", color: "var(--amber)" },
  STALE: { label: "STALE", color: "var(--amber)" },
  PRICE_MOVE: { label: "PRICE", color: "var(--amber)" },
  DISRUPTION: { label: "DISRUPTION", color: "var(--amber)" },
};

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: "var(--red)",
  MEDIUM: "var(--amber)",
  LOW: "#666",
};

const PRIORITY_BG: Record<string, string> = {
  HIGH: "rgba(226, 75, 74, 0.08)",
  MEDIUM: "rgba(200, 169, 110, 0.08)",
  LOW: "rgba(102, 102, 102, 0.05)",
};

const PRIORITY_EMOJI: Record<string, string> = {
  HIGH: "🔴",
  MEDIUM: "🟡",
  LOW: "🟢",
};

export function parseReviewFlag(ticker: string, triggerDate: string, triggerNote: string): ReviewFlag | null {
  const note = (triggerNote || "").trim();
  if (!note) return null;

  let prefix: ReviewFlag["prefix"] = "UNKNOWN";
  if (note.startsWith("W_EXIT")) prefix = "W_EXIT";
  else if (note.startsWith("Q_REVIEW")) prefix = "Q_REVIEW";
  else if (note.startsWith("M_REVIEW")) prefix = "M_REVIEW";
  else if (note.startsWith("Research Commit:")) prefix = "RESEARCH";

  let priority: ReviewFlag["priority"] = "LOW";
  if (note.includes("HIGH")) priority = "HIGH";
  else if (note.includes("MEDIUM")) priority = "MEDIUM";

  const typeMatch = note.match(/\[([A-Z_]+)\]/);
  const flagType = typeMatch ? typeMatch[1] : prefix;

  // Extract reason: everything after ] or after prefix block
  let reason = note;
  const bracketEnd = note.lastIndexOf("]");
  if (bracketEnd >= 0) {
    reason = note.substring(bracketEnd + 1).trim();
  } else if (prefix === "RESEARCH") {
    reason = note.replace(/^Research Commit:\s*/, "");
  }

  // Staleness: >14 days
  let isStale = false;
  if (triggerDate) {
    const d = new Date(triggerDate);
    if (!isNaN(d.getTime())) {
      const daysSince = Math.floor((Date.now() - d.getTime()) / 86400000);
      isStale = daysSince > 14;
    }
  }

  return { ticker, date: triggerDate, prefix, priority, flagType, reason, isStale };
}

export function parseAllFlags(holdings: LiveHolding[]): ReviewFlag[] {
  const flagMap = new Map<string, ReviewFlag>();
  for (const h of holdings) {
    const flag = parseReviewFlag(h.ticker, h.trigger_review_date, h.trigger_review_note);
    if (flag && !flagMap.has(h.ticker)) {
      flagMap.set(h.ticker, flag);
    }
  }
  const flags = Array.from(flagMap.values());
  const pOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  flags.sort((a, b) => (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2));
  return flags;
}

export function getFlagIndicator(holdings: LiveHolding[], ticker: string): { emoji: string; color: string } | null {
  const h = holdings.find(x => x.ticker === ticker);
  if (!h) return null;
  const flag = parseReviewFlag(h.ticker, h.trigger_review_date, h.trigger_review_note);
  if (!flag) return null;
  return { emoji: PRIORITY_EMOJI[flag.priority] || "🟢", color: PRIORITY_COLOR[flag.priority] || "#666" };
}

function FlagTypeBadge({ flagType }: { flagType: string }) {
  const config = FLAG_TYPE_CONFIG[flagType];
  const label = config?.label || flagType;
  const color = config?.color || "var(--text-dim)";
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.08em",
      padding: "1px 6px", borderRadius: 10,
      background: `color-mix(in srgb, ${color} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      color, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 };

interface ReviewQueueProps {
  holdings: LiveHolding[];
  /** Compact mode shows fewer details (for Command tab) */
  compact?: boolean;
}

export default function ReviewQueue({ holdings, compact = false }: ReviewQueueProps) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);
  const [showStale, setShowStale] = useState(true);
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set());

  const allFlags = parseAllFlags(holdings);
  const activeFlags = allFlags.filter(f => showStale || !f.isStale);
  const staleCount = allFlags.filter(f => f.isStale).length;
  const highCount = activeFlags.filter(f => f.priority === "HIGH").length;
  const medCount = activeFlags.filter(f => f.priority === "MEDIUM").length;
  const lowCount = activeFlags.filter(f => f.priority === "LOW").length;

  if (allFlags.length === 0) {
    return (
      <div style={{ ...card, borderLeft: "3px solid var(--green)", padding: isMobile ? "14px 12px" : "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>✅</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--green)", letterSpacing: "0.08em" }}>
            No review flags this week. All positions within parameters.
          </span>
        </div>
      </div>
    );
  }

  const mp = isMobile ? "10px 12px" : "14px 20px";
  const shouldCollapse = activeFlags.length > 5;

  const toggleReason = (ticker: string) => {
    setExpandedReasons(prev => {
      const next = new Set(prev);
      next.has(ticker) ? next.delete(ticker) : next.add(ticker);
      return next;
    });
  };

  return (
    <div style={{ ...card, borderLeft: "3px solid var(--gold)" }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: mp, borderBottom: expanded ? "1px solid var(--rim)" : "none", cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <AlertTriangle size={14} style={{ color: "var(--gold)" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--gold)" }}>
            ⚠️ {activeFlags.length} Review Flag{activeFlags.length !== 1 ? "s" : ""}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
            ({[highCount > 0 && `${highCount} HIGH`, medCount > 0 && `${medCount} MED`, lowCount > 0 && `${lowCount} LOW`].filter(Boolean).join(", ")})
          </span>
          {staleCount > 0 && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", opacity: 0.6 }}>
              · {staleCount} stale
            </span>
          )}
        </div>
        <div style={{ color: "var(--text-dim)" }}>{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</div>
      </div>

      {expanded && (
        <div style={{ padding: mp }}>
          {/* Stale filter controls */}
          {staleCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowStale(!showStale); }}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em",
                  background: "none", border: "1px solid var(--rim)", color: "var(--text-dim)",
                  cursor: "pointer", padding: "3px 10px", borderRadius: 2,
                }}
              >
                {showStale ? "Hide" : "Show"} {staleCount} stale flag{staleCount !== 1 ? "s" : ""}
              </button>
            </div>
          )}

          {(["HIGH", "MEDIUM", "LOW"] as const).map(priority => {
            const items = activeFlags.filter(f => f.priority === priority);
            if (items.length === 0) return null;
            return (
              <div key={priority} style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: PRIORITY_COLOR[priority], marginBottom: 6 }}>
                  {PRIORITY_EMOJI[priority]} {priority}
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {items.map(flag => {
                    const isReasonExpanded = expandedReasons.has(flag.ticker);
                    const reasonTruncated = flag.reason.length > 80;
                    const displayReason = reasonTruncated && !isReasonExpanded ? flag.reason.slice(0, 80) + "…" : flag.reason;

                    return (
                      <div key={flag.ticker} style={{
                        background: PRIORITY_BG[flag.priority],
                        border: "1px solid var(--rim)",
                        borderLeft: `3px solid ${PRIORITY_COLOR[flag.priority]}`,
                        padding: "10px 14px",
                        opacity: flag.isStale ? 0.5 : 1,
                        transition: "opacity 0.2s",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flex: 1 }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--gold)" }}>{flag.ticker}</span>
                            <FlagTypeBadge flagType={flag.flagType} />
                            {flag.isStale && (
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-dim)", letterSpacing: "0.1em", opacity: 0.7 }}>STALE</span>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              const prompt = `Deep dive on ${flag.ticker}. Review flag: [${flag.flagType}] ${flag.reason}. Run full assessment and produce research commit JSON.`;
                              const url = `${CLAUDE_PROJECT_URL}?prompt=${encodeURIComponent(prompt)}`;
                              (window.top || window).open(url, "_blank");
                            }}
                            style={{
                              fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em",
                              background: "none", border: "1px solid var(--accent)", color: "var(--accent)",
                              cursor: "pointer", padding: "3px 10px", borderRadius: 2, whiteSpace: "nowrap",
                            }}
                          >
                            Review ➜
                          </button>
                        </div>
                        <div
                          onClick={() => reasonTruncated && toggleReason(flag.ticker)}
                          style={{
                            fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)",
                            marginTop: 4, lineHeight: 1.5, cursor: reasonTruncated ? "pointer" : "default",
                          }}
                        >
                          {displayReason}
                        </div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", marginTop: 4, display: "flex", gap: 8 }}>
                          <span>{flag.prefix.replace("_", " ")}</span>
                          {flag.date && <span>· {flag.date}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
