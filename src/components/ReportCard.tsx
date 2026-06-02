import type { ReportMeta } from "./ResearchTab";

export default function ReportCard({ report, onClick }: { report: ReportMeta; onClick: () => void }) {
  const {
    ticker, name, layer, score, tier, reclass_status,
    report_date, summary, prob_weighted_ev, spot_at_report, version,
  } = report;

  const evMultiple = prob_weighted_ev && spot_at_report ? prob_weighted_ev / spot_at_report : null;
  const evColor = evMultiple == null
    ? "var(--text-dim)"
    : evMultiple >= 2 ? "var(--green)" : evMultiple >= 1 ? "var(--gold)" : "var(--red)";

  const date = (() => {
    try {
      return new Date(report_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).toUpperCase();
    } catch { return report_date; }
  })();

  return (
    <button onClick={onClick} className="report-row">
      {/* Left: ticker + name */}
      <div className="report-row-id">
        <div className="report-row-ticker">{ticker}</div>
        {name && <div className="report-row-name">{name}</div>}
      </div>

      {/* Middle: chips + summary */}
      <div className="report-row-body">
        <div className="report-row-chips">
          {version != null && (
            <span className="report-chip" style={{ color: "var(--text)", borderColor: "var(--gold-dim)" }}>
              v{version}
            </span>
          )}
          {layer && <span className="report-chip">{layer.toUpperCase()}</span>}
          {tier && <span className="report-chip">{tier.toUpperCase()}</span>}
          {reclass_status && (
            <span className="report-chip" style={{ color: "var(--accent)", borderColor: "var(--accent)" }}>
              {reclass_status}
            </span>
          )}
          {score !== null && (
            <span className="report-chip" style={{ color: "var(--gold)", borderColor: "var(--gold-dim)" }}>
              SCORE {score}
            </span>
          )}
        </div>
        {summary && (
          <div className="report-row-summary">
            {summary.length > 180 ? `${summary.slice(0, 180)}…` : summary}
          </div>
        )}
      </div>

      {/* Right: metrics + date */}
      <div className="report-row-meta">
        {evMultiple !== null ? (
          <div className="report-row-ev">
            <span style={{ color: evColor, fontSize: 15 }}>{evMultiple.toFixed(2)}x</span>
            <span className="report-row-ev-label">EV / SPOT</span>
          </div>
        ) : <div />}
        {spot_at_report !== null && (
          <div className="report-row-spot">spot {spot_at_report}</div>
        )}
        <div className="report-row-date">{date}</div>
      </div>

      <span className="report-row-arrow">→</span>

      <style>{`
        .report-row {
          display: grid;
          grid-template-columns: 140px 1fr auto 24px;
          gap: 20px;
          align-items: center;
          width: 100%;
          text-align: left;
          background: var(--panel);
          border: 1px solid var(--rim);
          border-left: 2px solid var(--gold-dim);
          padding: 14px 16px;
          color: var(--text);
          font-family: var(--font-ui);
          cursor: pointer;
          transition: border-color .15s, background .15s;
        }
        .report-row:hover {
          border-color: var(--gold);
          border-left-color: var(--gold);
          background: var(--surface);
        }
        .report-row-id { min-width: 0; }
        .report-row-ticker {
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--gold);
          letter-spacing: .08em;
        }
        .report-row-name {
          font-size: 11px;
          color: var(--text-dim);
          margin-top: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .report-row-body { min-width: 0; }
        .report-row-chips {
          display: flex; gap: 6px; flex-wrap: wrap;
          margin-bottom: 6px;
        }
        .report-chip {
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: .12em;
          color: var(--text-dim);
          border: 1px solid var(--rim);
          padding: 2px 6px;
        }
        .report-row-summary {
          font-size: 12px;
          color: var(--text-mid);
          line-height: 1.45;
        }
        .report-row-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          font-family: var(--font-mono);
          min-width: 90px;
        }
        .report-row-ev {
          display: flex; flex-direction: column; align-items: flex-end;
        }
        .report-row-ev-label {
          font-size: 8px;
          letter-spacing: .15em;
          color: var(--text-dim);
        }
        .report-row-spot {
          font-size: 10px;
          color: var(--text-dim);
          margin-top: 4px;
        }
        .report-row-date {
          font-size: 9px;
          letter-spacing: .12em;
          color: var(--text-dim);
          margin-top: 6px;
        }
        .report-row-arrow {
          color: var(--text-dim);
          font-family: var(--font-mono);
          font-size: 16px;
          transition: color .15s, transform .15s;
        }
        .report-row:hover .report-row-arrow {
          color: var(--gold);
          transform: translateX(2px);
        }
        @media (max-width: 767px) {
          .report-row {
            grid-template-columns: 1fr auto;
            gap: 10px;
            padding: 12px;
          }
          .report-row-id { grid-column: 1; }
          .report-row-meta { grid-column: 2; grid-row: 1; min-width: 0; }
          .report-row-body { grid-column: 1 / -1; }
          .report-row-arrow { display: none; }
          .report-row-summary { font-size: 11px; }
        }
      `}</style>
    </button>
  );
}
