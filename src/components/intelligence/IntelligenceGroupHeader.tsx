import { CSSProperties } from "react";
import type { AssetIntelligence } from "@/types/intelligence";
import type { GroupBy } from "@/lib/url-state";

interface Props {
  groupBy: Exclude<GroupBy, "none">;
  groupValue: string;
  assets: AssetIntelligence[];
  /** Layer-only: actual/target weights from the LAYERS sheet. */
  weight?: { actual: number; target: number };
  /** Layer-only click handler — sets the layer filter to just this group. */
  onClick?: () => void;
}

function avgScore(assets: AssetIntelligence[]): number {
  if (assets.length === 0) return 0;
  return assets.reduce((sum, a) => sum + a.score, 0) / assets.length;
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

export function IntelligenceGroupHeader({ groupBy, groupValue, assets, weight, onClick }: Props) {
  const avg = avgScore(assets).toFixed(0);
  const heldCount = assets.filter((a) => a.held_status === "HELD").length;
  const wlCount = assets.filter((a) => a.held_status === "WATCHLIST").length;
  const otherCount = assets.length - heldCount - wlCount;

  const labelStyle: CSSProperties = {
    fontWeight: 700,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "var(--gold)",
  };
  const sep = <span style={{ color: "var(--rim)" }}>·</span>;
  const dim: CSSProperties = { color: "var(--text-dim)" };

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
  } else if (groupBy === "tier") {
    const aumPct = assets.reduce((sum, a) => sum + (a.position?.aum_pct ?? 0), 0);
    if (aumPct > 0) {
      extra = (
        <>
          {sep}
          <span style={dim}>portfolio AUM</span>
          <span style={{ color: "var(--text-mid)" }}>{aumPct.toFixed(1)}%</span>
        </>
      );
    }
  }

  const interactive = Boolean(onClick);

  const content = (
    <>
      <span style={labelStyle}>{groupValue}</span>
      {sep}
      <span>{assets.length} {assets.length === 1 ? "asset" : "assets"}</span>
      {(heldCount > 0 || wlCount > 0 || otherCount > 0) && (
        <span style={dim}>
          ({heldCount} held · {wlCount} WL{otherCount > 0 ? ` · ${otherCount} other` : ""})
        </span>
      )}
      {sep}
      <span style={dim}>avg score</span>
      <span style={{ color: "var(--text-mid)" }}>{avg}</span>
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

export default IntelligenceGroupHeader;
