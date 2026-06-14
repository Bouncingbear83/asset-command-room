import React, { useState } from "react";
import { useLayerReviews, LayerReview } from "@/hooks/useLayerReviews";
import { useIsMobile } from "@/hooks/use-mobile";

/* ── Layer colour map (matches LAYERS tab hex) ── */
const LAYER_COLORS: Record<string, string> = {
  Compute: "#4f7fff",
  Energy: "#f39c12",
  Materials: "#e67e22",
  Biological: "#2ecc71",
  Sovereignty: "#9b59b6",
  Robotics: "#e74c3c",
  "Macro Hedge": "#95a5a6",
};

/* ── Shared styles (consistent with CommandTab) ── */
const card: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--rim)",
  marginBottom: 16,
};
const cardHeader: React.CSSProperties = {
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
  textTransform: "uppercase" as const,
  color: "var(--text-mid)",
};

/* ── Status helpers ── */
function statusColor(status: string, scheduledDate: string): { bg: string; fg: string; label: string } {
  if (status === "COMPLETE") return { bg: "var(--green-dim)", fg: "var(--green)", label: "DONE" };
  if (status === "IN_PROGRESS") return { bg: "var(--accent-dim)", fg: "var(--accent)", label: "IN PROGRESS" };
  if (status === "SKIPPED") return { bg: "var(--red-dim)", fg: "var(--text-dim)", label: "SKIPPED" };
  // SCHEDULED: check if overdue
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sched = new Date(scheduledDate + "T00:00:00");
  if (sched < today) return { bg: "var(--amber-dim)", fg: "var(--amber)", label: "OVERDUE" };
  // Check if this week
  const diffDays = Math.ceil((sched.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) return { bg: "var(--accent-dim)", fg: "var(--accent)", label: "THIS WEEK" };
  return { bg: "transparent", fg: "var(--text-dim)", label: "SCHEDULED" };
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/* ── Prompt launcher ── */
function launchReview(review: LayerReview) {
  const prompt = review.prompt_template || `Layer Review: ${review.layer} (${review.cycle})`;
  // Claude project deep link: open claude.ai with pre-filled prompt
  const encoded = encodeURIComponent(prompt);
  window.open(`https://claude.ai/new?q=${encoded}`, "_blank");
}

/* ── Main component ── */
export default function LayerReviewCalendar() {
  const isMobile = useIsMobile();
  const { reviews, trendCounts, loading, error, markDone, toggleActionItem } = useLayerReviews();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDone, setConfirmDone] = useState<string | null>(null);

  if (loading) {
    return (
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Layer Reviews</span>
        </div>
        <div style={{ padding: 20, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
          Loading schedule...
        </div>
      </div>
    );
  }

  if (error || reviews.length === 0) {
    return (
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Layer Reviews</span>
        </div>
        <div style={{ padding: 20, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
          {error || "No reviews scheduled. Seed Q3 schedule in Supabase."}
        </div>
      </div>
    );
  }

  const completedCount = reviews.filter((r) => r.status === "COMPLETE").length;
  const cycle = reviews[0]?.cycle || "Q3-2026";

  return (
    <div style={card}>
      {/* ── Header ── */}
      <div style={cardHeader}>
        <span style={cardTitle}>Layer Reviews</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-dim)",
            }}
          >
            {cycle}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: completedCount === 7 ? "var(--green)" : "var(--gold)",
              background: completedCount === 7 ? "var(--green-dim)" : "transparent",
              padding: "2px 8px",
              border: `1px solid ${completedCount === 7 ? "rgba(90,191,160,0.2)" : "var(--gold-dim)"}`,
              borderRadius: 2,
            }}
          >
            {completedCount}/7
          </span>
        </div>
      </div>

      {/* ── Review cards ── */}
      <div style={{ padding: isMobile ? "8px 10px" : "8px 14px" }}>
        {reviews.map((review) => {
          const { bg, fg, label } = statusColor(review.status, review.scheduled_date);
          const layerColor = LAYER_COLORS[review.layer] || "var(--text-mid)";
          const trends = trendCounts[review.layer] || 0;
          const isExpanded = expandedId === review.id;
          const openActions = review.action_items.filter((a) => !a.done).length;

          return (
            <div
              key={review.id}
              style={{
                borderBottom: "1px solid var(--rim)",
                padding: "10px 0",
              }}
            >
              {/* ── Row: layer info + status + actions ── */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                }}
                onClick={() => setExpandedId(isExpanded ? null : review.id)}
              >
                {/* Layer colour pip */}
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: layerColor,
                    flexShrink: 0,
                    opacity: review.status === "COMPLETE" ? 0.4 : 1,
                  }}
                />

                {/* Layer name + date */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-ui)",
                      fontSize: 13,
                      fontWeight: 600,
                      color: review.status === "COMPLETE" ? "var(--text-dim)" : "var(--text)",
                      textDecoration: review.status === "COMPLETE" ? "line-through" : "none",
                    }}
                  >
                    {review.layer}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      color: "var(--text-dim)",
                      marginTop: 2,
                    }}
                  >
                    {formatDateShort(review.scheduled_date)}
                    {trends > 0 && (
                      <span style={{ color: "var(--gold)", marginLeft: 8 }}>
                        {trends} trend{trends !== 1 ? "s" : ""}
                      </span>
                    )}
                    {openActions > 0 && (
                      <span style={{ color: "var(--amber)", marginLeft: 8 }}>
                        {openActions} action{openActions !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status chip */}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    padding: "2px 8px",
                    borderRadius: 2,
                    background: bg,
                    color: fg,
                    border: `1px solid ${fg}20`,
                    whiteSpace: "nowrap" as const,
                  }}
                >
                  {label}
                </span>

                {/* Expand chevron */}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--text-dim)",
                    transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.15s",
                  }}
                >
                  ▸
                </span>
              </div>

              {/* ── Expanded panel ── */}
              {isExpanded && (
                <div
                  style={{
                    marginTop: 10,
                    marginLeft: 18,
                    padding: "10px 12px",
                    background: "var(--deep)",
                    border: "1px solid var(--rim)",
                    borderRadius: 2,
                  }}
                >
                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    {review.status !== "COMPLETE" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          launchReview(review);
                        }}
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase" as const,
                          padding: "6px 14px",
                          background: "transparent",
                          color: "var(--gold)",
                          border: "1px solid var(--gold-dim)",
                          borderRadius: 2,
                          cursor: "pointer",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(200,169,110,0.08)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        Launch Review
                      </button>
                    )}
                    {review.status !== "COMPLETE" && (
                      <>
                        {confirmDone === review.id ? (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                              Confirm?
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markDone(review.id);
                                setConfirmDone(null);
                              }}
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 10,
                                padding: "4px 10px",
                                background: "var(--green-dim)",
                                color: "var(--green)",
                                border: "1px solid rgba(90,191,160,0.2)",
                                borderRadius: 2,
                                cursor: "pointer",
                              }}
                            >
                              Yes
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDone(null);
                              }}
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 10,
                                padding: "4px 10px",
                                background: "transparent",
                                color: "var(--text-dim)",
                                border: "1px solid var(--rim)",
                                borderRadius: 2,
                                cursor: "pointer",
                              }}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDone(review.id);
                            }}
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 10,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase" as const,
                              padding: "6px 14px",
                              background: "transparent",
                              color: "var(--green)",
                              border: "1px solid rgba(90,191,160,0.2)",
                              borderRadius: 2,
                              cursor: "pointer",
                              transition: "background 0.15s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--green-dim)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            Mark Done
                          </button>
                        )}
                      </>
                    )}
                    {review.status === "COMPLETE" && review.review_vault_path && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          color: "var(--text-dim)",
                          padding: "6px 0",
                        }}
                      >
                        Completed {review.completed_date ? formatDateShort(review.completed_date) : ""}
                      </span>
                    )}
                  </div>

                  {/* Action items */}
                  {review.action_items.length > 0 && (
                    <div>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 9,
                          letterSpacing: "0.18em",
                          textTransform: "uppercase" as const,
                          color: "var(--text-dim)",
                          marginBottom: 6,
                        }}
                      >
                        Action Items
                      </div>
                      {review.action_items.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleActionItem(review.id, idx);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 8,
                            padding: "4px 0",
                            cursor: "pointer",
                          }}
                        >
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              border: `1px solid ${item.done ? "var(--green)" : "var(--rim)"}`,
                              borderRadius: 2,
                              background: item.done ? "var(--green-dim)" : "transparent",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              marginTop: 1,
                              fontFamily: "var(--font-mono)",
                              fontSize: 10,
                              color: "var(--green)",
                            }}
                          >
                            {item.done ? "✓" : ""}
                          </span>
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 11,
                              color: item.done ? "var(--text-dim)" : "var(--text-mid)",
                              textDecoration: item.done ? "line-through" : "none",
                              lineHeight: 1.4,
                            }}
                          >
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Copy prompt */}
                  {review.prompt_template && (
                    <div style={{ marginTop: 10, borderTop: "1px solid var(--rim)", paddingTop: 8 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(review.prompt_template || "");
                        }}
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 9,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase" as const,
                          padding: "4px 10px",
                          background: "transparent",
                          color: "var(--text-dim)",
                          border: "1px solid var(--rim)",
                          borderRadius: 2,
                          cursor: "pointer",
                        }}
                      >
                        Copy Prompt
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Open Trends Summary ── */}
      {Object.keys(trendCounts).length > 0 && (
        <div
          style={{
            padding: isMobile ? "8px 10px 12px" : "8px 14px 12px",
            borderTop: "1px solid var(--rim)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.18em",
              textTransform: "uppercase" as const,
              color: "var(--text-dim)",
              marginBottom: 6,
            }}
          >
            Open Trends
          </div>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
            {Object.entries(trendCounts).map(([layer, count]) => (
              <span
                key={layer}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: LAYER_COLORS[layer] || "var(--text-mid)",
                  padding: "3px 8px",
                  border: `1px solid ${(LAYER_COLORS[layer] || "var(--text-mid)")}30`,
                  borderRadius: 2,
                }}
              >
                {layer} {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
