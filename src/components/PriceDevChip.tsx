import type { CSSProperties } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const chipStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 8,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  padding: "1px 4px",
  borderRadius: 2,
  background: "var(--red-dim)",
  color: "var(--red)",
  whiteSpace: "nowrap",
  display: "inline-block",
};

interface Props {
  /** True when abs(livePrice/priceAtLastScore - 1) > 0.2. */
  flag: boolean;
  /** Optional: the actual deviation percentage for the tooltip. */
  deviationPct?: number | null;
}

/**
 * Small warning chip when PRICE_DEV_FLAG triggers (>20% price move since score).
 * Renders nothing when flag is false.
 */
export function PriceDevChip({ flag, deviationPct }: Props) {
  if (!flag) return null;

  const detail = deviationPct !== null && deviationPct !== undefined
    ? `Price has moved ${deviationPct > 0 ? "+" : ""}${(deviationPct * 100).toFixed(0)}% since last score`
    : "Price has moved >20% since last score";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span style={chipStyle}>Review</span>
      </TooltipTrigger>
      <TooltipContent side="top" style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        background: "var(--panel)",
        border: "1px solid var(--rim)",
        color: "var(--text)",
        padding: "6px 8px",
        maxWidth: 200,
      }}>
        {detail}. Rescore consideration recommended.
      </TooltipContent>
    </Tooltip>
  );
}
