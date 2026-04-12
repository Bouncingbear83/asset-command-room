import { useState, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronRight, ChevronDown } from "lucide-react";
import { LiveWatchItem, LiveMacroState } from "@/hooks/usePortfolioData";
import { triggerWebhook } from "@/lib/webhooks";
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
  ACTIVE_MONITORING: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid color-mix(in srgb, var(--amber) 35%, transparent)" },
  MONITOR: { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)" },
  WAIT: { background: "rgba(80, 80, 120, 0.15)", color: "var(--text-dim)", border: "1px solid rgba(80, 80, 120, 0.25)" },
  WATCH: { background: "rgba(80, 80, 120, 0.15)", color: "var(--text-dim)", border: "1px solid rgba(80, 80, 120, 0.25)" },
  RESEARCH: { background: "rgba(80, 80, 160, 0.15)", color: "rgb(140, 140, 220)", border: "1px solid rgba(140, 140, 220, 0.25)" },
  "PRE-IPO": { background: "rgba(130, 80, 180, 0.15)", color: "rgb(170, 120, 220)", border: "1px solid rgba(170, 120, 220, 0.25)" },
  EXITED: { background: "rgba(60, 60, 80, 0.15)", color: "var(--text-dim)", border: "1px solid rgba(60, 60, 80, 0.3)" },
};

function parseEntryTarget(entry: string): number | null {
  if (!entry) return null;
  const parts = entry.split(/\s*[-–]\s*|\s+to\s+/i);
  const nums = parts
    .map((part) => parseFloat(part.replace(/[^0-9.]/g, "")))
    .filter((num) => !isNaN(num) && num > 0);
  if (nums.length === 0) return null;
  return nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0];
}

function getPctInfo(item: LiveWatchItem) {
  const current = typeof item.current === "number" ? item.current : null;
  const entryNum = item.triggerPriceNumeric ?? parseEntryTarget(item.entry);
  const hasBoth = current != null && entryNum != null && entryNum > 0;
  const pctDist = hasBoth ? ((current! - entryNum!) / entryNum!) * 100 : null;
  let vsColor = "var(--text-dim)";
  let vsLabel = "—";
  if (pctDist !== null) {
    // Negative = below target (buy zone) = green. Positive = above target (wait) = amber/red.
    if (pctDist <= 0) { vsColor = "var(--green)"; vsLabel = pctDist === 0 ? "AT TARGET" : `${pctDist.toFixed(1)}%`; }
    else if (pctDist <= 10) { vsColor = "var(--red)"; vsLabel = `+${pctDist.toFixed(1)}%`; }
    else { vsColor = "var(--red)"; vsLabel = `+${pctDist.toFixed(1)}%`; }
  }
  return { current, entryNum, pctDist, vsColor, vsLabel };
}

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

// ── Staleness indicator ──

interface StalenessConfig {
  amberDays: number;
  redDays: number;
  showStaleness: boolean;
}

const stalenessByStatus: Record<string, StalenessConfig> = {
  'ACTIVE':           { amberDays: 14, redDays: 30, showStaleness: true },
  'REVIEW_FLAGGED':   { amberDays: 14, redDays: 30, showStaleness: true },
  'PENDING':          { amberDays: 14, redDays: 30, showStaleness: true },
  'BUY NOW':          { amberDays: 14, redDays: 30, showStaleness: true },
  'BUY T1':           { amberDays: 14, redDays: 30, showStaleness: true },
  'BUY T2':           { amberDays: 14, redDays: 30, showStaleness: true },
  'ACTIVE_MONITORING':{ amberDays: 14, redDays: 30, showStaleness: true },
  'MONITOR':          { amberDays: 14, redDays: 30, showStaleness: true },
  'WAIT':             { amberDays: 30, redDays: 60, showStaleness: true },
  'WATCH':            { amberDays: 30, redDays: 60, showStaleness: true },
  'RESEARCH':         { amberDays: 30, redDays: 60, showStaleness: true },
  'PRE-IPO':          { amberDays: -1, redDays: -1, showStaleness: false },
  'EXITED':           { amberDays: -1, redDays: -1, showStaleness: false },
};

type StalenessColor = 'green' | 'amber' | 'red' | 'grey';

function getStalenessIndicator(
  reviewDate: string | null | undefined,
  status: string
): { color: StalenessColor; label: string; sortWeight: number } {
  const config = stalenessByStatus[status.trim().toUpperCase()] || stalenessByStatus['WAIT'];

  if (!reviewDate) {
    return { color: 'red', label: 'Never reviewed', sortWeight: 9999 };
  }

  const daysSince = reviewAge(reviewDate);
  if (daysSince === null) {
    return { color: 'red', label: 'Never reviewed', sortWeight: 9999 };
  }

  if (!config.showStaleness) {
    return { color: 'grey', label: `Scanned ${daysSince}d ago`, sortWeight: -1 };
  }

  if (daysSince >= config.redDays) {
    return { color: 'red', label: `${daysSince}d — overdue`, sortWeight: daysSince + 1000 };
  }
  if (daysSince >= config.amberDays) {
    return { color: 'amber', label: `${daysSince}d`, sortWeight: daysSince + 500 };
  }
  return { color: 'green', label: `${daysSince}d`, sortWeight: daysSince };
}

const STALENESS_DOT_COLORS: Record<StalenessColor, string> = {
  green: 'var(--green)',
  amber: '#EF9F27',
  red: 'var(--red)',
  grey: 'var(--text-dim)',
};

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

// ── Shared sub-components ──

function StatCard({ count, label, color, glow }: { count: number; label: string; color: string; glow?: string }) {
  return (
    <div style={{
      flex: "1 1 0",
      minWidth: 80,
      padding: "14px 14px",
      background: "var(--panel)",
      border: "1px solid var(--rim)",
      borderRadius: 3,
      position: "relative",
      overflow: "hidden",
    }}>
      {glow && <div style={{ position: "absolute", top: -20, right: -20, width: 60, height: 60, borderRadius: "50%", background: glow, filter: "blur(24px)", opacity: 0.4 }} />}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color, lineHeight: 1, position: "relative" }}>{count}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-dim)", marginTop: 6, position: "relative" }}>{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.trim().toUpperCase();
  const style = STATUS_STYLE[normalized] ?? STATUS_STYLE.WATCH;
  return (
    <span style={{ ...style, padding: "2px 8px", borderRadius: 2, fontSize: 8, letterSpacing: "0.12em", whiteSpace: "nowrap", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
      {normalized}
    </span>
  );
}

function ReviewCard({ note, dateStr }: { note: string; dateStr: string }) {
  const hasNote = note && note.trim() !== "";
  if (!hasNote && !dateStr) {
    return (
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", opacity: 0.5 }}>
        (no review)
      </span>
    );
  }

  const parsed = hasNote ? parseReviewNote(note) : null;
  const stale = hasNote && isStale(note);
  const age = reviewAge(dateStr);
  const overdue = age !== null && age > 90;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {parsed && (
        <div style={{
          borderLeft: `3px solid ${stale ? "#EF9F27" : "var(--green)"}`,
          background: stale ? "rgba(239, 159, 39, 0.06)" : "rgba(90, 191, 160, 0.04)",
          padding: "8px 12px",
          borderRadius: "0 3px 3px 0",
        }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: stale ? "#EF9F27" : "var(--green)", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 3 }}>
            {stale ? "⚠️ STALE" : "✓ OK"}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", lineHeight: 1.5 }}>
            {parsed.reason}
          </div>
          {parsed.suggestedTarget && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--gold)", fontStyle: "italic", marginTop: 4 }}>
              💡 Suggested target: {parsed.suggestedTarget}
            </div>
          )}
          {parsed.suggestedCondition && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--gold)", fontStyle: "italic" }}>
              💡 Suggested cond: {parsed.suggestedCondition}
            </div>
          )}
        </div>
      )}
      {dateStr && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: overdue ? "var(--red)" : "var(--text-dim)" }}>
          {overdue ? `Review overdue (${age}d)` : `Reviewed: ${formatReviewDate(dateStr)} ✓`}
        </span>
      )}
    </div>
  );
}

function ActionButtons({ ticker, type = 'watchlist' }: { ticker: string; type?: 'holding' | 'watchlist' }) {
  const handleDeepDive = () => {
    const prompt = type === 'holding'
      ? `Deep dive on ${ticker}. Search for latest news, earnings, and developments. Reassess all 6 scoring dimensions. Produce research commit JSON at the end.`
      : `Watchlist review for ${ticker}. Search for latest developments. Reassess entry target, trigger condition, and thesis. Produce research commit JSON at the end.`;
    const url = `https://claude.ai/new?q=${encodeURIComponent(prompt)}&project_uuid=019ca3a9-aefe-77ea-af76-db62fd96f4e1`;
    (window.top || window).open(url, '_blank');
  };

  const btnStyle: React.CSSProperties = {
    background: "none",
    border: "1px solid var(--rim)",
    color: "var(--text-dim)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.08em",
    padding: "3px 10px",
    borderRadius: 2,
    cursor: "pointer",
    transition: "all 0.15s",
  };

  return (
    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
      <button
        onClick={() => triggerWebhook("stellar-rescore", { ticker }, `Rescore triggered for ${ticker}`)}
        style={btnStyle}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--gold)"; e.currentTarget.style.color = "var(--gold)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--rim)"; e.currentTarget.style.color = "var(--text-dim)"; }}
      >
        🔄 Rescore
      </button>
      <button
        onClick={() => triggerWebhook("stellar-earnings-prep", { ticker }, `Earnings prep triggered for ${ticker}`)}
        style={btnStyle}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--gold)"; e.currentTarget.style.color = "var(--gold)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--rim)"; e.currentTarget.style.color = "var(--text-dim)"; }}
      >
        📋 Earnings Prep
      </button>
      <button
        onClick={() => triggerWebhook("stellar-watchlist-review", { ticker }, `Watchlist review triggered for ${ticker}. Check email.`)}
        style={btnStyle}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--gold)"; e.currentTarget.style.color = "var(--gold)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--rim)"; e.currentTarget.style.color = "var(--text-dim)"; }}
      >
        🔄 Review
      </button>
      <button
        onClick={handleDeepDive}
        style={{ ...btnStyle, color: "var(--accent)" }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--rim)"; e.currentTarget.style.color = "var(--accent)"; }}
        title="Deep dive (opens Claude project — free on Max)"
      >
        🔬 Deep Dive
      </button>
    </div>
  );
}

// ── Row Card ──

function WatchlistRow({ item, dimmed, hideActions }: { item: LiveWatchItem; dimmed?: boolean; hideActions?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { current, vsColor, vsLabel } = getPctInfo(item);
  const isMobile = useIsMobile();
  const staleness = getStalenessIndicator(item.triggerReviewDate, item.status);
  const staleDotColor = STALENESS_DOT_COLORS[staleness.color];
  const isReviewFlagged = item.status.trim().toUpperCase() === 'REVIEW_FLAGGED';

  return (
    <div
      style={{
        padding: isMobile ? "10px 12px" : "14px 20px",
        borderBottom: "1px solid rgba(28,28,48,0.3)",
        opacity: dimmed ? 0.6 : 1,
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(200, 169, 110, 0.03)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* Collapsed header — always visible, clickable */}
      <div
        style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: 8 }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Line 1: Ticker · Name · Layer · Status */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{item.ticker || "—"}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mid)" }}>{item.name}</span>
            {item.layer && (
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em", padding: "2px 7px", borderRadius: 2,
                background: "rgba(28,28,48,0.5)", border: "1px solid var(--rim)", color: "var(--text-dim)", textTransform: "uppercase",
              }}>
                {item.layer}
              </span>
            )}
            <StatusBadge status={item.status} />
          </div>

          {/* Line 2: Target · Current · vs% · Reviewed */}
          <div style={{ display: "flex", gap: isMobile ? 8 : 16, alignItems: "center", fontFamily: "var(--font-mono)", fontSize: 10, flexWrap: "wrap" }}>
            <span style={{ color: "var(--text-dim)" }}>Target: <span style={{ color: "var(--gold)" }}>{item.entry || "—"}</span></span>
            <span style={{ color: "var(--text-dim)" }}>Current: <span style={{ color: "var(--text)" }}>{current != null ? current.toLocaleString("en-GB", { maximumFractionDigits: 2 }) : "—"}</span></span>
            <span style={{ fontWeight: 700, color: vsColor }}>{vsLabel}</span>
            {item.deploy_amount_gbp != null && item.deploy_amount_gbp > 0 && (
              <span style={{ color: "var(--text-dim)" }}>Deploy: <span style={{ color: "var(--accent)" }}>£{item.deploy_amount_gbp.toLocaleString("en-GB", { maximumFractionDigits: 0 })}</span></span>
            )}
            {/* Staleness indicator */}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: staleDotColor, flexShrink: 0, boxShadow: staleness.color === 'red' ? `0 0 4px ${staleDotColor}` : undefined }} />
              <span style={{ color: staleDotColor, fontWeight: staleness.color === 'red' ? 700 : 400 }}>{staleness.label}</span>
            </span>
          </div>

          {/* Review note subtitle for REVIEW_FLAGGED */}
          {isReviewFlagged && item.triggerReviewNote && (
            <div style={{
              marginTop: 4,
              padding: "4px 8px",
              background: "rgba(239, 159, 39, 0.08)",
              borderLeft: "2px solid #EF9F27",
              borderRadius: "0 2px 2px 0",
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: "#EF9F27",
              lineHeight: 1.4,
            }}>
              {item.triggerReviewNote}
            </div>
          )}
        </div>

        {/* Chevron */}
        {expanded
          ? <ChevronDown size={14} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
          : <ChevronRight size={14} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
        }
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ marginTop: 8 }}>
          {/* Trigger condition */}
          {item.trigger && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", marginBottom: 4, lineHeight: 1.5 }}>
              {item.trigger}
            </div>
          )}
          {/* Thesis / rationale */}
          {item.rationale && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginBottom: 8, lineHeight: 1.5, fontStyle: "italic" }}>
              {item.rationale}
            </div>
          )}

          {/* Review note */}
          <ReviewCard note={item.triggerReviewNote} dateStr={item.triggerReviewDate} />

          {/* Action buttons */}
          {!hideActions && <ActionButtons ticker={item.ticker} />}
        </div>
      )}
    </div>
  );
}

// ── Section Header ──

function SectionHeader({ dotColor, label, count }: { dotColor: string; label: string; count: number }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: isMobile ? "12px 12px" : "14px 20px", borderBottom: "1px solid var(--rim)" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: dotColor, textTransform: "uppercase" }}>
        {label} ({count})
      </span>
    </div>
  );
}

// ── Main Component ──

export default function WatchlistTab({ liveData, macroState }: Props) {
  const [showAllWaiting, setShowAllWaiting] = useState(false);

  const BUY_STATUSES = ["BUY NOW", "BUY T1", "BUY T2"];
  const ACTIVE_MONITORING_STATUSES = ["ACTIVE_MONITORING"];
  const MONITORING_STATUSES = ["MONITOR"];
  const WAIT_STATUSES = ["WAIT", "WATCH"];
  const RESEARCH_STATUSES = ["RESEARCH"];
  const PREIPO_STATUSES = ["PRE-IPO"];
  const EXITED_STATUSES = ["EXITED"];

  const buyTargets = useMemo(() =>
    liveData
      .filter((item) => BUY_STATUSES.includes(item.status.trim().toUpperCase()))
      .sort((a, b) => {
        const aPct = getPctInfo(a).pctDist ?? 999;
        const bPct = getPctInfo(b).pctDist ?? 999;
        return aPct - bPct; // most below target first
      }),
    [liveData]
  );

  const waiting = useMemo(() =>
    liveData
      .filter((item) => WAIT_STATUSES.includes(item.status.trim().toUpperCase()))
      .sort((a, b) => {
        const aPct = getPctInfo(a).pctDist ?? 999;
        const bPct = getPctInfo(b).pctDist ?? 999;
        return aPct - bPct; // closest to entry first
      }),
    [liveData]
  );

  const preIpo = useMemo(() =>
    liveData
      .filter((item) => PREIPO_STATUSES.includes(item.status.trim().toUpperCase()))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [liveData]
  );

  const activeMonitoring = useMemo(() =>
    liveData
      .filter((item) => ACTIVE_MONITORING_STATUSES.includes(item.status.trim().toUpperCase()))
      .sort((a, b) => getStalenessIndicator(b.triggerReviewDate, b.status).sortWeight - getStalenessIndicator(a.triggerReviewDate, a.status).sortWeight || a.name.localeCompare(b.name)),
    [liveData]
  );

  const monitoring = useMemo(() =>
    liveData
      .filter((item) => MONITORING_STATUSES.includes(item.status.trim().toUpperCase()))
      .sort((a, b) => getStalenessIndicator(b.triggerReviewDate, b.status).sortWeight - getStalenessIndicator(a.triggerReviewDate, a.status).sortWeight || a.name.localeCompare(b.name)),
    [liveData]
  );

  const research = useMemo(() =>
    liveData
      .filter((item) => RESEARCH_STATUSES.includes(item.status.trim().toUpperCase()))
      .sort((a, b) => getStalenessIndicator(b.triggerReviewDate, b.status).sortWeight - getStalenessIndicator(a.triggerReviewDate, a.status).sortWeight || a.name.localeCompare(b.name)),
    [liveData]
  );

  const exited = useMemo(() =>
    liveData
      .filter((item) => EXITED_STATUSES.includes(item.status.trim().toUpperCase()))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [liveData]
  );

  const inZoneCount = useMemo(() =>
    liveData.filter((item) => {
      const { pctDist } = getPctInfo(item);
      return pctDist !== null && pctDist < 0;
    }).length,
    [liveData]
  );

  const staleCount = useMemo(() =>
    liveData.filter((item) => getStalenessIndicator(item.triggerReviewDate, item.status).color === 'red').length,
    [liveData]
  );

  const pauseActive = (macroState["PAUSE_ACTIVE"]?.currentValue || "").trim().toUpperCase() === "YES";

  const visibleWaiting = showAllWaiting ? waiting : waiting.slice(0, 6);
  const hiddenWaitingCount = waiting.length - 6;

  return (
    <div>
      {/* Hero summary strip */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard count={buyTargets.length} label="Buy Ready" color="var(--green)" glow="rgba(90, 191, 160, 0.5)" />
        <StatCard count={inZoneCount} label="In Zone" color="var(--amber)" glow="rgba(200, 146, 90, 0.5)" />
        <StatCard count={staleCount} label="Overdue Reviews" color="#EF9F27" glow="rgba(239, 159, 39, 0.4)" />
        <StatCard count={liveData.length} label="Total Watching" color="var(--text-mid)" />
      </div>

      {/* ── Section 1: Buy Targets ── */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--rim)", borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
        <SectionHeader dotColor="var(--green)" label="Buy Targets" count={buyTargets.length} />

        {pauseActive && (
          <div style={{ margin: "12px 20px 0", background: "var(--red-dim)", border: "1px solid color-mix(in srgb, var(--red) 35%, transparent)", padding: "8px 14px", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", color: "var(--red)", fontWeight: 700 }}>
            ⛔ MACRO PAUSE ACTIVE — NO NEW BUYS
          </div>
        )}

        {buyTargets.length === 0 ? (
          <div style={{ padding: "20px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", textAlign: "center" }}>
            No buy targets active
          </div>
        ) : (
          buyTargets.map((item, idx) => (
            <WatchlistRow key={`buy-${idx}-${item.ticker}`} item={item} />
          ))
        )}
      </div>

      {/* ── Section 2: Active Monitoring ── */}
      {activeMonitoring.length > 0 && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--rim)", borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
          <SectionHeader dotColor="var(--amber)" label="Active Monitoring" count={activeMonitoring.length} />
          {activeMonitoring.map((item, idx) => (
            <WatchlistRow key={`monitor-${idx}-${item.ticker}`} item={item} />
          ))}
        </div>
      )}

      {/* ── Section 3: Monitoring ── */}
      {monitoring.length > 0 && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--rim)", borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
          <SectionHeader dotColor="var(--accent)" label="Monitoring" count={monitoring.length} />
          {monitoring.map((item, idx) => (
            <WatchlistRow key={`monitoring-${idx}-${item.ticker}`} item={item} />
          ))}
        </div>
      )}

      {/* ── Section 4: Waiting for Entry ── */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--rim)", borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
        <SectionHeader dotColor="var(--text-dim)" label="Waiting for Entry" count={waiting.length} />

        {waiting.length === 0 ? (
          <div style={{ padding: "20px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", textAlign: "center" }}>
            No entries waiting
          </div>
        ) : (
          <>
            {visibleWaiting.map((item, idx) => {
              const { pctDist } = getPctInfo(item);
              const farAway = pctDist !== null && pctDist > 25;
              return <WatchlistRow key={`wait-${idx}-${item.ticker}`} item={item} dimmed={farAway} />;
            })}
            {!showAllWaiting && hiddenWaitingCount > 0 && (
              <button
                onClick={() => setShowAllWaiting(true)}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "none",
                  border: "none",
                  borderTop: "1px solid var(--rim)",
                  color: "var(--gold)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(200, 169, 110, 0.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                + {hiddenWaitingCount} more waiting...
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Section 5: Research ── */}
      {research.length > 0 && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--rim)", borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
          <SectionHeader dotColor="rgb(100, 160, 220)" label="Research" count={research.length} />
          {research.map((item, idx) => (
            <WatchlistRow key={`research-${idx}-${item.ticker}`} item={item} dimmed />
          ))}
        </div>
      )}

      {/* ── Section 6: Pre-IPO ── */}
      {preIpo.length > 0 && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--rim)", borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
          <SectionHeader dotColor="rgb(170, 120, 220)" label="Pre-IPO" count={preIpo.length} />
          {preIpo.map((item, idx) => (
            <WatchlistRow key={`preipo-${idx}-${item.ticker}`} item={item} dimmed />
          ))}
        </div>
      )}

      {/* ── Section 7: Exited ── */}
      {exited.length > 0 && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--rim)", borderRadius: 3, overflow: "hidden" }}>
          <SectionHeader dotColor="var(--text-dim)" label="Exited" count={exited.length} />
          {exited.map((item, idx) => (
            <WatchlistRow key={`exited-${idx}-${item.ticker}`} item={item} dimmed />
          ))}
        </div>
      )}
    </div>
  );
}
