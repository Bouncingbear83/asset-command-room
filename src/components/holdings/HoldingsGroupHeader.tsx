import { CSSProperties } from "react";
import type { LiveHolding } from "@/hooks/usePortfolioData";
import type { HoldingsGroupBy } from "@/lib/url-state-holdings";

interface Props {
  groupBy: Exclude<HoldingsGroupBy, "none">;
  groupValue: string;
  holdings: LiveHolding[];
  totalAum: number;                         // portfolio MV £ (for AUM %)
  weight?: { actual: number; target: number }; // layer-only
  /** Layer-only click handler — sets the layer filter to just this group. */
  onClick?: () => void;
}

function deviationColor(deviation: number): string {
  const a = Math.abs(deviation);
  if (a <= 1.5) return "var(--green)";
  if (a <= 3.5) return "var(--amber)";
  return "var(--red)";
}

const headerBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 20px",
  background: "rgba(28,28,48,0.18)",
  borderBottom: "1px solid var(--rim)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--text-mid)",
  width: "100%",
  textAlign: "left",
  border: "none",
  borderTop: "1px solid var(--rim)",
};

const labelStyle: CSSProperties = {
  fontWeight: 700,
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  color: "var(--gold)",
};

const dim: CSSProperties = { color: "var(--text-dim)" };
const sep = <span style={{ color: "var(--rim)" }}>·</span>;

function fmtGbp(n: number): string {
  return `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export function HoldingsGroupHeader({ groupBy, groupValue, holdings, totalAum, weight, onClick }: Props) {
  const mv = holdings.reduce((s, h) => s + (h.mv || 0), 0);
  const totalCostWeight = holdings.reduce((s, h) => s + (h.gl != null ? Math.abs(h.mv || 0) : 0), 0);
  const weightedGl = totalCostWeight > 0
    ? holdings.reduce((s, h) => s + (h.gl ?? 0) * Math.abs(h.mv || 0), 0) / totalCostWeight
    : 0;
  const aumPct = totalAum > 0 ? (mv / totalAum) * 100 : 0;
  const glColor = weightedGl >= 0 ? "var(--green)" : "var(--red)";

  let extra: React.ReactNode = null;

  if (groupBy === "layer" && weight) {
    const dev = weight.actual - weight.target;
    const devColor = deviationColor(dev);
    const tag = Math.abs(dev) <= 0.5 ? "ON" : dev > 0 ? "OVER" : "UNDER";
    extra = (
      <>
        {sep}
        <span>weight <span style={{ color: "var(--text-mid)" }}>{weight.actual.toFixed(1)}%</span></span>
        <span style={dim}>/ target {weight.target.toFixed(1)}%</span>
        <span style={{ color: devColor, fontWeight: 600 }}>
          {dev >= 0 ? "+" : ""}{dev.toFixed(1)} {tag}
        </span>
      </>
    );
  } else if (groupBy === "tier" || groupBy === "account") {
    extra = (
      <>
        {sep}
        <span style={dim}>AUM</span>
        <span style={{ color: "var(--text-mid)" }}>{aumPct.toFixed(1)}%</span>
      </>
    );
  }

  const interactive = Boolean(onClick);

  const content = (
    <>
      <span style={labelStyle}>{groupValue}</span>
      {sep}
      <span>{holdings.length} {holdings.length === 1 ? "position" : "positions"}</span>
      {sep}
      <span style={dim}>MV</span>
      <span style={{ color: "var(--text-mid)" }}>{fmtGbp(mv)}</span>
      {sep}
      <span style={dim}>avg G/L</span>
      <span style={{ color: glColor, fontWeight: 600 }}>
        {weightedGl >= 0 ? "+" : ""}{weightedGl.toFixed(1)}%
      </span>
      {extra}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        aria-label={`Filter to ${groupValue}`}
        onClick={onClick}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(28,28,48,0.32)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(28,28,48,0.18)")}
        style={{ ...headerBase, cursor: "pointer" }}
      >
        {content}
      </button>
    );
  }

  return <div style={headerBase}>{content}</div>;
}

export default HoldingsGroupHeader;
