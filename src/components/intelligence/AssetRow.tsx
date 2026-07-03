import { CSSProperties, KeyboardEvent } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { AssetIntelligence, BuyDistance, HeldStatus, Layer, ScoreTrend } from "@/types/intelligence";
import { AssetExpansion } from "./AssetExpansion";
import { COL } from "./columns";
import { profileChipStyle, subtypeChipStyle, PROFILE_LABEL, SUBTYPE_LABEL } from "./profileChips";
import { LBandPill } from "./LBandPill";
import { StackBadge } from "@/components/holdings/DriverChip";
import { AsymmetryPill } from "@/components/AsymmetryPill";
import { IrrBbPill } from "@/components/IrrBbPill";
import { ChinaRiskChip } from "@/components/ChinaRiskChip";
import "./AssetRow.css";

interface Props {
  asset: AssetIntelligence;
  expanded: boolean;
  onToggle: () => void;
}

// ── Visual tokens ───────────────────────────────────────────────────────────

const LAYER_PALETTE: Record<Layer, { bg: string; fg: string; border: string }> = {
  Compute:     { bg: "rgba(110,142,200,0.10)", fg: "#6e8ec8", border: "rgba(110,142,200,0.25)" },
  Energy:      { bg: "rgba(200,146,90,0.10)",  fg: "#c8925a", border: "rgba(200,146,90,0.25)" },
  Materials:   { bg: "rgba(200,168,110,0.10)", fg: "#c8a86e", border: "rgba(200,168,110,0.25)" },
  Biological:  { bg: "rgba(90,191,160,0.10)",  fg: "#5abfa0", border: "rgba(90,191,160,0.25)" },
  Sovereignty: { bg: "rgba(155,89,182,0.10)",  fg: "#9b59b6", border: "rgba(155,89,182,0.25)" },
  Robotics:    { bg: "rgba(52,152,219,0.10)",  fg: "#3498db", border: "rgba(52,152,219,0.25)" },
  Hedge:       { bg: "rgba(200,90,90,0.10)",   fg: "#c85a5a", border: "rgba(200,90,90,0.25)" },
};

const STATUS_STYLE: Record<HeldStatus, CSSProperties> = {
  HELD: {
    background: "var(--accent)",
    color: "var(--void)",
    border: "1px solid var(--accent)",
  },
  WATCHLIST: {
    background: "var(--muted)",
    color: "var(--text-mid)",
    border: "1px solid var(--rim)",
  },
  RESEARCH: {
    background: "var(--amber-dim)",
    color: "var(--amber)",
    border: "1px solid rgba(200,146,90,0.4)",
  },
  PRE_IPO: {
    background: "transparent",
    color: "var(--text-dim)",
    border: "2px dashed var(--text-dim)",
  },
  REJECTED: {
    background: "transparent",
    color: "var(--red)",
    border: "1px solid var(--red)",
    textDecoration: "line-through",
  },
  EXITED: {
    background: "transparent",
    color: "var(--text-dim)",
    border: "1px solid var(--text-dim)",
    textDecoration: "line-through",
  },
  DORMANT: {
    background: "rgba(156,163,175,0.10)",
    color: "rgb(156,163,175)", // gray-400, same family as Watchlist ARCHIVE
    border: "1px solid rgba(156,163,175,0.35)",
  },
};

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  GBX: "p",
  JPY: "¥",
};

function formatBuyRange(low: number | null, high: number | null, currency: string): string {
  if (low === null || high === null) return "—";
  const sym = CURRENCY_SYMBOL[currency.toUpperCase()];
  const fmt = (n: number) => (n >= 1000 ? n.toFixed(0) : n.toFixed(n < 10 ? 2 : 1));
  return sym ? `${sym}${fmt(low)}–${fmt(high)}` : `${currency} ${fmt(low)}–${fmt(high)}`;
}

function scoreColor(score: number): string {
  if (score >= 80) return "var(--green)";
  if (score >= 60) return "var(--amber)";
  return "var(--red)";
}

function disruptionColor(status: "GREEN" | "AMBER" | "RED"): { bg: string; fg: string; border: string } {
  switch (status) {
    case "GREEN": return { bg: "var(--green-dim)", fg: "var(--green)", border: "rgba(90,191,160,0.25)" };
    case "AMBER": return { bg: "var(--amber-dim)", fg: "var(--amber)", border: "rgba(200,146,90,0.25)" };
    case "RED":   return { bg: "var(--red-dim)",   fg: "var(--red)",   border: "rgba(200,90,90,0.25)" };
  }
}

// ── Sub-components ──────────────────────────────────────────────────────────

function trendColor(direction: ScoreTrend["direction"]): string {
  if (direction === "up")   return "var(--green)";
  if (direction === "down") return "var(--red)";
  return "var(--text-dim)";
}

function trendArrow(direction: ScoreTrend["direction"]): string {
  if (direction === "up")   return "↗";
  if (direction === "down") return "↘";
  if (direction === "flat") return "→";
  return "";
}

/** Compact trend indicator for the total-score column. */
function TrendIndicator({ trend }: { trend: ScoreTrend }) {
  if (trend.direction === null) return null;
  const color = trendColor(trend.direction);
  const arrow = trendArrow(trend.direction);
  const sign = trend.delta !== null && trend.delta > 0 ? "+" : "";
  return (
    <span
      title={trend.prior_value !== null ? `Prior: ${trend.prior_value}` : undefined}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        color,
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
      }}
    >
      {arrow}{trend.direction !== "flat" && trend.delta !== null ? `${sign}${trend.delta}` : ""}
    </span>
  );
}

/** Micro trend indicator for sub-score bars. */
function MicroTrend({ trend }: { trend: ScoreTrend }) {
  if (trend.direction === null) return null;
  const color = trendColor(trend.direction);
  const arrow = trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→";
  return (
    <span
      title={trend.prior_value !== null ? `Prior: ${trend.prior_value}` : undefined}
      style={{ fontFamily: "var(--font-mono)", fontSize: 8, color, marginLeft: 2 }}
    >
      {arrow}{trend.direction !== "flat" && trend.delta !== null ? Math.abs(trend.delta) : ""}
    </span>
  );
}

function MiniBar({ value, max, trend }: { value: number; max: number; trend?: ScoreTrend }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color = pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--amber)" : "var(--red)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 40 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", textAlign: "right" }}>
        {value}<span style={{ color: "var(--text-dim)", fontSize: 8 }}>/{max}</span>
        {trend && <MicroTrend trend={trend} />}
      </span>
      <div style={{ height: 2, background: "var(--muted)", width: "100%" }}>
        <div style={{ height: 2, background: color, width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Distance-to-buy-zone chip; replaces the old static buy-range column. */
function DistanceChip({
  buyDistance, currentPrice, low, high, currency,
}: {
  buyDistance: BuyDistance;
  currentPrice: number | null;
  low: number | null;
  high: number | null;
  currency: string;
}) {
  const baseChip: CSSProperties = {
    display: "block",
    width: "100%",
    padding: "3px 6px",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: "0.06em",
    textAlign: "center",
    borderRadius: 2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    boxSizing: "border-box",
  };
  const sym = CURRENCY_SYMBOL[currency.toUpperCase()] ?? "";
  const fmt = (n: number) => (n >= 1000 ? n.toFixed(0) : n.toFixed(n < 10 ? 2 : 1));
  const rangeStr = low !== null && high !== null
    ? (sym ? `${sym}${fmt(low)}–${fmt(high)}` : `${currency} ${fmt(low)}–${fmt(high)}`)
    : "—";
  const priceStr = currentPrice !== null ? `${sym || currency + " "}${fmt(currentPrice)}` : "n/a";
  const tooltip = `Current: ${priceStr} · Buy: ${rangeStr}`;

  if (buyDistance.status === "IN_ZONE") {
    return (
      <span title={tooltip} style={{
        ...baseChip,
        background: "var(--green-dim)",
        color: "var(--green)",
        border: "1px solid rgba(90,191,160,0.35)",
        textTransform: "uppercase",
      }}>IN ZONE</span>
    );
  }
  if (buyDistance.status === "ABOVE" && buyDistance.pct_from_zone !== null) {
    const pct = buyDistance.pct_from_zone;
    const color = pct > 20 ? "var(--red)" : pct > 5 ? "var(--amber)" : "var(--text-dim)";
    const bg = pct > 20 ? "var(--red-dim)" : pct > 5 ? "var(--amber-dim)" : "transparent";
    const border = pct > 20 ? "rgba(200,90,90,0.35)" : pct > 5 ? "rgba(200,146,90,0.35)" : "var(--rim)";
    return (
      <span title={tooltip} style={{ ...baseChip, color, background: bg, border: `1px solid ${border}` }}>
        +{pct.toFixed(pct >= 100 ? 0 : 1)}%
      </span>
    );
  }
  if (buyDistance.status === "BELOW" && buyDistance.pct_from_zone !== null) {
    return (
      <span title={tooltip} style={{
        ...baseChip,
        color: "var(--green)",
        background: "var(--green-dim)",
        border: "1px solid rgba(90,191,160,0.35)",
      }}>
        {buyDistance.pct_from_zone.toFixed(1)}%
      </span>
    );
  }
  if (buyDistance.status === "NO_PRICE") {
    return (
      <span title={tooltip} style={{
        ...baseChip,
        color: "var(--text-dim)",
        border: "1px dashed var(--rim)",
        background: "transparent",
      }}>{rangeStr}</span>
    );
  }
  // NO_RANGE
  return (
    <span title={tooltip} style={{
      ...baseChip,
      color: "var(--text-dim)",
      border: "none",
      background: "transparent",
    }}>—</span>
  );
}

function LayerChip({ layer }: { layer: Layer | null }) {
  if (!layer) {
    return (
      <span style={{
        display: "block",
        width: "100%",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--text-dim)",
        textAlign: "center",
      }}>—</span>
    );
  }
  const c = LAYER_PALETTE[layer];
  return (
    <span style={{
      display: "block",
      width: "100%",
      padding: "3px 6px",
      fontFamily: "var(--font-mono)",
      fontSize: 9,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      textAlign: "center",
      background: c.bg,
      color: c.fg,
      border: `1px solid ${c.border}`,
      borderRadius: 2,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      boxSizing: "border-box",
    }}>
      {layer}
    </span>
  );
}

function StatusChip({ status }: { status: HeldStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span style={{
      display: "block",
      width: "100%",
      padding: "3px 6px",
      fontFamily: "var(--font-mono)",
      fontSize: 9,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      textAlign: "center",
      borderRadius: 2,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      boxSizing: "border-box",
      ...style,
    }}>
      {status.replace("_", " ")}
    </span>
  );
}

function DisruptionBadge({ asset }: { asset: AssetIntelligence }) {
  const baseFill: CSSProperties = {
    display: "block",
    width: "100%",
    padding: "3px 6px",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.1em",
    textAlign: "center",
    borderRadius: 2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    boxSizing: "border-box",
  };
  if (!asset.disruption) {
    return (
      <span style={{
        ...baseFill,
        color: "var(--text-dim)",
        border: "1px solid var(--rim)",
      }}>
        — n/a
      </span>
    );
  }
  const c = disruptionColor(asset.disruption.status);
  return (
    <span
      title={`Last assessed: ${asset.disruption.last_checked || "—"}`}
      style={{
        ...baseFill,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      {asset.disruption.status} {Math.round(asset.disruption.total)}
    </span>
  );
}

// ── Mobile-only inline (fit-content) chip variants ─────────────────────────

function StatusChipInline({ status }: { status: HeldStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span style={{
      padding: "2px 6px", fontFamily: "var(--font-mono)", fontSize: 8,
      letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: 2,
      whiteSpace: "nowrap", flexShrink: 0, ...style,
    }}>{status.replace("_", " ")}</span>
  );
}

function LayerChipInline({ layer }: { layer: Layer }) {
  const c = LAYER_PALETTE[layer];
  return (
    <span style={{
      padding: "2px 6px", fontFamily: "var(--font-mono)", fontSize: 8,
      letterSpacing: "0.1em", textTransform: "uppercase", borderRadius: 2,
      whiteSpace: "nowrap", flexShrink: 0,
      background: c.bg, color: c.fg, border: `1px solid ${c.border}`,
    }}>{layer}</span>
  );
}

function DisruptionBadgeInline({ asset }: { asset: AssetIntelligence }) {
  if (!asset.disruption) return null;
  const c = disruptionColor(asset.disruption.status);
  return (
    <span style={{
      padding: "2px 6px", fontFamily: "var(--font-mono)", fontSize: 8,
      letterSpacing: "0.1em", borderRadius: 2, whiteSpace: "nowrap",
      flexShrink: 0, background: c.bg, color: c.fg, border: `1px solid ${c.border}`,
    }}>{asset.disruption.status} {Math.round(asset.disruption.total)}</span>
  );
}

// ── Profile chip pair (RETURN_PROFILE + optional COMPOUNDER subtype) ────────

function ProfileChips({ asset, compact = false }: { asset: AssetIntelligence; compact?: boolean }) {
  if (!asset.return_profile) return null;
  const profileStyle = profileChipStyle(asset.return_profile);
  const subtypeStyle = asset.compounder_subtype ? subtypeChipStyle(asset.compounder_subtype) : null;
  const sizeOverride: CSSProperties = compact ? { fontSize: 8, padding: "1px 5px", letterSpacing: "0.08em" } : {};
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ ...profileStyle, ...sizeOverride }} title={`Return profile: ${asset.return_profile}`}>
        {PROFILE_LABEL[asset.return_profile]}
      </span>
      {asset.compounder_subtype && subtypeStyle && (
        <span style={{ ...subtypeStyle, ...sizeOverride }} title={`Subtype: ${asset.compounder_subtype}`}>
          {SUBTYPE_LABEL[asset.compounder_subtype]}
        </span>
      )}
    </div>
  );
}

// ── Main row ────────────────────────────────────────────────────────────────

export function AssetRow({ asset, expanded, onToggle }: Props) {
  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onToggle();
    }
  };

  const ariaLabel = `${asset.ticker} ${asset.name}, score ${asset.score}, status ${asset.held_status}`;

  const sharedHandlers = {
    role: "button" as const,
    tabIndex: 0,
    "aria-expanded": expanded,
    "aria-label": ariaLabel,
    onClick: onToggle,
    onKeyDown: handleKey,
  };

  return (
    <div style={{ borderBottom: "1px solid var(--rim)" }}>
      {/* ── Mobile stacked card (≤767px) ────────────────────────── */}
      <div
        {...sharedHandlers}
        className="asset-row-mobile"
        style={{
          background: expanded ? "rgba(28,28,48,0.30)" : "transparent",
          outline: "none",
        }}
      >
        <div className="asset-row-mobile-line1">
          <span className="asset-row-mobile-ticker">{asset.ticker}</span>
          <StatusChipInline status={asset.held_status} />
          <span className="asset-row-mobile-score" style={{ color: scoreColor(asset.score) }}>
            {Math.round(asset.score)}
            <span style={{ color: "var(--text-dim)", fontSize: 9, marginLeft: 2 }}>/100</span>
          </span>
          <span style={{ color: "var(--text-dim)", display: "flex", alignItems: "center" }}>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </div>

        <div className="asset-row-mobile-line2">
          <span className="asset-row-mobile-name">{asset.name}</span>
          {asset.layer && <LayerChipInline layer={asset.layer} />}
          {asset.substrate_level && <LBandPill level={asset.substrate_level} stackLayer={asset.stack_layer} />}
          {asset.stack_layer && <StackBadge value={asset.stack_layer} />}
          <DisruptionBadgeInline asset={asset} />
        </div>

        {asset.return_profile && (
          <div style={{ padding: "0 10px 4px" }}>
            <ProfileChips asset={asset} compact />
          </div>
        )}

        <div className="asset-row-mobile-bars">
          <MiniBar value={asset.sub_scores.substrate}        max={27} trend={asset.trend.substrate} />
          <MiniBar value={asset.sub_scores.demand}           max={22} trend={asset.trend.demand} />
          <MiniBar value={asset.sub_scores.moat}             max={18} trend={asset.trend.moat} />
          <MiniBar value={asset.sub_scores.valuation}        max={10} trend={asset.trend.valuation} />
          <MiniBar value={asset.sub_scores.mgmt}             max={7}  trend={asset.trend.mgmt} />
          <MiniBar value={asset.sub_scores.disruption_score} max={16} trend={asset.trend.disruption} />
        </div>

        <div className="asset-row-mobile-line4" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DistanceChip
            buyDistance={asset.buy_distance}
            currentPrice={asset.current_price}
            low={asset.buy_range.low}
            high={asset.buy_range.high}
            currency={asset.buy_range.currency}
          />
          {asset.liveAsymmetry.baseRatio !== null && <AsymmetryPill asymmetry={asset.liveAsymmetry} />}
        </div>
      </div>

      {/* ── Desktop flex row (≥768px) ───────────────────────────── */}
      <div
        {...sharedHandlers}
        className="asset-row-desktop"
        style={{
          alignItems: "center",
          gap: COL.rowGap,
          minHeight: 48,
          padding: `6px ${COL.rowPadX}px`,
          background: expanded ? "rgba(28,28,48,0.30)" : "transparent",
          cursor: "pointer",
          transition: "background 120ms ease",
          outline: "none",
        }}
        onMouseEnter={(e) => {
          if (!expanded) (e.currentTarget as HTMLDivElement).style.background = "rgba(28,28,48,0.18)";
        }}
        onMouseLeave={(e) => {
          if (!expanded) (e.currentTarget as HTMLDivElement).style.background = "transparent";
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "inset 0 0 0 1px var(--gold-dim)";
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        }}
      >
        {/* Ticker + name + dual-account badge */}
        <div style={{ width: COL.ticker, minWidth: COL.ticker, maxWidth: COL.ticker, flexShrink: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--text-mid)", letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: 4 }}>
            {asset.ticker}
            {asset.framing?.china_exposure_flag && <ChinaRiskChip flag={asset.framing.china_exposure_flag} />}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
            {asset.name}
          </span>
          {asset.position?.account === "SIPP+ISA" && (
            <span style={{
              display: "inline-block",
              marginTop: 2,
              padding: "1px 4px",
              width: "fit-content",
              fontFamily: "var(--font-mono)",
              fontSize: 7,
              letterSpacing: "0.1em",
              color: "var(--accent)",
              border: "1px solid rgba(110,142,200,0.4)",
              borderRadius: 2,
            }}>
              SIPP+ISA
            </span>
          )}
          {asset.return_profile && (
            <div style={{ marginTop: 3 }}>
              <ProfileChips asset={asset} compact />
            </div>
          )}
        </div>

        {/* Layer chip */}
        <div style={{ width: COL.layer, minWidth: COL.layer, maxWidth: COL.layer, flexShrink: 0 }}>
          <LayerChip layer={asset.layer} />
        </div>

        {/* Stack layer (v2.5) */}
        <div style={{ width: COL.stack, minWidth: COL.stack, maxWidth: COL.stack, flexShrink: 0, textAlign: "center" }}>
          {asset.stack_layer ? <StackBadge value={asset.stack_layer} /> : <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>—</span>}
        </div>

        {/* Score + trend Δ */}
        <div style={{ width: COL.score, minWidth: COL.score, maxWidth: COL.score, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 600, color: scoreColor(asset.score), lineHeight: 1 }}>
            {Math.round(asset.score)}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.1em" }}>/100</span>
            <TrendIndicator trend={asset.trend.score} />
          </div>
        </div>

        {/* 6D bars (order = SUB / DEM / MOAT / MoS / MGMT / DISR; v3.13 weights) */}
        <div style={{ flex: COL.bars.flex, minWidth: COL.bars.minWidth, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
          <MiniBar value={asset.sub_scores.substrate}        max={27} trend={asset.trend.substrate} />
          <MiniBar value={asset.sub_scores.demand}           max={22} trend={asset.trend.demand} />
          <MiniBar value={asset.sub_scores.moat}             max={18} trend={asset.trend.moat} />
          <MiniBar value={asset.sub_scores.valuation}        max={10} trend={asset.trend.valuation} />
          <MiniBar value={asset.sub_scores.mgmt}             max={7}  trend={asset.trend.mgmt} />
          <MiniBar value={asset.sub_scores.disruption_score} max={16} trend={asset.trend.disruption} />
        </div>

        {/* L-band (v2.5) */}
        <div style={{ width: COL.lband, minWidth: COL.lband, maxWidth: COL.lband, flexShrink: 0, textAlign: "center" }}>
          <LBandPill level={asset.substrate_level} stackLayer={asset.stack_layer} />
        </div>


        <div style={{ width: COL.disruption, minWidth: COL.disruption, maxWidth: COL.disruption, flexShrink: 0 }}>
          <DisruptionBadge asset={asset} />
        </div>

        {/* Distance chip — replaces static buy range. Hidden below 1100px. */}
        <div className="asset-row-buy-range" style={{ width: COL.buyRange, minWidth: COL.buyRange, maxWidth: COL.buyRange, flexShrink: 0 }}>
          <DistanceChip
            buyDistance={asset.buy_distance}
            currentPrice={asset.current_price}
            low={asset.buy_range.low}
            high={asset.buy_range.high}
            currency={asset.buy_range.currency}
          />
        </div>

        {/* Asymmetry pill */}
        <div style={{ width: COL.asymmetry, minWidth: COL.asymmetry, maxWidth: COL.asymmetry, flexShrink: 0, display: "flex", justifyContent: "center" }}>
          <AsymmetryPill asymmetry={asset.liveAsymmetry} />
        </div>
        <div style={{ width: COL.irrBb, minWidth: COL.irrBb, maxWidth: COL.irrBb, flexShrink: 0, display: "flex", justifyContent: "center" }}>
          {asset.irrBbResult ? <IrrBbPill result={asset.irrBbResult} /> : <span style={{ color: "var(--text-dim)", opacity: 0.4, fontFamily: "var(--font-mono)", fontSize: 10 }}>—</span>}
        </div>
        <div style={{ width: COL.status, minWidth: COL.status, maxWidth: COL.status, flexShrink: 0 }}>
          <StatusChip status={asset.held_status} />
        </div>

        {/* Chevron */}
        <div style={{ width: COL.chevron, minWidth: COL.chevron, maxWidth: COL.chevron, flexShrink: 0, color: "var(--text-dim)", display: "flex", alignItems: "center" }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </div>

      {expanded && <AssetExpansion asset={asset} />}
    </div>
  );
}

export default AssetRow;
