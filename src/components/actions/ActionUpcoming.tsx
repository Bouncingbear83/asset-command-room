import { useMemo, type CSSProperties } from "react";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { useActionTracker } from "./useActionTracker";

interface Props {
  onNavigate?: () => void;
}

function daysUntil(due: string): number {
  const d = new Date(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

const TYPE_COLORS: Record<string, string> = {
  EARNINGS_GATE: "#5b8def",
  PRICE_GATE: "#5abfa0",
  CATALYST_WATCH: "#a07de8",
  REVIEW_DUE: "var(--amber)",
  KILL_CHECK: "var(--red)",
  DEPLOY_READY: "#36bfb1",
  MANUAL: "var(--text-dim)",
};

const card: CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--rim)",
  marginBottom: 16,
};
const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
  borderBottom: "1px solid var(--rim)",
};
const title: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--text-mid)",
};

export default function ActionUpcoming({ onNavigate }: Props) {
  const { watchlist, holdings, earningsCalendar } = usePortfolioData();
  const { items } = useActionTracker({ watchlist, holdings, earnings: earningsCalendar });

  const top = useMemo(() => {
    return items
      .filter((i) => i.status === "OPEN")
      .sort((a, b) => {
        // Overdue first, then by date
        const da = daysUntil(a.due_date);
        const db = daysUntil(b.due_date);
        if (da < 0 && db >= 0) return -1;
        if (db < 0 && da >= 0) return 1;
        return a.due_date.localeCompare(b.due_date);
      })
      .slice(0, 8);
  }, [items]);

  const openCount = useMemo(() => items.filter((i) => i.status === "OPEN").length, [items]);

  return (
    <div style={{ padding: "0 var(--app-px, 40px)" }}>
      <div style={card}>
        <div style={header}>
          <span style={title}>
            Upcoming Actions
            {openCount > 0 && (
              <span style={{ color: "var(--amber)", fontWeight: 400, marginLeft: 8 }}>
                {openCount}
              </span>
            )}
          </span>
          <button
            onClick={onNavigate}
            style={{
              background: "none",
              border: "none",
              color: "var(--gold)",
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.15em",
              cursor: "pointer",
            }}
          >
            VIEW ALL →
          </button>
        </div>
        {top.length === 0 ? (
          <div
            style={{
              padding: "14px",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-dim)",
            }}
          >
            No open actions.
          </div>
        ) : (
          top.map((it) => {
            const d = daysUntil(it.due_date);
            const color = d < 0 ? "var(--red)" : d <= 7 ? "var(--amber)" : "var(--green)";
            const dueLabel = new Date(it.due_date).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
            });
            const typeColor = TYPE_COLORS[it.action_type] || "var(--text-dim)";

            return (
              <div
                key={it.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 14px",
                  borderBottom: "1px solid rgba(28,28,48,0.4)",
                  borderLeft: d < 0 ? "2px solid var(--red)" : "2px solid transparent",
                }}
              >
                {/* Priority dot */}
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background:
                      it.priority === "HIGH"
                        ? "var(--red)"
                        : it.priority === "MEDIUM"
                          ? "var(--amber)"
                          : "var(--text-dim)",
                    flexShrink: 0,
                  }}
                />

                {/* Ticker */}
                {it.ticker && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--gold)",
                      minWidth: 55,
                    }}
                  >
                    {it.ticker}
                  </span>
                )}

                {/* Summary */}
                <span
                  style={{
                    flex: 1,
                    fontFamily: "var(--font-ui)",
                    fontSize: 11,
                    color: "var(--text)",
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {it.summary}
                </span>

                {/* Type chip */}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 8,
                    letterSpacing: "0.08em",
                    padding: "1px 5px",
                    borderRadius: 2,
                    color: typeColor,
                    background: `color-mix(in srgb, ${typeColor} 10%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${typeColor} 20%, transparent)`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {it.action_type.replace(/_/g, " ")}
                </span>

                {/* Due badge */}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    color,
                    padding: "2px 6px",
                    borderRadius: 2,
                    background: `color-mix(in srgb, ${color} 10%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {d < 0
                    ? `${dueLabel} · ${Math.abs(d)}d late`
                    : d === 0
                      ? `${dueLabel} · today`
                      : `${dueLabel} · ${d}d`}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
