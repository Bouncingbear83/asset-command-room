import { useState, useMemo, useRef } from "react";
import { ChevronRight, ChevronDown, Shield, Microscope, AlertTriangle } from "lucide-react";
import { SIPP_HOLDINGS, ISA_HOLDINGS } from "@/data/portfolio";
import { LiveHolding, LiveDisruption, LiveTransaction, LiveScore } from "@/hooks/usePortfolioData";
import { useIsMobile } from "@/hooks/use-mobile";
import { calcHoldingReturns, HoldingReturns } from "@/lib/xirr";

const CLAUDE_PROJECT_URL = "https://claude.ai/project/019ca3a9-aefe-77ea-af76-db62fd96f4e1";

interface Props {
  sipp: LiveHolding[];
  isa: LiveHolding[];
  disruption?: LiveDisruption[];
  transactions?: LiveTransaction[];
  scores?: LiveScore[];
}

type ViewMode = "layer" | "account" | "pricemap";

type SortKey = "ticker" | "name" | "layer" | "mv" | "gl" | "day" | "price" | "action" | "annReturn" | "cost" | "truePL" | "truePLpct" | "entryDate";
type SortDir = "asc" | "desc";

const ACTION_STYLE: Record<string, React.CSSProperties> = {
  HOLD: { background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(90,191,160,0.2)" },
  ADD: { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(110,142,200,0.2)" },
  "SIZE UP": { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(110,142,200,0.2)" },
  MONITOR: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  REVIEW: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  TRIM: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  EXIT: { background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(200,90,90,0.2)" },
  SELL: { background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(200,90,90,0.2)" },
  CAP: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  WATCH: { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(110,142,200,0.2)" },
};

const ALERT_STYLE: Record<string, React.CSSProperties> = {
  ADD_ZONE: { background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(90,191,160,0.2)" },
  EXIT_ZONE: { background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(200,90,90,0.2)" },
  REVIEW: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
};

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 24 };
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
const detailRowS: React.CSSProperties = {
  padding: "6px 12px 6px 36px",
  fontFamily: "'DM Mono', var(--font-mono)",
  fontSize: "0.78rem",
  background: "color-mix(in srgb, var(--panel) 90%, white 10%)",
  borderBottom: "1px solid rgba(28,28,48,0.25)",
};

const BASE_COLUMNS: { label: string; key: SortKey; align?: "right"; hideMobile?: boolean }[] = [
  { label: "Ticker", key: "ticker" },
  { label: "Name", key: "name", hideMobile: true },
  { label: "Layer", key: "layer", hideMobile: true },
  { label: "MV £", key: "mv", align: "right" },
  { label: "G/L %", key: "gl", align: "right" },
  { label: "Day %", key: "day", align: "right" },
  { label: "Price", key: "price", align: "right" },
];

const RETURNS_COLUMNS: { label: string; key: SortKey; align?: "right"; hideMobile?: boolean }[] = [
  { label: "Cost £", key: "cost", align: "right", hideMobile: true },
  { label: "P&L £", key: "truePL", align: "right", hideMobile: true },
  { label: "Return %", key: "truePLpct", align: "right", hideMobile: true },
  { label: "Ann. Return", key: "annReturn", align: "right" },
  { label: "Entry", key: "entryDate", hideMobile: true },
];

function normalizeAlertStatus(value: string) {
  return value.trim().toUpperCase();
}

function AlertBadge({ status }: { status: string }) {
  const normalized = normalizeAlertStatus(status);
  const style = ALERT_STYLE[normalized];
  if (!style || normalized === "CLEAR") return null;

  return (
    <span
      style={{
        ...style,
        padding: "2px 8px",
        borderRadius: 2,
        fontFamily: "var(--font-mono)",
        fontSize: 8,
        letterSpacing: "0.12em",
        whiteSpace: "nowrap",
      }}
    >
      {normalized.replace("_", " ")}
    </span>
  );
}

type HoldingWithReturns = LiveHolding & { returns?: HoldingReturns };

function sortHoldings(data: HoldingWithReturns[], key: SortKey, dir: SortDir): HoldingWithReturns[] {
  return [...data].sort((a, b) => {
    let av: any, bv: any;
    switch (key) {
      case "annReturn": av = a.returns?.annualisedReturn ?? -999; bv = b.returns?.annualisedReturn ?? -999; break;
      case "cost": av = a.returns?.totalCost ?? 0; bv = b.returns?.totalCost ?? 0; break;
      case "truePL": av = a.returns?.truePL ?? 0; bv = b.returns?.truePL ?? 0; break;
      case "truePLpct": av = a.returns?.truePLpct ?? 0; bv = b.returns?.truePLpct ?? 0; break;
      case "entryDate": av = a.returns?.entryDate ?? ""; bv = b.returns?.entryDate ?? ""; break;
      default: av = a[key] ?? ""; bv = b[key] ?? "";
    }
    if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
    return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });
}

function InlineRangeBar({ h }: { h: LiveHolding }) {
  if (h.ma60 == null || h.high_52w == null || h.low_52w == null || h.price == null) return null;
  const low = h.low_52w;
  const high = h.high_52w;
  const price = h.price;
  const ma60 = h.ma60;
  const range = high - low;
  if (range <= 0) return null;

  const pricePct = Math.max(0, Math.min(100, ((price - low) / range) * 100));
  const ma60Pct = Math.max(0, Math.min(100, ((ma60 - low) / range) * 100));
  const distFromMa = ((price - ma60) / ma60) * 100;

  let statusColor: string;
  let statusLabel: string;
  if (price < ma60) {
    statusColor = "var(--red)";
    statusLabel = "Dislocation";
  } else if (pricePct >= 80) {
    statusColor = "var(--amber)";
    statusLabel = "Extended";
  } else {
    statusColor = "var(--green)";
    statusLabel = "Healthy";
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
      <div style={{ flex: 1, position: "relative", height: 22, display: "flex", alignItems: "center", minWidth: 120 }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 6, background: "rgba(110,142,200,0.25)", borderRadius: 3 }} />
        <div style={{ position: "absolute", left: `${ma60Pct}%`, top: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ fontFamily: "'DM Mono', var(--font-mono)", fontSize: 7, color: "var(--gold)", whiteSpace: "nowrap", marginBottom: 1 }}>MA60</span>
          <div style={{ width: 0, flex: 1, borderLeft: "1px dashed var(--gold)" }} />
        </div>
        <div style={{ position: "absolute", left: `${pricePct}%`, top: 2, bottom: 2, width: 3, background: statusColor, borderRadius: 1 }} />
        <span style={{ position: "absolute", left: 0, bottom: -1, fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-dim)" }}>{low.toFixed(0)}</span>
        <span style={{ position: "absolute", right: 0, bottom: -1, fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-dim)" }}>{high.toFixed(0)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span
          style={{
            background: statusColor === "var(--green)" ? "var(--green-dim)" : statusColor === "var(--amber)" ? "var(--amber-dim)" : "var(--red-dim)",
            color: statusColor,
            border: `1px solid ${statusColor === "var(--green)" ? "rgba(90,191,160,0.2)" : statusColor === "var(--amber)" ? "rgba(200,146,90,0.2)" : "rgba(200,90,90,0.2)"}`,
            padding: "1px 6px",
            borderRadius: 2,
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            letterSpacing: "0.08em",
            whiteSpace: "nowrap",
          }}
        >
          {statusLabel}
        </span>
        <span style={{ fontFamily: "'DM Mono', var(--font-mono)", fontSize: 10, color: statusColor, whiteSpace: "nowrap" }}>
          {distFromMa >= 0 ? "+" : ""}
          {distFromMa.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

const DISRUPTION_STATUS_STYLE: Record<string, React.CSSProperties> = {
  GREEN: { background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(90,191,160,0.2)" },
  MONITOR: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  AMBER: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  RED: { background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(200,90,90,0.2)" },
};

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
        {subScores.map((s) =>
          s.val != null ? (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-dim)", letterSpacing: "0.1em" }}>{s.label}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--text-mid)" }}>{s.val}</span>
            </div>
          ) : null,
        )}
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

function TriggerRows({ h, colSpan, disruption, returns }: { h: LiveHolding; colSpan: number; disruption?: LiveDisruption; returns?: HoldingReturns }) {
  const addVal = h.trigger_price_add || h.add_trigger || "—";
  const exitVal = h.trigger_price_exit || h.exit_trigger || "—";
  const has52w = h.ma60 != null && h.high_52w != null && h.low_52w != null && h.price != null;
  return (
    <>
      <tr>
        <td colSpan={colSpan} style={detailRowS}>
          <span style={{ color: "var(--green)", fontWeight: 700, marginRight: 10, fontSize: 9, letterSpacing: "0.1em" }}>ADD</span>
          <span style={{ color: "var(--text-mid)" }}>{addVal}</span>
        </td>
      </tr>
      <tr>
        <td colSpan={colSpan} style={detailRowS}>
          <span style={{ color: "var(--red)", fontWeight: 700, marginRight: 10, fontSize: 9, letterSpacing: "0.1em" }}>EXIT</span>
          <span style={{ color: "var(--text-mid)" }}>{exitVal}</span>
        </td>
      </tr>
      {h.trigger_type && (
        <tr>
          <td colSpan={colSpan} style={detailRowS}>
            <span style={{ color: "var(--accent)", fontWeight: 700, marginRight: 10, fontSize: 9, letterSpacing: "0.1em" }}>TYPE</span>
            <span style={{ color: "var(--text-mid)" }}>{h.trigger_type}</span>
          </td>
        </tr>
      )}
      {has52w && (
        <tr>
          <td colSpan={colSpan} style={detailRowS}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 9, letterSpacing: "0.1em", flexShrink: 0 }}>52W</span>
              <InlineRangeBar h={h} />
            </div>
          </td>
        </tr>
      )}
      {/* Mobile: show returns detail in expanded row */}
      {returns && returns.totalCost > 0 && (
        <tr>
          <td colSpan={colSpan} style={detailRowS}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <span><span style={{ color: "var(--text-dim)", fontSize: 9, letterSpacing: "0.1em" }}>COST</span> <span style={{ color: "var(--text-mid)" }}>£{returns.totalCost.toLocaleString("en-GB", { maximumFractionDigits: 0 })}</span></span>
              <span><span style={{ color: "var(--text-dim)", fontSize: 9, letterSpacing: "0.1em" }}>P&L</span> <span style={{ color: returns.truePL >= 0 ? "var(--green)" : "var(--red)" }}>£{returns.truePL >= 0 ? "+" : ""}{returns.truePL.toLocaleString("en-GB", { maximumFractionDigits: 0 })}</span></span>
              <span><span style={{ color: "var(--text-dim)", fontSize: 9, letterSpacing: "0.1em" }}>RETURN</span> <span style={{ color: returns.truePLpct >= 0 ? "var(--green)" : "var(--red)" }}>{returns.truePLpct >= 0 ? "+" : ""}{returns.truePLpct.toFixed(1)}%</span></span>
              <span><span style={{ color: "var(--text-dim)", fontSize: 9, letterSpacing: "0.1em" }}>ANN.</span> <span style={{ color: returns.annualisedReturn >= 0 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>{returns.annualisedReturn >= 0 ? "+" : ""}{returns.annualisedReturn.toFixed(1)}% pa</span></span>
              <span><span style={{ color: "var(--text-dim)", fontSize: 9, letterSpacing: "0.1em" }}>ENTRY</span> <span style={{ color: "var(--text-dim)" }}>{returns.entryDate}</span></span>
              <span><span style={{ color: "var(--text-dim)", fontSize: 9, letterSpacing: "0.1em" }}>TRANCHES</span> <span style={{ color: "var(--text-mid)" }}>{returns.trancheCount}</span></span>
            </div>
          </td>
        </tr>
      )}
      {disruption && (
        <tr>
          <td colSpan={colSpan} style={{ padding: 0 }}>
            <DisruptionPanel d={disruption} />
          </td>
        </tr>
      )}
    </>
  );
}

function HoldingsTable({ holdings, disruptionMap, transactions }: { holdings: LiveHolding[]; disruptionMap: Map<string, LiveDisruption>; transactions: LiveTransaction[] }) {
  const isMobile = useIsMobile();
  const [sortKey, setSortKey] = useState<SortKey>("mv");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Calculate returns for each holding
  const holdingsWithReturns: HoldingWithReturns[] = useMemo(() => {
    return holdings.map(h => ({
      ...h,
      returns: transactions.length > 0 ? calcHoldingReturns(h.ticker, h.account, h.mv || 0, transactions) : undefined,
    }));
  }, [holdings, transactions]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = sortHoldings(holdingsWithReturns, sortKey, sortDir);
  const total = holdings.reduce((sum, holding) => sum + (holding.mv || 0), 0);
  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  const allColumns = [...BASE_COLUMNS, ...RETURNS_COLUMNS];
  const visibleCols = allColumns.filter(col => !(isMobile && col.hideMobile));
  const totalCols = visibleCols.length + 2; // +notes +action +chevron on desktop

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
        <thead>
          <tr>
            {visibleCols.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                style={{
                  fontSize: 9,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: sortKey === col.key ? "var(--gold)" : "var(--text-dim)",
                  padding: isMobile ? "8px 6px" : "8px 12px",
                  borderBottom: "1px solid var(--rim)",
                  textAlign: col.align ?? "left",
                  fontWeight: 400,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                {col.label}
                {arrow(col.key)}
              </th>
            ))}
            {!isMobile && <th style={{ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-dim)", padding: "8px 12px", borderBottom: "1px solid var(--rim)", textAlign: "left", fontWeight: 400 }}>Notes</th>}
            <th style={{ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-dim)", padding: isMobile ? "8px 6px" : "8px 12px", borderBottom: "1px solid var(--rim)", textAlign: "left", fontWeight: 400 }}>Action</th>
            <th style={{ width: 24, padding: "8px 6px", borderBottom: "1px solid var(--rim)" }} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((h) => {
            const isOpen = expanded.has(h.ticker);
            const r = h.returns;
            const hasReturns = r && r.totalCost > 0;
            return (
              <>
                <tr key={h.ticker} onClick={() => toggle(h.ticker)} style={{ borderBottom: isOpen ? "none" : "1px solid rgba(28,28,48,0.4)", cursor: "pointer" }}>
                  <td style={{ padding: isMobile ? "10px 6px" : "10px 12px", color: "var(--gold)", fontWeight: 700 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span>{h.ticker}</span>
                      {(() => {
                        if (!h.trigger_review_note?.startsWith('Q_REVIEW')) return null;
                        const m = h.trigger_review_note.match(/^Q_REVIEW\s+\S+\s+(HIGH|MEDIUM|LOW)/);
                        if (!m) return null;
                        const c = m[1] === 'HIGH' ? 'var(--red)' : m[1] === 'MEDIUM' ? 'var(--amber)' : 'var(--green)';
                        return <span title={`Review: ${m[1]}`} style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: c, flexShrink: 0, cursor: "pointer" }} />;
                      })()}
                      <AlertBadge status={h.alert_status} />
                    </div>
                  </td>
                  {!isMobile && <td style={{ padding: "10px 12px", color: "var(--text)", whiteSpace: "nowrap" }}>{h.name}</td>}
                  {!isMobile && <td style={{ padding: "10px 12px", color: "var(--text-dim)", fontSize: 10 }}>{h.layer}</td>}
                  <td style={{ padding: isMobile ? "10px 6px" : "10px 12px", color: "var(--text)", textAlign: "right", whiteSpace: "nowrap" }}>{h.mv ? `£${h.mv.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : "—"}</td>
                  <td style={{ padding: isMobile ? "10px 6px" : "10px 12px", color: h.gl >= 0 ? "var(--green)" : "var(--red)", textAlign: "right" }}>{h.gl != null ? `${h.gl >= 0 ? "+" : ""}${h.gl.toFixed(1)}%` : "—"}</td>
                  <td style={{ padding: isMobile ? "10px 6px" : "10px 12px", color: h.day > 0 ? "var(--green)" : h.day < 0 ? "var(--red)" : "var(--text-dim)", textAlign: "right" }}>{h.day != null ? `${h.day >= 0 ? "+" : ""}${h.day.toFixed(2)}%` : "—"}</td>
                  <td style={{ padding: isMobile ? "10px 6px" : "10px 12px", color: "var(--text-mid)", textAlign: "right" }}>{h.price != null ? `${h.price.toLocaleString("en-GB", { maximumFractionDigits: 2 })}` : "—"}</td>
                  {/* Returns columns */}
                  {!isMobile && <td style={{ padding: "10px 12px", color: "var(--text-dim)", textAlign: "right", fontSize: 10 }}>{hasReturns ? `£${r!.totalCost.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : "—"}</td>}
                  {!isMobile && <td style={{ padding: "10px 12px", textAlign: "right", color: hasReturns ? (r!.truePL >= 0 ? "var(--green)" : "var(--red)") : "var(--text-dim)" }}>{hasReturns ? `${r!.truePL >= 0 ? "+" : ""}£${Math.abs(r!.truePL).toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : "—"}</td>}
                  {!isMobile && <td style={{ padding: "10px 12px", textAlign: "right", color: hasReturns ? (r!.truePLpct >= 0 ? "var(--green)" : "var(--red)") : "var(--text-dim)" }}>{hasReturns ? `${r!.truePLpct >= 0 ? "+" : ""}${r!.truePLpct.toFixed(1)}%` : "—"}</td>}
                  <td style={{ padding: isMobile ? "10px 6px" : "10px 12px", textAlign: "right", color: hasReturns ? (r!.annualisedReturn >= 0 ? "var(--green)" : "var(--red)") : "var(--text-dim)", fontWeight: hasReturns ? 700 : 400, fontSize: hasReturns ? 12 : 11 }}>{hasReturns ? `${r!.annualisedReturn >= 0 ? "+" : ""}${r!.annualisedReturn.toFixed(1)}% pa` : "—"}</td>
                  {!isMobile && <td style={{ padding: "10px 12px", color: "var(--text-dim)", textAlign: "left", fontSize: 9 }}>{hasReturns ? r!.entryDate : "—"}</td>}
                  {!isMobile && <td style={{ padding: "10px 12px", color: "var(--text-dim)", fontSize: 10, maxWidth: 260, overflow: "hidden", textOverflow: isOpen ? "unset" : "ellipsis", whiteSpace: isOpen ? "normal" : "nowrap", lineHeight: 1.5 }}>{h.notes}</td>}
                  <td style={{ padding: isMobile ? "10px 6px" : "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ ...(ACTION_STYLE[h.action] ?? ACTION_STYLE.MONITOR), fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", padding: "2px 8px", borderRadius: 2, whiteSpace: "nowrap" }}>{h.action}</span>
                      <button
                        title={`Deep dive ${h.ticker} (opens Claude project)`}
                        onClick={(e) => {
                          e.stopPropagation();
                          const prompt = `Deep dive rescore on ${h.ticker}. Layer: ${h.layer}. Current score: ${h.gl}. Run full 6D substrate audit, check for thesis changes, and Research Commit when done.`;
                          const url = `${CLAUDE_PROJECT_URL}?prompt=${encodeURIComponent(prompt)}`;
                          (window.top || window).open(url, '_blank');
                        }}
                        style={{ background: "none", border: "1px solid var(--rim)", color: "var(--accent)", cursor: "pointer", padding: "2px 4px", borderRadius: 2, display: "inline-flex", alignItems: "center", transition: "color 0.2s" }}
                      >
                        <Microscope size={11} />
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: "10px 6px", color: "var(--text-dim)" }}>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                </tr>
                {isOpen && <TriggerRows h={h} colSpan={totalCols + 1} disruption={disruptionMap.get(h.ticker)} returns={r} />}
              </>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} style={{ padding: "12px", color: "var(--text-mid)", fontWeight: 700, borderTop: "1px solid var(--rim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>TOTAL</td>
            <td style={{ padding: "12px", color: "var(--gold)", fontWeight: 700, textAlign: "right", borderTop: "1px solid var(--rim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>£{total.toLocaleString("en-GB", { maximumFractionDigits: 0 })}</td>
            <td colSpan={totalCols - 3} style={{ borderTop: "1px solid var(--rim)" }} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ToggleButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        padding: "4px 12px",
        border: "1px solid var(--rim)",
        background: active ? "var(--accent-dim)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-dim)",
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
    >
      {label}
    </button>
  );
}

interface LayerGroup {
  layer: string;
  holdings: HoldingWithReturns[];
  totalMv: number;
  pctAum: number;
}

function LayerView({ allHoldings, totalAum, transactions }: { allHoldings: LiveHolding[]; totalAum: number; transactions: LiveTransaction[] }) {
  const holdingsWithReturns: HoldingWithReturns[] = useMemo(() => {
    return allHoldings.map(h => ({
      ...h,
      returns: transactions.length > 0 ? calcHoldingReturns(h.ticker, h.account, h.mv || 0, transactions) : undefined,
    }));
  }, [allHoldings, transactions]);

  const grouped = new Map<string, HoldingWithReturns[]>();
  for (const h of holdingsWithReturns) {
    const key = h.layer || "Uncategorised";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(h);
  }

  const layers: LayerGroup[] = Array.from(grouped.entries())
    .map(([layer, holdings]) => ({
      layer,
      holdings,
      totalMv: holdings.reduce((sum, holding) => sum + (holding.mv || 0), 0),
      pctAum: totalAum > 0 ? (holdings.reduce((sum, holding) => sum + (holding.mv || 0), 0) / totalAum) * 100 : 0,
    }))
    .sort((a, b) => b.totalMv - a.totalMv);

  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("mv");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const toggleRow = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const pad = isMobile ? "8px 6px" : "8px 12px";
  const cellPad = isMobile ? "10px 6px" : "10px 12px";

  const thS: React.CSSProperties = {
    fontSize: 9,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "var(--text-dim)",
    padding: pad,
    borderBottom: "1px solid var(--rim)",
    textAlign: "left",
    fontWeight: 400,
    whiteSpace: "nowrap",
    cursor: "pointer",
    userSelect: "none",
  };

  const LAYER_COLS: { label: string; key: SortKey; align?: "right"; hideMobile?: boolean }[] = [
    { label: "Ticker", key: "ticker" },
    { label: "Name", key: "name", hideMobile: true },
    { label: "MV £", key: "mv", align: "right" },
    { label: "G/L %", key: "gl", align: "right" },
    { label: "Day %", key: "day", align: "right" },
    { label: "Price", key: "price", align: "right", hideMobile: true },
    { label: "Ann. Ret", key: "annReturn", align: "right" },
    { label: "Notes", key: "name", hideMobile: true },
    { label: "Action", key: "action" },
  ];

  const visibleCols = LAYER_COLS.filter(c => !(isMobile && c.hideMobile));
  const totalCols = visibleCols.length + 1;

  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
        <thead>
          <tr>
            {visibleCols.map((col) => (
              <th key={col.key + col.label} onClick={() => handleSort(col.key)} style={{ ...thS, textAlign: col.align ?? "left", color: sortKey === col.key ? "var(--gold)" : "var(--text-dim)" }}>{col.label}{arrow(col.key)}</th>
            ))}
            <th style={{ width: 24, padding: "8px 6px", borderBottom: "1px solid var(--rim)" }} />
          </tr>
        </thead>
        <tbody>
          {layers.map((lg) => {
            const sortedHoldings = sortHoldings(lg.holdings, sortKey, sortDir);
            return (
            <>
              <tr key={`layer-${lg.layer}`} style={{ background: "rgba(28,28,48,0.6)" }}>
                <td colSpan={isMobile ? 2 : 2} style={{ padding: cellPad, color: "var(--gold)", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {lg.layer}
                  <span style={{ color: "var(--text-dim)", fontWeight: 400, fontSize: 9, marginLeft: 8 }}>{lg.holdings.length}</span>
                </td>
                <td style={{ padding: cellPad, textAlign: "right", color: "var(--text)", fontWeight: 700 }}>£{lg.totalMv.toLocaleString("en-GB", { maximumFractionDigits: 0 })}</td>
                <td style={{ padding: cellPad, textAlign: "right", color: "var(--accent)", fontWeight: 700, fontSize: 10 }}>{lg.pctAum.toFixed(1)}%</td>
                <td colSpan={totalCols - 4} />
              </tr>
              {sortedHoldings.map((h) => {
                const isOpen = expanded.has(h.ticker);
                const r = h.returns;
                const hasReturns = r && r.totalCost > 0;
                return (
                  <>
                    <tr key={h.ticker} onClick={() => toggleRow(h.ticker)} style={{ borderBottom: isOpen ? "none" : "1px solid rgba(28,28,48,0.3)", cursor: "pointer" }}>
                      <td style={{ padding: isMobile ? "10px 6px 10px 12px" : "10px 12px 10px 24px", color: "var(--gold)", fontWeight: 700 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span>{h.ticker}</span>
                          <AlertBadge status={h.alert_status} />
                        </div>
                      </td>
                      {!isMobile && <td style={{ padding: cellPad, color: "var(--text)", whiteSpace: "nowrap" }}>{h.name}</td>}
                      <td style={{ padding: cellPad, color: "var(--text)", textAlign: "right", whiteSpace: "nowrap" }}>{h.mv ? `£${h.mv.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : "—"}</td>
                      <td style={{ padding: cellPad, color: h.gl >= 0 ? "var(--green)" : "var(--red)", textAlign: "right" }}>{h.gl != null ? `${h.gl >= 0 ? "+" : ""}${h.gl.toFixed(1)}%` : "—"}</td>
                      <td style={{ padding: cellPad, color: h.day > 0 ? "var(--green)" : h.day < 0 ? "var(--red)" : "var(--text-dim)", textAlign: "right" }}>{h.day != null ? `${h.day >= 0 ? "+" : ""}${h.day.toFixed(2)}%` : "—"}</td>
                      {!isMobile && <td style={{ padding: cellPad, color: "var(--text-mid)", textAlign: "right" }}>{h.price != null ? `${h.price.toLocaleString("en-GB", { maximumFractionDigits: 2 })} ${h.currency}` : "—"}</td>}
                      <td style={{ padding: cellPad, textAlign: "right", color: hasReturns ? (r!.annualisedReturn >= 0 ? "var(--green)" : "var(--red)") : "var(--text-dim)", fontWeight: hasReturns ? 700 : 400, fontSize: hasReturns ? 12 : 11 }}>{hasReturns ? `${r!.annualisedReturn >= 0 ? "+" : ""}${r!.annualisedReturn.toFixed(1)}%` : "—"}</td>
                      {!isMobile && <td style={{ padding: cellPad, color: "var(--text-dim)", fontSize: 10, maxWidth: 260, overflow: "hidden", textOverflow: isOpen ? "unset" : "ellipsis", whiteSpace: isOpen ? "normal" : "nowrap", lineHeight: 1.5 }}>{h.notes}</td>}
                      <td style={{ padding: cellPad }}>
                        <span style={{ ...(ACTION_STYLE[h.action] ?? ACTION_STYLE.MONITOR), fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", padding: "2px 8px", borderRadius: 2, whiteSpace: "nowrap" }}>{h.action}</span>
                      </td>
                      <td style={{ padding: "10px 6px", color: "var(--text-dim)" }}>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                    </tr>
                    {isOpen && <TriggerRows h={h} colSpan={totalCols} returns={r} />}
                  </>
                );
              })}
            </>
          )})}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={isMobile ? 2 : 2} style={{ padding: "12px", color: "var(--text-mid)", fontWeight: 700, borderTop: "1px solid var(--rim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>TOTAL</td>
            <td style={{ padding: "12px", color: "var(--gold)", fontWeight: 700, textAlign: "right", borderTop: "1px solid var(--rim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>£{totalAum.toLocaleString("en-GB", { maximumFractionDigits: 0 })}</td>
            <td colSpan={totalCols - 3} style={{ borderTop: "1px solid var(--rim)" }} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

type PriceMapSort = "ma_dist" | "pct_above_low" | "pct_below_high";

function getPriceMapSortValue(h: LiveHolding, sort: PriceMapSort): number {
  const price = h.price!;
  const low = h.low_52w!;
  const high = h.high_52w!;
  const ma60 = h.ma60!;
  switch (sort) {
    case "pct_above_low":
      return ((price - low) / low) * 100;
    case "pct_below_high":
      return ((high - price) / high) * 100;
    case "ma_dist":
      return Math.abs(((price - ma60) / ma60) * 100);
  }
}

function PriceMapView({ allHoldings }: { allHoldings: LiveHolding[] }) {
  const [sortMode, setSortMode] = useState<PriceMapSort>("ma_dist");
  const deduped = new Map<string, LiveHolding>();
  for (const h of allHoldings) {
    const key = h.ticker || h.name;
    if (!deduped.has(key) || (h.ma60 && !deduped.get(key)!.ma60)) deduped.set(key, h);
  }

  const valid = Array.from(deduped.values()).filter((h) => h.ma60 && h.high_52w && h.low_52w && h.price != null);
  const grouped = new Map<string, LiveHolding[]>();
  for (const h of valid) {
    const key = h.layer || "Uncategorised";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(h);
  }
  const layers = Array.from(grouped.entries()).sort((a, b) => {
    const mvA = a[1].reduce((sum, holding) => sum + (holding.mv || 0), 0);
    const mvB = b[1].reduce((sum, holding) => sum + (holding.mv || 0), 0);
    return mvB - mvA;
  });

  if (valid.length === 0) {
    return <div style={{ padding: 40, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>No price map data — populate MA60, HIGH_52w, LOW_52w columns in holdings sheets.</div>;
  }

  const SORT_OPTIONS: { key: PriceMapSort; label: string }[] = [
    { key: "ma_dist", label: "60d MA Dist" },
    { key: "pct_above_low", label: "% Above 52W Low" },
    { key: "pct_below_high", label: "% Below 52W High" },
  ];

  return (
    <div style={{ padding: "12px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-dim)", marginRight: 4 }}>Sort</span>
        {SORT_OPTIONS.map((opt) => <ToggleButton key={opt.key} active={sortMode === opt.key} label={opt.label} onClick={() => setSortMode(opt.key)} />)}
      </div>
      {layers.map(([layer, holdings]) => {
        const sorted = [...holdings].sort((a, b) => getPriceMapSortValue(a, sortMode) - getPriceMapSortValue(b, sortMode));
        return (
          <div key={layer} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--gold)", padding: "8px 0", borderBottom: "1px solid var(--rim)", marginBottom: 8 }}>{layer}</div>
            {sorted.map((h) => {
              const low = h.low_52w!;
              const high = h.high_52w!;
              const price = h.price!;
              const ma60 = h.ma60!;
              const range = high - low;
              if (range <= 0) return null;

              const pricePct = Math.max(0, Math.min(100, ((price - low) / range) * 100));
              const ma60Pct = Math.max(0, Math.min(100, ((ma60 - low) / range) * 100));
              const distFromMa = ((price - ma60) / ma60) * 100;
              const sortVal = getPriceMapSortValue(h, sortMode);

              let statusColor: string;
              let statusLabel: string;
              if (price < ma60) {
                statusColor = "var(--red)";
                statusLabel = "Dislocation";
              } else if (pricePct >= 80) {
                statusColor = "var(--amber)";
                statusLabel = "Extended";
              } else {
                statusColor = "var(--green)";
                statusLabel = "Healthy";
              }

              return (
                <div key={h.ticker || h.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid rgba(28,28,48,0.25)" }}>
                  <div style={{ width: 140, flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--gold)" }}>{h.ticker}</span>
                      <AlertBadge status={h.alert_status} />
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</div>
                  </div>
                  <div style={{ flex: 1, position: "relative", height: 28, display: "flex", alignItems: "center" }}>
                    <div style={{ position: "absolute", left: 0, right: 0, height: 6, background: "rgba(110,142,200,0.25)", borderRadius: 3 }} />
                    <div style={{ position: "absolute", left: `${ma60Pct}%`, top: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span style={{ fontFamily: "'DM Mono', var(--font-mono)", fontSize: 7, color: "var(--gold)", whiteSpace: "nowrap", marginBottom: 1 }}>MA60</span>
                      <div style={{ width: 0, flex: 1, borderLeft: "1px dashed var(--gold)" }} />
                    </div>
                    <div style={{ position: "absolute", left: `${pricePct}%`, top: 2, bottom: 2, width: 3, background: statusColor, borderRadius: 1 }} />
                    <span style={{ position: "absolute", left: 0, bottom: -2, fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-dim)" }}>{low.toFixed(0)}</span>
                    <span style={{ position: "absolute", right: 0, bottom: -2, fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-dim)" }}>{high.toFixed(0)}</span>
                  </div>
                  <div style={{ width: 80, flexShrink: 0, textAlign: "right" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)" }}>{price.toFixed(2)}</span>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)" }}>{h.currency}</div>
                  </div>
                  <div style={{ width: 140, flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ background: statusColor === "var(--green)" ? "var(--green-dim)" : statusColor === "var(--amber)" ? "var(--amber-dim)" : "var(--red-dim)", color: statusColor, border: `1px solid ${statusColor === "var(--green)" ? "rgba(90,191,160,0.2)" : statusColor === "var(--amber)" ? "rgba(200,146,90,0.2)" : "rgba(200,90,90,0.2)"}`, padding: "1px 6px", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{statusLabel}</span>
                    <span style={{ fontFamily: "'DM Mono', var(--font-mono)", fontSize: 10, color: statusColor, whiteSpace: "nowrap" }}>{distFromMa >= 0 ? "+" : ""}{distFromMa.toFixed(1)}%</span>
                    <span style={{ fontFamily: "'DM Mono', var(--font-mono)", fontSize: 8, color: "var(--text-dim)", whiteSpace: "nowrap" }}>({sortVal.toFixed(1)}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function withFallbackHolding(h: (typeof SIPP_HOLDINGS)[number], account: "SIPP" | "ISA"): LiveHolding {
  return {
    ...h,
    account,
    day: 0,
    price: 0,
    prevClose: 0,
    currency: "USD",
    costGbp: 0,
    shares: 0,
    add_trigger: "",
    exit_trigger: "",
    trigger_type: "",
    trigger_price_add: "",
    trigger_price_exit: "",
    alert_status: "CLEAR",
    alert_fired_date: "",
    ma60: null,
    high_52w: null,
    low_52w: null,
    deploy_target_gbp: 0,
    deploy_note: "",
    trigger_review_date: "",
    trigger_review_note: "",
  };
}

export default function HoldingsTab({ sipp, isa, disruption = [], transactions = [], scores = [] }: Props) {
  const [view, setView] = useState<ViewMode>("layer");
  const [reviewExpanded, setReviewExpanded] = useState(false);
  const reviewBannerRef = useRef<HTMLDivElement>(null);

  const disruptionMap = new Map<string, LiveDisruption>();
  for (const d of disruption) {
    if (d.ticker) disruptionMap.set(d.ticker, d);
  }

  const sippData: LiveHolding[] = sipp.length > 0 ? sipp : SIPP_HOLDINGS.map((h) => withFallbackHolding(h, "SIPP"));
  const isaData: LiveHolding[] = isa.length > 0 ? isa : ISA_HOLDINGS.map((h) => withFallbackHolding(h, "ISA"));

  const allHoldings = [...sippData, ...isaData];
  const totalAum = allHoldings.reduce((sum, holding) => sum + (holding.mv || 0), 0);
  const sippTotal = sippData.reduce((sum, holding) => sum + (holding.mv || 0), 0);
  const isaTotal = isaData.reduce((sum, holding) => sum + (holding.mv || 0), 0);

  // Build scores map for cross-referencing
  const scoresMap = new Map(scores.map(s => [s.ticker, s]));

  // Parse review flags
  const parseReviewFlag = (note: string) => {
    if (!note || !note.startsWith('Q_REVIEW')) return null;
    const match = note.match(/^Q_REVIEW\s+(\S+)\s+(HIGH|MEDIUM|LOW)\s+\[(\w+)\]\s+(.+)$/);
    if (!match) return null;
    return { quarter: match[1], priority: match[2] as 'HIGH' | 'MEDIUM' | 'LOW', flagType: match[3], reason: match[4] };
  };

  type ReviewFlag = NonNullable<ReturnType<typeof parseReviewFlag>>;

  const flaggedHoldings = allHoldings
    .map(h => {
      const flag = parseReviewFlag(h.trigger_review_note);
      if (!flag) return null;
      const scoreData = scoresMap.get(h.ticker);
      return { holding: h, flag, score: scoreData?.score ?? null, scoreDate: scoreData?.scoreDate ?? null };
    })
    .filter(Boolean) as { holding: LiveHolding; flag: ReviewFlag; score: number | null; scoreDate: string | null }[];

  // Deduplicate by ticker (SIPP+ISA may have same ticker)
  const uniqueFlagged = Array.from(new Map(flaggedHoldings.map(f => [f.holding.ticker, f])).values());

  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  uniqueFlagged.sort((a, b) => priorityOrder[a.flag.priority] - priorityOrder[b.flag.priority]);

  const highCount = uniqueFlagged.filter(f => f.flag.priority === 'HIGH').length;
  const medCount = uniqueFlagged.filter(f => f.flag.priority === 'MEDIUM').length;
  const lowCount = uniqueFlagged.filter(f => f.flag.priority === 'LOW').length;

  const priorityDotColor = (p: string) => p === 'HIGH' ? 'var(--red)' : p === 'MEDIUM' ? 'var(--amber)' : 'var(--green)';
  const priorityEmoji = (p: string) => p === 'HIGH' ? '🔴' : p === 'MEDIUM' ? '🟡' : '🟢';

  const daysSince = (dateStr: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  };

  // Build review flag map for dot badges
  const reviewFlagMap = new Map(uniqueFlagged.map(f => [f.holding.ticker, f.flag]));

  const scrollToReviewBanner = () => {
    setReviewExpanded(true);
    reviewBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div>
      {/* Review Queue Banner */}
      {uniqueFlagged.length > 0 && (
        <div ref={reviewBannerRef} style={{ ...card, marginBottom: 20, borderLeft: "3px solid var(--gold)" }}>
          <div
            onClick={() => setReviewExpanded(!reviewExpanded)}
            style={{ ...cardHeader, cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={14} style={{ color: "var(--gold)" }} />
              <span style={{ ...cardTitle, color: "var(--gold)" }}>
                ⚠️ {uniqueFlagged.length} position{uniqueFlagged.length !== 1 ? "s" : ""} flagged for review
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
                ({[highCount > 0 && `${highCount} HIGH`, medCount > 0 && `${medCount} MEDIUM`, lowCount > 0 && `${lowCount} LOW`].filter(Boolean).join(", ")})
              </span>
            </div>
            <div style={{ color: "var(--text-dim)" }}>{reviewExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</div>
          </div>
          {reviewExpanded && (
            <div style={{ padding: "0 20px 16px" }}>
              {(['HIGH', 'MEDIUM', 'LOW'] as const).map(priority => {
                const items = uniqueFlagged.filter(f => f.flag.priority === priority);
                if (items.length === 0) return null;
                return (
                  <div key={priority} style={{ marginTop: 12 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: priorityDotColor(priority), marginBottom: 6 }}>
                      {priorityEmoji(priority)} {priority}
                    </div>
                    {items.map(({ holding, flag, score, scoreDate }) => {
                      const days = daysSince(scoreDate as string);
                      return (
                        <div key={holding.ticker} style={{ background: "rgba(20,20,40,0.4)", border: "1px solid var(--rim)", borderLeft: `3px solid ${priorityDotColor(flag.priority)}`, padding: "10px 14px", marginBottom: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                            <div>
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--gold)" }}>{holding.ticker}</span>
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent)", marginLeft: 8, padding: "1px 6px", background: "var(--accent-dim)", border: "1px solid rgba(110,142,200,0.2)", borderRadius: 2, letterSpacing: "0.08em" }}>[{flag.flagType}]</span>
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", marginLeft: 8 }}>{flag.reason}</span>
                            </div>
                            <button
                              onClick={() => {
                                const prompt = `Deep dive rescore on ${holding.ticker}. Quarterly flagged ${flag.flagType}: ${flag.reason}. Current score ${score ?? "N/A"} scored ${scoreDate ?? "N/A"}. Run full 6D assessment and Research Commit when done.`;
                                const url = `${CLAUDE_PROJECT_URL}?prompt=${encodeURIComponent(prompt)}`;
                                (window.top || window).open(url, '_blank');
                              }}
                              style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", background: "none", border: "1px solid var(--accent)", color: "var(--accent)", cursor: "pointer", padding: "3px 10px", borderRadius: 2, whiteSpace: "nowrap", transition: "all 0.15s" }}
                            >
                              Review ➜
                            </button>
                          </div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginTop: 4 }}>
                            Score: {score ?? "—"} · Scored: {scoreDate ?? "—"}{days != null ? ` (${days} days ago)` : ""}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div style={{ ...card, marginBottom: 20 }}>
        <div style={cardHeader}>
          <span style={cardTitle}>Holdings</span>
          <div style={{ display: "flex", gap: 0 }}>
            <ToggleButton active={view === "layer"} label="By Layer" onClick={() => setView("layer")} />
            <ToggleButton active={view === "account"} label="By Account" onClick={() => setView("account")} />
            <ToggleButton active={view === "pricemap"} label="Price Map" onClick={() => setView("pricemap")} />
          </div>
        </div>

        {view === "layer" && <LayerView allHoldings={allHoldings} totalAum={totalAum} transactions={transactions} />}
        {view === "pricemap" && <PriceMapView allHoldings={allHoldings} />}
      </div>

      {view === "account" && (
        <>
          <div style={card}>
            <div style={cardHeader}>
              <span style={cardTitle}>SIPP Holdings</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)" }}>£{sippTotal.toLocaleString("en-GB", { maximumFractionDigits: 0 })}<span style={{ color: "var(--text-dim)", fontSize: 10 }}> · long horizon</span></span>
            </div>
            <HoldingsTable holdings={sippData} disruptionMap={disruptionMap} transactions={transactions} />
          </div>
          <div style={card}>
            <div style={cardHeader}>
              <span style={cardTitle}>ISA Holdings</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)" }}>£{isaTotal.toLocaleString("en-GB", { maximumFractionDigits: 0 })}<span style={{ color: "var(--text-dim)", fontSize: 10 }}> · flexible wrapper</span></span>
            </div>
            <HoldingsTable holdings={isaData} disruptionMap={disruptionMap} transactions={transactions} />
          </div>
        </>
      )}
    </div>
  );
}
