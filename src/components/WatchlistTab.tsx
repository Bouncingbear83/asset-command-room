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
            const entryNum = parseEntryTarget(w.entry);
            const hasBoth = curr != null && entryNum != null && entryNum > 0;
            const pctDist = hasBoth ? ((curr - entryNum) / entryNum) * 100 : null;

            let vsColor = "var(--text-dim)";
            let vsLabel = "—";
            let gaugeWidth = 50;
            if (pctDist !== null) {
              if (pctDist <= 0) {
                vsColor = "var(--green)";
                vsLabel = pctDist === 0 ? "✓ AT TARGET" : `${pctDist.toFixed(1)}%`;
                gaugeWidth = 0;
              } else if (pctDist <= 10) {
                vsColor = "var(--amber)";
                vsLabel = `+${pctDist.toFixed(1)}%`;
                gaugeWidth = pctDist * 5; // 0-50% bar width for 0-10%
              } else {
                vsColor = "var(--red, #e05555)";
                vsLabel = `+${pctDist.toFixed(1)}%`;
                gaugeWidth = Math.min(100, pctDist * 2.5);
              }
            }

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
                <td style={{ padding: "12px 16px" }}>
                  {pctDist !== null ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                      {/* Inline gauge */}
                      <div style={{ width: 48, height: 4, background: "rgba(28,28,48,0.5)", borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
                        <div style={{ width: `${gaugeWidth}%`, height: "100%", background: vsColor, borderRadius: 2, transition: "width 0.3s" }} />
                      </div>
                      {/* Percentage chip */}
                      <span style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        fontWeight: 700,
                        color: vsColor,
                        whiteSpace: "nowrap",
                      }}>
                        {vsLabel}
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: "var(--text-dim)" }}>—</span>
                  )}
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
