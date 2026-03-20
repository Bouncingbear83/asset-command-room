import { LiveWatchItem, LiveMacroState } from "@/hooks/usePortfolioData";

interface Props {
  liveData: LiveWatchItem[];
  macroState: LiveMacroState;
}

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  "BUY T1": { background: "var(--green-dim)", color: "var(--green)", border: "1px solid color-mix(in srgb, var(--green) 35%, transparent)" },
  "BUY T2": { background: "var(--green-dim)", color: "var(--green)", border: "1px solid color-mix(in srgb, var(--green) 35%, transparent)" },
  "BUY NOW": { background: "var(--green-dim)", color: "var(--green)", border: "1px solid color-mix(in srgb, var(--green) 35%, transparent)" },
  WAIT: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid color-mix(in srgb, var(--amber) 35%, transparent)" },
  WATCH: { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)" },
  MONITOR: { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)" },
  RESEARCH: { background: "rgba(28,28,48,0.5)", color: "var(--text-dim)", border: "1px solid var(--rim)" },
  "PRE-IPO": { background: "rgba(28,28,48,0.5)", color: "var(--text-dim)", border: "1px solid var(--rim)" },
};

const ALERT_STYLE: Record<string, React.CSSProperties> = {
  IN_ZONE: {
    background: "var(--amber-dim)",
    color: "var(--amber)",
    border: "1px solid color-mix(in srgb, var(--amber) 35%, transparent)",
  },
  EXECUTE: {
    background: "var(--green-dim)",
    color: "var(--green)",
    border: "1px solid color-mix(in srgb, var(--green) 35%, transparent)",
    animation: "pulse-alert 2s ease-in-out infinite",
  },
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

function parseEntryTarget(entry: string): number | null {
  if (!entry) return null;
  const parts = entry.split(/\s*[-–]\s*|\s+to\s+/i);
  const nums = parts
    .map((part) => parseFloat(part.replace(/[^0-9.]/g, "")))
    .filter((num) => !isNaN(num) && num > 0);
  if (nums.length === 0) return null;
  return Math.max(...nums);
}

function normalizeAlertStatus(value: string) {
  return value.trim().toUpperCase();
}

const STATUS_ORDER: Record<string, number> = {
  "EXECUTE": 0,
  "BUY NOW": 1,
  "BUY T1": 2,
  "BUY T2": 3,
  "WAIT": 4,
  "MONITOR": 5,
  "WATCH": 6,
  "RESEARCH": 7,
  "PRE-IPO": 8,
};

function getSortPriority(item: LiveWatchItem): number {
  const alertNorm = normalizeAlertStatus(item.alertStatus);
  if (alertNorm === "EXECUTE") return 0;
  const statusNorm = item.status.trim().toUpperCase();
  return STATUS_ORDER[statusNorm] ?? 99;
}

function AlertBadge({ status }: { status: string }) {
  const normalized = normalizeAlertStatus(status);
  const style = ALERT_STYLE[normalized];
  if (!style) return null;
  return (
    <span style={{ ...style, padding: "3px 10px", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", whiteSpace: "nowrap" }}>
      {normalized.replace("_", " ")}
    </span>
  );
}

function BuyHighlightBox({ items, pauseActive }: { items: LiveWatchItem[]; pauseActive: boolean }) {
  if (items.length === 0) return null;
  return (
    <div style={{ margin: "16px 20px", padding: 16, background: "var(--green-dim)", border: "1px solid color-mix(in srgb, var(--green) 25%, transparent)", borderRadius: 4 }}>
      {pauseActive && (
        <div style={{ background: "var(--red-dim)", border: "1px solid color-mix(in srgb, var(--red) 35%, transparent)", padding: "8px 14px", marginBottom: 12, borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", color: "var(--red)", fontWeight: 700 }}>
          ⛔ MACRO PAUSE ACTIVE — NO NEW BUYS
        </div>
      )}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--green)", marginBottom: 10, textTransform: "uppercase" }}>
        Buy Targets ({items.length})
      </div>
      {items.map((item) => {
        const current = typeof item.current === "number" ? item.current : null;
        const entryNum = item.triggerPriceNumeric ?? parseEntryTarget(item.entry);
        const hasBoth = current != null && entryNum != null && entryNum > 0;
        const pctDist = hasBoth ? ((current - entryNum) / entryNum) * 100 : null;
        let vsColor = "var(--text-dim)";
        let vsLabel = "—";
        if (pctDist !== null) {
          if (pctDist <= 0) { vsColor = "var(--green)"; vsLabel = pctDist === 0 ? "AT TARGET" : `${pctDist.toFixed(1)}%`; }
          else if (pctDist <= 10) { vsColor = "var(--amber)"; vsLabel = `+${pctDist.toFixed(1)}%`; }
          else { vsColor = "var(--red)"; vsLabel = `+${pctDist.toFixed(1)}%`; }
        }
        return (
          <div key={`${item.name}-${item.ticker}`} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 80px 80px", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid rgba(28,28,48,0.2)" }}>
            <div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "var(--text)" }}>{item.name}</span>
              {item.ticker && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--gold)", marginLeft: 8 }}>{item.ticker}</span>}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--gold)", textAlign: "right" }}>{item.entry || "—"}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text)", textAlign: "right" }}>{current != null ? current.toLocaleString("en-GB", { maximumFractionDigits: 2 }) : "—"}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: vsColor, textAlign: "right" }}>{vsLabel}</div>
            <div style={{ textAlign: "right" }}>
              <span style={{ ...(STATUS_STYLE[item.status] ?? STATUS_STYLE.WATCH), padding: "2px 8px", borderRadius: 2, fontSize: 8, letterSpacing: "0.12em", whiteSpace: "nowrap" }}>{item.status}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WatchTable({ items }: { items: LiveWatchItem[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
        <thead>
          <tr>
            {["Name", "Ticker", "Layer", "Entry Target", "Current", "vs Target", "Trigger", "Status", "Alert"].map((heading) => (
              <th key={heading} style={th}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const current = typeof item.current === "number" ? item.current : null;
            const entryNum = item.triggerPriceNumeric ?? parseEntryTarget(item.entry);
            const hasBoth = current != null && entryNum != null && entryNum > 0;
            const pctDist = hasBoth ? ((current - entryNum) / entryNum) * 100 : null;
            let vsColor = "var(--text-dim)";
            let vsLabel = "—";
            if (pctDist !== null) {
              if (pctDist <= 0) { vsColor = "var(--green)"; vsLabel = pctDist === 0 ? "AT TARGET" : `${pctDist.toFixed(1)}%`; }
              else if (pctDist <= 10) { vsColor = "var(--amber)"; vsLabel = `+${pctDist.toFixed(1)}%`; }
              else { vsColor = "var(--red)"; vsLabel = `+${pctDist.toFixed(1)}%`; }
            }
            return (
              <tr key={`${item.name}-${item.ticker}`} style={{ borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                <td style={{ padding: "12px 16px", color: "var(--text)", fontWeight: 600, whiteSpace: "nowrap" }} title={item.rationale}>{item.name}</td>
                <td style={{ padding: "12px 16px", color: "var(--gold)" }}>{item.ticker || "—"}</td>
                <td style={{ padding: "12px 16px", color: "var(--text-dim)", fontSize: 10 }}>{item.layer || "—"}</td>
                <td style={{ padding: "12px 16px", color: "var(--gold)" }}>{item.entry || "—"}</td>
                <td style={{ padding: "12px 16px", color: "var(--text)", textAlign: "right" }}>{current != null ? current.toLocaleString("en-GB", { maximumFractionDigits: 2 }) : "—"}</td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: vsColor }}>{vsLabel}</span>
                </td>
                <td style={{ padding: "12px 16px", color: "var(--text-dim)", maxWidth: 300, lineHeight: 1.5 }}>{item.trigger || "—"}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ ...(STATUS_STYLE[item.status] ?? STATUS_STYLE.WATCH), padding: "3px 10px", borderRadius: 2, fontSize: 9, letterSpacing: "0.15em", whiteSpace: "nowrap" }}>{item.status}</span>
                </td>
                <td style={{ padding: "12px 16px" }}><AlertBadge status={item.alertStatus} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function WatchlistTab({ liveData, macroState }: Props) {
  const items = [...liveData].sort((a, b) => getSortPriority(a) - getSortPriority(b));
  const buyItems = items.filter((item) => {
    const s = item.status.trim().toUpperCase();
    return s === "BUY NOW" || s === "BUY T1";
  });
  const executeCount = items.filter((item) => normalizeAlertStatus(item.alertStatus) === "EXECUTE").length;
  const inZoneCount = items.filter((item) => normalizeAlertStatus(item.alertStatus) === "IN_ZONE").length;
  const pauseActive = (macroState["PAUSE_ACTIVE"]?.currentValue || "").trim().toUpperCase() === "YES";

  return (
    <div style={card}>
      <div style={cardHeader}>
        <span style={cardTitle}>Watchlist — Do Not Buy Above Entry Target</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {executeCount > 0 && <AlertBadge status="EXECUTE" />}
          {inZoneCount > 0 && <AlertBadge status="IN_ZONE" />}
        </div>
      </div>
      <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--rim)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.08em" }}>
        {executeCount} execute-ready · {inZoneCount} in-zone · {items.length} total
      </div>
      <BuyHighlightBox items={buyItems} pauseActive={pauseActive} />
      <WatchTable items={items} />
    </div>
  );
}
