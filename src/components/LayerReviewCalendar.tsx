import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLayerReviews, LayerReview, ActionItem } from "@/hooks/useLayerReviews";

const CURRENT_CYCLE = "Q3-2026";

const card: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--rim)",
  borderRadius: 2,
};
const cardHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
  borderBottom: "1px solid var(--rim)",
};
const cardTitle: React.CSSProperties = {
  fontFamily: "var(--font-display, var(--font-mono))",
  letterSpacing: "0.18em",
  fontSize: 12,
  textTransform: "uppercase",
  color: "var(--text)",
};
const chip: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  padding: "2px 8px",
  borderRadius: 2,
  border: "1px solid var(--rim)",
};

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function statusChip(r: LayerReview): React.ReactNode {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sched = new Date(r.scheduled_date);
  sched.setHours(0, 0, 0, 0);

  if (r.status === "COMPLETE") {
    return (
      <span style={{ ...chip, background: "rgba(126,180,114,0.12)", color: "var(--green)", border: "1px solid rgba(126,180,114,0.35)" }}>
        COMPLETE
      </span>
    );
  }
  if (r.status === "IN_PROGRESS") {
    return (
      <span style={{ ...chip, background: "rgba(90,150,200,0.12)", color: "#5aaad8", border: "1px solid rgba(90,150,200,0.35)" }}>
        IN PROGRESS
      </span>
    );
  }
  if (r.status === "SKIPPED") {
    return (
      <span style={{ ...chip, background: "rgba(138,138,154,0.1)", color: "var(--text-dim)" }}>SKIPPED</span>
    );
  }
  // SCHEDULED
  const diff = daysBetween(today, sched);
  if (diff < 0) {
    return (
      <span style={{ ...chip, background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.35)" }}>
        OVERDUE
      </span>
    );
  }
  if (diff <= 7) {
    return (
      <span style={{ ...chip, background: "rgba(90,150,200,0.12)", color: "#5aaad8", border: "1px solid rgba(90,150,200,0.35)" }}>
        THIS WEEK
      </span>
    );
  }
  return <span style={{ ...chip, color: "var(--text-dim)" }}>SCHEDULED</span>;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function openClaude(prompt: string) {
  const url = `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
  (window.top || window).open(url, "_blank");
}

export default function LayerReviewCalendar() {
  const { reviews, trendCountsByLayer, loading, error, markComplete, updateActionItems } =
    useLayerReviews(CURRENT_CYCLE);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const summary = useMemo(() => {
    const total = reviews.length;
    const done = reviews.filter((r) => r.status === "COMPLETE").length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = reviews.filter((r) => {
      if (r.status === "COMPLETE" || r.status === "SKIPPED") return false;
      const d = new Date(r.scheduled_date);
      d.setHours(0, 0, 0, 0);
      return d < today;
    }).length;
    return { total, done, overdue };
  }, [reviews]);

  const handleCopy = async (text: string | null) => {
    if (!text) {
      toast.error("No prompt template");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Prompt copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleLaunch = (r: LayerReview) => {
    if (!r.prompt_template) {
      toast.error("No prompt template");
      return;
    }
    openClaude(r.prompt_template);
  };

  const handleMarkDone = async (r: LayerReview) => {
    if (!confirm(`Mark ${r.layer} review as COMPLETE?`)) return;
    try {
      await markComplete(r.id);
      toast.success(`${r.layer} marked complete`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to update");
    }
  };

  const handleToggleItem = async (r: LayerReview, idx: number) => {
    const next = r.action_items.map((it, i) => (i === idx ? { ...it, done: !it.done } : it));
    try {
      await updateActionItems(r.id, next);
    } catch (e: any) {
      toast.error(e?.message || "Failed to update action item");
    }
  };

  return (
    <div style={card}>
      <div style={cardHeader}>
        <span style={cardTitle}>Layer Reviews · {CURRENT_CYCLE}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {summary.overdue > 0 && (
            <span style={{ ...chip, background: "var(--amber-dim)", color: "var(--amber)" }}>
              {summary.overdue} OVERDUE
            </span>
          )}
          <span style={{ ...chip, color: "var(--text-dim)" }}>
            {summary.done}/{summary.total} DONE
          </span>
        </div>
      </div>

      {loading && (
        <div style={{ padding: 14, color: "var(--text-dim)", fontSize: 12 }}>Loading…</div>
      )}
      {error && (
        <div style={{ padding: 14, color: "var(--red)", fontSize: 12 }}>{error}</div>
      )}
      {!loading && !error && reviews.length === 0 && (
        <div style={{ padding: 14, color: "var(--text-dim)", fontSize: 12 }}>
          No reviews scheduled for {CURRENT_CYCLE}.
        </div>
      )}

      {!loading && !error && reviews.length > 0 && (
        <div>
          {reviews.map((r) => {
            const expanded = expandedId === r.id;
            const trendCount = trendCountsByLayer[r.layer] ?? r.open_trends ?? 0;
            return (
              <div key={r.id} style={{ borderBottom: "1px solid var(--rim)" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "70px 1fr auto auto",
                    gap: 10,
                    alignItems: "center",
                    padding: "10px 14px",
                    cursor: "pointer",
                  }}
                  onClick={() => setExpandedId(expanded ? null : r.id)}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--text-dim)",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {fmtDate(r.scheduled_date)}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span
                      style={{
                        fontFamily: "var(--font-display, var(--font-mono))",
                        fontSize: 14,
                        color: "var(--text)",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {r.layer}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                      {trendCount} open trend{trendCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  {statusChip(r)}
                  <span style={{ color: "var(--text-dim)", fontSize: 10, fontFamily: "var(--font-mono)" }}>
                    {expanded ? "▾" : "▸"}
                  </span>
                </div>

                {expanded && (
                  <div style={{ padding: "0 14px 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => handleLaunch(r)} style={btn("primary")} disabled={!r.prompt_template}>
                        Launch Review
                      </button>
                      <button onClick={() => handleCopy(r.prompt_template)} style={btn()} disabled={!r.prompt_template}>
                        Copy Prompt
                      </button>
                      {r.status !== "COMPLETE" && (
                        <button onClick={() => handleMarkDone(r)} style={btn()}>
                          Mark Done
                        </button>
                      )}
                    </div>

                    {r.action_items.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
                          Action Items
                        </div>
                        {r.action_items.map((it, i) => (
                          <label key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: it.done ? "var(--text-dim)" : "var(--text)", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={it.done}
                              onChange={() => handleToggleItem(r, i)}
                              style={{ marginTop: 3 }}
                            />
                            <span style={{ textDecoration: it.done ? "line-through" : "none" }}>{it.text}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {(r.session_vault_path || r.review_vault_path) && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
                        {r.session_vault_path && <span>session: {r.session_vault_path}</span>}
                        {r.review_vault_path && <span>review: {r.review_vault_path}</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function btn(kind: "primary" | "default" = "default"): React.CSSProperties {
  if (kind === "primary") {
    return {
      background: "var(--gold, #c9a84c)",
      color: "#0a0a1a",
      border: "1px solid var(--gold, #c9a84c)",
      padding: "6px 12px",
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      cursor: "pointer",
      borderRadius: 2,
    };
  }
  return {
    background: "transparent",
    color: "var(--text)",
    border: "1px solid var(--rim)",
    padding: "6px 12px",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    cursor: "pointer",
    borderRadius: 2,
  };
}
