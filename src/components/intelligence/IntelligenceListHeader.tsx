import { CSSProperties } from "react";
import { COL, SUB_LABELS } from "./columns";
import type { SortField } from "@/lib/url-state";
import "./IntelligenceListHeader.css";

interface Props {
  sortField: SortField;
  sortDir: "asc" | "desc";
  onSortChange: (field: SortField) => void;
}

const labelBase: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  color: "var(--text-dim)",
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  textAlign: "left",
};

function arrow(active: boolean, dir: "asc" | "desc"): string {
  if (!active) return "";
  return dir === "asc" ? " ▲" : " ▼";
}

export function IntelligenceListHeader({ sortField, sortDir, onSortChange }: Props) {
  const sortBtn = (label: string, field: SortField, align: "left" | "right" = "left") => {
    const active = sortField === field;
    const ariaSort: "ascending" | "descending" | "none" = active
      ? sortDir === "asc"
        ? "ascending"
        : "descending"
      : "none";
    return (
      <button
        type="button"
        aria-sort={ariaSort}
        onClick={() => onSortChange(field)}
        style={{
          ...labelBase,
          textAlign: align,
          color: active ? "var(--text-mid)" : "var(--text-dim)",
          width: "100%",
        }}
      >
        {label}{arrow(active, sortDir)}
      </button>
    );
  };

  return (
    <div
      className="intelligence-list-header"
      style={{
        display: "flex",
        alignItems: "center",
        gap: COL.rowGap,
        padding: `8px ${COL.rowPadX}px`,
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        borderBottom: "1px solid var(--rim)",
        position: "sticky",
        top: 0,
        zIndex: 5,
      }}
    >
      <div style={{ width: COL.ticker, flexShrink: 0 }}>{sortBtn("Ticker", "ticker")}</div>
      <div style={{ width: COL.layer, flexShrink: 0, textAlign: "center" }}>{sortBtn("Layer", "layer", "left")}</div>
      <div style={{ width: COL.stack, flexShrink: 0, textAlign: "center" }}>{sortBtn("Stack", "stack", "left")}</div>
      <div style={{ width: COL.score, flexShrink: 0 }}>{sortBtn("Score", "score")}</div>

      {/* 6D bar labels — non-sortable, mirrors AssetRow grid */}
      <div style={{ flex: COL.bars.flex, minWidth: COL.bars.minWidth, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
        {SUB_LABELS.map((l) => (
          <span key={l} style={{ ...labelBase, cursor: "default", textAlign: "right" }}>{l}</span>
        ))}
      </div>

      <div style={{ width: COL.lband, flexShrink: 0, textAlign: "center" }}>
        {sortBtn("L-band", "lband", "left")}
      </div>
      <div style={{ width: COL.disruption, flexShrink: 0, textAlign: "center" }}>
        {sortBtn("Disruption", "disruption", "left")}
      </div>
      <div className="asset-row-buy-range" style={{ width: COL.buyRange, flexShrink: 0, textAlign: "center" }}>
        {sortBtn("Buy Range", "buy_distance", "left")}
      </div>
      <div style={{ width: COL.asymmetry, flexShrink: 0, textAlign: "center" }}>
        {sortBtn("Asym", "asymmetry", "left")}
      </div>
      <div style={{ width: COL.status, flexShrink: 0, textAlign: "center" }}>
        <span style={{ ...labelBase, cursor: "default" }}>Status</span>
      </div>
      <div style={{ width: COL.chevron, flexShrink: 0 }} />
    </div>
  );
}

export default IntelligenceListHeader;
