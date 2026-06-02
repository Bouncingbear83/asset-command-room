import type { ReportMeta } from "./ResearchTab";

export default function ReportCard({ report, onClick }: { report: ReportMeta; onClick: () => void }) {
  const { ticker, name, layer, score, tier, reclass_status, report_date, summary, prob_weighted_ev, spot_at_report } = report;
  const evMultiple = prob_weighted_ev && spot_at_report ? (prob_weighted_ev / spot_at_report) : null;

  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        background: "var(--panel)",
        border: "1px solid var(--rim)",
        padding: 16,
        cursor: "pointer",
        color: "var(--text)",
        fontFamily: "var(--font-ui)",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--gold)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--rim)")}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--gold)", letterSpacing: "0.05em" }}>{ticker}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>{report_date}</span>
      </div>
      {name && <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 8 }}>{name}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em" }}>
        {layer && <span style={chip}>{layer.toUpperCase()}</span>}
        {tier && <span style={chip}>{tier.toUpperCase()}</span>}
        {reclass_status && <span style={{ ...chip, color: "var(--accent)" }}>{reclass_status}</span>}
        {score !== null && <span style={{ ...chip, color: "var(--gold)" }}>{score}</span>}
      </div>
      {summary && (
        <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5, marginBottom: 10 }}>
          {summary.length > 140 ? `${summary.slice(0, 140)}…` : summary}
        </div>
      )}
      {evMultiple !== null && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
          EV <span style={{ color: "var(--gold)" }}>{evMultiple.toFixed(2)}x</span>
          {spot_at_report !== null && <> · spot {spot_at_report}</>}
        </div>
      )}
    </button>
  );
}

const chip: React.CSSProperties = {
  padding: "2px 6px",
  border: "1px solid var(--rim)",
  color: "var(--text-dim)",
};
