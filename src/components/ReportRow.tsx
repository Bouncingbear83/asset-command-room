import type { ReportMeta } from "./ResearchTab";
import { parseConclusion, conclusionColor, type Conclusion } from "@/lib/parseConclusion";

interface Props {
  report: ReportMeta;
  livePrice: number | null;
  onClick: () => void;
}

export default function ReportRow({ report, livePrice, onClick }: Props) {
  const { ticker, name, layer, score, tier, reclass_status, report_date, summary, spot_at_report, version } = report;

  const conclusion: Conclusion | null = parseConclusion(summary, null);

  const deltaPct =
    livePrice != null && spot_at_report != null && spot_at_report !== 0
      ? (livePrice - Number(spot_at_report)) / Number(spot_at_report)
      : null;
  const deltaColor =
    deltaPct == null ? "var(--text-dim)" : deltaPct > 0 ? "var(--green)" : deltaPct < 0 ? "var(--red)" : "var(--text-dim)";
  const deltaText =
    deltaPct == null
      ? "—"
      : `${deltaPct > 0 ? "+" : deltaPct < 0 ? "−" : ""}${Math.abs(deltaPct * 100).toFixed(1)}%`;

  const dateText = (() => {
    try {
      return new Date(report_date)
        .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
        .toUpperCase();
    } catch {
      return report_date;
    }
  })();

  return (
    <button onClick={onClick} className="report-row">
      <div className="report-row-id">
        <div className="report-row-ticker">{ticker}</div>
        {name && <div className="report-row-name">{name}</div>}
        <div className="report-row-chips">
          {version != null && <span className="report-chip">v{version}</span>}
          {layer && <span className="report-chip">{layer.toUpperCase()}</span>}
          {tier && <span className="report-chip">{tier.toUpperCase()}</span>}
          {reclass_status && (
            <span className="report-chip" style={{ color: "var(--accent)", borderColor: "var(--accent)" }}>
              {reclass_status}
            </span>
          )}
        </div>
      </div>

      <div className="report-row-cell report-row-conclusion">
        {conclusion ? (
          <span className="report-chip" style={{ color: conclusionColor(conclusion), borderColor: conclusionColor(conclusion), fontSize: 11 }}>
            {conclusion}
          </span>
        ) : (
          <span style={{ color: "var(--text-dim)" }}>—</span>
        )}
      </div>

      <div className="report-row-cell report-row-score">
        {score !== null ? (
          <span style={{ color: "var(--gold)" }}>{score}</span>
        ) : (
          <span style={{ color: "var(--text-dim)" }}>—</span>
        )}
      </div>

      <div className="report-row-cell report-row-date">{dateText}</div>

      <div className="report-row-cell report-row-delta" style={{ color: deltaColor }}>
        {deltaText}
        {spot_at_report != null && (
          <span className="report-row-spot">spot {spot_at_report}</span>
        )}
      </div>

      <div className="report-row-body">
        {summary && <div className="report-row-summary">{summary.length > 220 ? `${summary.slice(0, 220)}…` : summary}</div>}
      </div>

      <span className="report-row-arrow">→</span>

      <style>{`
        .report-row {
          display: grid;
          grid-template-columns: 180px 90px 60px 88px 110px 1fr 24px;
          gap: 16px;
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
        .report-row-chips {
          display: flex; gap: 4px; flex-wrap: wrap;
          margin-top: 6px;
        }
        .report-chip {
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: .12em;
          color: var(--text-dim);
          border: 1px solid var(--rim);
          padding: 2px 6px;
        }
        .report-row-cell {
          font-family: var(--font-mono);
          font-size: 12px;
        }
        .report-row-conclusion { text-align: left; }
        .report-row-score { text-align: right; font-size: 14px; }
        .report-row-date { color: var(--text-mid); font-size: 11px; letter-spacing: .1em; }
        .report-row-delta {
          display: flex; flex-direction: column; align-items: flex-end;
          font-size: 13px;
        }
        .report-row-spot {
          font-size: 9px;
          color: var(--text-dim);
          margin-top: 2px;
        }
        .report-row-body { min-width: 0; }
        .report-row-summary {
          font-size: 12px;
          color: var(--text-mid);
          line-height: 1.45;
        }
        .report-row-arrow {
          color: var(--text-dim);
          font-family: var(--font-mono);
          font-size: 16px;
          transition: color .15s, transform .15s;
          text-align: right;
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
          .report-row-id { grid-column: 1 / -1; }
          .report-row-conclusion, .report-row-score, .report-row-date, .report-row-delta {
            grid-column: auto;
            text-align: left;
            align-items: flex-start;
          }
          .report-row-body { grid-column: 1 / -1; }
          .report-row-arrow { display: none; }
          .report-row-summary { font-size: 11px; }
        }
      `}</style>
    </button>
  );
}
