import type { SourceMap } from "@/hooks/usePortfolioData";

const LABELS: Record<string, string> = {
  holdings: "HOLDINGS", holdingsCash: "HOLDINGS cash block", watchlist: "WATCHLIST", layers: "LAYERS",
  scores: "SCORES", scoreLog: "SCORE_LOG", monitor: "MONITOR", disruption: "DISRUPTION",
  performance: "PERFORMANCE", narrative: "NARRATIVE", macroState: "MACRO_STATE",
  earningsCalendar: "EARNINGS", cash: "CASH", transactions: "TRANSACTIONS", jisaHoldings: "JISA_HOLDINGS",
};

/** Header strip listing every sheet source that is not ok. Renders nothing when all are ok. */
export default function SourceStatus({ sources, loading }: { sources: SourceMap; loading: boolean }) {
  const bad = Object.entries(sources).filter(([, s]) => s.status !== "ok");
  if (loading && bad.every(([, s]) => s.status === "empty" && s.rows === 0 && !s.dataDate)) return null;
  if (bad.length === 0) return null;
  return (
    <div role="status" style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "6px var(--app-px, 40px)", background: "var(--red-dim)", borderBottom: "1px solid var(--rim)", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" }}>
      <span style={{ color: "var(--text-dim)" }}>Sources not ok:</span>
      {bad.map(([k, s]) => (
        <span key={k} title={s.error ?? ""} style={{ color: s.status === "error" ? "var(--red)" : "var(--amber)", border: "1px solid var(--rim)", padding: "1px 6px", borderRadius: 2 }}>
          {LABELS[k] ?? k} · {s.status}
        </span>
      ))}
    </div>
  );
}

export function NoData({ label }: { label?: string }) {
  return (
    <div style={{ padding: "40px 0", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em", color: "var(--red)", textTransform: "uppercase" }}>
      NO DATA{label ? ` · ${label} unavailable` : ""}
    </div>
  );
}
