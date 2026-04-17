import { CSSProperties } from "react";

interface AccountCounts {
  total: number;
  sipp: number;
  isa: number;
  sippIsa: number;
}

interface Props {
  positionCount: number;          // includes CASH? caller decides
  accountCounts: AccountCounts;
  alertCount: number;             // non-CLEAR alerts in the full set
  filteredCount: number;
  sortLabel: string;
  groupLabel: string;
  hasFilters: boolean;
  onShowAlerts?: () => void;      // wires the alert banner CTA to apply filter
}

const meta: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.08em",
  color: "var(--text-dim)",
};

const badge: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--text-mid)",
  padding: "3px 10px",
  border: "1px solid var(--rim)",
  borderRadius: 2,
  whiteSpace: "nowrap",
};

const badgeAccent: CSSProperties = {
  ...badge,
  color: "var(--gold)",
  borderColor: "rgba(201,168,76,0.4)",
  background: "var(--gold-dim, rgba(201,168,76,0.12))",
};

export function HoldingsHeader({
  positionCount, accountCounts, alertCount, filteredCount, sortLabel, groupLabel, hasFilters, onShowAlerts,
}: Props) {
  const showing =
    !hasFilters && filteredCount === positionCount
      ? `Showing all ${positionCount} positions.`
      : `Showing ${filteredCount} of ${positionCount} positions.`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 16px 0" }}>
        <span style={badgeAccent}>{positionCount} positions <span style={{ color: "var(--text-dim)" }}>+ CASH</span></span>
        <span style={badge}>{accountCounts.sipp} SIPP</span>
        <span style={badge}>{accountCounts.isa} ISA</span>
        <span style={badge}>{accountCounts.sippIsa} SIPP+ISA</span>
        {alertCount > 0 && (
          <button
            type="button"
            onClick={onShowAlerts}
            title="Filter to non-clear alerts"
            style={{
              ...badge,
              cursor: "pointer",
              color: "var(--amber)",
              borderColor: "rgba(200,146,90,0.4)",
              background: "var(--amber-dim)",
              marginLeft: "auto",
            }}
          >
            ⚠ {alertCount} {alertCount === 1 ? "active alert" : "active alerts"} — show all
          </button>
        )}
      </div>

      <div style={{ padding: "0 16px 8px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={meta}>{showing}</span>
        <span style={{ ...meta, opacity: 0.6 }}>(sort: {sortLabel} · group: {groupLabel})</span>
      </div>
    </div>
  );
}

export default HoldingsHeader;
