import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, Shield, Microscope } from "lucide-react";
import { LiveScore, LiveScoreLog, LiveDisruption, LiveHolding } from "@/hooks/usePortfolioData";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRationales } from "@/hooks/useRationales";
import { ScoreRationalePanel, DisruptionRationalePanel, RationaleLoading } from "@/components/RationalePanels";
import { PriceDataMap } from "@/hooks/useDailyPrices";
import { Sparkline } from "@/components/Sparkline";

const CLAUDE_PROJECT_URL = "https://claude.ai/project/019ca3a9-aefe-77ea-af76-db62fd96f4e1";

interface Props {
  scores: LiveScore[];
  scoreLog: LiveScoreLog[];
  disruptionData?: LiveDisruption[];
  allHoldings?: LiveHolding[];
  priceData?: PriceDataMap;
}

function ScoreBar({ value, max, color }: { value: number | null; max: number; color: string }) {
  if (value == null) return <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>—</span>;
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 50, height: 2, background: "var(--muted)", flexShrink: 0 }}>
        <div style={{ height: 2, background: color, width: `${pct}%` }} />
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)", minWidth: 20 }}>{value}</span>
    </div>
  );
}

function getTier(score: number | null): string {
  if (score == null) return "UNSCORED";
  if (score >= 80) return "CORE";
  if (score >= 60) return "SATELLITE";
  return "SPEC";
}

const TIER_STYLE: Record<string, React.CSSProperties> = {
  CORE: { background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(90,191,160,0.2)" },
  ANCHOR: { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(110,142,200,0.2)" },
  SATELLITE: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  SPEC: { background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(200,90,90,0.2)" },
  RESIDUAL: { background: "rgba(28,28,48,0.5)", color: "var(--text-dim)", border: "1px solid var(--rim)" },
  UNSCORED: { background: "rgba(28,28,48,0.5)", color: "var(--text-dim)", border: "1px solid var(--rim)" },
};

const ACTION_STYLE: Record<string, React.CSSProperties> = {
  "BOUGHT": { background: "#00aa66", color: "#fff" },
  "SIZE UP": { background: "#00aa66", color: "#fff" },
  "TOP-UP": { background: "#00aa66", color: "#fff" },
  "BUY": { background: "#00aa66", color: "#fff" },
  "HOLD": { background: "transparent", color: "var(--text-dim)", border: "1px solid var(--rim)" },
  "TRIMMED": { background: "#e74c3c", color: "#fff" },
  "EXIT": { background: "#e74c3c", color: "#fff" },
  "PENDING": { background: "transparent", color: "#c9a84c", border: "1px solid #c9a84c" },
  "WATCHLIST": { background: "transparent", color: "var(--text-dim)", border: "1px solid rgba(85,85,85,0.5)" },
  "REVIEW": { background: "transparent", color: "#e67e22", border: "1px solid #e67e22" },
  "MONITOR": { background: "transparent", color: "#e67e22", border: "1px solid #e67e22" },
};

function getActionStyle(action: string): React.CSSProperties {
  const upper = action.toUpperCase();
  if (ACTION_STYLE[upper]) return ACTION_STYLE[upper];
  for (const key of Object.keys(ACTION_STYLE)) {
    if (upper.includes(key)) return ACTION_STYLE[key];
  }
  return ACTION_STYLE["HOLD"];
}

const DISRUPTION_STATUS_STYLE: Record<string, React.CSSProperties> = {
  GREEN: { background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(90,191,160,0.2)" },
  MONITOR: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  AMBER: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  RED: { background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(200,90,90,0.2)" },
};

type ScoreSortKey = "ticker" | "score" | "substrate" | "demand" | "moat" | "valuation" | "mgmt" | "disruption" | "buyLow" | "scoreDate" | "layer" | "tier" | "action";
type DisruptionSortKey = "ticker" | "disruptionScore" | "subAvail" | "economics" | "govtSupport" | "demandVuln" | "timeViability" | "status";
type SortDir = "asc" | "desc";
type TabView = "scores" | "disruption";

const COLUMNS: { label: string; key: ScoreSortKey; max: number }[] = [
  { label: "Ticker", key: "ticker", max: 0 },
  { label: "Layer", key: "layer", max: 0 },
  { label: "Score", key: "score", max: 100 },
  { label: "Sub /25", key: "substrate", max: 25 },
  { label: "Dem /22", key: "demand", max: 22 },
  { label: "Moat /18", key: "moat", max: 18 },
  { label: "Val /13", key: "valuation", max: 13 },
  { label: "Mgmt /7", key: "mgmt", max: 7 },
  { label: "Disr /15", key: "disruption", max: 15 },
  { label: "Buy Range", key: "buyLow", max: 0 },
  { label: "Tier", key: "tier", max: 0 },
  { label: "Action", key: "action", max: 0 },
];

const DISRUPTION_COLUMNS: { label: string; key: DisruptionSortKey }[] = [
  { label: "Ticker", key: "ticker" },
  { label: "Score /100", key: "disruptionScore" },
  { label: "Sub Avail", key: "subAvail" },
  { label: "Economics", key: "economics" },
  { label: "Govt Support", key: "govtSupport" },
  { label: "Demand Vuln", key: "demandVuln" },
  { label: "Time Viability", key: "timeViability" },
  { label: "Status", key: "status" },
];

function sortScores(data: LiveScore[], key: ScoreSortKey, dir: SortDir): LiveScore[] {
  return [...data].sort((a, b) => {
    const av = (a as any)[key] ?? "";
    const bv = (b as any)[key] ?? "";
    if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
    return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });
}

function sortDisruption(data: LiveDisruption[], key: DisruptionSortKey, dir: SortDir): LiveDisruption[] {
  return [...data].sort((a, b) => {
    const av = (a as any)[key] ?? "";
    const bv = (b as any)[key] ?? "";
    if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
    return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });
}

type TrendField = "score" | "substrate" | "demand" | "moat" | "valuation" | "mgmt";

function ScoreTrend({ ticker, scoreLog, field = "score" }: { ticker: string; scoreLog: LiveScoreLog[]; field?: TrendField }) {
  const entries = scoreLog
    .filter((e) => e.ticker === ticker && e[field] != null)
    .sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
  if (entries.length === 0) return null;
  if (entries.length === 1) return <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)", marginLeft: 6 }}>→</span>;
  const prev = entries[entries.length - 2][field]!;
  const latest = entries[entries.length - 1][field]!;
  const delta = latest - prev;
  if (delta === 0) return <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)", marginLeft: 6 }}>→</span>;
  const isUp = delta > 0;
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: isUp ? "var(--green)" : "var(--red)", marginLeft: 6 }}>
      {isUp ? "↑" : "↓"}<span style={{ fontSize: 9, marginLeft: 2 }}>{isUp ? `+${delta}` : delta}</span>
    </span>
  );
}

function DisruptionPanel({ d }: { d: LiveDisruption }) {
  const subScores = [
    { label: "SUB_AVAIL", val: d.subAvail },
    { label: "ECONOMICS", val: d.economics },
    { label: "GOVT", val: d.govtSupport },
    { label: "DEMAND", val: d.demandVuln },
    { label: "TIME", val: d.timeViability },
  ];
  return (
    <div style={{ padding: "8px 12px 10px 36px", background: "rgba(20,20,40,0.6)", borderBottom: "1px solid rgba(28,28,48,0.3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <Shield size={12} style={{ color: "var(--accent)" }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "var(--accent)" }}>DISRUPTION</span>
        {d.disruptionScore != null && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: d.disruptionScore >= 70 ? "var(--green)" : d.disruptionScore >= 50 ? "var(--amber)" : "var(--red)" }}>
            {d.disruptionScore}/100
          </span>
        )}
        <span style={{ ...(DISRUPTION_STATUS_STYLE[d.status] ?? DISRUPTION_STATUS_STYLE.MONITOR), fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.1em", padding: "1px 6px", borderRadius: 2 }}>
          {d.status}
        </span>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
        {subScores.map((s) => s.val != null && (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-dim)", letterSpacing: "0.1em" }}>{s.label}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--text-mid)" }}>{s.val}</span>
          </div>
        ))}
      </div>
      {d.evidence && <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--text-mid)", lineHeight: 1.5, marginBottom: 4 }}>{d.evidence}</div>}
      <div style={{ display: "flex", gap: 20, marginTop: 4 }}>
        {d.amberTrigger && (
          <div style={{ flex: 1 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--amber)", fontWeight: 700, letterSpacing: "0.1em" }}>⚠ AMBER</span>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginTop: 2 }}>{d.amberTrigger}</div>
          </div>
        )}
        {d.redTrigger && (
          <div style={{ flex: 1 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--red)", fontWeight: 700, letterSpacing: "0.1em" }}>🔴 RED</span>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginTop: 2 }}>{d.redTrigger}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ScoresTab({ scores, scoreLog, disruptionData = [], allHoldings = [], priceData }: Props) {
  const isMobile = useIsMobile();
  const [activeView, setActiveView] = useState<TabView>("scores");
  const [sortKey, setSortKey] = useState<ScoreSortKey>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [dSortKey, setDSortKey] = useState<DisruptionSortKey>("disruptionScore");
  const [dSortDir, setDSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { scoreCache, disruptionCache, fetchScoreRationales, fetchDisruptionRationales, isLoading } = useRationales();

  const data = scores.length > 0 ? scores : [];
  const disruptionMap = new Map(disruptionData.map((d) => [d.ticker, d]));
  const sorted = sortScores(data, sortKey, sortDir);
  const isLive = scores.length > 0;

  const reviewFlagMap = new Map<string, 'HIGH' | 'MEDIUM' | 'LOW'>();
  for (const h of allHoldings) {
    if (h.trigger_review_note?.startsWith('Q_REVIEW')) {
      const match = h.trigger_review_note.match(/^Q_REVIEW\s+\S+\s+(HIGH|MEDIUM|LOW)/);
      if (match) reviewFlagMap.set(h.ticker, match[1] as 'HIGH' | 'MEDIUM' | 'LOW');
    }
  }
  const reviewDotColor = (p: string) => p === 'HIGH' ? 'var(--red)' : p === 'MEDIUM' ? 'var(--amber)' : 'var(--green)';

  const holdings = sorted.filter((s) => s.rowType !== "watchlist");
  const watchlist = sorted.filter((s) => s.rowType === "watchlist");

  const handleSort = (key: ScoreSortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const handleDSort = (key: DisruptionSortKey) => {
    if (key === dSortKey) setDSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setDSortKey(key); setDSortDir("desc"); }
  };

  const toggleExpand = (ticker: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) {
        next.delete(ticker);
      } else {
        next.add(ticker);
        // Fetch rationales on expand
        fetchScoreRationales(ticker);
        fetchDisruptionRationales(ticker);
      }
      return next;
    });
  };

  const toggleDisruptionExpand = (ticker: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) {
        next.delete(ticker);
      } else {
        next.add(ticker);
        fetchDisruptionRationales(ticker);
      }
      return next;
    });
  };

  const arrow = (key: string, current: string) => (current === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");
  const dArrow = (key: DisruptionSortKey) => (dSortKey === key ? (dSortDir === "asc" ? " ▲" : " ▼") : "");

  const getEffectiveTier = (s: LiveScore) => {
    if (s.tier && s.tier.trim()) return s.tier.toUpperCase();
    return getTier(s.score);
  };

  const core = holdings.filter((s) => getEffectiveTier(s) === "CORE").length;
  const anchor = holdings.filter((s) => getEffectiveTier(s) === "ANCHOR").length;
  const satellite = holdings.filter((s) => getEffectiveTier(s) === "SATELLITE").length;
  const spec = holdings.filter((s) => getEffectiveTier(s) === "SPEC" || getEffectiveTier(s) === "RESIDUAL").length;

  const cardS: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 };
  const cardHeaderS: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--rim)" };
  const cardTitleS: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "var(--text-mid)" };
  const thBase: React.CSSProperties = { fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" as const, padding: "8px 12px", borderBottom: "1px solid var(--rim)", textAlign: "left" as const, fontWeight: 400, whiteSpace: "nowrap" as const, cursor: "pointer", userSelect: "none" as const };
  const badgeBase: React.CSSProperties = { padding: "2px 8px", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", whiteSpace: "nowrap" as const };

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    background: "transparent", border: "none",
    borderBottom: isActive ? "2px solid var(--gold)" : "2px solid transparent",
    color: isActive ? "var(--gold)" : "var(--text-dim)",
    cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10,
    letterSpacing: "0.15em", textTransform: "uppercase", padding: "12px 20px 10px",
  });

  const MOBILE_COLUMNS = ["ticker", "layer", "score", "tier", "action"];

  const renderRow = (s: LiveScore) => {
    const tier = getEffectiveTier(s);
    const buyRange = s.buyLow && s.buyHigh ? `${s.currency} ${s.buyLow}–${s.buyHigh}` : s.buyLow ? `${s.currency} >${s.buyLow}` : "—";
    const tierStyle = TIER_STYLE[tier] ?? TIER_STYLE.UNSCORED;
    const actionStyle = getActionStyle(s.action);
    const isExpanded = expanded.has(s.ticker);
    const dd = disruptionMap.get(s.ticker);
    const p = isMobile ? "10px 6px" : "10px 12px";

    const scoreRat = scoreCache.get(s.ticker);
    const disruptionRat = disruptionCache.get(s.ticker);
    const loading = isLoading(s.ticker);

    return (
      <>
        <tr key={s.ticker} style={{ borderBottom: "1px solid rgba(28,28,48,0.4)", cursor: "pointer" }} onClick={() => toggleExpand(s.ticker)}>
          <td style={{ padding: p }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {isExpanded ? <ChevronDown size={12} style={{ color: "var(--text-dim)", flexShrink: 0 }} /> : <ChevronRight size={12} style={{ color: "var(--text-dim)", flexShrink: 0 }} />}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ color: "var(--gold)", fontWeight: 700, fontFamily: "var(--font-mono)", fontSize: 12 }}>
                  {s.ticker}
                  {reviewFlagMap.has(s.ticker) && <span title={`Review: ${reviewFlagMap.get(s.ticker)}`} style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: reviewDotColor(reviewFlagMap.get(s.ticker)!), marginLeft: 5, verticalAlign: "middle" }} />}
                  {s.disruption != null && s.disruption < 8 && <span title="Disruption risk" style={{ color: "var(--red)", marginLeft: 4, fontSize: 12 }}>⚠</span>}
                </span>
                {s.name && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", lineHeight: 1 }}>{s.name}</span>}
              </div>
            </div>
          </td>
          {!isMobile && <td style={{ padding: p, fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-mid)", letterSpacing: "0.08em" }}>{s.layer || "—"}</td>}
          <td style={{ padding: p }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: isMobile ? 14 : 18, fontWeight: 700, color: (s.score ?? 0) >= 80 ? "var(--green)" : (s.score ?? 0) >= 60 ? "var(--accent)" : (s.score ?? 0) >= 40 ? "var(--amber)" : "var(--red)", display: "inline-flex", alignItems: "center" }}>
              {s.score ?? "—"}<ScoreTrend ticker={s.ticker} scoreLog={scoreLog} field="score" />
            </span>
          </td>
          {!isMobile && <td style={{ padding: p }}><div style={{ display: "inline-flex", alignItems: "center" }}><ScoreBar value={s.substrate} max={25} color="var(--gold)" /><ScoreTrend ticker={s.ticker} scoreLog={scoreLog} field="substrate" /></div></td>}
          {!isMobile && <td style={{ padding: p }}><div style={{ display: "inline-flex", alignItems: "center" }}><ScoreBar value={s.demand} max={22} color="var(--accent)" /><ScoreTrend ticker={s.ticker} scoreLog={scoreLog} field="demand" /></div></td>}
          {!isMobile && <td style={{ padding: p }}><div style={{ display: "inline-flex", alignItems: "center" }}><ScoreBar value={s.moat} max={18} color="var(--green)" /><ScoreTrend ticker={s.ticker} scoreLog={scoreLog} field="moat" /></div></td>}
          {!isMobile && <td style={{ padding: p }}><div style={{ display: "inline-flex", alignItems: "center" }}><ScoreBar value={s.valuation} max={13} color="var(--amber)" /><ScoreTrend ticker={s.ticker} scoreLog={scoreLog} field="valuation" /></div></td>}
          {!isMobile && <td style={{ padding: p }}><div style={{ display: "inline-flex", alignItems: "center" }}><ScoreBar value={s.mgmt} max={7} color="var(--text-mid)" /><ScoreTrend ticker={s.ticker} scoreLog={scoreLog} field="mgmt" /></div></td>}
          {!isMobile && <td style={{ padding: p }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ScoreBar value={s.disruption} max={15} color={s.disruption != null ? (s.disruption >= 11 ? "var(--green)" : s.disruption >= 8 ? "var(--amber)" : "var(--red)") : "var(--text-dim)"} />
              {(() => { if (!dd || !dd.status) return null; const st = dd.status.toUpperCase(); const style = DISRUPTION_STATUS_STYLE[st] ?? DISRUPTION_STATUS_STYLE.MONITOR; return <span style={{ ...style, ...badgeBase, padding: "1px 6px", fontSize: 8 }}>{st}</span>; })()}
            </div>
          </td>}
          {!isMobile && <td style={{ padding: p, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", whiteSpace: "nowrap" }}>{buyRange}</td>}
          <td style={{ padding: p }}><span style={{ ...tierStyle, ...badgeBase }}>{tier}</span></td>
          <td style={{ padding: p }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {s.action && s.action.trim() ? <span style={{ ...actionStyle, ...badgeBase }}>{s.action.toUpperCase()}</span> : <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>—</span>}
              <button
                title={`Deep dive ${s.ticker}`}
                onClick={(e) => {
                  e.stopPropagation();
                  const prompt = `Deep dive rescore on ${s.ticker}. Layer: ${s.layer}. Current score: ${s.score}. Run full 6D substrate audit, check for thesis changes, and Research Commit when done.`;
                  const url = `${CLAUDE_PROJECT_URL}?prompt=${encodeURIComponent(prompt)}`;
                  (window.top || window).open(url, '_blank');
                }}
                style={{ background: "none", border: "1px solid var(--rim)", color: "var(--accent)", cursor: "pointer", padding: "2px 4px", borderRadius: 2, display: "inline-flex", alignItems: "center", transition: "color 0.2s" }}
              >
                <Microscope size={11} />
              </button>
            </div>
          </td>
          {!isMobile && <td style={{ padding: p, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.changeNote || s.fullThesis}</td>}
        </tr>
        {/* Expanded: Score rationale section */}
        {isExpanded && loading && <tr><td colSpan={COLUMNS.length + 1}><RationaleLoading /></td></tr>}
        {isExpanded && !loading && scoreRat?.latest && (
          <tr key={`${s.ticker}-score-rationale`}><td colSpan={COLUMNS.length + 1} style={{ padding: 0 }}>
            <ScoreRationalePanel rationale={scoreRat.latest} showHistory={true} history={scoreRat.history} />
          </td></tr>
        )}
        {/* Expanded: Disruption section (existing numeric + enhanced with rationales) */}
        {isExpanded && dd && <tr key={`${s.ticker}-disruption`}><td colSpan={COLUMNS.length + 1}><DisruptionPanel d={dd} /></td></tr>}
        {isExpanded && !loading && disruptionRat?.latest && (
          <tr key={`${s.ticker}-disruption-rationale`}><td colSpan={COLUMNS.length + 1} style={{ padding: 0 }}>
            <DisruptionRationalePanel rationale={disruptionRat.latest} showHistory={true} history={disruptionRat.history} />
          </td></tr>
        )}
        {isExpanded && !loading && !scoreRat?.latest && !dd && <tr key={`${s.ticker}-no-data`}><td colSpan={COLUMNS.length + 1} style={{ padding: "8px 12px 10px 36px", background: "rgba(20,20,40,0.6)", borderBottom: "1px solid rgba(28,28,48,0.3)" }}><span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>No rationale data for {s.ticker}</span></td></tr>}
      </>
    );
  };

  const renderTable = (title: string, rows: LiveScore[], subtitle?: string) => (
    <div style={cardS}>
      <div style={cardHeaderS}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={cardTitleS}>{title}</span>
          {subtitle && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.08em" }}>{subtitle}</span>}
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: isLive ? "var(--green)" : "var(--text-dim)", letterSpacing: "0.12em" }}>{isLive ? "● LIVE" : "● STATIC"}</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {COLUMNS.filter(col => !isMobile || MOBILE_COLUMNS.includes(col.key)).map((col) => (
                <th key={col.key} onClick={() => handleSort(col.key)} style={{ ...thBase, padding: isMobile ? "8px 6px" : "8px 12px", color: sortKey === col.key ? "var(--gold)" : "var(--text-dim)" }}>{col.label}{arrow(col.key, sortKey)}</th>
              ))}
              {!isMobile && <th style={{ ...thBase, cursor: "default", color: "var(--text-dim)" }}>Notes</th>}
            </tr>
          </thead>
          <tbody>{rows.map((s) => renderRow(s))}</tbody>
        </table>
      </div>
    </div>
  );

  const sortedDisruption = sortDisruption(disruptionData, dSortKey, dSortDir);

  const renderDisruptionView = () => (
    <div style={cardS}>
      <div style={cardHeaderS}>
        <span style={cardTitleS}>Disruption Analysis</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: disruptionData.length > 0 ? "var(--green)" : "var(--text-dim)", letterSpacing: "0.12em" }}>
          {disruptionData.length > 0 ? `● ${disruptionData.length} ASSETS` : "● NO DATA"}
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {DISRUPTION_COLUMNS.map((col) => (
                <th key={col.key} onClick={() => handleDSort(col.key)} style={{ ...thBase, color: dSortKey === col.key ? "var(--gold)" : "var(--text-dim)" }}>
                  {col.label}{dArrow(col.key)}
                </th>
              ))}
              <th style={{ ...thBase, cursor: "default", color: "var(--text-dim)" }}>Triggers</th>
              <th style={{ ...thBase, cursor: "default", color: "var(--text-dim)" }}>Evidence</th>
              <th style={{ width: 24, padding: "8px 6px", borderBottom: "1px solid var(--rim)" }} />
            </tr>
          </thead>
          <tbody>
            {sortedDisruption.map((d) => {
              const scoreColor = d.disruptionScore != null ? (d.disruptionScore >= 70 ? "var(--green)" : d.disruptionScore >= 50 ? "var(--amber)" : "var(--red)") : "var(--text-dim)";
              const st = d.status.toUpperCase();
              const statusStyle = DISRUPTION_STATUS_STYLE[st] ?? DISRUPTION_STATUS_STYLE.MONITOR;
              const isExp = expanded.has(`d-${d.ticker}`);
              const dRat = disruptionCache.get(d.ticker);
              const dLoading = isLoading(d.ticker);

              return (
                <>
                  <tr key={d.ticker} style={{ borderBottom: "1px solid rgba(28,28,48,0.4)", cursor: "pointer" }} onClick={() => toggleDisruptionExpand(`d-${d.ticker}`)}>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {isExp ? <ChevronDown size={12} style={{ color: "var(--text-dim)" }} /> : <ChevronRight size={12} style={{ color: "var(--text-dim)" }} />}
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ color: "var(--gold)", fontWeight: 700, fontFamily: "var(--font-mono)", fontSize: 12 }}>{d.ticker}</span>
                          {d.name && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>{d.name}</span>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: scoreColor }}>{d.disruptionScore ?? "—"}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)" }}>{d.subAvail ?? "—"}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)" }}>{d.economics ?? "—"}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)" }}>{d.govtSupport ?? "—"}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)" }}>{d.demandVuln ?? "—"}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)" }}>{d.timeViability ?? "—"}</td>
                    <td style={{ padding: "10px 12px" }}><span style={{ ...statusStyle, ...badgeBase, padding: "2px 8px" }}>{st}</span></td>
                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", maxWidth: 150 }}>
                      {d.amberTrigger && <div style={{ color: "var(--amber)", marginBottom: 2 }}>⚠ {d.amberTrigger}</div>}
                      {d.redTrigger && <div style={{ color: "var(--red)" }}>🔴 {d.redTrigger}</div>}
                      {!d.amberTrigger && !d.redTrigger && "—"}
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.evidence || "—"}</td>
                    <td style={{ padding: "10px 6px", color: "var(--text-dim)" }}>{isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                  </tr>
                  {isExp && dLoading && <tr><td colSpan={DISRUPTION_COLUMNS.length + 3}><RationaleLoading /></td></tr>}
                  {isExp && !dLoading && dRat?.latest && (
                    <tr><td colSpan={DISRUPTION_COLUMNS.length + 3} style={{ padding: 0 }}>
                      <DisruptionRationalePanel rationale={dRat.latest} showHistory={true} history={dRat.history} />
                    </td></tr>
                  )}
                  {isExp && !dLoading && !dRat?.latest && (
                    <tr><td colSpan={DISRUPTION_COLUMNS.length + 3} style={{ padding: "8px 12px 10px 36px", background: "rgba(20,20,40,0.6)", borderBottom: "1px solid rgba(28,28,48,0.3)" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>No disruption rationale data for {d.ticker}</span>
                    </td></tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", borderBottom: "1px solid var(--rim)", marginBottom: 20 }}>
        <button style={tabStyle(activeView === "scores")} onClick={() => setActiveView("scores")}>Scores</button>
        <button style={tabStyle(activeView === "disruption")} onClick={() => setActiveView("disruption")}>Disruption</button>
      </div>

      {activeView === "scores" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(5, 1fr)", gap: isMobile ? 8 : 16, marginBottom: 20 }}>
            {[
              { label: "Holdings", value: String(holdings.length), color: "var(--text)" },
              { label: "Core", value: String(core), color: "var(--green)" },
              { label: "Anchor", value: String(anchor), color: "var(--accent)" },
              { label: "Satellite", value: String(satellite), color: "var(--amber)" },
              { label: "Spec / Residual", value: String(spec), color: "var(--red)" },
            ].map((m) => (
              <div key={m.label} style={{ ...cardS, padding: "16px 20px", marginBottom: 0 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 300, color: m.color }}>{m.value}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-dim)", marginTop: 6 }}>{m.label}</div>
              </div>
            ))}
          </div>
          {renderTable("Stellar Alignment Scores", holdings, `${holdings.length} holdings`)}
          {watchlist.length > 0 && renderTable("Watchlist Scores", watchlist, `${watchlist.length} watchlist`)}
          <div style={{ ...cardS, padding: "12px 20px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", color: "var(--text-dim)", lineHeight: 2 }}>
              DIMENSION WEIGHTS · Substrate /25 · Demand /22 · Moat /18 · Valuation /13 · Mgmt /7 · Disruption /15 · Total /100 &nbsp;·&nbsp; TIERS · Core (4–7% AUM) · Anchor · Satellite (1–3%) · Spec (≤1%) · Residual
            </div>
          </div>
        </>
      )}

      {activeView === "disruption" && renderDisruptionView()}
    </div>
  );
}
