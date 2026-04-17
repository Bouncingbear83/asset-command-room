import { CSSProperties, KeyboardEvent } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { AssetIntelligence, HeldStatus, Layer } from "@/types/intelligence";
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

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color = pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--amber)" : "var(--red)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 40 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", textAlign: "right" }}>
        {value}<span style={{ color: "var(--text-dim)", fontSize: 8 }}>/{max}</span>
      </span>
      <div style={{ height: 2, background: "var(--muted)", width: "100%" }}>
        <div style={{ height: 2, background: color, width: `${pct}%` }} />
      </div>
    </div>
  );
}

function LayerChip({ layer }: { layer: Layer | null }) {
  if (!layer) {
    return <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>—</span>;
  }
  const c = LAYER_PALETTE[layer];
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      fontFamily: "var(--font-mono)",
      fontSize: 9,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      background: c.bg,
      color: c.fg,
      border: `1px solid ${c.border}`,
      borderRadius: 2,
      whiteSpace: "nowrap",
    }}>
      {layer}
    </span>
  );
}

function StatusChip({ status }: { status: HeldStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 10px",
      fontFamily: "var(--font-mono)",
      fontSize: 9,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      borderRadius: 2,
      whiteSpace: "nowrap",
      ...style,
    }}>
      {status.replace("_", " ")}
    </span>
  );
}

function DisruptionBadge({ asset }: { asset: AssetIntelligence }) {
  if (!asset.disruption) {
    return (
      <span style={{
        display: "inline-block",
        padding: "3px 10px",
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        letterSpacing: "0.1em",
        color: "var(--text-dim)",
        border: "1px solid var(--rim)",
        borderRadius: 2,
        whiteSpace: "nowrap",
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
        display: "inline-block",
        padding: "3px 10px",
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        letterSpacing: "0.1em",
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        borderRadius: 2,
        whiteSpace: "nowrap",
      }}
    >
      {asset.disruption.status} {Math.round(asset.disruption.total)}
    </span>
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

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-label={ariaLabel}
      onClick={onToggle}
      onKeyDown={handleKey}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: 48,
        padding: "6px 12px",
        borderBottom: "1px solid var(--rim)",
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
      <div style={{ width: 96, flexShrink: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--text-mid)", letterSpacing: "0.04em" }}>
          {asset.ticker}
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
      </div>

      {/* Layer chip */}
      <div style={{ width: 84, flexShrink: 0 }}>
        <LayerChip layer={asset.layer} />
      </div>

      {/* Score (delta placeholder for later) */}
      {/* TODO: wire trend Δ from SCORE_LOG once hook exposes it */}
      <div style={{ width: 64, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 600, color: scoreColor(asset.score), lineHeight: 1 }}>
          {Math.round(asset.score)}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.1em", marginTop: 2 }}>
          /100
        </span>
      </div>

      {/* 6D bars */}
      <div style={{ flex: 1, minWidth: 360, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
        <MiniBar label="SUB"   value={asset.sub_scores.substrate}        max={25} />
        <MiniBar label="DEM"   value={asset.sub_scores.demand}           max={22} />
        <MiniBar label="MOAT"  value={asset.sub_scores.moat}             max={18} />
        <MiniBar label="VAL"   value={asset.sub_scores.valuation}        max={13} />
        <MiniBar label="MGMT"  value={asset.sub_scores.mgmt}             max={7} />
        <MiniBar label="DISR"  value={asset.sub_scores.disruption_score} max={15} />
      </div>

      {/* Disruption deep-dive badge */}
      <div style={{ width: 88, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
        <DisruptionBadge asset={asset} />
      </div>

      {/* Buy range */}
      <div style={{ width: 96, flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mid)", textAlign: "right" }}>
        {formatBuyRange(asset.buy_range.low, asset.buy_range.high, asset.buy_range.currency)}
      </div>

      {/* Status chip */}
      <div style={{ width: 110, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
        <StatusChip status={asset.held_status} />
      </div>

      {/* Chevron */}
      <div style={{ width: 16, flexShrink: 0, color: "var(--text-dim)", display: "flex", alignItems: "center" }}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </div>
    </div>
  );
}

export default AssetRow;
