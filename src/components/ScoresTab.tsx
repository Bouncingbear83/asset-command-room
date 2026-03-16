import { useState } from "react";
import { LiveScore, LiveScoreLog, LiveDisruption } from "@/hooks/usePortfolioData";

interface Props {
  scores: LiveScore[];
  scoreLog: LiveScoreLog[];
  disruptionData?: LiveDisruption[];
}

function ScoreBar({ value, max, color }: { value: number | null; max: number; color: string }) {
  if (value == null)
    return <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>—</span>;
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
  if (score >= 40) return "SPEC";
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
  // Check exact match first, then partial
  if (ACTION_STYLE[upper]) return ACTION_STYLE[upper];
  for (const key of Object.keys(ACTION_STYLE)) {
    if (upper.includes(key)) return ACTION_STYLE[key];
  }
  return ACTION_STYLE["HOLD"];
}

const STATIC: LiveScore[] = [
  { ticker: "ASML", name: "ASML Holding", layer: "Compute", tier: "Core", action: "HOLD", score: 91, scoreDate: "2026-03-04", substrate: 95, demand: 90, moat: 95, valuation: 75, mgmt: 90, disruption: 13, buyLow: 550, buyHigh: 680, fullThesis: "Only EUV lithography vendor. Irreplaceable compute substrate.", currency: "EUR", changeNote: "" },
  { ticker: "NVDA", name: "NVIDIA", layer: "Compute", tier: "Core", action: "SIZE UP", score: 88, scoreDate: "2026-03-04", substrate: 90, demand: 90, moat: 85, valuation: 70, mgmt: 85, disruption: 11, buyLow: 115, buyHigh: 220, fullThesis: "GPU compute substrate. Target 6% AUM. Was criminally undersized.", currency: "USD", changeNote: "" },
  { ticker: "CCJ", name: "Cameco", layer: "Energy", tier: "Core", action: "TRIMMED", score: 82, scoreDate: "2026-03-04", substrate: 85, demand: 80, moat: 75, valuation: 70, mgmt: 80, disruption: 14, buyLow: 38, buyHigh: 52, fullThesis: "Installed-base fuel monopoly. 440 reactors, 20-40yr remaining life.", currency: "USD", changeNote: "" },
];

type ScoreSortKey = "ticker" | "score" | "substrate" | "demand" | "moat" | "valuation" | "mgmt" | "disruption" | "buyLow" | "scoreDate" | "layer" | "tier" | "action";
type SortDir = "asc" | "desc";

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

function sortScores(data: LiveScore[], key: ScoreSortKey, dir: SortDir): LiveScore[] {
  return [...data].sort((a, b) => {
    const av = (a as any)[key] ?? "";
    const bv = (b as any)[key] ?? "";
    if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
    return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });
}

function ScoreTrend({ ticker, scoreLog }: { ticker: string; scoreLog: LiveScoreLog[] }) {
  const entries = scoreLog
    .filter((e) => e.ticker === ticker && e.score != null)
    .sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));

  if (entries.length === 0) return null;

  if (entries.length === 1) {
    return (
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)", marginLeft: 6 }}>→</span>
    );
  }

  const prev = entries[entries.length - 2].score!;
  const latest = entries[entries.length - 1].score!;
  const delta = latest - prev;

  if (delta === 0) {
    return (
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)", marginLeft: 6 }}>→</span>
    );
  }

  const isUp = delta > 0;
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: isUp ? "var(--green)" : "var(--red)", marginLeft: 6 }}>
      {isUp ? "↑" : "↓"}
      <span style={{ fontSize: 9, marginLeft: 2 }}>{isUp ? `+${delta}` : delta}</span>
    </span>
  );
}

const DISRUPTION_STATUS_STYLE: Record<string, React.CSSProperties> = {
  GREEN: { background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(90,191,160,0.2)" },
  MONITOR: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  RED: { background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(200,90,90,0.2)" },
};

export default function ScoresTab({ scores, scoreLog, disruptionData = [] }: Props) {
  const [sortKey, setSortKey] = useState<ScoreSortKey>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const data = scores.length > 0 ? scores : STATIC;
  const disruptionMap = new Map(disruptionData.map((d) => [d.ticker, d]));
  const sorted = sortScores(data, sortKey, sortDir);
  const isLive = scores.length > 0;

  const handleSort = (key: ScoreSortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const arrow = (key: ScoreSortKey) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  // Use explicit tier from sheet when available, fall back to derived
  const getEffectiveTier = (s: LiveScore) => {
    if (s.tier && s.tier.trim()) return s.tier.toUpperCase();
    return getTier(s.score);
  };

  const core = sorted.filter((s) => getEffectiveTier(s) === "CORE").length;
  const anchor = sorted.filter((s) => getEffectiveTier(s) === "ANCHOR").length;
  const satellite = sorted.filter((s) => getEffectiveTier(s) === "SATELLITE").length;
  const spec = sorted.filter((s) => getEffectiveTier(s) === "SPEC" || getEffectiveTier(s) === "RESIDUAL").length;

  const cardS: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 };
  const cardHeaderS: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--rim)" };
  const cardTitleS: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "var(--text-mid)" };
  const thBase: React.CSSProperties = { fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" as const, padding: "8px 12px", borderBottom: "1px solid var(--rim)", textAlign: "left" as const, fontWeight: 400, whiteSpace: "nowrap" as const, cursor: "pointer", userSelect: "none" as const };
  const badgeBase: React.CSSProperties = { padding: "2px 8px", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", whiteSpace: "nowrap" as const };

  return (
    <div>
      {/* Summary row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Total scored", value: String(sorted.length), color: "var(--text)" },
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

      {/* Main table */}
      <div style={cardS}>
        <div style={cardHeaderS}>
          <span style={cardTitleS}>Stellar Alignment Scores</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: isLive ? "var(--green)" : "var(--text-dim)", letterSpacing: "0.12em" }}>
            {isLive ? "● LIVE FROM SCORES SHEET" : "● STATIC SNAPSHOT — populate SCORES sheet to go live"}
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key} onClick={() => handleSort(col.key)} style={{ ...thBase, color: sortKey === col.key ? "var(--gold)" : "var(--text-dim)" }}>
                    {col.label}{arrow(col.key)}
                  </th>
                ))}
                <th style={{ ...thBase, cursor: "default", color: "var(--text-dim)" }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => {
                const tier = getEffectiveTier(s);
                const buyRange = s.buyLow && s.buyHigh ? `${s.currency} ${s.buyLow}–${s.buyHigh}` : s.buyLow ? `${s.currency} >${s.buyLow}` : "—";
                const tierStyle = TIER_STYLE[tier] ?? TIER_STYLE.UNSCORED;
                const actionStyle = getActionStyle(s.action);
                return (
                  <tr key={s.ticker} style={{ borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                    {/* Ticker + Name */}
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ color: "var(--gold)", fontWeight: 700, fontFamily: "var(--font-mono)", fontSize: 12 }}>
                          {s.ticker}
                          {s.disruption != null && s.disruption < 8 && (
                            <span title="Disruption risk — review thesis" style={{ color: "var(--red)", marginLeft: 4, fontSize: 12, cursor: "help" }}>⚠</span>
                          )}
                        </span>
                        {s.name && (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", lineHeight: 1 }}>{s.name}</span>
                        )}
                      </div>
                    </td>
                    {/* Layer */}
                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-mid)", letterSpacing: "0.08em" }}>
                      {s.layer || "—"}
                    </td>
                    {/* Score */}
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: (s.score ?? 0) >= 80 ? "var(--green)" : (s.score ?? 0) >= 60 ? "var(--accent)" : (s.score ?? 0) >= 40 ? "var(--amber)" : "var(--red)", display: "inline-flex", alignItems: "center" }}>
                        {s.score ?? "—"}
                        <ScoreTrend ticker={s.ticker} scoreLog={scoreLog} />
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}><ScoreBar value={s.substrate} max={25} color="var(--gold)" /></td>
                    <td style={{ padding: "10px 12px" }}><ScoreBar value={s.demand} max={22} color="var(--accent)" /></td>
                    <td style={{ padding: "10px 12px" }}><ScoreBar value={s.moat} max={18} color="var(--green)" /></td>
                    <td style={{ padding: "10px 12px" }}><ScoreBar value={s.valuation} max={13} color="var(--amber)" /></td>
                    <td style={{ padding: "10px 12px" }}><ScoreBar value={s.mgmt} max={7} color="var(--text-mid)" /></td>
                    {/* Disruption */}
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <ScoreBar value={s.disruption} max={15} color={s.disruption != null ? (s.disruption >= 11 ? "var(--green)" : s.disruption >= 8 ? "var(--amber)" : "var(--red)") : "var(--text-dim)"} />
                        {(() => {
                          const dd = disruptionMap.get(s.ticker);
                          if (!dd || !dd.status) return null;
                          const st = dd.status.toUpperCase();
                          const style = DISRUPTION_STATUS_STYLE[st] ?? DISRUPTION_STATUS_STYLE.MONITOR;
                          return (
                            <span title={dd.evidence || undefined} style={{ ...style, ...badgeBase, padding: "1px 6px", fontSize: 8, cursor: dd.evidence ? "help" : "default" }}>
                              {st}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    {/* Buy Range */}
                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", whiteSpace: "nowrap" }}>{buyRange}</td>
                    {/* Tier */}
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ ...tierStyle, ...badgeBase }}>{tier}</span>
                    </td>
                    {/* Action */}
                    <td style={{ padding: "10px 12px" }}>
                      {s.action && s.action.trim() ? (
                        <span style={{ ...actionStyle, ...badgeBase }}>{s.action.toUpperCase()}</span>
                      ) : (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>—</span>
                      )}
                    </td>
                    {/* Notes */}
                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.changeNote || s.fullThesis}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Framework reminder */}
      <div style={{ ...cardS, padding: "12px 20px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", color: "var(--text-dim)", lineHeight: 2 }}>
          DIMENSION WEIGHTS · Substrate /25 · Demand /22 · Moat /18 · Valuation /13 · Mgmt /7 · Disruption /15 · Total /100 &nbsp;·&nbsp; TIERS · Core (4–7% AUM) · Anchor · Satellite (1–3%) · Spec (≤1%) · Residual
        </div>
      </div>
    </div>
  );
}
