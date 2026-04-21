import { LiveEarningsCalendarItem } from "@/hooks/usePortfolioData";
import { triggerWebhook } from "@/lib/webhooks";
import { buildClaudePromptUrl } from "@/lib/claudePromptUrl";

interface Props {
  items: LiveEarningsCalendarItem[];
}

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
const th: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  color: "var(--text-dim)",
  padding: "8px 16px",
  borderBottom: "1px solid var(--rim)",
  textAlign: "left",
  fontWeight: 400,
  whiteSpace: "nowrap",
};

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDaysUntil(value: string) {
  const date = parseDate(value);
  if (!date) return Number.POSITIVE_INFINITY;
  const now = startOfDay(new Date());
  const target = startOfDay(date);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getUrgencyStyle(daysUntil: number): React.CSSProperties {
  if (daysUntil <= 2) {
    return {
      background: "var(--red-dim)",
      color: "var(--red)",
      border: "1px solid color-mix(in srgb, var(--red) 35%, transparent)",
    };
  }

  if (daysUntil <= 7) {
    return {
      background: "var(--amber-dim)",
      color: "var(--amber)",
      border: "1px solid color-mix(in srgb, var(--amber) 35%, transparent)",
    };
  }

  return {
    background: "rgba(28,28,48,0.5)",
    color: "var(--text-dim)",
    border: "1px solid var(--rim)",
  };
}

function formatDate(value: string) {
  const date = parseDate(value);
  if (!date) return value || "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function EarningsCalendarTab({ items }: Props) {
  const ordered = [...items].sort((a, b) => {
    const aTime = parseDate(a.nextEarningsDate)?.getTime() ?? Number.POSITIVE_INFINITY;
    const bTime = parseDate(b.nextEarningsDate)?.getTime() ?? Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });

  return (
    <div style={card}>
      <div style={cardHeader}>
        <span style={cardTitle}>Earnings Calendar</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.08em" }}>
          {ordered.length} rows
        </span>
      </div>
      {ordered.length === 0 ? (
        <div style={{ padding: 20, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>No earnings rows available.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
            <thead>
              <tr>
                {["Ticker", "Next Earnings", "Window", "Fiscal Period", "Confirmed", "Updated", ""].map((heading) => (
                  <th key={heading} style={th}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordered.map((item) => {
                const daysUntil = getDaysUntil(item.nextEarningsDate);
                const urgencyStyle = getUrgencyStyle(daysUntil);

                return (
                  <tr key={`${item.ticker}-${item.nextEarningsDate}`} style={{ borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                    <td style={{ padding: "12px 16px", color: "var(--gold)", fontWeight: 700 }}>{item.ticker}</td>
                    <td style={{ padding: "12px 16px", color: "var(--text)" }}>{formatDate(item.nextEarningsDate)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ ...urgencyStyle, padding: "3px 10px", borderRadius: 2, fontSize: 9, letterSpacing: "0.12em", whiteSpace: "nowrap" }}>
                        {daysUntil === Number.POSITIVE_INFINITY ? "UNSCHEDULED" : daysUntil < 0 ? "PAST" : `${daysUntil}D`}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-dim)" }}>{item.fiscalPeriod || "—"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        padding: "3px 10px",
                        borderRadius: 2,
                        fontSize: 9,
                        letterSpacing: "0.12em",
                        whiteSpace: "nowrap",
                        background: item.confirmed ? "var(--green-dim)" : "rgba(28,28,48,0.5)",
                        color: item.confirmed ? "var(--green)" : "var(--text-dim)",
                        border: item.confirmed ? "1px solid color-mix(in srgb, var(--green) 35%, transparent)" : "1px solid var(--rim)",
                      }}>
                        {item.confirmed ? "CONFIRMED" : "TENTATIVE"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-dim)" }}>{formatDate(item.lastUpdated)}</td>
                    <td style={{ padding: "12px 8px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          title={`Earnings prep for ${item.ticker}`}
                          onClick={() => triggerWebhook("stellar-earnings-prep", { ticker: item.ticker }, `Earnings prep triggered for ${item.ticker}. Check email.`)}
                          style={{ background: "none", border: "1px solid var(--rim)", color: "var(--text-dim)", cursor: "pointer", padding: "3px 8px", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", transition: "color 0.2s" }}
                        >
                          📋 Prep
                        </button>
                        <button
                          title={`Post-earnings thesis check for ${item.ticker}`}
                          onClick={() => {
                            const url = buildClaudePromptUrl("earnings_post", {
                              ticker: item.ticker,
                              fiscal_period: item.fiscalPeriod || "—",
                              earnings_date: item.nextEarningsDate || "—",
                            });
                            (window.top || window).open(url, "_blank");
                          }}
                          style={{ background: "none", border: "1px solid var(--accent)", color: "var(--accent)", cursor: "pointer", padding: "3px 8px", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", transition: "color 0.2s" }}
                        >
                          🔬 Post
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
