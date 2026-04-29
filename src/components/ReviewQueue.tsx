import { useState } from "react";
import { ChevronRight, ChevronDown, AlertTriangle } from "lucide-react";
import { LiveHolding } from "@/hooks/usePortfolioData";
import { useIsMobile } from "@/hooks/use-mobile";

const CLAUDE_PROJECT_URL = "https://claude.ai/project/019ca3a9-aefe-77ea-af76-db62fd96f4e1";

// ── Prefix taxonomy ─────────────────────────────────────────────────────────
// Score / weekly / quarterly review prefixes (existing)
const SCORE_PREFIXES = ["W_EXIT", "W_FACTOR", "W_STALE", "M_REVIEW", "Q_REVIEW"] as const;
// Profile lifecycle prefixes (Quarterly v2.4)
const PROFILE_PREFIXES = [
  "PROFILE_LADDER",
  "PROFILE_TRANSITION",
  "PROFILE_MIX",
  "PROFILE_STALE",
] as const;

type ScorePrefix = typeof SCORE_PREFIXES[number];
type ProfilePrefix = typeof PROFILE_PREFIXES[number];
export type FlagPrefix = ScorePrefix | ProfilePrefix;

export type FlagCategory = "profile" | "score" | "holdings";

export interface ReviewFlag {
  ticker: string;
  date: string;
  prefix: FlagPrefix;
  category: FlagCategory;
  priority: "HIGH" | "MEDIUM" | "LOW";
  flagType: string;
  reason: string;
  isStale: boolean;
  isConsolidated?: boolean; // W_STALE flags show as a consolidated card
  isPortfolio?: boolean;    // CASH-row PROFILE_MIX flag
}

// ── Visual config ───────────────────────────────────────────────────────────

const FLAG_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  EXIT_SIZE_HARD: { label: "SIZE ⚠️", color: "var(--red)" },
  EXIT_SIZE_SOFT: { label: "SIZE", color: "var(--amber)" },
  EXIT_RECLASS:   { label: "RECLASS", color: "var(--amber)" },
  EXIT_DECAY:     { label: "STALE", color: "var(--amber)" },
  EARNINGS:       { label: "EARNINGS", color: "var(--accent)" },
  COMPETITOR:     { label: "COMPETITOR", color: "var(--accent)" },
  THESIS_WEAK:    { label: "THESIS", color: "var(--red)" },
  KILL_CONDITION: { label: "KILL", color: "var(--red)" },
  REGULATORY:     { label: "REGULATORY", color: "var(--amber)" },
  STALE:          { label: "STALE", color: "var(--amber)" },
  PRICE_MOVE:     { label: "PRICE", color: "var(--amber)" },
  DISRUPTION:     { label: "DISRUPTION", color: "var(--amber)" },
  FACTOR_HARD:    { label: "FACTOR ⚠️", color: "var(--red)" },
  FACTOR_SOFT:    { label: "FACTOR", color: "var(--amber)" },
  STALE_WATCHLIST:{ label: "STALE", color: "var(--amber)" },
  // Profile-family fall-through labels (used when flagType === prefix)
  PROFILE_LADDER:     { label: "LADDER MISMATCH", color: "var(--amber)" },
  PROFILE_TRANSITION: { label: "PROFILE TRANSITION", color: "var(--accent)" },
  PROFILE_MIX:        { label: "MIX OUT OF BAND", color: "var(--red)" },
  PROFILE_STALE:      { label: "RECLASS STALE", color: "var(--amber)" },
};

/** Friendly group label shown above a stack of cards within a priority bucket. */
const FLAG_TYPE_GROUP_LABEL: Record<string, string> = {
  PROFILE_LADDER:     "Profile · Ladder mismatch",
  PROFILE_TRANSITION: "Profile · Lifecycle transition",
  PROFILE_MIX:        "Profile · Mix outside band",
  PROFILE_STALE:      "Profile · Reclass stalled (12m+)",
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

// ── Parser ──────────────────────────────────────────────────────────────────

function categoryFor(prefix: FlagPrefix): FlagCategory {
  if ((PROFILE_PREFIXES as readonly string[]).includes(prefix)) return "profile";
  if (prefix === "W_EXIT" || prefix === "W_FACTOR" || prefix === "M_REVIEW") return "score";
  // W_STALE and Q_REVIEW are holdings/quarterly reviews
  return "holdings";
}

export function parseReviewFlag(ticker: string, triggerDate: string, triggerNote: string): ReviewFlag | null {
  const note = (triggerNote || "").trim();
  if (!note) return null;

  let prefix: FlagPrefix | null = null;
  // Profile prefixes (longest match first to avoid PROFILE_* colliding with anything else)
  for (const p of PROFILE_PREFIXES) {
    if (note.startsWith(p)) { prefix = p; break; }
  }
  if (!prefix) {
    if (note.startsWith("W_EXIT")) prefix = "W_EXIT";
    else if (note.startsWith("W_FACTOR")) prefix = "W_FACTOR";
    else if (note.startsWith("W_STALE")) prefix = "W_STALE";
    else if (note.startsWith("Q_REVIEW")) prefix = "Q_REVIEW";
    else if (note.startsWith("M_REVIEW")) prefix = "M_REVIEW";
    else return null;
  }

  let priority: ReviewFlag["priority"] = "LOW";
  if (note.includes("HIGH")) priority = "HIGH";
  else if (note.includes("MEDIUM")) priority = "MEDIUM";
  // Sensible defaults for profile flags when no priority token present
  if (priority === "LOW") {
    if (prefix === "PROFILE_LADDER" || prefix === "PROFILE_MIX") priority = "HIGH";
    else if (prefix === "PROFILE_TRANSITION" || prefix === "PROFILE_STALE") priority = "MEDIUM";
  }

  const typeMatch = note.match(/\[([A-Z_]+)\]/);
  const flagType = typeMatch ? typeMatch[1] : prefix;

  let reason = note;
  const bracketEnd = note.lastIndexOf("]");
  if (bracketEnd >= 0) {
    reason = note.substring(bracketEnd + 1).trim();
  } else {
    // No bracket — strip the leading prefix + any priority token
    reason = note.replace(prefix, "").replace(/^\s*(HIGH|MEDIUM|LOW)\s*/i, "").trim();
  }

  let isStale = false;
  if (triggerDate) {
    const d = new Date(triggerDate);
    if (!isNaN(d.getTime())) {
      const daysSince = Math.floor((Date.now() - d.getTime()) / 86400000);
      isStale = daysSince > 14;
    }
  }

  const isConsolidated = prefix === "W_STALE";
  const isPortfolio = prefix === "PROFILE_MIX" && ticker.trim().toUpperCase() === "CASH";

  return {
    ticker,
    date: triggerDate,
    prefix,
    category: categoryFor(prefix),
    priority,
    flagType,
    reason,
    isStale,
    isConsolidated,
    isPortfolio,
  };
}

export function parseAllFlags(holdings: LiveHolding[]): ReviewFlag[] {
  const flagMap = new Map<string, ReviewFlag>();
  for (const h of holdings) {
    const flag = parseReviewFlag(h.ticker, h.trigger_review_date, h.trigger_review_note);
    if (!flag) continue;
    // Key by ticker+prefix so a single ticker can carry both score and profile flags.
    const key = `${flag.ticker}::${flag.prefix}`;
    if (!flagMap.has(key)) flagMap.set(key, flag);
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

// ── Subcomponents ───────────────────────────────────────────────────────────

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

function PortfolioBadge() {
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700,
      letterSpacing: "0.14em", padding: "2px 7px", borderRadius: 2,
      background: "color-mix(in srgb, var(--gold) 16%, transparent)",
      border: "1px solid color-mix(in srgb, var(--gold) 40%, transparent)",
      color: "var(--gold)", textTransform: "uppercase", whiteSpace: "nowrap",
    }}>
      PORTFOLIO
    </span>
  );
}

function CategoryChip({
  label, count, active, onClick,
}: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-pressed={active}
      style={{
        fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em",
        textTransform: "uppercase",
        padding: "4px 10px", borderRadius: 2, cursor: "pointer",
        border: `1px solid ${active ? "rgba(201,168,76,0.5)" : "var(--rim)"}`,
        background: active ? "rgba(201,168,76,0.12)" : "transparent",
        color: active ? "var(--gold)" : "var(--text-dim)",
        whiteSpace: "nowrap",
      }}
    >
      {label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{count}</span>
    </button>
  );
}

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 };

interface ReviewQueueProps {
  holdings: LiveHolding[];
  /** Compact mode shows fewer details (for Command tab) */
  compact?: boolean;
}

type CategoryFilter = "all" | FlagCategory;

const CATEGORY_FILTERS: { key: CategoryFilter; label: string }[] = [
  { key: "all",      label: "All" },
  { key: "profile",  label: "Profile only" },
  { key: "score",    label: "Score only" },
  { key: "holdings", label: "Holdings only" },
];

export default function ReviewQueue({ holdings, compact = false }: ReviewQueueProps) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);
  const [showStale, setShowStale] = useState(true);
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  const allFlags = parseAllFlags(holdings);

  // Counts (always on full set, before staleness filter, so chips show true totals)
  const catCounts: Record<CategoryFilter, number> = {
    all: allFlags.length,
    profile: allFlags.filter(f => f.category === "profile").length,
    score: allFlags.filter(f => f.category === "score").length,
    holdings: allFlags.filter(f => f.category === "holdings").length,
  };

  const visibleFlags = allFlags.filter(f => {
    if (!showStale && f.isStale) return false;
    if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
    return true;
  });

  const staleCount = allFlags.filter(f => f.isStale).length;
  const highCount = visibleFlags.filter(f => f.priority === "HIGH").length;
  const medCount  = visibleFlags.filter(f => f.priority === "MEDIUM").length;
  const lowCount  = visibleFlags.filter(f => f.priority === "LOW").length;

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

  const toggleReason = (key: string) => {
    setExpandedReasons(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
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
            ⚠️ {visibleFlags.length} Review Flag{visibleFlags.length !== 1 ? "s" : ""}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
            ({[highCount > 0 && `${highCount} HIGH`, medCount > 0 && `${medCount} MED`, lowCount > 0 && `${lowCount} LOW`].filter(Boolean).join(", ") || "filtered"})
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
          {/* Category filter chips */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {CATEGORY_FILTERS.map(({ key, label }) => (
              <CategoryChip
                key={key}
                label={label}
                count={catCounts[key]}
                active={categoryFilter === key}
                onClick={() => setCategoryFilter(key)}
              />
            ))}
          </div>

          {/* Stale filter control */}
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

          {visibleFlags.length === 0 && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", padding: "12px 0" }}>
              No flags match the current filter.
            </div>
          )}

          {(["HIGH", "MEDIUM", "LOW"] as const).map(priority => {
            const priorityItems = visibleFlags.filter(f => f.priority === priority);
            if (priorityItems.length === 0) return null;

            // Group by flagType within this priority bucket.
            // PROFILE_* groups must render in a fixed doctrine order:
            //   PROFILE_LADDER → PROFILE_MIX → PROFILE_TRANSITION → PROFILE_STALE
            // Non-profile flagTypes preserve first-seen order and render after profile groups.
            const PROFILE_GROUP_ORDER = [
              "PROFILE_LADDER",
              "PROFILE_MIX",
              "PROFILE_TRANSITION",
              "PROFILE_STALE",
            ] as const;
            const profileRank = (ft: string) => {
              const i = (PROFILE_GROUP_ORDER as readonly string[]).indexOf(ft);
              return i === -1 ? Number.POSITIVE_INFINITY : i;
            };

            const seenOrder: string[] = [];
            const groupMap = new Map<string, ReviewFlag[]>();
            for (const f of priorityItems) {
              if (!groupMap.has(f.flagType)) { groupMap.set(f.flagType, []); seenOrder.push(f.flagType); }
              groupMap.get(f.flagType)!.push(f);
            }
            const groupOrder = [...seenOrder].sort((a, b) => {
              const ra = profileRank(a);
              const rb = profileRank(b);
              if (ra !== rb) return ra - rb;
              // Same rank (both profile with same key — impossible — or both non-profile): preserve insertion order
              return seenOrder.indexOf(a) - seenOrder.indexOf(b);
            });

            return (
              <div key={priority} style={{ marginBottom: 14 }}>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
                  letterSpacing: "0.12em", color: PRIORITY_COLOR[priority], marginBottom: 6,
                }}>
                  {PRIORITY_EMOJI[priority]} {priority}
                </div>

                {groupOrder.map(flagType => {
                  const items = groupMap.get(flagType)!;
                  const groupLabel =
                    FLAG_TYPE_GROUP_LABEL[flagType]
                    ?? FLAG_TYPE_CONFIG[flagType]?.label
                    ?? flagType;
                  const isPortfolioGroup = items.every(i => i.isPortfolio);
                  const tickerSummary = isPortfolioGroup
                    ? "portfolio-level"
                    : `${items.length} ticker${items.length !== 1 ? "s" : ""}`;

                  return (
                    <div key={`${priority}-${flagType}`} style={{ marginBottom: 10 }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em",
                        textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 4,
                      }}>
                        <span style={{ color: "var(--text-mid)" }}>{groupLabel}</span>
                        <span style={{ opacity: 0.7 }}>({tickerSummary})</span>
                      </div>

                      <div style={{ display: "grid", gap: 6 }}>
                        {items.map(flag => {
                          const rowKey = flag.ticker + flag.prefix;
                          const isReasonExpanded = expandedReasons.has(rowKey);
                          const reasonTruncated = flag.reason.length > 80;
                          const displayReason = reasonTruncated && !isReasonExpanded
                            ? flag.reason.slice(0, 80) + "…"
                            : flag.reason;

                          return (
                            <div key={rowKey} style={{
                              background: PRIORITY_BG[flag.priority],
                              border: "1px solid var(--rim)",
                              borderLeft: `3px solid ${PRIORITY_COLOR[flag.priority]}`,
                              padding: "10px 14px",
                              opacity: flag.isStale ? 0.5 : 1,
                              transition: "opacity 0.2s",
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flex: 1 }}>
                                  {flag.isPortfolio ? (
                                    <PortfolioBadge />
                                  ) : (
                                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--gold)" }}>
                                      {flag.isConsolidated ? "Stale watchlist" : flag.ticker}
                                    </span>
                                  )}
                                  <FlagTypeBadge flagType={flag.flagType} />
                                  {flag.isStale && (
                                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-dim)", letterSpacing: "0.1em", opacity: 0.7 }}>STALE</span>
                                  )}
                                </div>
                                <button
                                  onClick={() => {
                                    const subject = flag.isPortfolio ? "the portfolio" : flag.ticker;
                                    const prompt = `Review flag ${flag.prefix} on ${subject}. Type: ${flag.flagType}. Priority: ${flag.priority}. Reason: ${flag.reason || "—"}. Reassess and produce Research Commit.`;
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
                                onClick={() => reasonTruncated && toggleReason(rowKey)}
                                style={{
                                  fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)",
                                  marginTop: 4, lineHeight: 1.5, cursor: reasonTruncated ? "pointer" : "default",
                                }}
                              >
                                {displayReason}
                              </div>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", marginTop: 4, display: "flex", gap: 8 }}>
                                <span>{flag.prefix.replace(/_/g, " ")}</span>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
