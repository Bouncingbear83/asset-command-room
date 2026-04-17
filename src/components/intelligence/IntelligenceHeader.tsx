import { CSSProperties } from "react";

interface Props {
  totalAssets: number;
  filteredCount: number;
  sortLabel: string;
  groupLabel: string;
  hasFilters: boolean;
}

const meta: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.08em",
  color: "var(--text-dim)",
};

export function IntelligenceHeader({ totalAssets, filteredCount, sortLabel, groupLabel, hasFilters }: Props) {
  const showing =
    !hasFilters && filteredCount === totalAssets
      ? `Showing all ${totalAssets} assets.`
      : `Showing ${filteredCount} of ${totalAssets} assets.`;

  return (
    <div style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={meta}>{showing}</span>
      <span style={{ ...meta, opacity: 0.6 }}>(sort: {sortLabel} · group: {groupLabel})</span>
    </div>
  );
}

export default IntelligenceHeader;
