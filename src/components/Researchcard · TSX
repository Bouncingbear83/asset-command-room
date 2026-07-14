/**
 * ResearchCard — compact card for the Research index grid.
 * Shows ticker, name, score, classification badges, thesis snippet.
 * Clicking opens the FactSheet via context.
 */
import type { ResearchIndexEntry } from "@/hooks/useResearchIndex";

interface Props {
  entry: ResearchIndexEntry;
  onClick: () => void;
}

function scoreColor(score: number | null): string {
  if (score == null) return "var(--text-dim)";
  if (score >= 80) return "var(--green)";
  if (score >= 60) return "var(--accent)";
  if (score >= 40) return "var(--amber)";
  return "var(--red)";
}

function tierColor(tier: string | null): string {
  if (!tier) return "var(--text-dim)";
  if (/core/i.test(tier)) return "var(--gold)";
  return "var(--text-mid)";
}

function statusColor(status: string | null): string {
  if (!status) return "var(--text-dim)";
  if (status === "HELD") return "var(--green)";
  if (status === "EXITED" || status === "REJECTED" || status === "DORMANT") return "var(--text-dim)";
  return "var(--accent)";
}

function reclassColor(reclass: string | null): string {
  if (!reclass) return "var(--text-dim)";
  if (reclass === "PRE") return "var(--green)";
  if (reclass === "IN_PROGRESS") return "var(--accent)";
  if (reclass === "COMPLETE") return "var(--text-dim)";
  return "var(--text-mid)";
}

function fmtDate(d: string | null): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).toUpperCase();
  } catch {
    return d;
  }
}

export default function ResearchCard({ entry, onClick }: Props) {
  const {
    ticker, name, layer, score, tier, status, reclass_status,
    substrate_stage, factor_group, framework, last_scored,
    thesis_snippet, has_deep_dive,
  } = entry;

  const isExited = status === "EXITED" || status === "REJECTED" || status === "DORMANT";

  return (
    <button onClick={onClick} className="rcard">
      {/* Header row */}
      <div className="rcard-header">
        <div className="rcard-left">
          <span className="rcard-ticker">{ticker}</span>
          {score != null && (
            <span className="rcard-score" style={{ color: scoreColor(score) }}>
              {score}
            </span>
          )}
        </div>
        <div className="rcard-status" style={{ color: statusColor(status) }}>
          {status || ""}
        </div>
      </div>

      {/* Name */}
      {name && <div className="rcard-name">{name}</div>}

      {/* Classification chips */}
      <div className="rcard-chips">
        {layer && <span className="rcard-chip">{layer}</span>}
        {tier && <span className="rcard-chip" style={{ color: tierColor(tier), borderColor: tierColor(tier) }}>{tier}</span>}
        {reclass_status && (
          <span className="rcard-chip" style={{ color: reclassColor(reclass_status), borderColor: reclassColor(reclass_status) }}>
            {reclass_status}
          </span>
        )}
        {substrate_stage && substrate_stage !== "N/A" && (
          <span className="rcard-chip">{substrate_stage}</span>
        )}
        {framework && <span className="rcard-chip">FW:{framework}</span>}
        {factor_group && <span className="rcard-chip rcard-chip-fg">{factor_group.replace(/_/g, " ")}</span>}
      </div>

      {/* Thesis snippet */}
      {thesis_snippet && (
        <div className="rcard-thesis" style={{ opacity: isExited ? 0.5 : 1 }}>
          {thesis_snippet}
        </div>
      )}

      {/* Footer: date + deep dive badge */}
      <div className="rcard-footer">
        {last_scored && (
          <span className="rcard-date">Scored {fmtDate(last_scored)}</span>
        )}
        {has_deep_dive && (
          <span className="rcard-badge">DEEP DIVE</span>
        )}
      </div>

      <style>{`
        .rcard {
          display: flex;
          flex-direction: column;
          gap: 6px;
          text-align: left;
          background: var(--panel);
          border: 1px solid var(--rim);
          border-left: 2px solid var(--gold-dim);
          padding: 14px 16px;
          color: var(--text);
          cursor: pointer;
          transition: border-color .15s, background .15s;
          width: 100%;
        }
        .rcard:hover {
          border-color: var(--gold);
          border-left-color: var(--gold);
          background: var(--surface);
        }
        .rcard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .rcard-left {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .rcard-ticker {
          font-family: var(--font-mono);
          font-size: 14px;
          color: var(--gold);
          letter-spacing: .08em;
          font-weight: 400;
        }
        .rcard-score {
          font-family: var(--font-mono);
          font-size: 16px;
          font-weight: 400;
        }
        .rcard-status {
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: .15em;
          text-transform: uppercase;
        }
        .rcard-name {
          font-family: var(--font-ui);
          font-size: 11px;
          color: var(--text-dim);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .rcard-chips {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }
        .rcard-chip {
          font-family: var(--font-mono);
          font-size: 8px;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: var(--text-dim);
          border: 1px solid var(--rim);
          padding: 1px 5px;
        }
        .rcard-chip-fg {
          font-size: 7px;
          letter-spacing: .08em;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .rcard-thesis {
          font-family: var(--font-ui);
          font-size: 11px;
          line-height: 1.5;
          color: var(--text-mid);
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .rcard-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 2px;
        }
        .rcard-date {
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: .1em;
          color: var(--text-dim);
          text-transform: uppercase;
        }
        .rcard-badge {
          font-family: var(--font-mono);
          font-size: 8px;
          letter-spacing: .15em;
          color: var(--gold);
          border: 1px solid var(--gold-dim);
          padding: 2px 6px;
          text-transform: uppercase;
        }
      `}</style>
    </button>
  );
}
