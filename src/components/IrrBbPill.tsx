import { type CSSProperties } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type IrrBbResult, type IrrBbBand, formatIrr, formatYears } from "@/lib/computeIrrBb";

const BAND_STYLE: Record<string, CSSProperties> = {
  DEPLOY:     { background: "rgba(90,191,160,0.12)", color: "var(--green)",    border: "1px solid rgba(90,191,160,0.2)" },
  ACTIONABLE: { background: "rgba(200,146,90,0.12)", color: "var(--amber)",    border: "1px solid rgba(200,146,90,0.2)" },
  HOLD_ONLY:  { background: "rgba(200,90,90,0.10)",  color: "var(--red)",      border: "1px solid rgba(200,90,90,0.2)" },
  DORMANT:    { background: "transparent",            color: "var(--text-dim)", border: "1px solid rgba(80,80,120,0.15)" },
};

const BASE: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.06em",
  padding: "2px 6px",
  borderRadius: 3,
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  whiteSpace: "nowrap",
};

interface Props {
  result: IrrBbResult;
  /** Show "N/A" instead of "---" for names with no bb_target_date by design. */
  showNa?: boolean;
}

export function IrrBbPill({ result, showNa }: Props) {
  const { irrBb, band, nearTerm, aboveBull, priceDevFlag, yearsRemaining,
    bbTargetDate, divYield, livePrice, bullBase } = result;

  // Null state: no IRR-BB computed
  if (irrBb === null) {
    return (
      <span style={{ ...BASE, color: "var(--text-dim)", opacity: 0.4 }}>
        {showNa ? "N/A" : "---"}
      </span>
    );
  }

  const style: CSSProperties = {
    ...BASE,
    ...(BAND_STYLE[band ?? "DORMANT"]),
  };

  // Warning indicators
  const arrow = aboveBull ? "▼" : null;
  const nearChip = nearTerm ? (
    <span style={{ fontSize: 7, color: "var(--amber)", marginLeft: 1 }} title="Target date < 1 year">◆</span>
  ) : null;
  const devChip = priceDevFlag ? (
    <span style={{ fontSize: 7, color: "var(--red)", marginLeft: 1 }} title="Price >20% from last score">!</span>
  ) : null;

  const tooltipLines = [
    `IRR-BB: ${formatIrr(irrBb)} pa`,
    `Band: ${band}`,
    "",
    bullBase !== null ? `Bull base: ${bullBase.toLocaleString()}` : null,
    livePrice !== null ? `Live price: ${livePrice.toLocaleString()}` : null,
    bbTargetDate ? `Target date: ${bbTargetDate}` : null,
    yearsRemaining !== null ? `Years remaining: ${formatYears(yearsRemaining)}` : null,
    divYield > 0 ? `Div yield: ${(divYield * 100).toFixed(1)}%` : null,
    "",
    priceDevFlag ? "⚠ Price deviation >20% from last score" : null,
    nearTerm ? "◆ Near-term target (< 1yr)" : null,
    aboveBull ? "▼ Price above bull base" : null,
  ].filter(Boolean).join("\n");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span style={style}>
          {arrow && <span style={{ fontSize: 8 }}>{arrow}</span>}
          {formatIrr(irrBb)}
          {nearChip}
          {devChip}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        whiteSpace: "pre-line",
        background: "var(--panel)",
        border: "1px solid var(--rim)",
        color: "var(--text)",
        padding: "8px 10px",
        lineHeight: 1.6,
        maxWidth: 220,
      }}>
        {tooltipLines}
      </TooltipContent>
    </Tooltip>
  );
}
