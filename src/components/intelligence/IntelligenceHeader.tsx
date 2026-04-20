import { CSSProperties } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  totalAssets: number;
  filteredCount: number;
  sortLabel: string;
  groupLabel: string;
  hasFilters: boolean;
}

export function IntelligenceHeader({ totalAssets, filteredCount, sortLabel, groupLabel, hasFilters }: Props) {
  const isMobile = useIsMobile();

  const meta: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: isMobile ? 9 : 10,
    letterSpacing: isMobile ? "0.06em" : "0.08em",
    color: "var(--text-dim)",
  };

  const showing =
    !hasFilters && filteredCount === totalAssets
      ? `Showing all ${totalAssets} assets.`
      : `Showing ${filteredCount} of ${totalAssets} assets.`;

  return (
    <div
      style={{
        padding: isMobile ? "6px 12px" : "8px 16px",
        display: "flex",
        alignItems: "center",
        gap: isMobile ? 8 : 12,
        flexWrap: "wrap",
      }}
    >
      <span style={meta}>{showing}</span>
      <span style={{ ...meta, opacity: 0.6 }}>(sort: {sortLabel} · group: {groupLabel})</span>
    </div>
  );
}

export default IntelligenceHeader;
