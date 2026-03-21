import { useState, useMemo } from "react";
import { LiveWatchItem, LiveMacroState } from "@/hooks/usePortfolioData";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

function normalizeAlertStatus(value: string) {
  return value.trim().toUpperCase();
}

function getSortPriority(item: LiveWatchItem): number {
  const alertNorm = normalizeAlertStatus(item.alertStatus);
  if (alertNorm === "EXECUTE") return 0;
  const statusNorm = item.status.trim().toUpperCase();
  return STATUS_ORDER[statusNorm] ?? 99;
}

function parseEntryTarget(entry: string): number | null {
  if (!entry) return null;
  const parts = entry.split(/\s*[-–]\s*|\s+to\s+/i);
  const nums = parts
    .map((part) => parseFloat(part.replace(/[^0-9.]/g, "")))
    .filter((num) => !isNaN(num) && num > 0);
  if (nums.length === 0) return null;
  return Math.max(...nums);
}

function getPctInfo(item: LiveWatchItem) {
  const current = typeof item.current === "number" ? item.current : null;
  const entryNum = item.triggerPriceNumeric ?? parseEntryTarget(item.entry);
  const hasBoth = current != null && entryNum != null && entryNum > 0;
  const pctDist = hasBoth ? ((current! - entryNum!) / entryNum!) * 100 : null;
  let vsColor = "var(--text-dim)";
  let vsLabel = "—";
  if (pctDist !== null) {
    if (pctDist <= 0) { vsColor = "var(--green)"; vsLabel = pctDist === 0 ? "AT TARGET" : `${pctDist.toFixed(1)}%`; }
    else if (pctDist <= 10) { vsColor = "var(--amber)"; vsLabel = `+${pctDist.toFixed(1)}%`; }
    else { vsColor = "var(--red)"; vsLabel = `+${pctDist.toFixed(1)}%`; }
  }
  return { current, vsColor, vsLabel };
}

// --- Review note parsing ---
function isStale(note: string) {
  return note?.toUpperCase().startsWith("STALE:");
}

function reviewAge(dateStr: string): number | null {
  if (!dateStr) return null;
  const reviewDate = new Date(dateStr);
  if (isNaN(reviewDate.getTime())) return null;
  const now = new Date();
  return Math.floor((now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24));
}

function formatReviewDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function parseReviewNote(note: string) {
  const parts = {
    status: note?.toUpperCase().startsWith("STALE:") ? "STALE" as const : "OK" as const,
    reason: "",
    suggestedTarget: "",
    suggestedCondition: "",
  };
  if (!note) return parts;
  const targetMatch = note.match(/\|\s*Target:\s*([^|]+)/);
  const condMatch = note.match(/\|\s*Cond:\s*([^|]+)/);
  parts.reason = note.split("|")[0].replace(/^(STALE|OK):\s*/i, "").trim();
  if (targetMatch) parts.suggestedTarget = targetMatch[1].trim();
  if (condMatch) parts.suggestedCondition = condMatch[1].trim();
  return parts;
}

type SortCol = "name" | "ticker" | "layer" | "entry" | "current" | "vs" | "status" | "alert";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortCol; label: string; width: string; align?: "right" }[] = [
  { key: "name", label: "Name", width: "minmax(140px, 1.5fr)" },
  { key: "ticker", label: "Ticker", width: "85px" },
  { key: "layer", label: "Layer", width: "80px" },
  { key: "entry", label: "Entry Target", width: "100px", align: "right" },
  { key: "current", label: "Current", width: "80px", align: "right" },
  { key: "vs", label: "vs Target", width: "80px", align: "right" },
  { key: "status", label: "Status", width: "90px" },
  { key: "alert", label: "Alert", width: "80px" },
];

function getSortValue(item: LiveWatchItem, col: SortCol): string | number {
  switch (col) {
    case "name": return item.name.toLowerCase();
    case "ticker": return item.ticker.toLowerCase();
    case "layer": return item.layer.toLowerCase();
    case "entry": return parseEntryTarget(item.entry) ?? 999999;
    case "current": return item.current ?? 999999;
    case "vs": {
      const entryNum = item.triggerPriceNumeric ?? parseEntryTarget(item.entry);
      if (item.current == null || entryNum == null || entryNum === 0) return 999999;
      return ((item.current - entryNum) / entryNum) * 100;
    }
    case "status": return STATUS_ORDER[item.status.trim().toUpperCase()] ?? 99;
    case "alert": return normalizeAlertStatus(item.alertStatus);
    default: return 0;
  }
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

function StaleBadge({ note }: { note: string }) {
  const parsed = parseReviewNote(note);
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              background: "rgba(239, 159, 39, 0.15)",
              color: "#EF9F27",
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 4,
              cursor: "help",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              letterSpacing: "0.05em",
              whiteSpace: "nowrap",
            }}
          >
            ⚠️ Stale
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="max-w-xs"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--rim)",
            color: "var(--text)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            lineHeight: 1.5,
            padding: "10px 14px",
          }}
        >
          <div style={{ fontWeight: 700, color: "#EF9F27", marginBottom: 4, fontSize: 10, letterSpacing: "0.1em" }}>
            STALE TRIGGER
          </div>
          <div style={{ color: "var(--text-mid)" }}>{parsed.reason || note}</div>
          {parsed.suggestedTarget && (
            <div style={{ marginTop: 6, color: "var(--gold)", fontStyle: "italic" }}>
              💡 Target: {parsed.suggestedTarget}
            </div>
          )}
          {parsed.suggestedCondition && (
            <div style={{ color: "var(--gold)", fontStyle: "italic" }}>
              💡 Cond: {parsed.suggestedCondition}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ReviewDateLine({ dateStr }: { dateStr: string }) {
  if (!dateStr) {
    return (
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", opacity: 0.5 }}>
        (no review)
      </span>
    );
  }
  const age = reviewAge(dateStr);
  const overdue = age !== null && age > 90;
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: overdue ? "var(--red)" : "var(--text-dim)" }}>
      {overdue
        ? `Review overdue (${age}d)`
        : `Reviewed: ${formatReviewDate(dateStr)} ✓`}
    </span>
  );
}

function SuggestedUpdates({ note }: { note: string }) {
  const parsed = parseReviewNote(note);
  if (!parsed.suggestedTarget && !parsed.suggestedCondition) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {parsed.suggestedTarget && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--gold)", fontStyle: "italic" }}>
          💡 Suggested target: {parsed.suggestedTarget}
        </span>
      )}
      {parsed.suggestedCondition && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--gold)", fontStyle: "italic" }}>
          💡 Suggested cond: {parsed.suggestedCondition}
        </span>
      )}
    </div>
  );
}

function StatCard({ count, label, color, glow }: { count: number; label: string; color: string; glow?: string }) {
  return (
    <div style={{
      flex: "1 1 0",
      minWidth: 120,
      padding: "18px 20px",
      background: "var(--panel)",
      border: "1px solid var(--rim)",
      borderRadius: 3,
      position: "relative",
      overflow: "hidden",
    }}>
      {glow && <div style={{ position: "absolute", top: -20, right: -20, width: 60, height: 60, borderRadius: "50%", background: glow, filter: "blur(24px)", opacity: 0.4 }} />}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700, color, lineHeight: 1, position: "relative" }}>{count}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-dim)", marginTop: 6, position: "relative" }}>{label}</div>
    </div>
  );
}

function BuyHighlightBox({ items, pauseActive }: { items: LiveWatchItem[]; pauseActive: boolean }) {
  if (items.length === 0) return null;
  return (
    <div style={{
      margin: "0 0 20px",
      padding: "16px 20px",
      background: "var(--green-dim)",
      border: "1px solid color-mix(in srgb, var(--green) 20%, transparent)",
      borderLeft: "3px solid var(--green)",
      borderRadius: 3,
    }}>
      {pauseActive && (
        <div style={{ background: "var(--red-dim)", border: "1px solid color-mix(in srgb, var(--red) 35%, transparent)", padding: "8px 14px", marginBottom: 12, borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", color: "var(--red)", fontWeight: 700 }}>
          ⛔ MACRO PAUSE ACTIVE — NO NEW BUYS
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", animation: "pulse-alert 2s ease-in-out infinite" }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--green)", textTransform: "uppercase" }}>
          Buy Targets ({items.length})
        </span>
      </div>
      {items.map((item, idx) => {
        const { current, vsColor, vsLabel } = getPctInfo(item);
        return (
          <div key={`buy-${idx}-${item.ticker}`} style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 80px 80px 80px 80px",
            alignItems: "center",
            gap: 8,
            padding: "10px 0",
            borderBottom: "1px solid rgba(90, 191, 160, 0.08)",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(90, 191, 160, 0.04)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
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

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span style={{ opacity: 0.25, marginLeft: 4, fontSize: 8 }}>↕</span>;
  return <span style={{ marginLeft: 4, fontSize: 8, color: "var(--gold)" }}>{dir === "asc" ? "↑" : "↓"}</span>;
}

export default function WatchlistTab({ liveData, macroState }: Props) {
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const statusSorted = useMemo(() => [...liveData].sort((a, b) => getSortPriority(a) - getSortPriority(b)), [liveData]);

  const items = useMemo(() => {
    if (!sortCol) return statusSorted;
    return [...statusSorted].sort((a, b) => {
      const av = getSortValue(a, sortCol);
      const bv = getSortValue(b, sortCol);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [statusSorted, sortCol, sortDir]);

  const BUY_STATUSES = ["BUY NOW", "BUY T1", "BUY T2"];
  const buyItems = statusSorted.filter((item) => BUY_STATUSES.includes(item.status.trim().toUpperCase()));
  const buyReadyCount = buyItems.length;
  const inZoneCount = statusSorted.filter((item) => {
    const current = typeof item.current === "number" ? item.current : null;
    const entryNum = item.triggerPriceNumeric ?? parseEntryTarget(item.entry);
    if (current == null || entryNum == null || entryNum <= 0) return false;
    return ((current - entryNum) / entryNum) * 100 < 0;
  }).length;
  const staleCount = statusSorted.filter((item) => isStale(item.triggerReviewNote)).length;
  const pauseActive = (macroState["PAUSE_ACTIVE"]?.currentValue || "").trim().toUpperCase() === "YES";

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortCol(null); setSortDir("asc"); }
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  const gridCols = COLUMNS.map((c) => c.width).join(" ");

  return (
    <div>
      {/* Hero summary strip */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard count={buyReadyCount} label="Buy Ready" color="var(--green)" glow="rgba(90, 191, 160, 0.5)" />
        <StatCard count={inZoneCount} label="In Zone" color="var(--amber)" glow="rgba(200, 146, 90, 0.5)" />
        <StatCard count={staleCount} label="Stale Triggers" color="#EF9F27" glow="rgba(239, 159, 39, 0.4)" />
        <StatCard count={items.length} label="Total Watching" color="var(--text-mid)" />
      </div>

      {/* Buy targets callout */}
      <BuyHighlightBox items={buyItems} pauseActive={pauseActive} />

      {/* Main table */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--rim)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--rim)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-mid)" }}>
            Watchlist — Do Not Buy Above Entry Target
          </span>
          {sortCol && (
            <button
              onClick={() => { setSortCol(null); setSortDir("asc"); }}
              style={{ background: "none", border: "1px solid var(--rim)", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em", padding: "2px 8px", cursor: "pointer" }}
            >
              RESET SORT
            </button>
          )}
        </div>
        <div style={{ overflowX: "auto" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: gridCols, minWidth: 800, borderBottom: "1px solid var(--rim)" }}>
            {COLUMNS.map((col) => (
              <div
                key={col.key}
                onClick={() => handleSort(col.key)}
                style={{
                  fontSize: 9,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: sortCol === col.key ? "var(--gold)" : "var(--text-dim)",
                  padding: "10px 16px",
                  textAlign: col.align ?? "left",
                  fontWeight: 400,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  userSelect: "none",
                  fontFamily: "var(--font-mono)",
                  transition: "color 0.15s",
                }}
              >
                {col.label}
                <SortArrow active={sortCol === col.key} dir={sortDir} />
              </div>
            ))}
          </div>
          {/* Rows */}
          {items.map((item, idx) => {
            const { current, vsColor, vsLabel } = getPctInfo(item);
            const staleNote = isStale(item.triggerReviewNote);
            const hasReviewNote = item.triggerReviewNote && item.triggerReviewNote.trim() !== "";
            const parsed = hasReviewNote ? parseReviewNote(item.triggerReviewNote) : null;

            return (
              <div
                key={`row-${idx}-${item.ticker}`}
                style={{
                  borderBottom: "1px solid rgba(28,28,48,0.4)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(200, 169, 110, 0.03)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {/* Main row */}
                <div style={{ display: "grid", gridTemplateColumns: gridCols, minWidth: 800 }}>
                  <div style={{ padding: "12px 16px", color: "var(--text)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 8 }} title={item.rationale}>
                    {item.name}
                    {staleNote && <StaleBadge note={item.triggerReviewNote} />}
                  </div>
                  <div style={{ padding: "12px 16px", color: "var(--gold)" }}>{item.ticker || "—"}</div>
                  <div style={{ padding: "12px 16px", color: "var(--text-dim)", fontSize: 10 }}>{item.layer || "—"}</div>
                  <div style={{ padding: "12px 16px", color: "var(--gold)", textAlign: "right" }}>{item.entry || "—"}</div>
                  <div style={{ padding: "12px 16px", color: "var(--text)", textAlign: "right" }}>{current != null ? current.toLocaleString("en-GB", { maximumFractionDigits: 2 }) : "—"}</div>
                  <div style={{ padding: "12px 16px", textAlign: "right" }}>
                    <span style={{ fontWeight: 700, color: vsColor }}>{vsLabel}</span>
                  </div>
                  <div style={{ padding: "12px 16px" }}>
                    <span style={{ ...(STATUS_STYLE[item.status] ?? STATUS_STYLE.WATCH), padding: "3px 10px", borderRadius: 2, fontSize: 9, letterSpacing: "0.15em", whiteSpace: "nowrap" }}>{item.status}</span>
                  </div>
                  <div style={{ padding: "12px 16px" }}><AlertBadge status={item.alertStatus} /></div>
                </div>
                {/* Sub-row: review date + suggested updates */}
                <div style={{ padding: "0 16px 8px 16px", display: "flex", flexDirection: "column", gap: 3 }}>
                  <ReviewDateLine dateStr={item.triggerReviewDate} />
                  {parsed && <SuggestedUpdates note={item.triggerReviewNote} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
