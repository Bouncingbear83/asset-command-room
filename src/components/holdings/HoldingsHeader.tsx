import { CSSProperties } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface AccountCounts {
  total: number;
  sipp: number;
  isa: number;
  sippIsa: number;
  bordier: number;
}

interface Props {
  positionCount: number;
  accountCounts: AccountCounts;
  filteredCount: number;
  sortLabel: string;
  groupLabel: string;
  hasFilters: boolean;
}

export function HoldingsHeader({
  positionCount, accountCounts, filteredCount, sortLabel, groupLabel, hasFilters,
}: Props) {
  const isMobile = useIsMobile();

  const meta: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: isMobile ? 9 : 10,
    letterSpacing: isMobile ? "0.06em" : "0.08em",
    color: "var(--text-dim)",
  };

  const badge: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: isMobile ? 9 : 10,
    letterSpacing: isMobile ? "0.08em" : "0.12em",
    textTransform: "uppercase",
    color: "var(--text-mid)",
    padding: isMobile ? "2px 7px" : "3px 10px",
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

  const showing =
    !hasFilters && filteredCount === positionCount
      ? `Showing all ${positionCount} positions.`
      : `Showing ${filteredCount} of ${positionCount} positions.`;

  const padX = isMobile ? 12 : 16;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 4 : 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 6 : 10,
          flexWrap: "wrap",
          padding: `${isMobile ? 8 : 10}px ${padX}px 0`,
        }}
      >
        <span style={badgeAccent}>
          {positionCount} positions <span style={{ color: "var(--text-dim)" }}>+ CASH</span>
        </span>
        <span style={badge}>{accountCounts.sipp} SIPP</span>
        <span style={badge}>{accountCounts.isa} ISA</span>
        <span style={badge}>{accountCounts.sippIsa} SIPP+ISA</span>
        {accountCounts.bordier > 0 && (
          <span style={{ ...badge, color: "var(--gold)", borderColor: "rgba(201,168,76,0.4)" }}>
            {accountCounts.bordier} BORDIER · JPY
          </span>
        )}
      </div>

      <div
        style={{
          padding: `0 ${padX}px ${isMobile ? 6 : 8}px`,
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 8 : 12,
          flexWrap: "wrap",
        }}
      >
        <span style={meta}>{showing}</span>
        <span style={{ ...meta, opacity: 0.6 }}>(sort: {sortLabel} · group: {groupLabel})</span>
      </div>
    </div>
  );
}

export default HoldingsHeader;
