import React from "react";
import { useScheduledReviews, ScheduledReview } from "@/hooks/useScheduledReviews";
import { useIsMobile } from "@/hooks/use-mobile";

/* ── Shared styles (consistent with CommandTab cards) ── */
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

/* ── Review type icons (mono text, no emoji) ── */
const TYPE_LABELS: Record<string, string> = {
  GM_SCAN: "G(m)",
  QUARTERLY: "QTR",
  EVENT_GATE: "GATE",
  LAYER_REVIEW: "LAYER",
  ONE_OFF: "TASK",
};

/* ── Status colour logic ── */
function getStatusInfo(review: ScheduledReview): { bg: string; fg: string; label: string } {
  if (review.status === "COMPLETED") return { bg: "var(--green-dim)", fg: "var(--green)", label: "DONE" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(review.next_due + "T00:00:00");

  if (due < today) return { bg: "var(--red-dim)", fg: "var(--red)", label: "OVERDUE" };

  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 1) return { bg: "var(--amber-dim)", fg: "var(--amber)", label: "TODAY" };
  if (diffDays <= 7) return { bg: "var(--accent-dim)", fg: "var(--accent)", label: "THIS WEEK" };
  return { bg: "transparent", fg: "var(--text-dim)", label: "UPCOMING" };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function daysDiff(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function ScheduledReviewsCard() {
  const { reviews, loading, error, markDone, dismiss } = useScheduledReviews();
  const isMobile = useIsMobile();

  // Filter: show non-completed, sorted by urgency
  const active = reviews.filter((r) => r.status !== "COMPLETED");
  const completed = reviews.filter((r) => r.status === "COMPLETED");
  const overdueCount = active.filter((r) => daysDiff(r.next_due) < 0).length;
  const dueCount = active.filter((r) => {
    const d = daysDiff(r.next_due);
    return d >= 0 && d <= 7;
  }).length;

  return (
    <details style={card} open>
      <summary style={{ ...cardHeader, cursor: "pointer", userSelect: "none", listStyle: "none" }}>
        <span style={cardTitle}>Scheduled Reviews</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {overdueCount > 0 && (
            <span style={chipStyle("var(--red)")}>{overdueCount} OVERDUE</span>
          )}
          {dueCount > 0 && (
            <span style={chipStyle("var(--amber)")}>{dueCount} DUE</span>
          )}
          {overdueCount === 0 && dueCount === 0 && active.length > 0 && (
            <span style={chipStyle("var(--green)")}>{active.length} UPCOMING</span>
          )}
          {active.length === 0 && (
            <span style={chipStyle("var(--text-dim)")}>CLEAR</span>
          )}
        </div>
      </summary>

      <div style={{ padding: isMobile ? "0 12px 12px" : "0 20px 12px" }}>
        {loading && (
          <div style={{ padding: "16px 0", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
            Loading...
          </div>
        )}

        {error && (
          <div style={{ padding: "16px 0", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--red)" }}>
            {error}
          </div>
        )}

        {!loading && active.length === 0 && !error && (
          <div style={{ padding: "16px 0", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
            No upcoming reviews
          </div>
        )}

        {active.map((review) => {
          const status = getStatusInfo(review);
          const days = daysDiff(review.next_due);
          const typeLabel = TYPE_LABELS[review.review_type] || review.review_type;

          return (
            <div
              key={review.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 0",
                borderBottom: "1px solid rgba(28,28,48,0.4)",
              }}
            >
              {/* Type badge */}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: "var(--text-dim)",
                  minWidth: 36,
                  textAlign: "center",
                }}
              >
                {typeLabel}
              </span>

              {/* Title + notes */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {review.title}
                  {review.ticker && (
                    <span style={{ color: "var(--accent)", marginLeft: 6 }}>{review.ticker}</span>
                  )}
                </div>
                {review.notes && !isMobile && (
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      color: "var(--text-dim)",
                      marginTop: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {review.notes}
                  </div>
                )}
              </div>

              {/* Date + countdown */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: status.fg }}>
                  {formatDate(review.next_due)}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
                  {days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? "today" : `${days}d`}
                </div>
              </div>

              {/* Status chip */}
              <span
                style={{
                  background: status.bg,
                  color: status.fg,
                  border: `1px solid ${status.fg}`,
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase" as const,
                  padding: "2px 8px",
                  borderRadius: 2,
                  flexShrink: 0,
                  cursor: "pointer",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  markDone(review.id);
                }}
                title="Click to mark done"
              >
                {status.label}
              </span>
            </div>
          );
        })}

        {/* Completed (collapsed) */}
        {completed.length > 0 && (
          <details style={{ marginTop: 8 }}>
            <summary
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--text-dim)",
                letterSpacing: "0.12em",
                cursor: "pointer",
                userSelect: "none",
                listStyle: "none",
                padding: "6px 0",
              }}
            >
              {completed.length} completed
            </summary>
            {completed.map((review) => (
              <div
                key={review.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 0",
                  opacity: 0.5,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    color: "var(--text-dim)",
                    minWidth: 36,
                    textAlign: "center",
                  }}
                >
                  {TYPE_LABELS[review.review_type] || review.review_type}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--text-dim)",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {review.title}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--green)" }}>
                  DONE {review.last_completed ? formatDate(review.last_completed) : ""}
                </span>
              </div>
            ))}
          </details>
        )}
      </div>
    </details>
  );
}

/* ── Helper ── */
function chipStyle(color: string): React.CSSProperties {
  return {
    background: "transparent",
    color,
    border: `1px solid ${color}`,
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    padding: "2px 8px",
    borderRadius: 2,
  };
}
