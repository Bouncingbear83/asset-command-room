import { useState } from "react";
import { WATCHLIST } from "@/data/portfolio";
import { LiveWatchItem } from "@/hooks/usePortfolioData";

interface Props {
  liveData: LiveWatchItem[];
}

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  "BUY T1": { background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(90,191,160,0.2)" },
  "BUY NOW": { background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(90,191,160,0.2)" },
  WAIT: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  WATCH: { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(110,142,200,0.2)" },
  RESEARCH: { background: "rgba(28,28,48,0.5)", color: "var(--text-dim)", border: "1px solid var(--rim)" },
  "PRE-IPO": { background: "rgba(28,28,48,0.5)", color: "var(--text-dim)", border: "1px solid var(--rim)" },
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
  textTransform: "uppercase" as const,
  color: "var(--text-mid)",
};
const th: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: "0.15em",
  textTransform: "uppercase" as const,
  color: "var(--text-dim)",
  padding: "8px 16px",
  borderBottom: "1px solid var(--rim)",
  textAlign: "left" as const,
  fontWeight: 400,
  whiteSpace: "nowrap" as const,
};

function parseEntryTarget(entry: string): number | null {
  if (!entry) return null;
  // Split by range separators (–, -, "to")
  const parts = entry.split(/\s*[-–]\s*|\s+to\s+/i);
  const nums = parts
    .map((p) => parseFloat(p.replace(/[^0-9.]/g, "")))
    .filter((n) => !isNaN(n) && n > 0);
  if (nums.length === 0) return null;
  // Use upper bound of range for comparison
  return Math.max(...nums);
}

function WatchTable({ items }: { items: LiveWatchItem[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
        <thead>
          <tr>
            {["Name", "Ticker", "Layer", "Entry Target", "Current", "vs Target", "Trigger", "Rationale", "Status"].map(
              (h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((w) => {
            const key = w.name + w.ticker;
            const isOpen = expanded.has(key);
            const curr = typeof w.current === "number" ? w.current : null;
            const entryNum = w.entry ? parseFloat(w.entry.replace(/[^0-9.]/g, "")) : null;
            const atTarget = curr != null && entryNum != null ? curr <= entryNum : null;
            return (
              <tr
                key={key}
                onClick={() => toggle(key)}
                style={{ borderBottom: "1px solid rgba(28,28,48,0.4)", cursor: "pointer" }}
                title={isOpen ? "Click to collapse" : "Click to expand"}
              >
                <td style={{ padding: "12px 16px", color: "var(--text)", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {w.name}
                </td>
                <td style={{ padding: "12px 16px", color: "var(--gold)" }}>{w.ticker}</td>
                <td style={{ padding: "12px 16px", color: "var(--text-dim)", fontSize: 10 }}>{w.layer}</td>
                <td style={{ padding: "12px 16px", color: "var(--gold)" }}>{w.entry}</td>
                <td style={{ padding: "12px 16px", color: "var(--text)", textAlign: "right" }}>
                  {curr != null ? curr.toLocaleString("en-GB", { maximumFractionDigits: 2 }) : "—"}
                </td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                  {atTarget === true && <span style={{ color: "var(--green)", fontWeight: 700 }}>✓ IN RANGE</span>}
                  {atTarget === false && <span style={{ color: "var(--text-dim)" }}>above</span>}
                  {atTarget === null && <span style={{ color: "var(--text-dim)" }}>—</span>}
                </td>
                <td
                  style={{
                    padding: "12px 16px",
                    color: "var(--text-dim)",
                    maxWidth: 240,
                    overflow: "hidden",
                    textOverflow: isOpen ? "unset" : "ellipsis",
                    whiteSpace: isOpen ? "normal" : "nowrap",
                    lineHeight: 1.5,
                  }}
                >
                  {w.trigger}
                </td>
                <td
                  style={{
                    padding: "12px 16px",
                    color: "var(--text-dim)",
                    maxWidth: 280,
                    overflow: "hidden",
                    textOverflow: isOpen ? "unset" : "ellipsis",
                    whiteSpace: isOpen ? "normal" : "nowrap",
                    lineHeight: 1.5,
                  }}
                >
                  {w.rationale}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span
                    style={{
                      ...(STATUS_STYLE[w.status] ?? STATUS_STYLE.WATCH),
                      padding: "3px 10px",
                      borderRadius: 2,
                      fontSize: 9,
                      letterSpacing: "0.15em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {w.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function WatchlistTab({ liveData }: Props) {
  // Map static watchlist to LiveWatchItem shape as fallback
  const staticItems: LiveWatchItem[] = WATCHLIST.map((w) => ({
    name: w.name,
    ticker: "",
    layer: w.layer,
    entry: w.entry,
    current: null,
    trigger: w.trigger,
    rationale: w.rationale,
    status: w.status,
  }));

  const items = liveData.length > 0 ? liveData : staticItems;
  const buys = items.filter((w) => w.status === "BUY T1" || w.status === "BUY NOW");
  const rest = items.filter((w) => w.status !== "BUY T1" && w.status !== "BUY NOW");

  return (
    <div>
      {buys.length > 0 && (
        <div style={{ ...card, borderColor: "rgba(90,191,160,0.3)" }}>
          <div style={cardHeader}>
            <span style={cardTitle}>⚡ Active Buys</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--green)",
                background: "var(--green-dim)",
                border: "1px solid rgba(90,191,160,0.2)",
                padding: "3px 10px",
                borderRadius: 2,
                letterSpacing: "0.15em",
              }}
            >
              {buys.length} POSITIONS
            </span>
          </div>
          <WatchTable items={buys} />
        </div>
      )}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Watchlist — Do Not Buy Above Entry Target</span>
        </div>
        <WatchTable items={rest} />
      </div>
    </div>
  );
}
